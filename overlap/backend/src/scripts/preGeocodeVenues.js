const mongoose = require('mongoose');
const axios = require('axios');
const Venue = require('../models/Venue');

// LocationIQ configuration
const LOCATIONIQ_API_KEY = process.env.LOCATIONIQ_API_KEY;
const LOCATIONIQ_BASE_URL = 'https://us1.locationiq.com/v1';

// Rate limiting helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function geocodeAddress(venue) {
    try {
        const address = `${venue.name}, ${venue.city}, ${venue.country}`;
        console.log(`🔍 Geocoding: ${address}`);

        const response = await axios.get(`${LOCATIONIQ_BASE_URL}/search.php`, {
            params: {
                key: LOCATIONIQ_API_KEY,
                q: address,
                format: 'json',
                limit: 1
            }
        });

        if (response.data && response.data[0]) {
            const { lat, lon } = response.data[0];
            return [parseFloat(lon), parseFloat(lat)]; // GeoJSON format: [longitude, latitude]
        }
        return null;
    } catch (error) {
        console.error(`❌ Geocoding error for ${venue.name}:`, error.message);
        return null;
    }
}

async function preGeocodeVenues() {
    console.log('🌍 Starting venue pre-geocoding process...');
    
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    
    try {
        // Get all venues without coordinates
        const venues = await Venue.find({
            $or: [
                { location: { $exists: false } },
                { location: null },
                { 'location.coordinates': { $exists: false } },
                { 'location.coordinates': null }
            ]
        });

        console.log(`📍 Found ${venues.length} venues without coordinates`);

        for (const venue of venues) {
            try {
                // Skip if already has coordinates
                if (venue.location?.coordinates?.length === 2) {
                    console.log(`⏭️  Skipping ${venue.name} - already has coordinates`);
                    skipped++;
                    continue;
                }

                // Geocode the venue
                const coordinates = await geocodeAddress(venue);
                
                if (coordinates) {
                    venue.location = {
                        type: 'Point',
                        coordinates: coordinates
                    };
                    await venue.save();
                    console.log(`✅ Updated coordinates for ${venue.name}: [${coordinates}]`);
                    updated++;
                    
                    // Rate limiting - 1 request per second
                    await sleep(1000);
                } else {
                    console.log(`⚠️  Could not geocode ${venue.name}`);
                    errors++;
                }
            } catch (error) {
                console.error(`❌ Error processing ${venue.name}:`, error.message);
                errors++;
            }
        }
    } catch (error) {
        console.error('❌ Fatal error:', error.message);
    }

    console.log('\n📊 Pre-geocoding Summary:');
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
}

// Connect to MongoDB and run pre-geocoding
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/overlap';

console.log('🔌 Connecting to MongoDB at:', MONGODB_URI);

mongoose.connect(MONGODB_URI, { 
    useNewUrlParser: true,
    useUnifiedTopology: true 
})
    .then(async () => {
        console.log('📦 Connected to MongoDB');
        
        // Test connection by counting venues
        const venueCount = await Venue.countDocuments();
        console.log(`📊 Current venue count: ${venueCount}`);
        
        return preGeocodeVenues();
    })
    .then(() => {
        console.log('\n✨ Pre-geocoding complete!');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    }); 