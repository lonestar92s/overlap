/**
 * Script to identify and fix corrupted venue coordinates
 * 
 * Run with: node src/scripts/fixCorruptedVenueCoordinates.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Venue = require('../models/Venue');
const geocodingService = require('../services/geocodingService');

// Known corrupted venues with their correct coordinates
const VENUE_CORRECTIONS = {
  // Vitality Stadium - Bournemouth, UK (not New York!)
  504: {
    name: 'Vitality Stadium',
    city: 'Bournemouth',
    country: 'England',
    correctCoordinates: [-1.8384, 50.7352] // [lng, lat] - GeoJSON format
  },
  // Emirates Stadium - London, UK (not New Zealand!)
  494: {
    name: 'Emirates Stadium', 
    city: 'London',
    country: 'England',
    correctCoordinates: [-0.1086, 51.5549] // [lng, lat]
  },
  // St. James' Park - Newcastle, UK (correct longitude but wrong latitude)
  562: {
    name: "St. James' Park",
    city: 'Newcastle upon Tyne',
    country: 'England',
    correctCoordinates: [-1.6217, 54.9756] // [lng, lat]
  }
};

// Sanity check: venue coordinates should be within reasonable bounds for their country
const COUNTRY_BOUNDS = {
  'England': { latMin: 49.9, latMax: 55.8, lngMin: -6.0, lngMax: 2.0 },
  'UK': { latMin: 49.9, latMax: 60.9, lngMin: -8.0, lngMax: 2.0 },
  'Scotland': { latMin: 54.6, latMax: 60.9, lngMin: -8.0, lngMax: -0.7 },
  'Wales': { latMin: 51.4, latMax: 53.4, lngMin: -5.3, lngMax: -2.6 },
  'France': { latMin: 41.3, latMax: 51.1, lngMin: -5.1, lngMax: 9.6 },
  'Spain': { latMin: 36.0, latMax: 43.8, lngMin: -9.3, lngMax: 4.3 },
  'Germany': { latMin: 47.3, latMax: 55.1, lngMin: 5.9, lngMax: 15.0 },
  'Italy': { latMin: 35.5, latMax: 47.1, lngMin: 6.6, lngMax: 18.5 },
};

async function connectDB() {
  const mongoUri = process.env.MONGO_URL || process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MongoDB URI not found in environment variables');
  }
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB');
}

async function findCorruptedVenues() {
  console.log('\n🔍 Scanning for corrupted venue coordinates...\n');
  
  const venues = await Venue.find({ coordinates: { $exists: true, $ne: null } }).lean();
  const corrupted = [];
  
  for (const venue of venues) {
    const coords = venue.coordinates;
    if (!coords || !Array.isArray(coords) || coords.length !== 2) continue;
    
    const [lng, lat] = coords; // GeoJSON format: [longitude, latitude]
    const country = venue.country || 'Unknown';
    
    // Check if coordinates are valid numbers
    if (typeof lng !== 'number' || typeof lat !== 'number' || isNaN(lng) || isNaN(lat)) {
      corrupted.push({ venue, reason: 'Invalid coordinate types' });
      continue;
    }
    
    // Check if coordinates are within world bounds
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      corrupted.push({ venue, reason: 'Coordinates outside world bounds' });
      continue;
    }
    
    // Check if coordinates are reasonable for the country
    const bounds = COUNTRY_BOUNDS[country];
    if (bounds) {
      if (lat < bounds.latMin || lat > bounds.latMax || lng < bounds.lngMin || lng > bounds.lngMax) {
        corrupted.push({ 
          venue, 
          reason: `Coordinates outside ${country} bounds`,
          expected: bounds,
          actual: { lat, lng }
        });
      }
    }
  }
  
  return corrupted;
}

// Rate limiting helper - LocationIQ allows 2 requests/second
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const GEOCODE_DELAY_MS = 600; // 600ms between requests to stay well under 2/sec limit

async function fixCorruptedVenues(dryRun = true, skipGeocode = false) {
  const corrupted = await findCorruptedVenues();
  
  console.log(`\n📊 Found ${corrupted.length} venues with potentially corrupted coordinates:\n`);
  
  if (skipGeocode) {
    console.log('⏭️  Skipping geocoding (--no-geocode flag set). Only applying known corrections.\n');
  }
  
  let geocodeCount = 0;
  
  for (const { venue, reason, expected, actual } of corrupted) {
    console.log(`  ❌ ${venue.name} (ID: ${venue.venueId || venue.apiId || venue._id})`);
    console.log(`     City: ${venue.city}, Country: ${venue.country}`);
    console.log(`     Current coords: [${venue.coordinates[0]}, ${venue.coordinates[1]}]`);
    console.log(`     Issue: ${reason}`);
    if (expected && actual) {
      console.log(`     Expected bounds: lat ${expected.latMin}-${expected.latMax}, lng ${expected.lngMin}-${expected.lngMax}`);
      console.log(`     Actual: lat ${actual.lat}, lng ${actual.lng}`);
    }
    
    // Check if we have a known correction
    const venueId = venue.venueId || venue.apiId;
    const correction = VENUE_CORRECTIONS[venueId];
    
    if (correction) {
      console.log(`     ✅ Known correction available: [${correction.correctCoordinates[0]}, ${correction.correctCoordinates[1]}]`);
      
      if (!dryRun) {
        await Venue.updateOne(
          { _id: venue._id },
          { $set: { coordinates: correction.correctCoordinates } }
        );
        console.log(`     💾 FIXED!`);
      }
    } else if (!skipGeocode) {
      // Try to geocode (with rate limiting)
      console.log(`     🔍 Attempting to geocode...`);
      
      // Rate limit: wait between geocode requests
      if (geocodeCount > 0) {
        console.log(`     ⏳ Rate limiting: waiting ${GEOCODE_DELAY_MS}ms...`);
        await delay(GEOCODE_DELAY_MS);
      }
      geocodeCount++;
      
      try {
        const geocoded = await geocodingService.geocodeVenueCoordinates(
          venue.name,
          venue.city,
          venue.country
        );
        if (geocoded) {
          console.log(`     ✅ Geocoded: [${geocoded[0]}, ${geocoded[1]}]`);
          if (!dryRun) {
            await Venue.updateOne(
              { _id: venue._id },
              { $set: { coordinates: geocoded } }
            );
            console.log(`     💾 FIXED!`);
          }
        } else {
          console.log(`     ⚠️ Could not geocode - manual fix needed`);
        }
      } catch (err) {
        console.log(`     ⚠️ Geocoding error: ${err.message}`);
      }
    } else {
      console.log(`     ⏭️  Skipping geocode (no known correction)`);
    }
    console.log('');
  }
  
  console.log(`\n📊 Summary: ${geocodeCount} geocode API calls made`);

  if (dryRun) {
    console.log('\n📝 This was a DRY RUN. To apply corrections:');
    console.log('   node src/scripts/fixCorruptedVenueCoordinates.js --fix');
    if (!skipGeocode) {
      console.log('   (or --fix --no-geocode to skip geocoding)\n');
    }
  } else {
    console.log('\n✅ Corrections applied!\n');
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--fix');
  const skipGeocode = args.includes('--no-geocode');
  
  console.log('🔧 Venue Coordinate Fixer');
  console.log('========================');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLY FIXES'}`);
  console.log(`Geocoding: ${skipGeocode ? 'DISABLED' : 'ENABLED (with rate limiting)'}`);
  console.log('');
  console.log('Usage:');
  console.log('  node src/scripts/fixCorruptedVenueCoordinates.js           # Dry run, with geocoding');
  console.log('  node src/scripts/fixCorruptedVenueCoordinates.js --fix     # Apply fixes, with geocoding');
  console.log('  node src/scripts/fixCorruptedVenueCoordinates.js --no-geocode  # Dry run, known corrections only');
  console.log('  node src/scripts/fixCorruptedVenueCoordinates.js --fix --no-geocode  # Apply only known corrections');
  
  try {
    await connectDB();
    await fixCorruptedVenues(dryRun, skipGeocode);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

main();

