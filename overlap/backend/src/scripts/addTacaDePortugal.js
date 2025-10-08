const mongoose = require('mongoose');
const League = require('../models/League');

const TACA_DE_PORTUGAL = {
    apiId: '97',
    name: 'Taca de Portugal',
    shortName: 'TDP',
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
};

async function main() {
    try {
        // Connect to MongoDB
        await mongoose.connect('mongodb://localhost:27017/overlap', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('📦 Connected to MongoDB');
        
        // Check if league already exists
        const existingLeague = await League.findOne({ apiId: TACA_DE_PORTUGAL.apiId });
        
        if (!existingLeague) {
            const league = new League(TACA_DE_PORTUGAL);
            await league.save();
            console.log(`✅ Created league: ${TACA_DE_PORTUGAL.name}`);
        } else {
            console.log(`⏭️  League already exists: ${TACA_DE_PORTUGAL.name}`);
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
