/**
 * Script to fix Estadio Nuevo Mirandilla coordinates
 * 
 * This script specifically fixes the coordinates for Estadio Nuevo Mirandilla
 * in Cádiz, Spain, which may have wrong coordinates (Mexico City coordinates).
 * 
 * Run with: node src/scripts/fixNuevoMirandillaCoordinates.js [--dry-run]
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Venue = require('../models/Venue');

// Correct coordinates for Estadio Nuevo Mirandilla, Cádiz, Spain
const CORRECT_COORDINATES = [-6.272434991917359, 36.50296311481167]; // [lon, lat] - GeoJSON format

async function fixNuevoMirandilla(dryRun = true) {
    try {
        const MONGODB_URI = process.env.MONGODB_URI;
        if (!MONGODB_URI) {
            console.error('❌ MONGODB_URI environment variable is required');
            process.exit(1);
        }
        
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');
        
        // Find all venues with "Nuevo Mirandilla" in the name
        const venues = await Venue.find({
            $or: [
                { name: { $regex: /nuevo mirandilla/i } },
                { name: { $regex: /mirandilla/i } }
            ]
        });
        
        console.log(`🔍 Found ${venues.length} venue(s) matching "Nuevo Mirandilla"\n`);
        
        if (venues.length === 0) {
            console.log('⚠️  No venues found. The venue may not exist in the database yet.');
            await mongoose.disconnect();
            return;
        }
        
        for (const venue of venues) {
            console.log(`📍 Venue: ${venue.name}`);
            console.log(`   City: ${venue.city}`);
            console.log(`   Country: ${venue.country}`);
            
            const currentCoords = venue.coordinates || venue.location?.coordinates;
            if (currentCoords) {
                const [lon, lat] = currentCoords;
                console.log(`   Current coordinates: [${lon}, ${lat}]`);
                
                // Check if coordinates are wrong (Mexico City area or other wrong location)
                const isWrong = (lat >= 19 && lat <= 20 && lon >= -100 && lon <= -99) || // Mexico City
                               (lat < 36 || lat > 44 || lon < -10 || lon > 4); // Outside Spain bounds
                
                if (isWrong) {
                    console.log(`   ❌ Coordinates are WRONG (outside Spain bounds)`);
                    console.log(`   ✅ Correct coordinates: [${CORRECT_COORDINATES[0]}, ${CORRECT_COORDINATES[1]}]`);
                    
                    if (!dryRun) {
                        venue.coordinates = CORRECT_COORDINATES;
                        venue.location = {
                            type: 'Point',
                            coordinates: CORRECT_COORDINATES
                        };
                        venue.lastUpdated = new Date();
                        await venue.save();
                        console.log(`   ✅ Fixed!`);
                    } else {
                        console.log(`   🔍 DRY RUN - would fix coordinates`);
                    }
                } else {
                    // Check if coordinates match the correct ones
                    const [correctLon, correctLat] = CORRECT_COORDINATES;
                    const isCorrect = Math.abs(lon - correctLon) < 0.001 && Math.abs(lat - correctLat) < 0.001;
                    
                    if (isCorrect) {
                        console.log(`   ✅ Coordinates are CORRECT`);
                    } else {
                        console.log(`   ⚠️  Coordinates are different but may be valid`);
                        console.log(`   Expected: [${correctLon}, ${correctLat}]`);
                    }
                }
            } else {
                console.log(`   ⚠️  No coordinates found`);
                
                if (!dryRun) {
                    venue.coordinates = CORRECT_COORDINATES;
                    venue.location = {
                        type: 'Point',
                        coordinates: CORRECT_COORDINATES
                    };
                    venue.lastUpdated = new Date();
                    await venue.save();
                    console.log(`   ✅ Added correct coordinates!`);
                } else {
                    console.log(`   🔍 DRY RUN - would add coordinates`);
                }
            }
            
            // Also check if city/country are correct
            if (venue.city && !venue.city.toLowerCase().includes('cádiz') && !venue.city.toLowerCase().includes('cadiz')) {
                console.log(`   ⚠️  City may be wrong: "${venue.city}" (expected: Cádiz)`);
            }
            
            if (venue.country !== 'Spain') {
                console.log(`   ⚠️  Country may be wrong: "${venue.country}" (expected: Spain)`);
                
                if (!dryRun) {
                    venue.country = 'Spain';
                    venue.countryCode = 'ES';
                    await venue.save();
                    console.log(`   ✅ Fixed country to Spain`);
                }
            }
            
            console.log('');
        }
        
        // Also check for any duplicate venues with wrong coordinates
        console.log('🔍 Checking for duplicate venues with wrong coordinates...\n');
        
        const allMirandillaVenues = await Venue.find({
            $or: [
                { name: { $regex: /mirandilla/i } },
                { name: { $regex: /nuevo.*mirandilla/i } }
            ]
        });
        
        if (allMirandillaVenues.length > 1) {
            console.log(`⚠️  Found ${allMirandillaVenues.length} venues with "Mirandilla" in name:`);
            
            const validVenues = [];
            const invalidVenues = [];
            
            for (const v of allMirandillaVenues) {
                const coords = v.coordinates || v.location?.coordinates;
                if (coords) {
                    const [lon, lat] = coords;
                    // Check if in Spain bounds
                    const isValid = lat >= 36 && lat <= 44 && lon >= -10 && lon <= 4;
                    
                    if (isValid) {
                        validVenues.push(v);
                    } else {
                        invalidVenues.push(v);
                    }
                } else {
                    invalidVenues.push(v);
                }
            }
            
            if (invalidVenues.length > 0 && validVenues.length > 0) {
                console.log(`   ✅ Found ${validVenues.length} valid venue(s)`);
                console.log(`   ❌ Found ${invalidVenues.length} invalid venue(s) to remove\n`);
                
                for (const invalidVenue of invalidVenues) {
                    const coords = invalidVenue.coordinates || invalidVenue.location?.coordinates;
                    const [lon, lat] = coords || [null, null];
                    console.log(`   🗑️  Would remove: ${invalidVenue.name} (${invalidVenue.city}) - coords: [${lon}, ${lat}]`);
                    
                    if (!dryRun) {
                        await Venue.deleteOne({ _id: invalidVenue._id });
                        console.log(`      ✅ Deleted`);
                    }
                }
            }
        }
        
        await mongoose.disconnect();
        
        if (dryRun) {
            console.log('\n⚠️  This was a DRY RUN. Run without --dry-run to apply changes.');
        } else {
            console.log('\n✅ Fixes applied successfully!');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

// Main
if (require.main === module) {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run') || args.includes('-d');
    fixNuevoMirandilla(dryRun);
}

module.exports = { fixNuevoMirandilla };

