const mongoose = require('mongoose');
require('dotenv').config();
const Venue = require('../models/Venue');
/**
 * Fix incorrect coordinates for Exeter's St James Park (venueId: 532)
 * Current wrong coordinates: [-0.285572, 51.556899] (London area)
 * Correct coordinates: [-3.5339, 50.7184] (Exeter, Devon)
 */
async function fixExeterVenueCoordinates() {
    try {
        const MONGODB_URI = process.env.MONGODB_URI;
        if (!MONGODB_URI) {
            console.error('❌ MONGODB_URI environment variable is required');
            process.exit(1);
        }
        await mongoose.connect(MONGODB_URI);
        const venueId = 532;
        const correctCoordinates = [-3.5339, 50.7184]; // [longitude, latitude] for Exeter's St James Park
        // Find the venue first to verify it exists
        const venue = await Venue.findOne({ venueId: venueId });
        if (!venue) {
            console.error(`❌ Venue with venueId ${venueId} not found in database`);
            await mongoose.disconnect();
            process.exit(1);
        }
        // Update both coordinates and location.coordinates fields
        const updateResult = await Venue.updateOne(
            { venueId: venueId },
            {
                $set: {
                    coordinates: correctCoordinates,
                    location: {
                        type: 'Point',
                        coordinates: correctCoordinates
                    },
                    lastUpdated: new Date()
                }
            }
        );
        if (updateResult.modifiedCount > 0) {
            // Verify the update
            const updatedVenue = await Venue.findOne({ venueId: venueId });
        } else {
        }
        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error fixing venue coordinates:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}
// Run the script
fixExeterVenueCoordinates();
