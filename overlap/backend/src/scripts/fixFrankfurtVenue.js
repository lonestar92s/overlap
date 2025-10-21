const mongoose = require('mongoose');
const Team = require('../models/Team');
const { teamSearchCache, matchesCache } = require('../utils/cache');
require('dotenv').config();

async function fixFrankfurtVenue() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('📦 Connected to MongoDB');

        // Clear application cache
        teamSearchCache.clear();
        matchesCache.clear();
        console.log('🧹 Cache cleared');

        // Update Eintracht Frankfurt's venue data
        const result = await Team.updateOne(
            { 
                $or: [
                    { name: 'Eintracht Frankfurt' },
                    { aliases: 'Eintracht Frankfurt' }
                ]
            },
            {
                $set: {
                    'venue.name': 'Deutsche Bank Park',
                    'venue.city': 'Frankfurt',
                    'venue.coordinates': [8.645278, 50.068611], // [longitude, latitude]
                    city: 'Frankfurt',
                    country: 'Germany'
                },
                $addToSet: {
                    aliases: {
                        $each: ['Eintracht Frankfurt', 'Frankfurt', 'SGE']
                    }
                }
            }
        );

        console.log('✅ Update result:', result);
        console.log('🔄 Frankfurt venue data refreshed');

        // Verify the update
        const frankfurt = await Team.findOne({ name: 'Eintracht Frankfurt' });
   

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('📦 Disconnected from MongoDB');
    }
}

fixFrankfurtVenue(); 