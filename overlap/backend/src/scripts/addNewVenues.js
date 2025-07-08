const mongoose = require('mongoose');
const axios = require('axios');
const Team = require('../models/Team');
const Venue = require('../models/Venue');
const League = require('../models/League');

// API-Sports configuration
const API_SPORTS_KEY = process.env.API_SPORTS_KEY || '0ab95ca9f7baeb6fd551af7ca41ed8d2';
const API_SPORTS_BASE_URL = 'https://v3.football.api-sports.io';

/**
 * Get venue data from API-Sports
 */
async function getVenueFromApiSports(teamId) {
    try {
        const response = await axios.get(`${API_SPORTS_BASE_URL}/teams`, {
            headers: {
                'x-apisports-key': API_SPORTS_KEY
            },
            params: {
                id: teamId
            }
        });

        if (response.data.response.length > 0) {
            const teamData = response.data.response[0];
            const venue = teamData.venue;
            
            // Get country code from the country name
            const countryCode = getCountryCodeFromName(teamData.team.country);
            if (!countryCode) {
                console.log(`❌ Could not determine country code for ${teamData.team.country}`);
                return null;
            }

            // Parse coordinates, ensuring they are numbers
            const coordinates = [
                parseFloat(venue.lng) || 0,
                parseFloat(venue.lat) || 0
            ];

            // Skip if coordinates are invalid
            if (coordinates[0] === 0 || coordinates[1] === 0) {
                console.log(`❌ Invalid coordinates for ${venue.name}: [${coordinates}]`);
                return null;
            }

            return {
                name: venue.name,
                city: venue.city,
                country: teamData.team.country,
                countryCode: countryCode,
                capacity: venue.capacity,
                coordinates: coordinates
            };
        }
        return null;
    } catch (error) {
        console.error(`Error getting venue data for team ${teamId}:`, error.message);
        return null;
    }
}

// Helper function to get country code
function getCountryCodeFromName(country) {
    const countryMapping = {
        'Spain': 'ES',
        'England': 'GB',
        'Germany': 'DE',
        'Italy': 'IT',
        'France': 'FR',
        'Netherlands': 'NL',
        'Portugal': 'PT',
        'Belgium': 'BE',
        'Brazil': 'BR',
        'United States': 'US',
        'Japan': 'JP'
    };
    return countryMapping[country];
}

/**
 * Add a new venue to the database
 */
async function addVenue(venueData) {
    try {
        // Check if venue already exists
        const existingVenue = await Venue.findOne({
            name: venueData.name,
            city: venueData.city
        });

        if (existingVenue) {
            console.log(`⚠️  Venue already exists: ${venueData.name} in ${venueData.city}`);
            return existingVenue;
        }

        // Create new venue with GeoJSON format
        const venue = new Venue({
            name: venueData.name,
            city: venueData.city,
            country: venueData.country,
            countryCode: venueData.countryCode,
            capacity: venueData.capacity,
            surface: 'Natural grass', // Default value, update if available
            location: {
                type: 'Point',
                coordinates: venueData.coordinates
            }
        });

        await venue.save();
        console.log(`✅ Added venue: ${venue.name}`);
        return venue;
    } catch (error) {
        console.error(`Error adding venue ${venueData.name}:`, error.message);
        return null;
    }
}

/**
 * Add venues for all teams in a league
 */
