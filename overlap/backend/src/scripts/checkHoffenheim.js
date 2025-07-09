const mongoose = require('mongoose');
const Team = require('../models/Team');
require('dotenv').config();

async function checkHoffenheim() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('📦 Connected to MongoDB');

        // Try different name variations
        const searchPatterns = [
            /hoffenheim/i,
            /tsg/i,
            /1899/i
        ];

        for (const pattern of searchPatterns) {
            console.log(`\n🔍 Searching for pattern: ${pattern}`);
            const teams = await Team.find({
                $or: [
                    { name: pattern },
                    { aliases: pattern }
                ]
            });

            if (teams.length > 0) {
                teams.forEach(team => {
                    console.log('\nFound team:', {
                        name: team.name,
                        aliases: team.aliases,
                        venue: team.venue,
                        city: team.city
                    });
                });
            } else {
                console.log('No teams found with this pattern');
            }
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n📦 Disconnected from MongoDB');
    }
}

checkHoffenheim(); 