const mongoose = require('mongoose');
const Team = require('../models/Team');
const Venue = require('../models/Venue');
require('dotenv').config();
async function findMatchesWithoutCoordinates() {
    try {
        const mongoUrl = process.env.MONGO_PUBLIC_URL;
        if (!mongoUrl) {
            console.error('❌ MONGO_PUBLIC_URL environment variable not set');
            process.exit(1);
        }
        await mongoose.connect(mongoUrl);
        // Get all teams
        const teams = await Team.find({});
        const teamsWithoutVenue = [];
        const teamsWithoutCoords = [];
        const teamsWithCoords = [];
        for (const team of teams) {
            if (!team.venue || !team.venue.name) {
                teamsWithoutVenue.push({
                    name: team.name,
                    city: team.city || 'unknown',
                    country: team.country || 'unknown',
                    apiId: team.apiId
                });
            } else if (!team.venue.coordinates || !Array.isArray(team.venue.coordinates) || team.venue.coordinates.length !== 2) {
                teamsWithoutCoords.push({
                    name: team.name,
                    venue: team.venue.name,
                    city: team.city || 'unknown',
                    country: team.country || 'unknown',
                    apiId: team.apiId
                });
            } else {
                teamsWithCoords.push({
                    name: team.name,
                    venue: team.venue.name,
                    hasCoords: true
                });
            }
        }
        if (teamsWithoutCoords.length > 0) {
            teamsWithoutCoords.slice(0, 50).forEach(team => {
            });
            if (teamsWithoutCoords.length > 50) {
            }
        }
        if (teamsWithoutVenue.length > 0) {
            teamsWithoutVenue.slice(0, 50).forEach(team => {
            });
            if (teamsWithoutVenue.length > 50) {
            }
        }
        // Check if venues exist in Venue collection for teams without coordinates
        let venuesFound = 0;
        let venuesNotFound = 0;
        for (const team of teamsWithoutCoords.slice(0, 20)) { // Check first 20
            const venue = await Venue.findOne({
                $or: [
                    { name: { $regex: new RegExp(team.venue, 'i') } },
                    { city: { $regex: new RegExp(team.city, 'i') } }
                ],
                country: team.country
            });
            if (venue && venue.coordinates) {
                venuesFound++;
            } else {
                venuesNotFound++;
            }
        }
        // Save report
        const fs = require('fs');
        const report = {
            summary: {
                totalTeams: teams.length,
                withCoords: teamsWithCoords.length,
                withoutCoords: teamsWithoutCoords.length,
                withoutVenue: teamsWithoutVenue.length
            },
            teamsWithoutCoords: teamsWithoutCoords,
            teamsWithoutVenue: teamsWithoutVenue
        };
        fs.writeFileSync('./matches-without-coordinates-report.json', JSON.stringify(report, null, 2));
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}
findMatchesWithoutCoordinates();
