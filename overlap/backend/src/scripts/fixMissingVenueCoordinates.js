const mongoose = require('mongoose');
const axios = require('axios');

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/match-finder';
const LOCATIONIQ_API_KEY = process.env.LOCATIONIQ_API_KEY;

async function geocodeVenue(venueName, city, country) {
    if (!LOCATIONIQ_API_KEY) {
        console.log('❌ LOCATIONIQ_API_KEY not found in environment variables');
        return null;
    }

    try {
        const searchQuery = `${venueName}, ${city}, ${country}`;
        console.log(`🔍 Geocoding: ${searchQuery}`);
        
        const response = await axios.get('https://us1.locationiq.com/v1/search.php', {
            params: {
                key: LOCATIONIQ_API_KEY,
                q: searchQuery,
                format: 'json',
                limit: 1
            }
        });

        if (response.data && response.data.length > 0) {
            const result = response.data[0];
            console.log(`✅ Found coordinates: [${result.lon}, ${result.lat}]`);
            return [parseFloat(result.lon), parseFloat(result.lat)];
        } else {
            console.log('❌ No results found');
            return null;
        }
    } catch (error) {
        console.error(`❌ Error geocoding ${venueName}:`, error.response?.data || error.message);
        return null;
    }
}

async function updateVenueCoordinates() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Get the Venue model
        const Venue = require('../models/Venue');

        // List of venues that need coordinates
        const venuesToFix = [
            {
                name: 'BetWright Stadium',
                city: 'London',
                country: 'England',
                searchQuery: 'BetWright Stadium, London, England'
            },
            {
                name: 'Copperjax Community Stadium',
                city: 'London',
                country: 'England',
                searchQuery: 'Copperjax Community Stadium, London, England'
            },
            {
                name: 'Joie Stadium',
                city: 'Manchester',
                country: 'England',
                searchQuery: 'Joie Stadium, Manchester, England'
            }
        ];

        console.log('🔧 Starting venue coordinate fixes...\n');

        for (const venue of venuesToFix) {
            console.log(`📍 Processing: ${venue.name}`);
            
            // Try to find existing venue
            let existingVenue = await Venue.findOne({
                name: { $regex: new RegExp(venue.name, 'i') },
                city: { $regex: new RegExp(venue.city, 'i') }
            });

            if (!existingVenue) {
                console.log(`⚠️  Venue not found in database: ${venue.name}`);
                continue;
            }

            console.log(`📍 Current coordinates: ${existingVenue.coordinates || 'None'}`);

            // Geocode the venue
            const coordinates = await geocodeVenue(venue.name, venue.city, venue.country);
            
            if (coordinates) {
                // Update the venue with new coordinates
                existingVenue.coordinates = coordinates;
                await existingVenue.save();
                console.log(`✅ Updated ${venue.name} with coordinates: [${coordinates[0]}, ${coordinates[1]}]`);
            } else {
                console.log(`❌ Failed to geocode ${venue.name}`);
            }
            
            console.log('---');
        }

        console.log('🎯 Venue coordinate update complete!');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the script
updateVenueCoordinates();



