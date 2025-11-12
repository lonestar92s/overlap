const mongoose = require('mongoose');
const Team = require('../models/Team');
require('dotenv').config();

/**
 * Example script showing how to query teams by venue status
 * Run with: node src/scripts/findTeamsByVenueStatus.js
 */
async function findTeamsByVenueStatus() {
    try {
        const mongoUrl = process.env.MONGO_PUBLIC_URL;
        if (!mongoUrl) {
            console.error('❌ MONGO_PUBLIC_URL environment variable not set');
            process.exit(1);
        }
        
        await mongoose.connect(mongoUrl);
        console.log('📦 Connected to MongoDB\n');

        // Example 1: Find teams with venues but no venueId (need linking)
        console.log('🔍 Finding teams with venues but no venueId...');
        const teamsNeedingLinking = await Team.find({
            venue: { $exists: true, $ne: null },
            'venue.venueId': { $exists: false }
        }).select('name country city venue').lean();
        
        console.log(`   Found ${teamsNeedingLinking.length} teams needing venue linking\n`);
        teamsNeedingLinking.slice(0, 10).forEach(team => {
            console.log(`   - ${team.name} (${team.country}) - Venue: ${team.venue?.name || 'N/A'}`);
        });
        if (teamsNeedingLinking.length > 10) {
            console.log(`   ... and ${teamsNeedingLinking.length - 10} more\n`);
        }

        // Example 2: Find teams with venueId = null (explicitly null)
        console.log('🔍 Finding teams with venueId explicitly set to null...');
        const teamsWithNullVenueId = await Team.find({
            'venue.venueId': null
        }).select('name country city venue').lean();
        
        console.log(`   Found ${teamsWithNullVenueId.length} teams with null venueId\n`);

        // Example 3: Find teams with no venue at all
        console.log('🔍 Finding teams with no venue...');
        const teamsWithNoVenue = await Team.find({
            $or: [
                { venue: null },
                { venue: { $exists: false } }
            ]
        }).select('name country city').lean();
        
        console.log(`   Found ${teamsWithNoVenue.length} teams with no venue\n`);
        teamsWithNoVenue.slice(0, 10).forEach(team => {
            console.log(`   - ${team.name} (${team.country}, ${team.city || 'N/A'})`);
        });
        if (teamsWithNoVenue.length > 10) {
            console.log(`   ... and ${teamsWithNoVenue.length - 10} more\n`);
        }

        // Example 4: Find teams WITH venueId (successfully linked)
        console.log('🔍 Finding teams with venueId (successfully linked)...');
        const teamsWithVenueId = await Team.find({
            'venue.venueId': { $exists: true, $ne: null }
        }).select('name country city venue.venueId venue.name').lean();
        
        console.log(`   Found ${teamsWithVenueId.length} teams with venueId\n`);
        teamsWithVenueId.slice(0, 10).forEach(team => {
            console.log(`   - ${team.name} → Venue ID: ${team.venue?.venueId} (${team.venue?.name || 'N/A'})`);
        });
        if (teamsWithVenueId.length > 10) {
            console.log(`   ... and ${teamsWithVenueId.length - 10} more\n`);
        }

        // Example 5: Find teams with venueId but no coordinates (need geocoding)
        console.log('🔍 Finding teams with venueId but no coordinates...');
        const teamsNeedingCoords = await Team.find({
            'venue.venueId': { $exists: true, $ne: null },
            $or: [
                { 'venue.coordinates': { $exists: false } },
                { 'venue.coordinates': null },
                { 'venue.coordinates': [] }
            ]
        }).select('name country city venue').lean();
        
        console.log(`   Found ${teamsNeedingCoords.length} teams with venueId but no coordinates\n`);

        // Summary
        console.log('\n📊 Summary:');
        console.log(`   ✅ Teams with venueId: ${teamsWithVenueId.length}`);
        console.log(`   ⚠️  Teams needing linking: ${teamsNeedingLinking.length}`);
        console.log(`   ❌ Teams with no venue: ${teamsWithNoVenue.length}`);
        console.log(`   📍 Teams needing coordinates: ${teamsNeedingCoords.length}`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n📦 Disconnected from MongoDB');
    }
}

// Run the script
findTeamsByVenueStatus();

