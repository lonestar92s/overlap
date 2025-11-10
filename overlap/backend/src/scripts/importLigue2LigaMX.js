const mongoose = require('mongoose');
const axios = require('axios');
const https = require('https');
require('dotenv').config();

const Team = require('../models/Team');
const League = require('../models/League');
const Venue = require('../models/Venue');

// LocationIQ configuration for geocoding
const LOCATIONIQ_API_KEY = process.env.LOCATIONIQ_API_KEY;
const LOCATIONIQ_BASE_URL = 'https://us1.locationiq.com/v1';

// API-Sports configuration
const API_SPORTS_KEY = process.env.API_SPORTS_KEY || '0ab95ca9f7baeb6fd551af7ca41ed8d2';
const API_SPORTS_BASE_URL = 'https://v3.football.api-sports.io';

const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

// Current season year
const CURRENT_SEASON = new Date().getFullYear();
const SEASON = new Date().getMonth() >= 6 ? CURRENT_SEASON : CURRENT_SEASON - 1;

// Only import these two leagues
const TARGET_LEAGUES = [
    { id: 62, name: 'Ligue 2', country: 'France', countryCode: 'FR', tier: 2 },
    { id: 262, name: 'Liga MX', country: 'Mexico', countryCode: 'MX', tier: 1 },
];

// Helper function to get country code from country name
function getCountryCode(countryName) {
    const mapping = {
        'France': 'FR',
        'Mexico': 'MX',
    };
    return mapping[countryName] || 'INT';
}

// Rate limiting helper
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Get short name for league
function getShortName(leagueName) {
    const mapping = {
        'Ligue 2': 'FL2',
        'Liga MX': 'LMX',
    };
    return mapping[leagueName] || leagueName.substring(0, 3).toUpperCase();
}

// Import/Update League
async function importLeague(leagueData) {
    try {
        const existingLeague = await League.findOne({ apiId: leagueData.id.toString() });
        
        const leagueDataToSave = {
            apiId: leagueData.id.toString(),
            name: leagueData.name,
            shortName: getShortName(leagueData.name),
            country: leagueData.country,
            countryCode: leagueData.countryCode || getCountryCode(leagueData.country),
            tier: leagueData.tier || 1,
            emblem: `https://media.api-sports.io/football/leagues/${leagueData.id}.png`,
            season: {
                start: SEASON >= 6 ? `${SEASON}-08-01` : `${SEASON - 1}-08-01`,
                end: SEASON >= 6 ? `${SEASON + 1}-05-31` : `${SEASON}-05-31`,
                current: true
            },
            isActive: true,
            lastUpdated: new Date()
        };

        if (existingLeague) {
            await League.updateOne({ apiId: leagueData.id.toString() }, leagueDataToSave);
            return { action: 'updated', league: existingLeague };
        } else {
            const newLeague = await League.create(leagueDataToSave);
            return { action: 'created', league: newLeague };
        }
    } catch (error) {
        console.error(`❌ Error importing league ${leagueData.name}:`, error.message);
        return { action: 'error', error: error.message };
    }
}

// Geocode address using LocationIQ
async function geocodeAddress(address, venueName, city, country) {
    if (!LOCATIONIQ_API_KEY) {
        console.log('⚠️ LOCATIONIQ_API_KEY not set - skipping geocoding');
        return null;
    }

    try {
        let query = address || `${venueName}, ${city}, ${country}`;
        console.log(`🔍 Geocoding: ${query}`);
        
        const response = await axios.get(`${LOCATIONIQ_BASE_URL}/search.php`, {
            params: {
                key: LOCATIONIQ_API_KEY,
                q: query,
                format: 'json',
                limit: 1
            },
            timeout: 5000
        });

        if (response.data && response.data[0]) {
            const result = response.data[0];
            const coordinates = [parseFloat(result.lon), parseFloat(result.lat)];
            console.log(`✅ Geocoded to: [${coordinates[0]}, ${coordinates[1]}]`);
            return coordinates;
        }
        
        console.log(`⚠️ No geocoding results for: ${query}`);
        return null;
    } catch (error) {
        console.log(`❌ Geocoding error for ${address || venueName}:`, error.message);
        return null;
    }
}

