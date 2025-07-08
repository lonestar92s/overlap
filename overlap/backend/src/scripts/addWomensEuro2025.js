const mongoose = require('mongoose');
const League = require('../models/League');

const WOMENS_EURO_2025 = {
    apiId: '1083',
    name: 'UEFA Women\'s Euro 2025',
    shortName: 'WEURO',
    country: 'Europe',
    countryCode: 'INT',
    tier: 1,
    emblem: 'https://media.api-sports.io/football/leagues/1083.png',
    season: {
        start: '2025-07-02',
        end: '2025-07-27',
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
        const existingLeague = await League.findOne({ apiId: WOMENS_EURO_2025.apiId });
        
        if (!existingLeague) {
            const league = new League(WOMENS_EURO_2025);
            await league.save();
            console.log(`✅ Created league: ${WOMENS_EURO_2025.name}`);
        } else {
            console.log(`⏭️  League already exists: ${WOMENS_EURO_2025.name}`);
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