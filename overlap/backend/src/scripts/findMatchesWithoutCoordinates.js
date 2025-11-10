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
        console.log('📦 Connected to MongoDB\n');

        // Get all teams
        const teams = await Team.find({});
        console.log(`🔍 Analyzing ${teams.length} teams...\n`);

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

        console.log(`📊 Summary:`);
        console.log(`   ✅ Teams with venue + coordinates: ${teamsWithCoords.length}`);
        console.log(`   ⚠️  Teams with venue but NO coordinates: ${teamsWithoutCoords.length}`);
        console.log(`   ❌ Teams with NO venue: ${teamsWithoutVenue.length}`);

        if (teamsWithoutCoords.length > 0) {
            console.log(`\n⚠️  Teams with venue but missing coordinates (${teamsWithoutCoords.length}):`);
            teamsWithoutCoords.slice(0, 50).forEach(team => {
                console.log(`   - ${team.name} → ${team.venue} (${team.city}, ${team.country})`);
            });
            if (teamsWithoutCoords.length > 50) {
                console.log(`   ... and ${teamsWithoutCoords.length - 50} more`);
            }
        }

        if (teamsWithoutVenue.length > 0) {
            console.log(`\n❌ Teams without venue (${teamsWithoutVenue.length}):`);
            teamsWithoutVenue.slice(0, 50).forEach(team => {
                console.log(`   - ${team.name} (${team.city}, ${team.country})`);
            });
            if (teamsWithoutVenue.length > 50) {
                console.log(`   ... and ${teamsWithoutVenue.length - 50} more`);
            }
        }

        // Check if venues exist in Venue collection for teams without coordinates
        console.log(`\n🔍 Checking if venues exist in Venue collection for teams without coordinates...`);
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
                console.log(`   ✅ Found venue with coordinates: ${team.venue} → ${venue.name}`);
            } else {
                venuesNotFound++;
            }
        }

        console.log(`\n📊 Venue lookup results (sample of 20):`);
        console.log(`   ✅ Venues found with coordinates: ${venuesFound}`);
        console.log(`   ❌ Venues not found: ${venuesNotFound}`);

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
        console.log(`\n📄 Detailed report saved to: matches-without-coordinates-report.json`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n📦 Disconnected from MongoDB');
    }
}

findMatchesWithoutCoordinates();

