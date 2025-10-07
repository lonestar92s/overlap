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
    },
    
    // World Cup Qualifiers (Real API IDs)
    {
        apiId: '29',
        name: 'World Cup - Qualification Africa',
        shortName: 'WCQ-AFRICA',
        country: 'Africa',
        countryCode: 'INT',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/29.png',
        season: { start: '2025-03-01', end: '2026-03-31', current: true }
    },
    {
        apiId: '30',
        name: 'World Cup - Qualification Asia',
        shortName: 'WCQ-ASIA',
        country: 'Asia',
        countryCode: 'INT',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/30.png',
        season: { start: '2025-03-01', end: '2026-03-31', current: true }
    },
    {
        apiId: '31',
        name: 'World Cup - Qualification CONCACAF',
        shortName: 'WCQ-CONCACAF',
        country: 'North America',
        countryCode: 'INT',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/31.png',
        season: { start: '2025-03-01', end: '2026-03-31', current: true }
    },
    {
        apiId: '32',
        name: 'World Cup - Qualification Europe',
        shortName: 'WCQ-EUROPE',
        country: 'Europe',
        countryCode: 'INT',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/32.png',
        season: { start: '2025-03-01', end: '2026-03-31', current: true }
    },
    {
        apiId: '33',
        name: 'World Cup - Qualification Oceania',
        shortName: 'WCQ-OCEANIA',
        country: 'Oceania',
        countryCode: 'INT',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/33.png',
        season: { start: '2025-03-01', end: '2026-03-31', current: true }
    },
    {
        apiId: '34',
        name: 'World Cup - Qualification South America',
        shortName: 'WCQ-SOUTHAMERICA',
        country: 'South America',
        countryCode: 'INT',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/34.png',
        season: { start: '2025-03-01', end: '2026-03-31', current: true }
    },
    {
        apiId: '37',
        name: 'World Cup - Qualification Intercontinental Play-offs',
        shortName: 'WCQ-PLAYOFFS',
        country: 'International',
        countryCode: 'INT',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/37.png',
        season: { start: '2025-03-01', end: '2026-03-31', current: true }
    },
    
    // International Friendlies
    {
        apiId: '10',
        name: 'Friendlies',
        shortName: 'FRIENDLY',
        country: 'International',
        countryCode: 'INT',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/10.png',
        season: { start: '2025-01-01', end: '2025-12-31', current: true }
    },
    
    // Other International Competitions
    {
        apiId: '5',
        name: 'UEFA Nations League',
        shortName: 'UNL',
        country: 'Europe',
        countryCode: 'INT',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/5.png',
        season: { start: '2025-09-01', end: '2026-06-30', current: true }
    },
    {
        apiId: '6',
        name: 'Africa Cup of Nations',
        shortName: 'AFCON',
        country: 'Africa',
        countryCode: 'INT',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/6.png',
        season: { start: '2025-01-01', end: '2025-02-28', current: true }
    },
    {
        apiId: '7',
        name: 'Asian Cup',
        shortName: 'AC',
        country: 'Asia',
        countryCode: 'INT',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/7.png',
        season: { start: '2025-01-01', end: '2025-02-28', current: true }
    },
    {
        apiId: '8',
        name: 'World Cup - Women',
        shortName: 'WC-WOMEN',
        country: 'International',
        countryCode: 'INT',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/8.png',
        season: { start: '2025-07-01', end: '2025-08-31', current: true }
    },
    {
        apiId: '9',
        name: 'Copa America',
        shortName: 'CA',
        country: 'South America',
        countryCode: 'INT',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/9.png',
        season: { start: '2025-06-01', end: '2025-07-31', current: true }
    },
    {
        apiId: '15',
        name: 'FIFA Club World Cup',
        shortName: 'FCWC',
        country: 'International',
        countryCode: 'INT',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/15.png',
        season: { start: '2025-06-01', end: '2025-07-31', current: true }
    },
    {
        apiId: '26',
        name: 'International Champions Cup',
        shortName: 'ICC',
        country: 'International',
        countryCode: 'INT',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/26.png',
        season: { start: '2025-07-01', end: '2025-08-31', current: true }
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