// Import/Update Venue
async function importVenue(venueData, teamCountry, teamCountryCode) {
    try {
        if (!venueData || !venueData.id) {
            return null;
        }

        const existingVenue = await Venue.findOne({ venueId: venueData.id });
        
        let coordinates = null;
        let location = null;
        
        if (venueData.lat && venueData.lng) {
            coordinates = [parseFloat(venueData.lng), parseFloat(venueData.lat)];
            location = {
                type: 'Point',
                coordinates: coordinates
            };
        } else if (venueData.address || (venueData.name && venueData.city)) {
            console.log(`⚠️ Venue ${venueData.name} has no coordinates but has address: ${venueData.address || 'N/A'}`);
            coordinates = await geocodeAddress(
                venueData.address || null,
                venueData.name,
                venueData.city || '',
                venueData.country || teamCountry || ''
            );
            
            if (coordinates) {
                location = {
                    type: 'Point',
                    coordinates: coordinates
                };
                await delay(200);
            }
        }

        const venueToSave = {
            venueId: venueData.id,
            name: venueData.name,
            city: venueData.city || '',
            country: venueData.country || teamCountry || '',
            countryCode: venueData.countryCode || teamCountryCode || getCountryCode(venueData.country || teamCountry),
            address: venueData.address || '',
            capacity: venueData.capacity || null,
            surface: venueData.surface || null,
            image: venueData.image || null,
            coordinates: coordinates || undefined,
            location: location || undefined,
            isActive: true,
            lastUpdated: new Date()
        };

        if (existingVenue) {
            await Venue.updateOne({ venueId: venueData.id }, venueToSave);
            return { action: 'updated', venue: existingVenue, venueId: venueData.id };
        } else {
            const newVenue = await Venue.create(venueToSave);
            return { action: 'created', venue: newVenue, venueId: venueData.id };
        }
    } catch (error) {
        console.error(`❌ Error importing venue ${venueData?.name}:`, error.message);
        return null;
    }
}

// Import/Update Team
async function importTeam(teamData, leagueId, leagueName) {
    try {
        if (!teamData || !teamData.id) {
            return null;
        }

        const existingTeam = await Team.findOne({ apiId: teamData.id.toString() });
        
        let venueInfo = null;
        if (teamData.venue) {
            venueInfo = {
                name: teamData.venue.name || '',
                capacity: teamData.venue.capacity || null,
                coordinates: teamData.venue.lat && teamData.venue.lng 
                    ? [parseFloat(teamData.venue.lng), parseFloat(teamData.venue.lat)]
                    : null
            };
        }

        const leagueAssociation = {
            leagueId: leagueId,
            leagueName: leagueName,
            season: SEASON.toString(),
            isActive: true
        };

        const teamToSave = {
            apiId: teamData.id.toString(),
            name: teamData.name,
            code: teamData.code || null,
            founded: teamData.founded || null,
            logo: teamData.logo || null,
            country: teamData.country || '',
            city: teamData.venue?.city || '',
            venue: venueInfo,
            apiSource: 'api-sports',
            lastUpdated: new Date()
        };

        if (existingTeam) {
            const hasLeague = existingTeam.leagues.some(
                l => l.leagueId === leagueId && l.season === SEASON.toString()
            );
            
            if (!hasLeague) {
                existingTeam.leagues.push(leagueAssociation);
            }
            
            Object.assign(existingTeam, teamToSave);
            await existingTeam.save();
            return { action: 'updated', team: existingTeam };
        } else {
            teamToSave.leagues = [leagueAssociation];
            const newTeam = await Team.create(teamToSave);
            return { action: 'created', team: newTeam };
        }
    } catch (error) {
        console.error(`❌ Error importing team ${teamData?.name}:`, error.message);
        return null;
    }
}

// Fetch teams for a league
async function fetchTeamsForLeague(leagueId, leagueName, season = SEASON) {
    try {
        console.log(`\n📡 Fetching teams for ${leagueName} (League ID: ${leagueId}, Season: ${season})...`);
        
        const response = await axios.get(`${API_SPORTS_BASE_URL}/teams`, {
            params: {
                league: leagueId,
                season: season
            },
            headers: {
                'x-apisports-key': API_SPORTS_KEY
            },
            httpsAgent,
            timeout: 15000
        });

        if (!response.data || !response.data.response) {
            console.log(`⚠️ No teams data for ${leagueName}`);
            return [];
        }

        const teams = response.data.response;
        console.log(`✅ Found ${teams.length} teams in ${leagueName}`);
        
        return teams;
    } catch (error) {
        console.error(`❌ Error fetching teams for ${leagueName}:`, error.message);
        if (error.response) {
            console.error(`Response status: ${error.response.status}`);
            console.error(`Response data:`, error.response.data);
        }
        return [];
    }
}

