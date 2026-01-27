const mongoose = require('mongoose');
const Team = require('../models/Team');
const Venue = require('../models/Venue');
require('dotenv').config();
/**
 * Migration script to backfill venueId for existing teams
 * This script finds teams with venue data but no venueId and links them to venues
 */
async function migrateTeamVenueIds() {
    try {
        const mongoUrl = process.env.MONGO_PUBLIC_URL;
        if (!mongoUrl) {
            console.error('❌ MONGO_PUBLIC_URL environment variable not set');
            process.exit(1);
        }
        // Warn if connecting to production
        if (mongoUrl.includes('railway') || mongoUrl.includes('mongo:')) {
        }
        await mongoose.connect(mongoUrl);
        // Find all teams with venue data but no venueId
        const teams = await Team.find({
            venue: { $exists: true, $ne: null },
            'venue.venueId': { $exists: false }
        });
        let linked = 0;
        let notFound = [];
        let noCoords = [];
        let errors = [];
        for (const team of teams) {
            try {
                // Skip if venue has no name
                if (!team.venue?.name) {
                    continue;
                }
                // Strategy 1: Search by exact venue name and country
                let venue = await Venue.findOne({
                    name: { $regex: new RegExp(`^${team.venue.name}$`, 'i') },
                    country: team.country
                });
                // Strategy 2: Search by partial venue name
                if (!venue) {
                    venue = await Venue.findOne({
                        name: { $regex: new RegExp(team.venue.name, 'i') },
                        country: team.country
                    });
                }
                // Strategy 3: Search by city if venue name doesn't match
                if (!venue && team.city) {
                    venue = await Venue.findOne({
                        city: { $regex: new RegExp(team.city, 'i') },
                        country: team.country
                    });
                }
                // Strategy 4: Try name variations (remove common prefixes)
                if (!venue && team.venue.name) {
                    const nameVariations = [
                        team.venue.name,
                        team.venue.name.replace(/^estadio\s+/i, ''),
                        team.venue.name.replace(/^estadi\s+/i, ''),
                        team.venue.name.replace(/^stadium\s+/i, ''),
                        team.venue.name.replace(/\s+stadium$/i, ''),
                        team.venue.name.replace(/\s+arena$/i, '')
                    ].filter((v, i, arr) => arr.indexOf(v) === i);
                    for (const variation of nameVariations) {
                        venue = await Venue.findOne({
                            name: { $regex: new RegExp(variation, 'i') },
                            country: team.country
                        });
                        if (venue) break;
                    }
                }
                if (venue) {
                    // Check if venue has coordinates (prefer venues with coordinates)
                    const coords = venue.coordinates || venue.location?.coordinates;
                    if (coords && Array.isArray(coords) && coords.length === 2) {
                        // Update team with venueId and ensure coordinates match
                        team.venue.venueId = venue.venueId;
                        if (!team.venue.coordinates || !Array.isArray(team.venue.coordinates)) {
                            team.venue.coordinates = coords;
                        }
                        await team.save();
                        linked++;
                        if (linked % 10 === 0) {
                        }
                    } else {
                        // Venue found but no coordinates
                        team.venue.venueId = venue.venueId;
                        await team.save();
                        linked++;
                        noCoords.push({
                            team: team.name,
                            venue: venue.name,
                            venueId: venue.venueId
                        });
                    }
                } else {
                    notFound.push({
                        team: team.name,
                        venueName: team.venue?.name,
                        city: team.city || 'unknown',
                        country: team.country || 'unknown'
                    });
                }
            } catch (error) {
                errors.push({
                    team: team.name,
                    error: error.message
                });
            }
        }
        if (noCoords.length > 0) {
            noCoords.slice(0, 20).forEach(item => {
            });
            if (noCoords.length > 20) {
            }
        }
        if (notFound.length > 0) {
            notFound.slice(0, 20).forEach(item => {
            });
            if (notFound.length > 20) {
            }
        }
        if (errors.length > 0) {
            errors.slice(0, 10).forEach(item => {
            });
        }
        // Save detailed report
        const fs = require('fs');
        const report = {
            summary: {
                total: teams.length,
                linked,
                noCoords: noCoords.length,
                notFound: notFound.length,
                errors: errors.length
            },
            noCoords,
            notFound,
            errors,
            timestamp: new Date().toISOString()
        };
        fs.writeFileSync('./team-venue-id-migration-report.json', JSON.stringify(report, null, 2));
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}
// Run migration
migrateTeamVenueIds();
