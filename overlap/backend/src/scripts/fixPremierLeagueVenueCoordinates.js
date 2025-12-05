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
  console.log('✅ Connected to MongoDB');
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
  console.log('\n🔍 Scanning for Premier League venues with incorrect coordinates...\n');
  
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
    console.log(`   ⚠️  Venue with ID ${venueId} not found in database`);
    return false;
  }
  
  const oldCoords = venue.coordinates || venue.location?.coordinates;
  console.log(`   📍 Old coordinates: [${oldCoords?.[0]}, ${oldCoords?.[1]}]`);
  console.log(`   📍 New coordinates: [${correctCoords[0]}, ${correctCoords[1]}]`);
  
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
    console.log(`   ✅ Updated venue coordinates in database`);
    
    // Also update any teams that reference this venue
    const teams = await Team.find({
      'venue.name': venue.name,
      'venue.coordinates': { $exists: true }
    });
    
    if (teams.length > 0) {
      console.log(`   🔄 Updating ${teams.length} team(s) that reference this venue...`);
      for (const team of teams) {
        if (team.venue && team.venue.coordinates) {
          team.venue.coordinates = correctCoords;
          await team.save();
        }
      }
      console.log(`   ✅ Updated team venue coordinates`);
    }
    
    return true;
  }
  
  return false;
}

/**
 * Main fix function
 */
