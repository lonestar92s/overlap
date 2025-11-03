const mongoose = require('mongoose');
const axios = require('axios');
const Venue = require('../models/Venue');

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URL;
const LOCATIONIQ_API_KEY = process.env.LOCATIONIQ_API_KEY;

async function geocodeVenue(venueName, city, country) {
    if (!LOCATIONIQ_API_KEY) {
        console.log('❌ LOCATIONIQ_API_KEY not found in environment variables');
        return null;
    }

    try {
        // Try different search queries for better results
        const queries = [
            `${venueName}, ${city}, ${country}`,
            `${venueName}, ${city}`,
            `${venueName} ${city}, ${country}`
        ];

        for (const query of queries) {
            try {
                console.log(`🔍 Geocoding: ${query}`);
                
                const response = await axios.get('https://api.locationiq.com/v1/search.php', {
                    params: {
                        key: LOCATIONIQ_API_KEY,
                        q: query,
                        format: 'json',
                        limit: 1,
                        'accept-language': 'en'
                    },
                    timeout: 10000
                });

                if (response.data && response.data.length > 0) {
                    const result = response.data[0];
                    const coordinates = [parseFloat(result.lon), parseFloat(result.lat)];
                    console.log(`✅ Found coordinates: [${coordinates[0]}, ${coordinates[1]}]`);
                    return coordinates;
                }
            } catch (error) {
                if (error.response?.status === 429) {
                    console.log('⏳ Rate limited, waiting 2 seconds...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    continue;
                }
                if (error.response?.status === 401) {
                    console.error(`❌ Invalid LocationIQ API key`);
                    return null;
                }
                if (error.response?.status === 403) {
                    console.error(`❌ LocationIQ API access forbidden - check API key permissions`);
                    return null;
                }
                // Log more details for debugging
                const status = error.response?.status || 'unknown';
                const message = error.response?.data?.error || error.message || 'Unknown error';
                console.log(`⚠️ Query failed (${status}): ${query} - ${message}`);
            }
        }

        console.log('❌ No results found for any query');
        return null;
    } catch (error) {
        console.error(`❌ Error geocoding ${venueName}:`, error.response?.data || error.message);
        return null;
    }
}

async function updateVenueCoordinates() {
    try {
        if (!MONGODB_URI) {
            console.error('❌ MONGODB_URI not found in environment variables');
            console.error('💡 Please set MONGODB_URI or MONGO_URL environment variable');
            console.error('   Example: MONGODB_URI="mongodb://..." node src/scripts/addMissingVenueCoords.js');
            process.exit(1);
        }

        // Log which MongoDB we're connecting to (but hide credentials)
        const safeUri = MONGODB_URI.replace(/mongodb:\/\/([^:]+):([^@]+)@/, 'mongodb://***:***@');
        const isRailway = MONGODB_URI.includes('railway') || MONGODB_URI.includes('rlwy.net') || MONGODB_URI.includes('proxy.rlwy.net');
        const isLocal = MONGODB_URI.includes('localhost') || MONGODB_URI.includes('127.0.0.1');
        
        console.log(`🔌 Connecting to MongoDB: ${isRailway ? '✅ Railway' : isLocal ? '⚠️ LOCAL' : '✅ Remote'} - ${safeUri}`);
        await mongoose.connect(MONGODB_URI);
        
        const dbName = mongoose.connection.db?.databaseName || 'unknown';
        console.log(`✅ Connected to MongoDB database: ${dbName}`);
        
        // Warn if connecting to local in production
        if (isLocal && process.env.NODE_ENV === 'production') {
            console.error('⚠️ WARNING: Connecting to LOCAL MongoDB! Make sure this is intentional.');
        }

        // Find venues without coordinates (specifically English venues from the logs)
        const venuesToFix = [
            { name: 'Brisbane Road', city: 'London', country: 'England' },
            { name: 'Kingsmeadow', city: 'London', country: 'England' },
            { name: 'The Brick Community Stadium', city: 'Wigan', country: 'England' },
            { name: 'St Helens Stadium', city: 'St Helens', country: 'England' },
            { name: 'Bescot Stadium', city: 'Walsall', country: 'England' }
        ];

        console.log(`\n🔧 Starting venue coordinate fixes for ${venuesToFix.length} venues...\n`);

        let fixed = 0;
        let failed = 0;

        for (const venueToFix of venuesToFix) {
            console.log(`📍 Processing: ${venueToFix.name}, ${venueToFix.city}`);
            
            // Escape special regex characters
            const escapedName = venueToFix.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const escapedCity = venueToFix.city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            
            // Try to find existing venue by exact name match first (most precise)
            // First try: exact name + exact city + country + no coordinates
            let existingVenue = await Venue.findOne({
                name: { $regex: new RegExp(`^${escapedName}$`, 'i') },
                city: { $regex: new RegExp(`^${escapedCity}$`, 'i') },
                country: venueToFix.country,
                $or: [
                    { coordinates: { $exists: false } },
                    { coordinates: null },
                    { coordinates: [] }
                ]
            });

            if (!existingVenue) {
                // Second try: exact name + country + no coordinates (city might be different)
                existingVenue = await Venue.findOne({
                    name: { $regex: new RegExp(`^${escapedName}$`, 'i') },
                    country: venueToFix.country,
                    $or: [
                        { coordinates: { $exists: false } },
                        { coordinates: null },
                        { coordinates: [] }
                    ]
                });
            }

            if (!existingVenue) {
                // Third try: name contains + city contains (handles variations like "Kingston upon Thames, Surrey" vs "London")
                existingVenue = await Venue.findOne({
                    name: { $regex: new RegExp(escapedName, 'i') },
                    city: { $regex: new RegExp(escapedCity.split(' ')[0], 'i') }, // Match first word of city
                    country: venueToFix.country,
                    $or: [
                        { coordinates: { $exists: false } },
                        { coordinates: null },
                        { coordinates: [] }
                    ]
                });
            }

            if (!existingVenue) {
                // Fourth try: name contains + city contains + country + no coordinates
                existingVenue = await Venue.findOne({
                    name: { $regex: new RegExp(escapedName, 'i') },
                    city: { $regex: new RegExp(escapedCity, 'i') },
                    country: venueToFix.country,
                    $or: [
                        { coordinates: { $exists: false } },
                        { coordinates: null },
                        { coordinates: [] }
                    ]
                });
            }
            
            // Fifth try: without coordinates filter - check if venue exists at all (by exact name)
            if (!existingVenue) {
                existingVenue = await Venue.findOne({
                    name: { $regex: new RegExp(`^${escapedName}$`, 'i') },
                    country: venueToFix.country
                });
                if (existingVenue && existingVenue.coordinates && existingVenue.coordinates.length === 2) {
                    console.log(`ℹ️  Venue already has coordinates, skipping: ${existingVenue.name} (${existingVenue.city})`);
                    continue; // Skip this venue since it already has coordinates
                }
            }

            if (!existingVenue) {
                console.log(`⚠️  Venue not found in database: ${venueToFix.name}`);
                failed++;
                continue;
            }

            console.log(`📊 Found venue: ${existingVenue.name} (ID: ${existingVenue.venueId || 'N/A'})`);
            console.log(`📍 Current coordinates: ${existingVenue.coordinates ? JSON.stringify(existingVenue.coordinates) : 'None'}`);

            // Skip if already has coordinates
            if (existingVenue.coordinates && Array.isArray(existingVenue.coordinates) && existingVenue.coordinates.length === 2) {
                console.log(`✅ Venue already has coordinates, skipping`);
                continue;
            }

            // Geocode the venue
            const coordinates = await geocodeVenue(
                existingVenue.name || venueToFix.name,
                existingVenue.city || venueToFix.city,
                existingVenue.country || venueToFix.country
            );
            
            if (coordinates) {
                // Update the venue with new coordinates
                existingVenue.coordinates = coordinates;
                existingVenue.location = {
                    type: 'Point',
                    coordinates: coordinates
                };
                await existingVenue.save();
                console.log(`✅ Updated ${existingVenue.name} with coordinates: [${coordinates[0]}, ${coordinates[1]}]`);
                fixed++;
                
                // Rate limiting - wait 1 second between requests
                await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
                console.log(`❌ Failed to geocode ${existingVenue.name}`);
                failed++;
            }
            
            console.log('---');
        }

        // Also find and fix any other English venues missing coordinates
        console.log('\n🔍 Searching for other English venues missing coordinates...');
        const otherVenues = await Venue.find({
            country: 'England',
            $or: [
                { coordinates: { $exists: false } },
                { coordinates: null },
                { coordinates: [] }
            ]
        }).limit(20); // Limit to avoid too many API calls

        console.log(`Found ${otherVenues.length} additional English venues without coordinates`);

        for (const venue of otherVenues) {
            console.log(`\n📍 Processing: ${venue.name}, ${venue.city || 'Unknown City'}`);
            
            // Skip if already processed
            if (venuesToFix.some(v => v.name.toLowerCase() === venue.name.toLowerCase())) {
                continue;
            }

            const coordinates = await geocodeVenue(venue.name, venue.city || '', venue.country || 'England');
            
            if (coordinates) {
                venue.coordinates = coordinates;
                venue.location = {
                    type: 'Point',
                    coordinates: coordinates
                };
                await venue.save();
                console.log(`✅ Updated ${venue.name} with coordinates: [${coordinates[0]}, ${coordinates[1]}]`);
                fixed++;
                
                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
                console.log(`❌ Failed to geocode ${venue.name}`);
                failed++;
            }
        }

        console.log(`\n🎯 Venue coordinate update complete!`);
        console.log(`✅ Fixed: ${fixed} venues`);
        console.log(`❌ Failed: ${failed} venues`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the script
if (require.main === module) {
    updateVenueCoordinates();
}

module.exports = { updateVenueCoordinates, geocodeVenue };