// Main import function for a single league
async function importLeagueData(leagueData) {
    const stats = {
        league: { created: 0, updated: 0, errors: 0 },
        teams: { created: 0, updated: 0, errors: 0 },
        venues: { created: 0, updated: 0, errors: 0 }
    };

    try {
        console.log(`\n🏆 Processing ${leagueData.name}...`);
        
        // Step 1: Import/Update League
        console.log(`  📋 Importing league...`);
        const leagueResult = await importLeague(leagueData);
        if (leagueResult.action === 'created') {
            stats.league.created++;
            console.log(`    ✅ Created league: ${leagueData.name}`);
        } else if (leagueResult.action === 'updated') {
            stats.league.updated++;
            console.log(`    🔄 Updated league: ${leagueData.name}`);
        } else {
            stats.league.errors++;
            console.log(`    ❌ Error with league: ${leagueData.name}`);
            return stats;
        }

        // Step 2: Fetch teams for this league
        const teamsData = await fetchTeamsForLeague(leagueData.id, leagueData.name);
        
        if (teamsData.length === 0) {
            console.log(`    ⚠️ No teams found for ${leagueData.name}`);
            return stats;
        }

        // Step 3: Process each team
        const venueIds = new Set();
        
        for (const teamResponse of teamsData) {
            const team = teamResponse.team;
            const venue = teamResponse.venue;
            
            // Import venue first if it exists and we haven't processed it yet
            if (venue && venue.id && !venueIds.has(venue.id)) {
                const venueResult = await importVenue(venue, team.country, getCountryCode(team.country));
                if (venueResult) {
                    venueIds.add(venue.id);
                    if (venueResult.action === 'created') {
                        stats.venues.created++;
                    } else if (venueResult.action === 'updated') {
                        stats.venues.updated++;
                    }
                }
                await delay(100);
            }
            
            // Import team
            const teamResult = await importTeam(team, leagueData.id.toString(), leagueData.name);
            if (teamResult) {
                if (teamResult.action === 'created') {
                    stats.teams.created++;
                } else if (teamResult.action === 'updated') {
                    stats.teams.updated++;
                }
            } else {
                stats.teams.errors++;
            }
            
            await delay(100);
        }

        console.log(`  ✅ Completed ${leagueData.name}: ${stats.teams.created + stats.teams.updated} teams, ${stats.venues.created + stats.venues.updated} venues`);
        
        return stats;
    } catch (error) {
        console.error(`❌ Error processing league ${leagueData.name}:`, error.message);
        stats.league.errors++;
        return stats;
    }
}

// Main execution
async function main() {
    try {
        console.log('🚀 Starting import of Ligue 2 and Liga MX...\n');
        console.log(`📅 Using season: ${SEASON}`);
        console.log(`📋 Will import ${TARGET_LEAGUES.length} leagues\n`);

        // Connect to MongoDB
        const mongoUri = process.env.MONGO_PUBLIC_URL || process.env.MONGODB_URI || process.env.MONGO_URL || 'mongodb://localhost:27017/flight-match-finder';
        await mongoose.connect(mongoUri);
        
        const safeUri = mongoUri.replace(/mongodb:\/\/([^:]+):([^@]+)@/, 'mongodb://***:***@');
        console.log(`✅ Connected to MongoDB: ${safeUri}\n`);

        const totalStats = {
            league: { created: 0, updated: 0, errors: 0 },
            teams: { created: 0, updated: 0, errors: 0 },
            venues: { created: 0, updated: 0, errors: 0 }
        };

        // Process each league
        for (let i = 0; i < TARGET_LEAGUES.length; i++) {
            const leagueData = TARGET_LEAGUES[i];
            const stats = await importLeagueData(leagueData);
            
            // Aggregate stats
            Object.keys(stats).forEach(key => {
                Object.keys(stats[key]).forEach(action => {
                    totalStats[key][action] += stats[key][action];
                });
            });

            // Rate limiting between leagues
            if (i < TARGET_LEAGUES.length - 1) {
                console.log('⏳ Waiting 2 seconds before next league...');
                await delay(2000);
            }
        }

        // Print final summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 IMPORT SUMMARY');
        console.log('='.repeat(60));
        console.log('\n🏆 LEAGUES:');
        console.log(`   Created: ${totalStats.league.created}`);
        console.log(`   Updated: ${totalStats.league.updated}`);
        console.log(`   Errors: ${totalStats.league.errors}`);
        
        console.log('\n⚽ TEAMS:');
        console.log(`   Created: ${totalStats.teams.created}`);
        console.log(`   Updated: ${totalStats.teams.updated}`);
        console.log(`   Errors: ${totalStats.teams.errors}`);
        
        console.log('\n🏟️ VENUES:');
        console.log(`   Created: ${totalStats.venues.created}`);
        console.log(`   Updated: ${totalStats.venues.updated}`);
        console.log(`   Errors: ${totalStats.venues.errors}`);

        console.log('\n✨ Import completed!');

    } catch (error) {
        console.error('❌ Import failed:', error);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
        process.exit(0);
    }
}

// Run if executed directly
if (require.main === module) {
    main();
}

module.exports = { importLeagueData, TARGET_LEAGUES };

