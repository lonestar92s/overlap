const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const axios = require('axios');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const Team = require('../models/Team');

// API-Sports configuration
const API_SPORTS_KEY = process.env.API_SPORTS_KEY;
const API_SPORTS_BASE_URL = 'https://v3.football.api-sports.io';

async function searchTeamInAPI(teamName) {
    try {
        const response = await axios.get(`${API_SPORTS_BASE_URL}/teams`, {
            params: { search: teamName },
            headers: {
                'x-apisports-key': API_SPORTS_KEY
            }
        });

        if (response.data.response && response.data.response.length > 0) {
            // Find the best match by comparing names
            const bestMatch = response.data.response.find(team => 
                team.team.name.toLowerCase() === teamName.toLowerCase() ||
                team.team.name.toLowerCase().includes(teamName.toLowerCase()) ||
                teamName.toLowerCase().includes(team.team.name.toLowerCase())
            );

            if (bestMatch) {
                return bestMatch.team.logo;
            }
        }
        return null;
    } catch (error) {
        console.error(`Error searching for team ${teamName}:`, error.message);
        return null;
    }
}

async function updateTeamLogos() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Find all teams without logos
        const teamsWithoutLogos = await Team.find({ logo: { $exists: false } });
        console.log(`Found ${teamsWithoutLogos.length} teams without logos`);

        let updated = 0;
        let failed = 0;

        // Update each team's logo
        for (const team of teamsWithoutLogos) {
            try {
                console.log(`\nProcessing ${team.name}...`);
                
                // Search for team in API-Sports
                const logo = await searchTeamInAPI(team.name);
                
                if (logo) {
                    // Update team with new logo
                    await Team.updateOne(
                        { _id: team._id },
                        { $set: { logo: logo } }
                    );
                    console.log(`✅ Updated logo for ${team.name}`);
                    updated++;
                } else {
                    console.log(`❌ No logo found for ${team.name}`);
                    failed++;
                }

                // Add a delay to respect API rate limits
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error(`Error updating ${team.name}:`, error.message);
                failed++;
            }
        }

        // Print summary
        console.log('\nUpdate Summary:');
        console.log(`Total teams processed: ${teamsWithoutLogos.length}`);
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