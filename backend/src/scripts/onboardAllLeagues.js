const mongoose = require('mongoose');
const axios = require('axios');
const https = require('https');
require('dotenv').config();
const League = require('../models/League');
const leagueOnboardingService = require('../services/leagueOnboardingService');
// API-Sports configuration
const API_SPORTS_KEY = process.env.API_SPORTS_KEY || '0ab95ca9f7baeb6fd551af7ca41ed8d2';
const API_SPORTS_BASE_URL = 'https://v3.football.api-sports.io';
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});
// Current season year
const CURRENT_SEASON = new Date().getFullYear();
const SEASON = new Date().getMonth() >= 6 ? CURRENT_SEASON : CURRENT_SEASON - 1;
// Helper function to get country code from country name
function getCountryCode(countryName) {
    const mapping = {
        'England': 'GB',
        'Spain': 'ES',
        'Germany': 'DE',
        'France': 'FR',
        'Italy': 'IT',
        'Portugal': 'PT',
        'Netherlands': 'NL',
        'Belgium': 'BE',
        'Turkey': 'TR',
        'Scotland': 'GB',
        'Switzerland': 'CH',
        'USA': 'US',
        'United States': 'US',
        'Brazil': 'BR',
        'Mexico': 'MX',
        'Saudi Arabia': 'SA',
        'Japan': 'JP',
        'Europe': 'INT',
        'International': 'INT',
        'Africa': 'INT',
        'Asia': 'INT',
        'South America': 'INT',
        'North America': 'INT',
        'Oceania': 'INT'
    };
    return mapping[countryName] || 'INT';
}
// Rate limiting helper
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
// Fetch all leagues from API-Football
async function fetchAllLeaguesFromAPI() {
    try {
        const response = await axios.get(`${API_SPORTS_BASE_URL}/leagues`, {
            params: {
                season: SEASON
            },
            headers: {
                'x-apisports-key': API_SPORTS_KEY
            },
            httpsAgent,
            timeout: 30000
        });
        if (!response.data || !response.data.response) {
            return [];
        }
        const leagues = response.data.response;
        return leagues;
    } catch (error) {
        console.error('❌ Error fetching leagues from API:', error.message);
        if (error.response) {
            console.error(`Response status: ${error.response.status}`);
            console.error(`Response data:`, error.response.data);
        }
        return [];
    }
}
// Filter leagues for onboarding (active, current season, etc.)
function filterLeaguesForOnboarding(apiLeagues) {
    return apiLeagues
        .filter(league => {
            // Only include leagues that are active and have current season data
            const hasCurrentSeason = league.seasons && league.seasons.some(
                season => season.year === SEASON && season.coverage?.fixtures?.events === true
            );
            // Exclude certain types of leagues (optional - adjust as needed)
            const excludedTypes = ['Cup', 'Playoffs', 'Play-off'];
            const isExcluded = excludedTypes.some(type => 
                league.league?.type?.includes(type)
            );
            return hasCurrentSeason && !isExcluded && league.league?.id;
        })
        .map(league => ({
            id: league.league.id,
            name: league.league.name,
            country: league.country.name,
            countryCode: getCountryCode(league.country.name),
            tier: league.league?.type === 'League' ? 1 : 1, // Default to tier 1, can be adjusted
            type: league.league?.type
        }));
}
// Main execution
async function main() {
    try {
        // Connect to MongoDB
        const mongoUri = process.env.MONGO_PUBLIC_URL || process.env.MONGODB_URI || process.env.MONGO_URL || 'mongodb://localhost:27017/flight-match-finder';
        await mongoose.connect(mongoUri);
        const safeUri = mongoUri.replace(/mongodb:\/\/([^:]+):([^@]+)@/, 'mongodb://***:***@');
        // Step 1: Fetch all leagues from API
        const apiLeagues = await fetchAllLeaguesFromAPI();
        if (apiLeagues.length === 0) {
            await mongoose.disconnect();
            process.exit(1);
        }
        // Step 2: Filter leagues for onboarding
        const leaguesToOnboard = filterLeaguesForOnboarding(apiLeagues);
        // Step 3: Check which leagues already exist in database
        const existingLeagueIds = new Set();
        const existingLeagues = await League.find({}).select('apiId').lean();
        existingLeagues.forEach(league => {
            existingLeagueIds.add(league.apiId);
        });
        const newLeagues = leaguesToOnboard.filter(league => !existingLeagueIds.has(league.id.toString()));
        const existingLeaguesToUpdate = leaguesToOnboard.filter(league => existingLeagueIds.has(league.id.toString()));
        // Step 4: Onboard leagues
        const stats = {
            total: leaguesToOnboard.length,
            processed: 0,
            successful: 0,
            failed: 0,
            skipped: 0,
            leagueStats: {
                created: 0,
                updated: 0,
                errors: 0
            },
            teamStats: {
                created: 0,
                updated: 0,
                errors: 0
            },
            venueStats: {
                created: 0,
                updated: 0,
                errors: 0
            }
        };
        for (let i = 0; i < leaguesToOnboard.length; i++) {
            const leagueData = leaguesToOnboard[i];
            stats.processed++;
            try {
                const progressCallback = (update) => {
                    if (update.step === 'league') {
                    } else if (update.step === 'teams') {
                    } else if (update.step === 'processing') {
                        if (update.current && update.total) {
                            process.stdout.write(`\r   ${update.message} (${update.current}/${update.total})`);
                        } else {
                        }
                    }
                };
                const result = await leagueOnboardingService.onboardLeague(leagueData, progressCallback);
                if (result.success) {
                    stats.successful++;
                    stats.leagueStats.created += result.stats.league.created;
                    stats.leagueStats.updated += result.stats.league.updated;
                    stats.leagueStats.errors += result.stats.league.errors;
                    stats.teamStats.created += result.stats.teams.created;
                    stats.teamStats.updated += result.stats.teams.updated;
                    stats.teamStats.errors += result.stats.teams.errors;
                    stats.venueStats.created += result.stats.venues.created;
                    stats.venueStats.updated += result.stats.venues.updated;
                    stats.venueStats.errors += result.stats.venues.errors;
                    if (result.warning) {
                    } else {
                    }
                } else {
                    stats.failed++;
                    stats.leagueStats.errors++;
                }
            } catch (error) {
                stats.failed++;
                stats.leagueStats.errors++;
            }
            // Rate limiting - wait between leagues to avoid hitting API limits
            if (i < leaguesToOnboard.length - 1) {
                const delayMs = 2000; // 2 seconds between leagues
                process.stdout.write(`\n   ⏳ Waiting ${delayMs}ms before next league...`);
                await delay(delayMs);
                process.stdout.write('\r   ' + ' '.repeat(50) + '\r'); // Clear the waiting message
            }
        }
        // Print final summary
        // Database totals
        const dbTotals = {
            leagues: await League.countDocuments({ isActive: true }),
            teams: await require('../models/Team').countDocuments(),
            venues: await require('../models/Venue').countDocuments()
        };
    } catch (error) {
        console.error('❌ Onboarding failed:', error);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}
// Run if executed directly
if (require.main === module) {
    main();
}
module.exports = { fetchAllLeaguesFromAPI, filterLeaguesForOnboarding };
