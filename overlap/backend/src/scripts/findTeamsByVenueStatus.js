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
        // Example 1: Find teams with venues but no venueId (need linking)
        const teamsNeedingLinking = await Team.find({
            venue: { $exists: true, $ne: null },
            'venue.venueId': { $exists: false }
        }).select('name country city venue').lean();
        teamsNeedingLinking.slice(0, 10).forEach(team => {
        });
        if (teamsNeedingLinking.length > 10) {
        }
        // Example 2: Find teams with venueId = null (explicitly null)
        const teamsWithNullVenueId = await Team.find({
            'venue.venueId': null
        }).select('name country city venue').lean();
        // Example 3: Find teams with no venue at all
        const teamsWithNoVenue = await Team.find({
            $or: [
                { venue: null },
                { venue: { $exists: false } }
            ]
        }).select('name country city').lean();
        teamsWithNoVenue.slice(0, 10).forEach(team => {
        });
        if (teamsWithNoVenue.length > 10) {
        }
        // Example 4: Find teams WITH venueId (successfully linked)
        const teamsWithVenueId = await Team.find({
            'venue.venueId': { $exists: true, $ne: null }
        }).select('name country city venue.venueId venue.name').lean();
        teamsWithVenueId.slice(0, 10).forEach(team => {
        });
        if (teamsWithVenueId.length > 10) {
        }
        // Example 5: Find teams with venueId but no coordinates (need geocoding)
        const teamsNeedingCoords = await Team.find({
            'venue.venueId': { $exists: true, $ne: null },
            $or: [
                { 'venue.coordinates': { $exists: false } },
                { 'venue.coordinates': null },
                { 'venue.coordinates': [] }
            ]
        }).select('name country city venue').lean();
        // Summary
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}
// Run the script
findTeamsByVenueStatus();
