const mongoose = require('mongoose');
const Team = require('../models/Team');
const Venue = require('../models/Venue');
require('dotenv').config();

async function linkAllTeamVenues() {
    try {
        const mongoUrl = process.env.MONGO_PUBLIC_URL;
        if (!mongoUrl) {
            console.error('❌ MONGO_PUBLIC_URL environment variable not set');
            process.exit(1);
        }
        
        // Warn if connecting to production
        if (mongoUrl.includes('railway') || mongoUrl.includes('mongo:')) {
            console.log('⚠️  WARNING: Connecting to Railway/production database');
            console.log('   This will update production data!\n');
        }
        
        await mongoose.connect(mongoUrl);
        console.log('📦 Connected to MongoDB\n');

        // Get all teams
        const teams = await Team.find({});
        console.log(`🔍 Found ${teams.length} total teams\n`);

        let linked = 0;
        let alreadyLinked = 0;
        let notFound = [];
        let noCoords = [];
        let errors = [];

        for (const team of teams) {
            try {
                // Skip if already has venue with coordinates
                if (team.venue && team.venue.coordinates && Array.isArray(team.venue.coordinates) && team.venue.coordinates.length === 2) {
                    alreadyLinked++;
                    continue;
                }

                // Try to find venue by team name
                let venue = null;
                
                // Strategy 1: Search by team name in venue name
                venue = await Venue.findOne({
                    name: { $regex: new RegExp(team.name, 'i') },
                    country: team.country
                });

                // Strategy 2: Search by city if venue not found
                if (!venue && team.city) {
                    venue = await Venue.findOne({
                        city: { $regex: new RegExp(team.city, 'i') },
                        country: team.country
                    });
                }

                // Strategy 3: Search by team name variations (remove FC, remove common suffixes)
                if (!venue) {
                    const teamNameVariations = [
                        team.name,
                        team.name.replace(/\s*FC\s*/gi, ''),
                        team.name.replace(/\s*CF\s*/gi, ''),
                        team.name.replace(/\s*AC\s*/gi, ''),
                        team.name.replace(/\s*United\s*/gi, ''),
                        team.name.replace(/\s*City\s*/gi, '')
                    ].filter((v, i, arr) => arr.indexOf(v) === i); // Remove duplicates

                    for (const variation of teamNameVariations) {
                        venue = await Venue.findOne({
                            name: { $regex: new RegExp(variation, 'i') },
                            country: team.country
                        });
                        if (venue) break;
                    }
                }

                if (venue) {
                    // Check if venue has coordinates
                    const coords = venue.coordinates || venue.location?.coordinates;
                    
                    if (coords && Array.isArray(coords) && coords.length === 2) {
                        // Update team with venue data
                        team.venue = {
                            name: venue.name,
                            coordinates: coords,
                            capacity: venue.capacity || null
                        };
                        
                        // Also update city if missing
                        if (!team.city && venue.city) {
                            team.city = venue.city;
                        }

                        await team.save();
                        linked++;
                        
                        if (linked % 10 === 0) {
                            console.log(`✅ Linked ${linked} teams so far...`);
                        }
                    } else {
                        noCoords.push({
                            team: team.name,
                            venue: venue.name,
                            city: team.city || venue.city
                        });
                    }
                } else {
                    notFound.push({
                        team: team.name,
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

        console.log(`\n📊 Summary:`);
        console.log(`   ✅ Linked: ${linked}`);
        console.log(`   ⏭️  Already linked: ${alreadyLinked}`);
        console.log(`   ⚠️  Venue found but no coordinates: ${noCoords.length}`);
        console.log(`   ❌ Venue not found: ${notFound.length}`);
        console.log(`   ❌ Errors: ${errors.length}`);

        if (noCoords.length > 0) {
            console.log(`\n⚠️  Teams with venues but no coordinates (${noCoords.length}):`);
            noCoords.slice(0, 20).forEach(item => {
                console.log(`   - ${item.team} → ${item.venue} (${item.city})`);
            });
            if (noCoords.length > 20) {
                console.log(`   ... and ${noCoords.length - 20} more`);
            }
        }

        if (notFound.length > 0) {
            console.log(`\n❌ Teams without venues (${notFound.length}):`);
            notFound.slice(0, 20).forEach(item => {
                console.log(`   - ${item.team} (${item.city}, ${item.country})`);
            });
            if (notFound.length > 20) {
                console.log(`   ... and ${notFound.length - 20} more`);
            }
        }

        if (errors.length > 0) {
            console.log(`\n❌ Errors (${errors.length}):`);
            errors.slice(0, 10).forEach(item => {
                console.log(`   - ${item.team}: ${item.error}`);
            });
        }

        // Save detailed report
        const fs = require('fs');
        const report = {
            summary: {
                total: teams.length,
                linked,
                alreadyLinked,
                noCoords: noCoords.length,
                notFound: notFound.length,
                errors: errors.length
            },
            noCoords,
            notFound,
            errors
        };
        
        fs.writeFileSync('./team-venue-link-report.json', JSON.stringify(report, null, 2));
        console.log(`\n📄 Detailed report saved to: team-venue-link-report.json`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n📦 Disconnected from MongoDB');
    }
}

linkAllTeamVenues();

