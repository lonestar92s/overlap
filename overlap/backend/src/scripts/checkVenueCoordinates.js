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
}
async function checkVenueCoordinates() {
  for (const [venueId, venueInfo] of Object.entries(VENUES_TO_CHECK)) {
    const venueIdNum = parseInt(venueId);
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
      continue;
    }
    const currentCoords = venue.coordinates || venue.location?.coordinates;
    const [expectedLng, expectedLat] = venueInfo.expectedCoordinates;
    if (!currentCoords || !Array.isArray(currentCoords) || currentCoords.length !== 2) {
      continue;
    }
    const [currentLng, currentLat] = currentCoords;
    // Check if coordinates match (within 0.0001 degree tolerance, ~11 meters)
    const lngDiff = Math.abs(currentLng - expectedLng);
    const latDiff = Math.abs(currentLat - expectedLat);
    const tolerance = 0.0001;
    const isCorrect = lngDiff < tolerance && latDiff < tolerance;
    if (isCorrect) {
    } else {
    }
    // Also check location field if it exists
    if (venue.location?.coordinates) {
      const [locLng, locLat] = venue.location.coordinates;
      if (Math.abs(locLng - currentLng) > 0.0001 || Math.abs(locLat - currentLat) > 0.0001) {
      }
    }
  }
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
  }
}
main();
