const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const Team = require('../models/Team');

async function checkTeamLogos() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Find all teams
        const teams = await Team.find({});
        console.log(`Found ${teams.length} teams total`);

        // Check for teams with missing logos
        const teamsWithoutLogos = teams.filter(team => !team.logo);
        console.log(`\nTeams missing logos (${teamsWithoutLogos.length}):`);
        teamsWithoutLogos.forEach(team => {
            console.log(`- ${team.name} (${team.country})`);
        });

        // Check for teams with potentially broken logo URLs
        const teamsWithBrokenLogos = teams.filter(team => 
            team.logo && 
            (!team.logo.startsWith('http://') && !team.logo.startsWith('https://'))
        );
        console.log(`\nTeams with potentially invalid logo URLs (${teamsWithBrokenLogos.length}):`);
        teamsWithBrokenLogos.forEach(team => {
            console.log(`- ${team.name}: ${team.logo}`);
        });

        // Summary
        console.log('\nSummary:');
        console.log(`Total teams: ${teams.length}`);
        console.log(`Teams with logos: ${teams.length - teamsWithoutLogos.length}`);
        console.log(`Teams without logos: ${teamsWithoutLogos.length}`);
        console.log(`Teams with potentially invalid logos: ${teamsWithBrokenLogos.length}`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    }
}

// Run the script
checkTeamLogos(); 