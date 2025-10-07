const mongoose = require('mongoose');
const League = require('../models/League');

// International competitions data (Real API IDs)
const INTERNATIONAL_COMPETITIONS = [
    // World Cup Qualifiers
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
