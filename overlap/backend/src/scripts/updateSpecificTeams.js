const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const Team = require('../models/Team');

// Map of team names to their official logo URLs
const teamLogos = {
    'Fulham FC': 'https://resources.premierleague.com/premierleague/badges/t54.png',
    'Manchester United FC': 'https://resources.premierleague.com/premierleague/badges/t1.png',
    'Arsenal FC': 'https://resources.premierleague.com/premierleague/badges/t3.png',
    'Manchester City FC': 'https://resources.premierleague.com/premierleague/badges/t43.png',
    'Liverpool FC': 'https://resources.premierleague.com/premierleague/badges/t14.png',
    'Chelsea FC': 'https://resources.premierleague.com/premierleague/badges/t8.png',
    'Tottenham Hotspur FC': 'https://resources.premierleague.com/premierleague/badges/t6.png',
    'Newcastle United FC': 'https://resources.premierleague.com/premierleague/badges/t4.png',
    'Aston Villa FC': 'https://resources.premierleague.com/premierleague/badges/t7.png',
    'Brighton & Hove Albion FC': 'https://resources.premierleague.com/premierleague/badges/t36.png',
    'West Ham United FC': 'https://resources.premierleague.com/premierleague/badges/t21.png',
    'Brentford FC': 'https://resources.premierleague.com/premierleague/badges/t94.png',
    'Crystal Palace FC': 'https://resources.premierleague.com/premierleague/badges/t31.png',
    'Nottingham Forest FC': 'https://resources.premierleague.com/premierleague/badges/t17.png',
    'AFC Bournemouth': 'https://resources.premierleague.com/premierleague/badges/t91.png',
    'Everton FC': 'https://resources.premierleague.com/premierleague/badges/t11.png',
    'Luton Town FC': 'https://resources.premierleague.com/premierleague/badges/t102.png',
    'Burnley FC': 'https://resources.premierleague.com/premierleague/badges/t90.png',
    'Sheffield United FC': 'https://resources.premierleague.com/premierleague/badges/t49.png'
};

async function updateTeamLogos() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        let updated = 0;
        let failed = 0;

        // Update each team's logo
        for (const [teamName, logoUrl] of Object.entries(teamLogos)) {
            try {
                const result = await Team.updateOne(
                    { name: teamName },
                    { $set: { logo: logoUrl } }
                );

                if (result.modifiedCount > 0) {
                    console.log(`✅ Updated logo for ${teamName}`);
                    updated++;
                } else {
                    console.log(`❌ No team found with name: ${teamName}`);
                    failed++;
                }
            } catch (error) {
                console.error(`Error updating ${teamName}:`, error.message);
                failed++;
            }
        }

        // Print summary
        console.log('\nUpdate Summary:');
        console.log(`Total teams processed: ${Object.keys(teamLogos).length}`);
        console.log(`Successfully updated: ${updated}`);
        console.log(`Failed to update: ${failed}`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    }
}

// Run the script
updateTeamLogos(); 