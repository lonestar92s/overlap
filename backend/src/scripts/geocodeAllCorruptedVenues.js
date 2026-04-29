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
  const corrections = {};
  let successCount = 0;
  let failCount = 0;
  for (let i = 0; i < corrupted.length; i++) {
    const { venue } = corrupted[i];
    const venueId = venue.venueId || venue.apiId;
    if (!venueId) {
      failCount++;
      continue;
    }
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
          failCount++;
          continue;
        }
        corrections[venueId] = {
          name: venue.name,
          city: venue.city,
          country: venue.country,
          correctCoordinates: geocoded
        };
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
        }
      } else {
        failCount++;
      }
    } catch (err) {
      failCount++;
    }
  }
  // Output corrections in format ready to add to VENUE_CORRECTIONS
  for (const [venueId, correction] of Object.entries(corrections)) {
  }
  return corrections;
}
async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--fix');
  try {
    await connectDB();
    await geocodeAllCorruptedVenues(dryRun);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}
main();
