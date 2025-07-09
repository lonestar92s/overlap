const mongoose = require('mongoose');
const Team = require('../models/Team');
const { teamSearchCache, matchesCache } = require('../utils/cache');
require('dotenv').config();

async function refreshBayernData() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('📦 Connected to MongoDB');

        // Clear application cache
        teamSearchCache.clear();
        matchesCache.clear();
        console.log('🧹 Cache cleared');

        // Update Bayern Munich's venue data
        const result = await Team.updateOne(
            { 
                $or: [
                    { name: 'FC Bayern München' },
                    { name: 'Bayern Munich' },
                    { aliases: { $in: ['Bayern Munich', 'Bayern München', 'FC Bayern München'] } }
                ]
            },
            {
                $set: {
                    'venue.name': 'Allianz Arena',
                    'venue.city': 'Munich',
                    'venue.coordinates': [11.624722, 48.218889],
                    city: 'Munich',
                    country: 'Germany'
                },
                $addToSet: {
                    aliases: {
                        $each: ['Bayern Munich', 'Bayern München', 'FC Bayern München', 'Bayern']
                    }
                }
            }
        );

        console.log('✅ Update result:', result);
        console.log('🔄 Bayern Munich data refreshed');

        // Verify the update
        const bayern = await Team.findOne({ name: 'FC Bayern München' });
        console.log('📍 Updated venue data:', bayern.venue);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('📦 Disconnected from MongoDB');
    }
}

refreshBayernData(); 