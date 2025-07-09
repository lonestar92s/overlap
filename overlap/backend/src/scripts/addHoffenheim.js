const mongoose = require('mongoose');
const Team = require('../models/Team');
require('dotenv').config();

async function addHoffenheim() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('📦 Connected to MongoDB');

        const hoffenheim = new Team({
            apiId: 'hoffenheim_2023',  // You might want to update this with the correct API ID
            name: 'TSG 1899 Hoffenheim',
            aliases: ['1899 Hoffenheim', 'Hoffenheim', 'TSG Hoffenheim'],
            code: 'TSG',
            founded: 1899,
            country: 'Germany',
            city: 'Sinsheim',
            venue: {
                name: 'PreZero Arena',
                city: 'Sinsheim',
                coordinates: [8.891667, 49.239444],
                capacity: 30150
            },
            leagues: [{
                leagueId: '78', // Bundesliga ID
                leagueName: 'Bundesliga',
                season: '2023/24',
                isActive: true
            }]
        });

        const result = await hoffenheim.save();
        console.log('✅ Added Hoffenheim to database:', result);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('📦 Disconnected from MongoDB');
    }
}

addHoffenheim(); 