const mongoose = require('mongoose');
const Team = require('../models/Team');
const { TEAM_TICKETING_URLS } = require('../config/teamTicketingUrls');
require('dotenv').config();

/**
 * Populate ticketing URLs from mapping configuration to Team database
 * 
 * This script:
 * 1. Reads ticketing URLs from teamTicketingUrls.js config
 * 2. Matches teams by name (case-insensitive)
 * 3. Updates Team documents with ticketingUrl field
 * 
 * Usage: node src/scripts/populateTicketingUrls.js
 */
async function populateTicketingUrls() {
    try {
        const mongoUrl = process.env.MONGO_PUBLIC_URL || process.env.MONGO_URL;
        if (!mongoUrl) {
            console.error('❌ MONGO_PUBLIC_URL or MONGO_URL environment variable not set');
            process.exit(1);
        }
        
        // Warn if connecting to production
        if (mongoUrl.includes('railway') || mongoUrl.includes('mongo:')) {
            console.log('⚠️  WARNING: Connecting to Railway/production database');
            console.log('   This will update production data!\n');
        }
        
        await mongoose.connect(mongoUrl);
        console.log('📦 Connected to MongoDB\n');

        console.log(`📋 Found ${Object.keys(TEAM_TICKETING_URLS).length} teams in ticketing URL mapping\n`);

        let updated = 0;
        let notFound = [];
        let alreadySet = 0;
        let errors = [];

        // Iterate through mapping and update teams
        for (const [teamName, ticketingUrl] of Object.entries(TEAM_TICKETING_URLS)) {
            try {
                // Find team by name (case-insensitive)
                const team = await Team.findOne({
                    name: { $regex: new RegExp(`^${teamName}$`, 'i') }
                });

                if (!team) {
                    notFound.push(teamName);
                    continue;
                }

                // Skip if already set and matches
                if (team.ticketingUrl === ticketingUrl) {
                    alreadySet++;
                    continue;
                }

                // Update team with ticketing URL
                team.ticketingUrl = ticketingUrl;
                await team.save();
                updated++;
                console.log(`✅ Updated ${team.name}: ${ticketingUrl}`);

            } catch (error) {
                errors.push({ teamName, error: error.message });
                console.error(`❌ Error updating ${teamName}:`, error.message);
            }
        }

        console.log('\n📊 Summary:');
        console.log(`   ✅ Updated: ${updated}`);
        console.log(`   ⏭️  Already set: ${alreadySet}`);
        console.log(`   ❌ Not found: ${notFound.length}`);
        console.log(`   ⚠️  Errors: ${errors.length}`);

        if (notFound.length > 0) {
            console.log('\n⚠️  Teams not found in database:');
            notFound.forEach(name => console.log(`   - ${name}`));
        }

        if (errors.length > 0) {
            console.log('\n❌ Errors encountered:');
            errors.forEach(({ teamName, error }) => {
                console.log(`   - ${teamName}: ${error}`);
            });
        }

        await mongoose.disconnect();
        console.log('\n✅ Done!');

    } catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    populateTicketingUrls()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = populateTicketingUrls;
