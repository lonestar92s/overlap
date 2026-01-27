/**
 * Script to fix incorrect Premier League venue coordinates in MongoDB
 * 
 * Based on logs, several Premier League venues have wrong coordinates (US/China instead of UK)
 * 
 * Run with: 
 *   node src/scripts/fixPremierLeagueVenueCoordinates.js           # Dry run
 *   node src/scripts/fixPremierLeagueVenueCoordinates.js --fix    # Apply fixes
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Venue = require('../models/Venue');
const Team = require('../models/Team');
const geocodingService = require('../services/geocodingService');
// Known incorrect Premier League venue coordinates (from logs)
// Format: [longitude, latitude] - GeoJSON format
const PREMIER_LEAGUE_CORRECTIONS = {
  // Liverpool - Anfield
  // Current (WRONG): [-67.466189, 46.906592] (US - Maine/New Hampshire)
  // Correct: [-2.9609, 53.4308] (UK - Liverpool)
  550: {
    name: 'Anfield',
    city: 'Liverpool',
    country: 'England',
    correctCoordinates: [-2.9609, 53.4308] // [lng, lat]
  },
  // Sunderland - Stadium of Light
  // Current (WRONG): [-71.597354, 43.263698] (US - New Hampshire)
  // Correct: [-1.3880, 54.9069] (UK - Sunderland)
  589: {
    name: 'Stadium of Light',
    city: 'Sunderland',
    country: 'England',
    correctCoordinates: [-1.3880, 54.9069] // [lng, lat]
  },
  // Aston Villa - Villa Park
  // Current (WRONG): [-78.949043, 37.442778] (US - Virginia)
  // Correct: [-1.8847, 52.5090] (UK - Birmingham)
  495: {
    name: 'Villa Park',
    city: 'Birmingham',
    country: 'England',
    correctCoordinates: [-1.8847, 52.5090] // [lng, lat]
  },
  // Wolves - Molineux Stadium
  // Current (WRONG): [114.178709, 22.329628] (Hong Kong/China)
  // Correct: [-2.1304, 52.5900] (UK - Wolverhampton)
  600: {
    name: 'Molineux Stadium',
    city: 'Wolverhampton',
    country: 'England',
    correctCoordinates: [-2.1304, 52.5900] // [lng, lat]
  },
  // Brighton - American Express Stadium
  // Current (WRONG): [-81.903462, 40.861582] (US - Ohio)
  // Correct: [-0.0810, 50.8619] (UK - Brighton)
  508: {
    name: 'American Express Stadium',
    city: 'Falmer',
    country: 'England',
    correctCoordinates: [-0.0810, 50.8619] // [lng, lat]
  },
  // Elland Road - Leeds, UK
  546: {
    name: 'Elland Road',
    city: 'Leeds',
    country: 'England',
    correctCoordinates: [-1.572222, 53.777778] // [lng, lat] - precise coordinates
  }
};
// UK bounds for validation
const UK_BOUNDS = {
  latMin: 49.9,
  latMax: 60.9,
  lngMin: -8.0,
  lngMax: 2.0
};
async function connectDB() {
  const mongoUri = process.env.MONGO_URL || process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MongoDB URI not found in environment variables');
  }
  await mongoose.connect(mongoUri);
}
/**
 * Check if coordinates are within UK bounds
 */
function isWithinUKBounds(lng, lat) {
  return lat >= UK_BOUNDS.latMin && 
         lat <= UK_BOUNDS.latMax && 
         lng >= UK_BOUNDS.lngMin && 
         lng <= UK_BOUNDS.lngMax;
}
/**
 * Find all Premier League venues with incorrect coordinates
 */
async function findIncorrectPremierLeagueVenues() {
  // Find all venues in England
  const venues = await Venue.find({ 
    country: 'England',
    coordinates: { $exists: true, $ne: null }
  }).lean();
  const incorrect = [];
  for (const venue of venues) {
    const coords = venue.coordinates || venue.location?.coordinates;
    if (!coords || !Array.isArray(coords) || coords.length !== 2) continue;
    const [lng, lat] = coords;
    // Check if coordinates are valid numbers
    if (typeof lng !== 'number' || typeof lat !== 'number' || isNaN(lng) || isNaN(lat)) {
      continue;
    }
    // Check if coordinates are within UK bounds
    if (!isWithinUKBounds(lng, lat)) {
      incorrect.push({
        venue,
        currentCoords: [lng, lat],
        reason: 'Coordinates outside UK bounds'
      });
    }
  }
  return incorrect;
}
/**
 * Fix venue coordinates
 */
