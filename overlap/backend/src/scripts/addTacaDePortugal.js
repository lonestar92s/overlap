const mongoose = require('mongoose');
const League = require('../models/League');

const PORTUGUESE_COMPETITIONS = [
    {
        apiId: '96',
        name: 'Taca de Portugal',
        shortName: 'TDP',
        country: 'Portugal',
        countryCode: 'PT',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/96.png',
        season: {
            start: '2024-09-01',
            end: '2025-05-25',
            current: true
        },
        isActive: true
    },
    {
        apiId: '97',
        name: 'Taca da Liga',
        shortName: 'TDL',
        country: 'Portugal',
        countryCode: 'PT',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/97.png',
        season: {
            start: '2024-09-01',
            end: '2025-05-25',
            current: true
        },
        isActive: true
    }
];

async function main() {
    try {
        // Connect to MongoDB
        await mongoose.connect('mongodb://localhost:27017/overlap', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('📦 Connected to MongoDB');
        
        // Add both Portuguese competitions
        for (const competition of PORTUGUESE_COMPETITIONS) {
            const existingLeague = await League.findOne({ apiId: competition.apiId });
            
            if (!existingLeague) {
                const league = new League(competition);
                await league.save();
                console.log(`✅ Created league: ${competition.name}`);
            } else {
                console.log(`⏭️  League already exists: ${competition.name}`);
            }
        }
        
        console.log('✨ Migration completed');
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Disconnected from MongoDB');
    }
}

main();
