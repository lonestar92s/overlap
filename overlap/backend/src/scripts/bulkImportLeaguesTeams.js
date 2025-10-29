const mongoose = require('mongoose');
const axios = require('axios');
const https = require('https');
require('dotenv').config();

const Team = require('../models/Team');
const League = require('../models/League');

// API-Sports configuration
const API_SPORTS_KEY = process.env.API_SPORTS_KEY || '0ab95ca9f7baeb6fd551af7ca41ed8d2';
const API_SPORTS_BASE_URL = 'https://v3.football.api-sports.io';

const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

// Current season year
const CURRENT_SEASON = new Date().getFullYear();
const SEASON = new Date().getMonth() >= 6 ? CURRENT_SEASON : CURRENT_SEASON - 1;

// Major leagues to import (domestic top-tier + international competitions)
const MAJOR_LEAGUES = [
    // Top 5 European Leagues
    { id: 39, name: 'Premier League', country: 'England', countryCode: 'GB', tier: 1 },
    { id: 140, name: 'La Liga', country: 'Spain', countryCode: 'ES', tier: 1 },
    { id: 78, name: 'Bundesliga', country: 'Germany', countryCode: 'DE', tier: 1 },
    { id: 135, name: 'Serie A', country: 'Italy', countryCode: 'IT', tier: 1 },
    { id: 61, name: 'Ligue 1', country: 'France', countryCode: 'FR', tier: 1 },
    
    // Other Major European Leagues
    { id: 94, name: 'Primeira Liga', country: 'Portugal', countryCode: 'PT', tier: 1 },
    { id: 88, name: 'Eredivisie', country: 'Netherlands', countryCode: 'NL', tier: 1 },
    { id: 144, name: 'Jupiler Pro League', country: 'Belgium', countryCode: 'BE', tier: 1 },
    { id: 203, name: 'Süper Lig', country: 'Turkey', countryCode: 'TR', tier: 1 },
    { id: 188, name: 'Scottish Premiership', country: 'Scotland', countryCode: 'GB', tier: 1 },
    { id: 207, name: 'Swiss Super League', country: 'Switzerland', countryCode: 'CH', tier: 1 },
    
    // International Competitions
    { id: 2, name: 'Champions League', country: 'Europe', countryCode: 'INT', tier: 1 },
    { id: 3, name: 'Europa League', country: 'Europe', countryCode: 'INT', tier: 1 },
    { id: 848, name: 'Europa Conference League', country: 'Europe', countryCode: 'INT', tier: 1 },
    
    // Major Leagues Outside Europe
    { id: 253, name: 'Major League Soccer', country: 'USA', countryCode: 'US', tier: 1 },
    { id: 71, name: 'Série A', country: 'Brazil', countryCode: 'BR', tier: 1 },
    { id: 262, name: 'Liga MX', country: 'Mexico', countryCode: 'MX', tier: 1 },
    { id: 307, name: 'Saudi Pro League', country: 'Saudi Arabia', countryCode: 'SA', tier: 1 },
    { id: 98, name: 'J1 League', country: 'Japan', countryCode: 'JP', tier: 1 },
];

// Helper functions
function getCountryCode(countryName) {
    const mapping = {
        'England': 'GB', 'Spain': 'ES', 'Germany': 'DE', 'France': 'FR', 'Italy': 'IT',
        'Portugal': 'PT', 'Netherlands': 'NL', 'Belgium': 'BE', 'Turkey': 'TR',
        'Scotland': 'GB', 'Switzerland': 'CH', 'USA': 'US', 'United States': 'US',
        'Brazil': 'BR', 'Mexico': 'MX', 'Saudi Arabia': 'SA', 'Japan': 'JP',
        'Europe': 'INT', 'International': 'INT'
    };
    return mapping[countryName] || 'INT';
}