async function fixVenueCoordinates(venueId, correctCoords, dryRun = true) {
  const venue = await Venue.findOne({ venueId: venueId });
  if (!venue) {
    return false;
  }
  const oldCoords = venue.coordinates || venue.location?.coordinates;
  if (!dryRun) {
    // Update both coordinates fields using updateOne to avoid createdAt casting issues
    await Venue.updateOne(
      { _id: venue._id },
      {
        $set: {
          coordinates: correctCoords,
          location: {
            type: 'Point',
            coordinates: correctCoords
          },
          lastUpdated: new Date()
        }
      }
    );
    // Also update any teams that reference this venue
    const teams = await Team.find({
      'venue.name': venue.name,
      'venue.coordinates': { $exists: true }
    });
    if (teams.length > 0) {
      for (const team of teams) {
        if (team.venue && team.venue.coordinates) {
          team.venue.coordinates = correctCoords;
          await team.save();
        }
      }
    }
    return true;
  }
  return false;
}
/**
 * Main fix function
 */
async function fixPremierLeagueVenues(dryRun = true) {
  // First, apply known corrections
  let fixedCount = 0;
  let notFoundCount = 0;
  for (const [venueId, correction] of Object.entries(PREMIER_LEAGUE_CORRECTIONS)) {
    const venueIdNum = parseInt(venueId);
    const venue = await Venue.findOne({ venueId: venueIdNum });
    if (!venue) {
      notFoundCount++;
      continue;
    }
    const currentCoords = venue.coordinates || venue.location?.coordinates;
    if (!currentCoords || !Array.isArray(currentCoords) || currentCoords.length !== 2) {
      continue;
    }
    const [currentLng, currentLat] = currentCoords;
    const [correctLng, correctLat] = correction.correctCoordinates;
    // Check if coordinates are already correct
    const coordsMatch = Math.abs(currentLng - correctLng) < 0.001 && 
                        Math.abs(currentLat - correctLat) < 0.001;
    if (coordsMatch) {
      continue;
    }
    // Check if coordinates are outside UK bounds
    const isOutsideUK = !isWithinUKBounds(currentLng, currentLat);
    if (isOutsideUK) {
    } else {
    }
    if (!dryRun) {
      const fixed = await fixVenueCoordinates(venueIdNum, correction.correctCoordinates, dryRun);
      if (fixed) {
        fixedCount++;
      }
    } else {
    }
  }
  // Second, scan for other Premier League venues with incorrect coordinates
  const incorrectVenues = await findIncorrectPremierLeagueVenues();
  if (incorrectVenues.length > 0) {
    let geocodedCount = 0;
    let fixedCount = 0;
    const GEOCODE_DELAY_MS = 600; // Rate limit: 600ms between requests
    for (const { venue, currentCoords } of incorrectVenues) {
      // Skip if we already have a correction for this venue
      if (PREMIER_LEAGUE_CORRECTIONS[venue.venueId]) {
        continue;
      }
      // Try to geocode the venue
      if (!dryRun) {
        // Rate limiting
        if (geocodedCount > 0) {
          await new Promise(resolve => setTimeout(resolve, GEOCODE_DELAY_MS));
        }
        geocodedCount++;
        try {
          const geocodedCoords = await geocodingService.geocodeVenueCoordinates(
            venue.name,
            venue.city,
            venue.country || 'England'
          );
          if (geocodedCoords && Array.isArray(geocodedCoords) && geocodedCoords.length === 2) {
            const [newLng, newLat] = geocodedCoords;
            // Validate new coordinates are within UK bounds
            if (isWithinUKBounds(newLng, newLat)) {
              // Update venue
              await Venue.updateOne(
                { _id: venue._id },
                {
                  $set: {
                    coordinates: geocodedCoords,
                    location: {
                      type: 'Point',
                      coordinates: geocodedCoords
                    },
                    lastUpdated: new Date()
                  }
                }
              );
              // Update related teams
              const teams = await Team.find({
                'venue.name': venue.name,
                'venue.coordinates': { $exists: true }
              });
              if (teams.length > 0) {
                for (const team of teams) {
                  if (team.venue && team.venue.coordinates) {
                    team.venue.coordinates = geocodedCoords;
                    await team.save();
                  }
                }
              }
              fixedCount++;
            } else {
            }
          } else {
          }
        } catch (error) {
        }
      } else {
      }
    }
    if (!dryRun) {
    }
  } else {
  }
  // Summary
  if (!dryRun) {
  } else {
  }
  if (dryRun) {
  } else {
  }
}
async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--fix');
  try {
    await connectDB();
    await fixPremierLeagueVenues(dryRun);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}
main();
