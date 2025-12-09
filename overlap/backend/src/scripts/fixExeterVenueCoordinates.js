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

        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        const venueId = 532;
        const correctCoordinates = [-3.5339, 50.7184]; // [longitude, latitude] for Exeter's St James Park

        // Find the venue first to verify it exists
        const venue = await Venue.findOne({ venueId: venueId });
        
        if (!venue) {
            console.error(`❌ Venue with venueId ${venueId} not found in database`);
            await mongoose.disconnect();
            process.exit(1);
        }

        console.log(`📍 Found venue: ${venue.name}`);
        console.log(`   City: ${venue.city}`);
        console.log(`   Current coordinates: ${venue.coordinates || 'N/A'}`);
        console.log(`   Current location.coordinates: ${venue.location?.coordinates || 'N/A'}`);
        console.log(`\n🔧 Updating to correct coordinates: [${correctCoordinates[0]}, ${correctCoordinates[1]}]`);

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
            console.log(`✅ Successfully updated coordinates for ${venue.name} (venueId: ${venueId})`);
            
            // Verify the update
            const updatedVenue = await Venue.findOne({ venueId: venueId });
            console.log(`\n✅ Verification:`);
            console.log(`   coordinates: [${updatedVenue.coordinates[0]}, ${updatedVenue.coordinates[1]}]`);
            console.log(`   location.coordinates: [${updatedVenue.location.coordinates[0]}, ${updatedVenue.location.coordinates[1]}]`);
        } else {
            console.log(`⚠️  No changes made. Venue may already have correct coordinates.`);
        }

        await mongoose.disconnect();
        console.log('\n✅ Done!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error fixing venue coordinates:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

// Run the script
fixExeterVenueCoordinates();

