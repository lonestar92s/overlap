const mongoose = require('mongoose');

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/match-finder';

async function addMissingWSLVenues() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Get the Venue model
        const Venue = require('../models/Venue');

        // List of missing WSL venues with manually researched coordinates
        const missingVenues = [
            {
                venueId: 999001, // Generate unique ID
                name: 'BetWright Stadium',
                city: 'London',
                country: 'England',
                countryCode: 'GB',
                location: {
                    type: 'Point',
                    coordinates: [-0.066, 51.604] // Tottenham area, approximate
                },
                capacity: null,
                surface: null,
                address: null,
                image: null
            },
            {
                venueId: 999002, // Generate unique ID
                name: 'Copperjax Community Stadium',
                city: 'London',
                country: 'England',
                countryCode: 'GB',
                location: {
                    type: 'Point',
                    coordinates: [0.017, 51.507] // East London area, approximate
                },
                capacity: null,
                surface: null,
                address: null,
                image: null
            }
        ];

        console.log('🔧 Adding missing WSL venues...\n');

        for (const venueData of missingVenues) {
            console.log(`📍 Processing: ${venueData.name}`);
            
            // Check if venue already exists
            const existingVenue = await Venue.findOne({
                name: { $regex: new RegExp(venueData.name, 'i') },
                city: { $regex: new RegExp(venueData.city, 'i') }
            });

            if (existingVenue) {
                console.log(`⚠️  Venue already exists: ${venueData.name}`);
                // Update coordinates if missing
                if (!existingVenue.coordinates && venueData.coordinates) {
                    existingVenue.coordinates = venueData.coordinates;
                    await existingVenue.save();
                    console.log(`✅ Updated coordinates for ${venueData.name}: [${venueData.coordinates[0]}, ${venueData.coordinates[1]}]`);
                }
                continue;
            }

            // Create new venue
            const newVenue = new Venue(venueData);
            await newVenue.save();
            console.log(`✅ Added new venue: ${venueData.name} at [${venueData.coordinates[0]}, ${venueData.coordinates[1]}]`);
        }

        console.log('\n🎯 Missing WSL venues added successfully!');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the script
addMissingWSLVenues();