function getShortName(leagueName) {
    const mapping = {
        'Premier League': 'EPL', 'La Liga': 'LL', 'Bundesliga': 'BL1', 'Serie A': 'SA',
        'Ligue 1': 'FL1', 'Primeira Liga': 'PPL', 'Eredivisie': 'DED',
        'Jupiler Pro League': 'JPL', 'Süper Lig': 'TSL', 'Scottish Premiership': 'SPL',
        'Swiss Super League': 'SSL', 'Champions League': 'UCL', 'Europa League': 'UEL',
        'Europa Conference League': 'UECL', 'Major League Soccer': 'MLS', 'Série A': 'BSA',
        'Liga MX': 'LMX', 'Saudi Pro League': 'SPL', 'J1 League': 'J1'
    };
    return mapping[leagueName] || leagueName.substring(0, 3).toUpperCase();
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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

// Import/Update Team
async function importTeam(teamData, leagueId, leagueName) {
    try {
        if (!teamData || !teamData.id) {
            return null;
        }

        const existingTeam = await Team.findOne({ apiId: teamData.id.toString() });
        
        // Extract venue info if available (without geocoding)
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

        // Build league association
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
            // Update existing team - add league if not already associated
            const hasLeague = existingTeam.leagues.some(
                l => l.leagueId === leagueId && l.season === SEASON.toString()
            );
            
            if (!hasLeague) {
                existingTeam.leagues.push(leagueAssociation);
            }
            
            // Update team info
            Object.assign(existingTeam, teamToSave);
            await existingTeam.save();
            return { action: 'updated', team: existingTeam };
        } else {
            // Create new team
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
        console.log(`📡 Fetching teams for ${leagueName} (League ID: ${leagueId}, Season: ${season})...`);
        
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
        }
        return [];
    }
}

// Main import function for a single league
async function importLeagueData(leagueData) {
    const stats = {
        league: { created: 0, updated: 0, errors: 0 },
        teams: { created: 0, updated: 0, errors: 0 }
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

        // Step 3: Process each team (no venue geocoding)
        for (const teamResponse of teamsData) {
            const team = teamResponse.team;
            
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
        }

        console.log(`  ✅ Completed ${leagueData.name}: ${stats.teams.created + stats.teams.updated} teams`);
        
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
        console.log('🚀 Starting bulk import of leagues and teams (NO VENUES)...\n');
        console.log(`📅 Using season: ${SEASON}`);
        console.log(`📋 Will import ${MAJOR_LEAGUES.length} major leagues\n`);

        // Connect to MongoDB
        const mongoUri = process.env.MONGO_PUBLIC_URL || process.env.MONGODB_URI || process.env.MONGO_URL || 'mongodb://localhost:27017/flight-match-finder';
        await mongoose.connect(mongoUri);
        
        const safeUri = mongoUri.replace(/mongodb:\/\/([^:]+):([^@]+)@/, 'mongodb://***:***@');
        console.log(`✅ Connected to MongoDB: ${safeUri}\n`);

        const totalStats = {
            league: { created: 0, updated: 0, errors: 0 },
            teams: { created: 0, updated: 0, errors: 0 }
        };

        // Process each league
        for (let i = 0; i < MAJOR_LEAGUES.length; i++) {
            const leagueData = MAJOR_LEAGUES[i];
            const stats = await importLeagueData(leagueData);
            
            // Aggregate stats
            Object.keys(stats).forEach(key => {
                Object.keys(stats[key]).forEach(action => {
                    totalStats[key][action] += stats[key][action];
                });
            });

            // Small delay between leagues
            if (i < MAJOR_LEAGUES.length - 1) {
                await delay(1000);
            }
        }

        // Print final summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 BULK IMPORT SUMMARY');
        console.log('='.repeat(60));
        console.log('\n🏆 LEAGUES:');
        console.log(`   Created: ${totalStats.league.created}`);
        console.log(`   Updated: ${totalStats.league.updated}`);
        console.log(`   Errors: ${totalStats.league.errors}`);
        
        console.log('\n⚽ TEAMS:');
        console.log(`   Created: ${totalStats.teams.created}`);
        console.log(`   Updated: ${totalStats.teams.updated}`);
        console.log(`   Errors: ${totalStats.teams.errors}`);

        // Database totals
        const dbTotals = {
            leagues: await League.countDocuments(),
            teams: await Team.countDocuments()
        };

        console.log('\n📈 DATABASE TOTALS:');
        console.log(`   Total Leagues: ${dbTotals.leagues}`);
        console.log(`   Total Teams: ${dbTotals.teams}`);
        console.log('\n✨ Bulk import completed!');

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

module.exports = { importLeagueData, MAJOR_LEAGUES };

