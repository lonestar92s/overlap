/**
 * Script to geocode all corrupted venues and output corrections
 * This will geocode all venues once, then output the results in a format
 * that can be added to VENUE_CORRECTIONS
 * 
 * Run with: node src/scripts/geocodeAllCorruptedVenues.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Venue = require('../models/Venue');
const geocodingService = require('../services/geocodingService');

// Country bounds for validation
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
  const venues = await Venue.find({ coordinates: { $exists: true, $ne: null } }).lean();
  const corrupted = [];
  
  for (const venue of venues) {
    const coords = venue.coordinates;
    if (!coords || !Array.isArray(coords) || coords.length !== 2) continue;
    
    const [lng, lat] = coords;
    const country = venue.country || 'Unknown';
    
    if (typeof lng !== 'number' || typeof lat !== 'number' || isNaN(lng) || isNaN(lat)) {
      continue;
    }
    
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      corrupted.push({ venue, reason: 'Coordinates outside world bounds' });
      continue;
    }
    
    const bounds = COUNTRY_BOUNDS[country];
    if (bounds) {
      if (lat < bounds.latMin || lat > bounds.latMax || lng < bounds.lngMin || lng > bounds.lngMax) {
        corrupted.push({ venue, reason: `Coordinates outside ${country} bounds` });
      }
    }
  }
  
  return corrupted;
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const GEOCODE_DELAY_MS = 600;

async function geocodeAllCorruptedVenues(dryRun = true) {
  const corrupted = await findCorruptedVenues();
  
  console.log(`\n📊 Found ${corrupted.length} corrupted venues to geocode\n`);
  console.log('This will take approximately ' + Math.ceil(corrupted.length * GEOCODE_DELAY_MS / 1000 / 60) + ' minutes\n');
  
  const corrections = {};
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < corrupted.length; i++) {
    const { venue } = corrupted[i];
    const venueId = venue.venueId || venue.apiId;
    
    if (!venueId) {
      console.log(`⚠️  Skipping ${venue.name} - no venueId`);
      failCount++;
      continue;
    }
    
    console.log(`[${i + 1}/${corrupted.length}] Geocoding: ${venue.name} (ID: ${venueId})`);
    console.log(`   City: ${venue.city}, Country: ${venue.country}`);
    
    // Rate limiting
    if (i > 0) {
      await delay(GEOCODE_DELAY_MS);
    }
    
    try {
      const geocoded = await geocodingService.geocodeVenueCoordinates(
        venue.name,
        venue.city,
        venue.country
      );
      
      if (geocoded && Array.isArray(geocoded) && geocoded.length === 2) {
        const [lng, lat] = geocoded;
        
        // Validate coordinates are within country bounds
        const bounds = COUNTRY_BOUNDS[venue.country];
        if (bounds && (lat < bounds.latMin || lat > bounds.latMax || lng < bounds.lngMin || lng > bounds.lngMax)) {
          console.log(`   ⚠️  Geocoded coordinates still outside bounds: [${lng}, ${lat}]`);
          failCount++;
          continue;
        }
        
        corrections[venueId] = {
          name: venue.name,
          city: venue.city,
          country: venue.country,
          correctCoordinates: geocoded
        };
        
        console.log(`   ✅ Geocoded: [${lng}, ${lat}]`);
        successCount++;
        
        if (!dryRun) {
          await Venue.updateOne(
            { _id: venue._id },
            { 
              $set: { 
                coordinates: geocoded,
                location: {
                  type: 'Point',
                  coordinates: geocoded
                },
                lastUpdated: new Date()
              } 
            }
          );
          console.log(`   💾 Updated in database`);
        }
      } else {
        console.log(`   ❌ Geocoding failed - no coordinates returned`);
        failCount++;
      }
    } catch (err) {
      console.log(`   ❌ Geocoding error: ${err.message}`);
      failCount++;
    }
    
    console.log('');
  }
  
  console.log('\n📊 Summary:');
  console.log(`   Total: ${corrupted.length}`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Failed: ${failCount}`);
  
  // Output corrections in format ready to add to VENUE_CORRECTIONS
  console.log('\n\n// Add these to VENUE_CORRECTIONS:\n');
  for (const [venueId, correction] of Object.entries(corrections)) {
    console.log(`  ${venueId}: {`);
    console.log(`    name: '${correction.name.replace(/'/g, "\\'")}',`);
    console.log(`    city: '${correction.city.replace(/'/g, "\\'")}',`);
    console.log(`    country: '${correction.country}',`);
    console.log(`    correctCoordinates: [${correction.correctCoordinates[0]}, ${correction.correctCoordinates[1]}] // [lng, lat]`);
    console.log(`  },`);
  }
  
  return corrections;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--fix');
  
  console.log('🌍 Geocode All Corrupted Venues');
  console.log('================================');
  console.log(`Mode: ${dryRun ? 'DRY RUN (geocode only, no database updates)' : 'APPLY FIXES (geocode and update database)'}`);
  console.log('');
  
  try {
    await connectDB();
    await geocodeAllCorruptedVenues(dryRun);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

main();


