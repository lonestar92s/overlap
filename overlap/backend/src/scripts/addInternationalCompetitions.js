const mongoose = require('mongoose');
const League = require('../models/League');

// International competitions data
const INTERNATIONAL_COMPETITIONS = [
    // World Cup Qualifiers
    {
        apiId: '5',
        name: 'UEFA World Cup Qualifiers',
        shortName: 'WCQ-UEFA',
        country: 'Europe',
        countryCode: 'INT',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/5.png',
        season: { start: '2025-03-01', end: '2026-03-31', current: true }
    },
    {
        apiId: '6',
        name: 'CONMEBOL World Cup Qualifiers',
        shortName: 'WCQ-CONMEBOL',
        country: 'South America',
        countryCode: 'INT',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/6.png',
        season: { start: '2025-03-01', end: '2026-03-31', current: true }
    },
    {
        apiId: '7',
        name: 'CONCACAF World Cup Qualifiers',
        shortName: 'WCQ-CONCACAF',
        country: 'North America',
        countryCode: 'INT',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/7.png',
        season: { start: '2025-03-01', end: '2026-03-31', current: true }
    },
    {
        apiId: '8',
        name: 'AFC World Cup Qualifiers',
        shortName: 'WCQ-AFC',
        country: 'Asia',
        countryCode: 'INT',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/8.png',
        season: { start: '2025-03-01', end: '2026-03-31', current: true }
    },
    {
        apiId: '9',
        name: 'CAF World Cup Qualifiers',
        shortName: 'WCQ-CAF',
        country: 'Africa',
        countryCode: 'INT',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/9.png',
        season: { start: '2025-03-01', end: '2026-03-31', current: true }
    },
    {
        apiId: '10',
        name: 'OFC World Cup Qualifiers',
        shortName: 'WCQ-OFC',
        country: 'Oceania',
        countryCode: 'INT',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/10.png',
        season: { start: '2025-03-01', end: '2026-03-31', current: true }
    },
    
    // International Friendlies
    {
        apiId: '11',
        name: 'International Friendlies',
        shortName: 'FRIENDLY',
        country: 'International',
        countryCode: 'INT',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/11.png',
        season: { start: '2025-01-01', end: '2025-12-31', current: true }
    },
    
    // Other International Competitions
    {
        apiId: '12',
        name: 'UEFA Nations League',
        shortName: 'UNL',
        country: 'Europe',
        countryCode: 'INT',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/12.png',
        season: { start: '2025-09-01', end: '2026-06-30', current: true }
    },
    {
        apiId: '14',
        name: 'Copa América',
        shortName: 'CA',
        country: 'South America',
        countryCode: 'INT',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/14.png',
        season: { start: '2025-06-01', end: '2025-07-31', current: true }
    },
    {
        apiId: '15',
        name: 'CONCACAF Gold Cup',
        shortName: 'GC',
        country: 'North America',
        countryCode: 'INT',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/15.png',
        season: { start: '2025-06-01', end: '2025-07-31', current: true }
    },
    {
        apiId: '16',
        name: 'AFC Asian Cup',
        shortName: 'AC',
        country: 'Asia',
        countryCode: 'INT',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/16.png',
        season: { start: '2025-01-01', end: '2025-02-28', current: true }
    },
    {
        apiId: '17',
        name: 'Africa Cup of Nations',
        shortName: 'AFCON',
        country: 'Africa',
        countryCode: 'INT',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/17.png',
        season: { start: '2025-01-01', end: '2025-02-28', current: true }
    },
    {
        apiId: '18',
        name: 'OFC Nations Cup',
        shortName: 'ONC',
        country: 'Oceania',
        countryCode: 'INT',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/18.png',
        season: { start: '2025-06-01', end: '2025-07-31', current: true }
    }
];

async function addInternationalCompetitions() {
    console.log('🌍 Adding international competitions...');
    
    for (const competition of INTERNATIONAL_COMPETITIONS) {
        try {
            const existingCompetition = await League.findOne({ apiId: competition.apiId });
            
            if (!existingCompetition) {
                const league = new League(competition);
                await league.save();
                console.log(`✅ Created international competition: ${competition.name}`);
            } else {
                console.log(`⏭️  Competition already exists: ${competition.name}`);
            }
        } catch (error) {
            console.error(`❌ Error creating competition ${competition.name}:`, error.message);
        }
    }
}

async function main() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/flight-match-finder');
        console.log('📡 Connected to MongoDB');

        // Add international competitions
        await addInternationalCompetitions();

        console.log('🎉 International competitions migration completed!');
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('📡 Disconnected from MongoDB');
    }
}

// Run the migration
if (require.main === module) {
    main();
}

module.exports = { addInternationalCompetitions };