async function addVenuesForLeague(leagueApiId) {
    try {
        console.log(`\n🏟️  Adding venues for league ${leagueApiId}...`);

        // Get teams in league from API-Sports
        const response = await axios.get(`${API_SPORTS_BASE_URL}/teams`, {
            headers: {
                'x-apisports-key': API_SPORTS_KEY
            },
            params: {
                league: leagueApiId,
                season: new Date().getFullYear()
            }
        });

        if (!response.data.response.length) {
            console.log(`❌ No teams found for league ${leagueApiId}`);
            return;
        }

        let added = 0;
        let skipped = 0;
        let errors = 0;

        for (const teamData of response.data.response) {
            try {
                const venueData = await getVenueFromApiSports(teamData.team.id);
                if (!venueData) {
                    console.log(`❌ No venue data for team ${teamData.team.name}`);
                    errors++;
                    continue;
                }

                const venue = await addVenue(venueData);
                if (venue) {
                    if (venue.isNew) {
                        added++;
                    } else {
                        skipped++;
                    }

                    // Update team with venue reference
                    await Team.findOneAndUpdate(
                        { apiId: teamData.team.id },
                        { 
                            venueId: venue._id,
                            venue: {
                                name: venue.name,
                                coordinates: venue.location.coordinates
                            }
                        },
                        { upsert: true }
                    );
                } else {
                    errors++;
                }
            } catch (error) {
                console.error(`Error processing team ${teamData.team.name}:`, error.message);
                errors++;
            }

            // Rate limiting - 10 requests per minute
            await new Promise(resolve => setTimeout(resolve, 6000));
        }

        console.log('\n📊 Summary:');
        console.log(`   ✅ Added: ${added}`);
        console.log(`   ⏭️  Skipped: ${skipped}`);
        console.log(`   ❌ Errors: ${errors}`);

    } catch (error) {
        console.error(`Error adding venues for league ${leagueApiId}:`, error.message);
    }
}

/**
 * Add venues for specific teams
 */
async function addVenuesForTeams(teamIds) {
    console.log(`\n🏟️  Adding venues for ${teamIds.length} teams...`);

    let added = 0;
    let skipped = 0;
    let errors = 0;

    for (const teamId of teamIds) {
        try {
            const venueData = await getVenueFromApiSports(teamId);
            if (!venueData) {
                console.log(`❌ No venue data for team ${teamId}`);
                errors++;
                continue;
            }

            const venue = await addVenue(venueData);
            if (venue) {
                if (venue.isNew) {
                    added++;
                } else {
                    skipped++;
                }

                // Update team with venue reference
                await Team.findOneAndUpdate(
                    { apiId: teamId },
                    { 
                        venueId: venue._id,
                        venue: {
                            name: venue.name,
                            coordinates: venue.location.coordinates
                        }
                    },
                    { upsert: true }
                );
            } else {
                errors++;
            }
        } catch (error) {
            console.error(`Error processing team ${teamId}:`, error.message);
            errors++;
        }

        // Rate limiting - 10 requests per minute
        await new Promise(resolve => setTimeout(resolve, 6000));
    }

    console.log('\n📊 Summary:');
    console.log(`   ✅ Added: ${added}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
}

// Connect to MongoDB and run the script
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/overlap';

if (require.main === module) {
    // Script is being run directly
    const args = process.argv.slice(2);
    const mode = args[0];
    const id = args[1];

    if (!mode || !id) {
        console.log('\nUsage:');
        console.log('  Add venues for a league:');
        console.log('    node addNewVenues.js league <leagueApiId>');
        console.log('  Add venues for specific teams:');
        console.log('    node addNewVenues.js teams <teamId1,teamId2,...>');
        process.exit(1);
    }

    mongoose.connect(MONGODB_URI, { 
        useNewUrlParser: true,
        useUnifiedTopology: true 
    })
        .then(async () => {
            console.log('📦 Connected to MongoDB');
            
            if (mode === 'league') {
                await addVenuesForLeague(id);
            } else if (mode === 'teams') {
                const teamIds = id.split(',');
                await addVenuesForTeams(teamIds);
            } else {
                console.log('❌ Invalid mode. Use "league" or "teams"');
            }
        })
        .then(() => {
            console.log('\n✨ Done!');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Fatal error:', error);
            process.exit(1);
        });
} else {
    // Script is being required as a module
    module.exports = {
        addVenuesForLeague,
        addVenuesForTeams,
        addVenue
    };
} 