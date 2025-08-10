const axios = require('axios');
const https = require('https');
const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/flight-match-finder');

// API-Sports configuration
const API_SPORTS_KEY = process.env.API_SPORTS_KEY || '0ab95ca9f7baeb6fd551af7ca41ed8d2';
const API_SPORTS_BASE_URL = 'https://v3.football.api-sports.io';

const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

// Venue Schema
const venueSchema = new mongoose.Schema({
    venueId: { type: Number, required: true, unique: true }, // API-Football venue ID
    name: { type: String, required: true },
    address: { type: String },
    city: { type: String, required: true },
    country: { type: String, required: true },
    coordinates: {
        type: [Number], // [longitude, latitude]
        index: '2dsphere' // For geographic queries
    },
    capacity: { type: Number },
    surface: { type: String },
    image: { type: String },
    lastUpdated: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true }
});

const Venue = mongoose.model('Venue', venueSchema);

// Simple geocoding function (you can replace with Google Maps API later)
async function geocodeAddress(address) {
    if (!address) return null;
    
    try {
        const response = await axios.get(`https://nominatim.openstreetmap.org/search`, {
            params: {
                q: address,
                format: 'json',
                limit: 1
            },
            timeout: 5000
        });
        
        if (response.data && response.data.length > 0) {
            const result = response.data[0];
            return [parseFloat(result.lon), parseFloat(result.lat)];
        }
        
        return null;
    } catch (error) {
        console.log(`❌ Geocoding failed for "${address}": ${error.message}`);
        return null;
    }
}

// Fetch venues from API-Football
async function fetchPremierLeagueVenues() {
    try {
        console.log('🔍 Fetching Premier League venues from API-Football...');
        
        // First, get all teams in Premier League to find their venues
        const teamsResponse = await axios.get(`${API_SPORTS_BASE_URL}/teams`, {
            params: {
                league: 39, // Premier League
                season: 2025
            },
            headers: {
                'x-apisports-key': API_SPORTS_KEY
            },
            httpsAgent,
            timeout: 10000
        });
        
        if (!teamsResponse.data || !teamsResponse.data.response) {
            throw new Error('No teams data received');
        }
        
        const teams = teamsResponse.data.response;
        console.log(`✅ Found ${teams.length} Premier League teams`);
        
        // Extract unique venues from teams
        const venues = new Map();
        
        for (const team of teams) {
            if (team.venue && team.venue.id) {
                venues.set(team.venue.id, {
                    id: team.venue.id,
                    name: team.venue.name,
                    city: team.venue.city
                });
            }
        }
        
        console.log(`🏟️ Found ${venues.size} unique venues`);
        
        // Fetch detailed venue data for each venue
        const venueDetails = [];
        
        for (const [venueId, venue] of venues) {
            try {
                console.log(`📡 Fetching details for venue ${venueId}: ${venue.name}`);
                
                const venueResponse = await axios.get(`${API_SPORTS_BASE_URL}/venues`, {
                    params: { id: venueId },
                    headers: {
                        'x-apisports-key': API_SPORTS_KEY
                    },
                    httpsAgent,
                    timeout: 5000
                });
                
                if (venueResponse.data && venueResponse.data.response && venueResponse.data.response.length > 0) {
                    const venueData = venueResponse.data.response[0];
                    venueDetails.push(venueData);
                    console.log(`✅ Got venue data: ${venueData.name} (${venueData.capacity} capacity)`);
                } else {
                    console.log(`⚠️ No detailed data for venue ${venueId}`);
                }
                
                // Rate limiting - small delay between requests
                await new Promise(resolve => setTimeout(resolve, 200));
                
            } catch (error) {
                console.log(`❌ Error fetching venue ${venueId}: ${error.message}`);
            }
        }
        
        return venueDetails;
        
    } catch (error) {
        console.error('❌ Error fetching Premier League venues:', error.message);
        throw error;
    }
}

// Import venues to MongoDB
async function importVenues(venues) {
    try {
        console.log(`\n🗄️ Importing ${venues.length} venues to MongoDB...`);
        
        let imported = 0;
        let updated = 0;
        let errors = 0;
        
        for (const venue of venues) {
            try {
                // Geocode the address
                let coordinates = null;
                if (venue.address) {
                    console.log(`🗺️ Geocoding: ${venue.address}`);
                    coordinates = await geocodeAddress(venue.address);
                    if (coordinates) {
                        console.log(`✅ Geocoded: [${coordinates[0]}, ${coordinates[1]}]`);
                    } else {
                        console.log(`⚠️ Geocoding failed for: ${venue.address}`);
                    }
                }
                
                // Check if venue already exists
                const existingVenue = await Venue.findOne({ venueId: venue.id });
                
                if (existingVenue) {
                    // Update existing venue
                    await Venue.updateOne(
                        { venueId: venue.id },
                        {
                            name: venue.name,
                            address: venue.address,
                            city: venue.city,
                            country: venue.country,
                            coordinates: coordinates || existingVenue.coordinates,
                            capacity: venue.capacity,
                            surface: venue.surface,
                            image: venue.image,
                            lastUpdated: new Date()
                        }
                    );
                    updated++;
                    console.log(`🔄 Updated: ${venue.name}`);
                } else {
                    // Create new venue
                    await Venue.create({
                        venueId: venue.id,
                        name: venue.name,
                        address: venue.address,
                        city: venue.city,
                        country: venue.country,
                        coordinates: coordinates,
                        capacity: venue.capacity,
                        surface: venue.surface,
                        image: venue.image
                    });
                    imported++;
                    console.log(`✅ Imported: ${venue.name}`);
                }
                
                // Rate limiting for geocoding
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.log(`❌ Error processing venue ${venue.name}: ${error.message}`);
                errors++;
            }
        }
        
        console.log(`\n📊 Import Summary:`);
        console.log(`✅ Imported: ${imported} new venues`);
        console.log(`🔄 Updated: ${updated} existing venues`);
        console.log(`❌ Errors: ${errors} venues`);
        
    } catch (error) {
        console.error('❌ Error importing venues:', error.message);
        throw error;
    }
}

// Main execution
async function main() {
    try {
        console.log('🚀 Starting Premier League venue import...\n');
        
        // Fetch venues from API-Football
        const venues = await fetchPremierLeagueVenues();
        
        if (venues.length === 0) {
            console.log('❌ No venues found to import');
            return;
        }
        
        // Import venues to MongoDB
        await importVenues(venues);
        
        console.log('\n🎉 Premier League venue import completed!');
        
        // Display summary
        const totalVenues = await Venue.countDocuments({ isActive: true });
        console.log(`📊 Total active venues in database: ${totalVenues}`);
        
    } catch (error) {
        console.error('❌ Import failed:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = { Venue, geocodeAddress }; 
 