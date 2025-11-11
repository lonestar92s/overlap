const mongoose = require('mongoose');
const Venue = require('../models/Venue');
const Team = require('../models/Team');
require('dotenv').config();

// Correct coordinates: [longitude, latitude] format (GeoJSON)
const VENUE_FIXES = [
    {
        name: 'Estadio Cívitas Metropolitano',
        aliases: ['Wanda Metropolitano', 'Metropolitano', 'Cívitas Metropolitano'],
        city: 'Madrid',
        country: 'Spain',
        coordinates: [-3.5988167155056567, 40.43640375765067] // [lng, lat]
    },
    {
        name: 'Estadio de Mestalla',
        aliases: ['Mestalla'],
        city: 'Valencia',
        country: 'Spain',
        coordinates: [-0.35809669343598216, 39.47482113122734] // [lng, lat]
    },
    {
        name: 'Estadio de la Cerámica',
        aliases: ['Cerámica', 'Estadio de la Ceramica'],
        city: 'Villarreal',
        country: 'Spain',
        coordinates: [-0.1022261518603701, 39.94405850712263] // [lng, lat]
    }
];

async function fixSpanishVenueCoordinates() {
    try {
        const mongoUrl = process.env.MONGO_PUBLIC_URL;
        if (!mongoUrl) {
            console.error('❌ MONGO_PUBLIC_URL environment variable not set');
            process.exit(1);
        }
        
        if (mongoUrl.includes('railway') || mongoUrl.includes('mongo:')) {
            console.log('⚠️  WARNING: Connecting to Railway/production database');
            console.log('   This will update production data!\n');
        }
        
        await mongoose.connect(mongoUrl);
        console.log('📦 Connected to MongoDB\n');

        let venuesFixed = 0;
        let teamsFixed = 0;

        for (const fix of VENUE_FIXES) {
            console.log(`\n🔧 Fixing: ${fix.name}`);
            console.log(`   Correct coordinates: [${fix.coordinates[0]}, ${fix.coordinates[1]}]`);

            // Find venue by name (try exact match and aliases)
            let venue = await Venue.findOne({
                $or: [
                    { name: fix.name },
                    { name: { $regex: new RegExp(fix.name, 'i') } },
                    ...fix.aliases.map(alias => ({ name: { $regex: new RegExp(alias, 'i') } }))
                ],
                country: { $in: ['Spain', 'España'] }
            });

            if (!venue) {
                // Try by city if name doesn't match
                venue = await Venue.findOne({
                    city: { $regex: new RegExp(fix.city, 'i') },
                    country: { $in: ['Spain', 'España'] }
                });
            }

            if (venue) {
                const oldCoords = venue.coordinates || venue.location?.coordinates;
                console.log(`   Found venue: ${venue.name}`);
                console.log(`   Old coordinates: ${oldCoords ? `[${oldCoords[0]}, ${oldCoords[1]}]` : 'None'}`);

                // Update venue
                venue.coordinates = fix.coordinates;
                venue.location = {
                    type: 'Point',
                    coordinates: fix.coordinates
                };
                venue.lastUpdated = new Date();
                await venue.save();
                console.log(`   ✅ Updated venue coordinates`);
                venuesFixed++;
            } else {
                console.log(`   ⚠️  Venue not found in Venue collection`);
            }

            // Find and update teams - ONLY teams that actually use this specific venue
            // Don't match by city alone - that would update all teams in the city!
            const teams = await Team.find({
                $or: [
                    { 'venue.name': { $regex: new RegExp(fix.name, 'i') } },
                    ...fix.aliases.map(alias => ({ 'venue.name': { $regex: new RegExp(alias, 'i') } }))
                ],
                country: { $in: ['Spain', 'España'] }
            });

            console.log(`   Found ${teams.length} teams with this venue name`);

            for (const team of teams) {
                // Double-check the venue name matches (case-insensitive)
                const teamVenueName = team.venue?.name || '';
                const matchesVenue = fix.name.toLowerCase() === teamVenueName.toLowerCase() ||
                                   fix.aliases.some(alias => alias.toLowerCase() === teamVenueName.toLowerCase()) ||
                                   teamVenueName.toLowerCase().includes(fix.name.toLowerCase()) ||
                                   fix.name.toLowerCase().includes(teamVenueName.toLowerCase());

                if (matchesVenue) {
                    if (!team.venue) {
                        team.venue = {};
                    }
                    team.venue.name = fix.name;
                    team.venue.coordinates = fix.coordinates;
                    if (!team.city || team.city === 'Unknown City') {
                        team.city = fix.city;
                    }
                    await team.save();
                    teamsFixed++;
                    console.log(`   ✅ Updated team: ${team.name} (venue: ${teamVenueName})`);
                } else {
                    console.log(`   ⏭️  Skipped team: ${team.name} (venue: ${teamVenueName} - doesn't match)`);
                }
            }
        }

        console.log(`\n📊 Summary:`);
        console.log(`   ✅ Venues fixed: ${venuesFixed}`);
        console.log(`   ✅ Teams fixed: ${teamsFixed}`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n📦 Disconnected from MongoDB');
    }
}

fixSpanishVenueCoordinates();

