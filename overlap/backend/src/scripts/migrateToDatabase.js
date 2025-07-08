const mongoose = require('mongoose');
const League = require('../models/League');
const Team = require('../models/Team');
const Venue = require('../models/Venue');

// Import existing venue data
const {
    PREMIER_LEAGUE_VENUES,
    BUNDESLIGA_VENUES,
    SWISS_SUPER_LEAGUE_VENUES,
    LA_LIGA_VENUES,
    LIGUE_1_VENUES,
    EREDIVISIE_VENUES,
    PRIMEIRA_LIGA_VENUES,
    ITALIAN_SERIE_A_VENUES
} = require('../data/venues');

// League definitions
const LEAGUES_DATA = [
    {
        apiId: '39',
        name: 'Premier League',
        shortName: 'EPL',
        country: 'England',
        countryCode: 'GB',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/39.png',
        season: { start: '2025-08-01', end: '2026-05-31', current: true }
    },
    {
        apiId: '78',
        name: 'Bundesliga',
        shortName: 'BL1',
        country: 'Germany',
        countryCode: 'DE',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/78.png',
        season: { start: '2025-08-01', end: '2026-05-31', current: true }
    },
    {
        apiId: '207',
        name: 'Swiss Super League',
        shortName: 'SSL',
        country: 'Switzerland',
        countryCode: 'CH',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/207.png',
        season: { start: '2025-08-01', end: '2026-05-31', current: true }
    },
    {
        apiId: '140',
        name: 'La Liga',
        shortName: 'LL',
        country: 'Spain',
        countryCode: 'ES',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/140.png',
        season: { start: '2025-08-01', end: '2026-05-31', current: true }
    },
    {
        apiId: '61',
        name: 'Ligue 1',
        shortName: 'L1',
        country: 'France',
        countryCode: 'FR',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/61.png',
        season: { start: '2025-08-01', end: '2026-05-31', current: true }
    },
    {
        apiId: '88',
        name: 'Eredivisie',
        shortName: 'ED',
        country: 'Netherlands',
        countryCode: 'NL',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/88.png',
        season: { start: '2025-08-01', end: '2026-05-31', current: true }
    },
    {
        apiId: '94',
        name: 'Primeira Liga',
        shortName: 'PL',
        country: 'Portugal',
        countryCode: 'PT',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/94.png',
        season: { start: '2025-08-01', end: '2026-05-31', current: true }
    },
    {
        apiId: '135',
        name: 'Serie A',
        shortName: 'SA',
        country: 'Italy',
        countryCode: 'IT',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/135.png',
        season: { start: '2025-08-01', end: '2026-05-31', current: true }
    },
    {
        apiId: '1083',
        name: 'UEFA Women\'s Euro 2025',
        shortName: 'WEURO',
        country: 'Europe',
        countryCode: 'INT',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/1083.png',
        season: { start: '2025-07-02', end: '2025-07-27', current: true }
    }
];

// Map venue data to leagues
const VENUE_LEAGUES = [
    { venues: PREMIER_LEAGUE_VENUES, leagueApiId: '39' },
    { venues: BUNDESLIGA_VENUES, leagueApiId: '78' },
    { venues: SWISS_SUPER_LEAGUE_VENUES, leagueApiId: '207' },
    { venues: LA_LIGA_VENUES, leagueApiId: '140' },
    { venues: LIGUE_1_VENUES, leagueApiId: '61' },
    { venues: EREDIVISIE_VENUES, leagueApiId: '88' },
    { venues: PRIMEIRA_LIGA_VENUES, leagueApiId: '94' },
    { venues: ITALIAN_SERIE_A_VENUES, leagueApiId: '135' }
];

async function migrateLeagues() {
    console.log('🏆 Migrating leagues...');
    
    for (const leagueData of LEAGUES_DATA) {
        try {
            const existingLeague = await League.findOne({ apiId: leagueData.apiId });
            
            if (!existingLeague) {
                const league = new League(leagueData);
                await league.save();
                console.log(`✅ Created league: ${leagueData.name}`);
            } else {
                console.log(`⏭️  League already exists: ${leagueData.name}`);
            }
        } catch (error) {
            console.error(`❌ Error creating league ${leagueData.name}:`, error.message);
        }
    }
}

async function main() {
    try {
        // Connect to MongoDB
        await mongoose.connect('mongodb://localhost:27017/overlap', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('📦 Connected to MongoDB');
        
        // Migrate leagues
        await migrateLeagues();
        
        console.log('✨ Migration completed');
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Disconnected from MongoDB');
    }
}

main(); 