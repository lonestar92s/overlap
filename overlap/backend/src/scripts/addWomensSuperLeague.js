const mongoose = require('mongoose');
const League = require('../models/League');

const WOMENS_SUPER_LEAGUE = {
    apiId: '44',
    name: 'Women\'s Super League',
    shortName: 'WSL',
    country: 'England',
    countryCode: 'GB',
    tier: 1,
    emblem: 'https://media.api-sports.io/football/leagues/44.png',
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
        const existingLeague = await League.findOne({ apiId: WOMENS_SUPER_LEAGUE.apiId });
        
        if (!existingLeague) {
            const league = new League(WOMENS_SUPER_LEAGUE);
            await league.save();
            console.log(`✅ Created league: ${WOMENS_SUPER_LEAGUE.name}`);
        } else {
            console.log(`⏭️  League already exists: ${WOMENS_SUPER_LEAGUE.name}`);
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