async function fixPremierLeagueVenues(dryRun = true) {
  console.log('🔧 Premier League Venue Coordinate Fixer');
  console.log('========================================');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'APPLY FIXES'}`);
  console.log('');
  
  // First, apply known corrections
  console.log('📋 Applying known corrections from logs...\n');
  
  let fixedCount = 0;
  let notFoundCount = 0;
  
  for (const [venueId, correction] of Object.entries(PREMIER_LEAGUE_CORRECTIONS)) {
    const venueIdNum = parseInt(venueId);
    console.log(`🔍 Checking venue ID ${venueIdNum}: ${correction.name}`);
    
    const venue = await Venue.findOne({ venueId: venueIdNum });
    
    if (!venue) {
      console.log(`   ⚠️  Venue not found in database`);
      notFoundCount++;
      continue;
    }
    
    const currentCoords = venue.coordinates || venue.location?.coordinates;
    
    if (!currentCoords || !Array.isArray(currentCoords) || currentCoords.length !== 2) {
      console.log(`   ⚠️  Venue has no coordinates`);
      continue;
    }
    
    const [currentLng, currentLat] = currentCoords;
    const [correctLng, correctLat] = correction.correctCoordinates;
    
    // Check if coordinates are already correct
    const coordsMatch = Math.abs(currentLng - correctLng) < 0.001 && 
                        Math.abs(currentLat - correctLat) < 0.001;
    
    if (coordsMatch) {
      console.log(`   ✅ Coordinates already correct: [${currentLng}, ${currentLat}]`);
      continue;
    }
    
    // Check if coordinates are outside UK bounds
    const isOutsideUK = !isWithinUKBounds(currentLng, currentLat);
    
    if (isOutsideUK) {
      console.log(`   ❌ Coordinates are outside UK bounds: [${currentLng}, ${currentLat}]`);
    } else {
      console.log(`   ⚠️  Coordinates are within UK but may be incorrect: [${currentLng}, ${currentLat}]`);
    }
    
    if (!dryRun) {
      const fixed = await fixVenueCoordinates(venueIdNum, correction.correctCoordinates, dryRun);
      if (fixed) {
        fixedCount++;
      }
    } else {
      console.log(`   📝 Would update to: [${correctLng}, ${correctLat}]`);
    }
    
    console.log('');
  }
  
  // Second, scan for other Premier League venues with incorrect coordinates
  console.log('\n🔍 Scanning for other Premier League venues with incorrect coordinates...\n');
  
  const incorrectVenues = await findIncorrectPremierLeagueVenues();
  
  if (incorrectVenues.length > 0) {
    console.log(`📊 Found ${incorrectVenues.length} additional venue(s) with coordinates outside UK bounds:\n`);
    
    let geocodedCount = 0;
    let fixedCount = 0;
    const GEOCODE_DELAY_MS = 600; // Rate limit: 600ms between requests
    
    for (const { venue, currentCoords } of incorrectVenues) {
      // Skip if we already have a correction for this venue
      if (PREMIER_LEAGUE_CORRECTIONS[venue.venueId]) {
        continue;
      }
      
      console.log(`  🔍 ${venue.name} (ID: ${venue.venueId || 'N/A'})`);
      console.log(`     City: ${venue.city}`);
      console.log(`     Current coords: [${currentCoords[0]}, ${currentCoords[1]}]`);
      
      // Try to geocode the venue
      if (!dryRun) {
        // Rate limiting
        if (geocodedCount > 0) {
          console.log(`     ⏳ Rate limiting: waiting ${GEOCODE_DELAY_MS}ms...`);
          await new Promise(resolve => setTimeout(resolve, GEOCODE_DELAY_MS));
        }
        geocodedCount++;
        
        try {
          console.log(`     🔍 Attempting to geocode...`);
          const geocodedCoords = await geocodingService.geocodeVenueCoordinates(
            venue.name,
            venue.city,
            venue.country || 'England'
          );
          
          if (geocodedCoords && Array.isArray(geocodedCoords) && geocodedCoords.length === 2) {
            const [newLng, newLat] = geocodedCoords;
            
            // Validate new coordinates are within UK bounds
            if (isWithinUKBounds(newLng, newLat)) {
              console.log(`     ✅ Geocoded: [${newLng}, ${newLat}]`);
              
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
                console.log(`     🔄 Updated ${teams.length} team(s)`);
              }
              
              console.log(`     ✅ FIXED!`);
              fixedCount++;
            } else {
              console.log(`     ⚠️  Geocoded coordinates are still outside UK bounds: [${newLng}, ${newLat}]`);
              console.log(`     ⚠️  Manual fix needed`);
            }
          } else {
            console.log(`     ⚠️  Geocoding failed - no coordinates returned`);
            console.log(`     ⚠️  Manual fix needed`);
          }
        } catch (error) {
          console.log(`     ⚠️  Geocoding error: ${error.message}`);
          console.log(`     ⚠️  Manual fix needed`);
        }
      } else {
        console.log(`     📝 Would attempt to geocode and fix`);
      }
      
      console.log('');
    }
    
    if (!dryRun) {
      console.log(`\n📊 Geocoding Summary:`);
      console.log(`   Geocode attempts: ${geocodedCount}`);
      console.log(`   Successfully fixed: ${fixedCount}`);
      console.log(`   Failed/needs manual fix: ${incorrectVenues.length - fixedCount - Object.keys(PREMIER_LEAGUE_CORRECTIONS).length}`);
    }
  } else {
    console.log('✅ No additional venues with incorrect coordinates found');
  }
  
  // Summary
  console.log('\n📊 Summary:');
  console.log(`   Known corrections: ${Object.keys(PREMIER_LEAGUE_CORRECTIONS).length}`);
  if (!dryRun) {
    console.log(`   Fixed: ${fixedCount}`);
    console.log(`   Not found: ${notFoundCount}`);
  } else {
    console.log(`   Would fix: ${Object.keys(PREMIER_LEAGUE_CORRECTIONS).length - notFoundCount}`);
  }
  console.log(`   Additional incorrect venues found: ${incorrectVenues.length}`);
  
  if (dryRun) {
    console.log('\n📝 This was a DRY RUN. To apply fixes:');
    console.log('   node src/scripts/fixPremierLeagueVenueCoordinates.js --fix\n');
  } else {
    console.log('\n✅ Fixes applied!\n');
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
    console.log('Disconnected from MongoDB');
  }
}

main();

