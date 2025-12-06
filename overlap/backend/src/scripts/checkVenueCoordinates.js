/**
 * Script to check venue coordinates in the database
 * 
 * Run with: node src/scripts/checkVenueCoordinates.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Venue = require('../models/Venue');

// Venues to check
const VENUES_TO_CHECK = {
  562: {
    name: "St. James' Park",
    city: 'Newcastle upon Tyne',
    expectedCoordinates: [-1.621667, 54.975556]
  },
  546: {
    name: 'Elland Road',
    city: 'Leeds',
    expectedCoordinates: [-1.572222, 53.777778]
  }
};

async function connectDB() {
  const mongoUri = process.env.MONGO_URL || process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MongoDB URI not found in environment variables');
  }
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB');
}

async function checkVenueCoordinates() {
  console.log('\n🔍 Checking venue coordinates in database...\n');
  
  for (const [venueId, venueInfo] of Object.entries(VENUES_TO_CHECK)) {
    const venueIdNum = parseInt(venueId);
    console.log(`📍 Checking: ${venueInfo.name} (ID: ${venueIdNum})`);
    console.log(`   City: ${venueInfo.city}`);
    
    // Try to find by venueId first
    let venue = await Venue.findOne({ venueId: venueIdNum });
    
    // If not found, try by name and city
    if (!venue) {
      venue = await Venue.findOne({ 
        name: { $regex: new RegExp(venueInfo.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        city: { $regex: new RegExp(venueInfo.city, 'i') }
      });
    }
    
    if (!venue) {
      console.log(`   ❌ Venue not found in database`);
      console.log('');
      continue;
    }
    
    const currentCoords = venue.coordinates || venue.location?.coordinates;
    const [expectedLng, expectedLat] = venueInfo.expectedCoordinates;
    
    if (!currentCoords || !Array.isArray(currentCoords) || currentCoords.length !== 2) {
      console.log(`   ❌ No coordinates found in database`);
      console.log(`   Expected: [${expectedLng}, ${expectedLat}]`);
      console.log('');
      continue;
    }
    
    const [currentLng, currentLat] = currentCoords;
    
    // Check if coordinates match (within 0.0001 degree tolerance, ~11 meters)
    const lngDiff = Math.abs(currentLng - expectedLng);
    const latDiff = Math.abs(currentLat - expectedLat);
    const tolerance = 0.0001;
    
    const isCorrect = lngDiff < tolerance && latDiff < tolerance;
    
    console.log(`   Current coordinates: [${currentLng}, ${currentLat}]`);
    console.log(`   Expected coordinates: [${expectedLng}, ${expectedLat}]`);
    
    if (isCorrect) {
      console.log(`   ✅ Coordinates are CORRECT`);
    } else {
      console.log(`   ❌ Coordinates are INCORRECT`);
      console.log(`   Difference: lng=${lngDiff.toFixed(6)}, lat=${latDiff.toFixed(6)}`);
      console.log(`   Distance error: ~${Math.sqrt(lngDiff * lngDiff + latDiff * latDiff) * 111} km`);
    }
    
    // Also check location field if it exists
    if (venue.location?.coordinates) {
      const [locLng, locLat] = venue.location.coordinates;
      if (Math.abs(locLng - currentLng) > 0.0001 || Math.abs(locLat - currentLat) > 0.0001) {
        console.log(`   ⚠️  Location field differs: [${locLng}, ${locLat}]`);
      }
    }
    
    console.log('');
  }
  
  console.log('✅ Check complete\n');
}

async function main() {
  try {
    await connectDB();
    await checkVenueCoordinates();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

main();

