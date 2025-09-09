const mongoose = require('mongoose');

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/match-finder';

async function fixVenueCoordinates() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Get the Venue model
        const Venue = require('../models/Venue');

        // Remove the old venues with incorrect structure
        console.log('🗑️  Removing old venues with incorrect coordinate structure...');
        const deleteResult = await Venue.deleteMany({
            venueId: { $in: [999001, 999002] }
        });
        console.log(`✅ Removed ${deleteResult.deletedCount} old venues`);

        // Add venues back with correct structure
        const missingVenues = [
            {
                venueId: 999001,
                name: 'BetWright Stadium',
                city: 'London',
                country: 'England',
                countryCode: 'GB',
                location: {
                    type: 'Point',
                    coordinates: [-0.066, 51.604] // Tottenham area, approximate
                },
                coordinates: [-0.066, 51.604], // Also set the direct coordinates field
                capacity: null,
                surface: null,
                address: null,
                image: null
            },
            {
                venueId: 999002,
                name: 'Copperjax Community Stadium',
                city: 'London',
                country: 'England',
                countryCode: 'GB',
                location: {
                    type: 'Point',
                    coordinates: [0.017, 51.507] // East London area, approximate
                },
                coordinates: [0.017, 51.507], // Also set the direct coordinates field
                capacity: null,
                surface: null,
                address: null,
                image: null
            }
        ];

        console.log('\n🔧 Adding venues back with correct coordinate structure...');

        for (const venueData of missingVenues) {
            console.log(`📍 Processing: ${venueData.name}`);
            
            const newVenue = new Venue(venueData);
            await newVenue.save();
            console.log(`✅ Added venue: ${venueData.name} at [${venueData.location.coordinates[0]}, ${venueData.location.coordinates[1]}]`);
        }

        console.log('\n🎯 Venue coordinates fixed successfully!');

        // Verify the venues are now in the database
        console.log('\n🔍 Verifying venues in database...');
        const venues = await Venue.find({
            venueId: { $in: [999001, 999002] }
        });
        
        venues.forEach(v => {
            console.log(`- ${v.name} (ID: ${v.venueId}) in ${v.city}, ${v.country}`);
            console.log(`  Location coordinates: ${v.location?.coordinates ? JSON.stringify(v.location.coordinates) : 'None'}`);
            console.log(`  Direct coordinates: ${v.coordinates ? JSON.stringify(v.coordinates) : 'None'}`);
            console.log('---');
        });

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the script
fixVenueCoordinates();
