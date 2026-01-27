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
        await mongoose.connect(MONGODB_URI);
        // Find all venues with "Nuevo Mirandilla" in the name
        const venues = await Venue.find({
            $or: [
                { name: { $regex: /nuevo mirandilla/i } },
                { name: { $regex: /mirandilla/i } }
            ]
        });
        if (venues.length === 0) {
            await mongoose.disconnect();
            return;
        }
        for (const venue of venues) {
            const currentCoords = venue.coordinates || venue.location?.coordinates;
            if (currentCoords) {
                const [lon, lat] = currentCoords;
                // Check if coordinates are wrong (Mexico City area or other wrong location)
                const isWrong = (lat >= 19 && lat <= 20 && lon >= -100 && lon <= -99) || // Mexico City
                               (lat < 36 || lat > 44 || lon < -10 || lon > 4); // Outside Spain bounds
                if (isWrong) {
                    if (!dryRun) {
                        venue.coordinates = CORRECT_COORDINATES;
                        venue.location = {
                            type: 'Point',
                            coordinates: CORRECT_COORDINATES
                        };
                        venue.lastUpdated = new Date();
                        await venue.save();
                    } else {
                    }
                } else {
                    // Check if coordinates match the correct ones
                    const [correctLon, correctLat] = CORRECT_COORDINATES;
                    const isCorrect = Math.abs(lon - correctLon) < 0.001 && Math.abs(lat - correctLat) < 0.001;
                    if (isCorrect) {
                    } else {
                    }
                }
            } else {
                if (!dryRun) {
                    venue.coordinates = CORRECT_COORDINATES;
                    venue.location = {
                        type: 'Point',
                        coordinates: CORRECT_COORDINATES
                    };
                    venue.lastUpdated = new Date();
                    await venue.save();
                } else {
                }
            }
            // Also check if city/country are correct
            if (venue.city && !venue.city.toLowerCase().includes('cádiz') && !venue.city.toLowerCase().includes('cadiz')) {
            }
            if (venue.country !== 'Spain') {
                if (!dryRun) {
                    venue.country = 'Spain';
                    venue.countryCode = 'ES';
                    await venue.save();
                }
            }
        }
        // Also check for any duplicate venues with wrong coordinates
        const allMirandillaVenues = await Venue.find({
            $or: [
                { name: { $regex: /mirandilla/i } },
                { name: { $regex: /nuevo.*mirandilla/i } }
            ]
        });
        if (allMirandillaVenues.length > 1) {
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
                for (const invalidVenue of invalidVenues) {
                    const coords = invalidVenue.coordinates || invalidVenue.location?.coordinates;
                    const [lon, lat] = coords || [null, null];
                    if (!dryRun) {
                        await Venue.deleteOne({ _id: invalidVenue._id });
                    }
                }
            }
        }
        await mongoose.disconnect();
        if (dryRun) {
        } else {
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
