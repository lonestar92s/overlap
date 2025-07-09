const mongoose = require('mongoose');
const Team = require('../models/Team');
const { teamSearchCache, matchesCache } = require('../utils/cache');
require('dotenv').config();

const BUNDESLIGA_VENUES = [
    {
        names: ['FC Bayern München', 'Bayern Munich', 'Bayern München', 'Bayern'],
        venue: {
            name: 'Allianz Arena',
            city: 'Munich',
            coordinates: [11.624722, 48.218889],
            capacity: 75000
        },
        city: 'Munich',
        country: 'Germany'
    },
    {
        names: ['SV Werder Bremen', 'Werder Bremen', 'Werder'],
        venue: {
            name: 'Weserstadion',
            city: 'Bremen',
            coordinates: [8.837778, 53.066389],
            capacity: 42100
        },
        city: 'Bremen',
        country: 'Germany'
    },
    {
        names: ['1. FC Köln', '1.FC Koln', 'FC Koln', 'Cologne'],
        venue: {
            name: 'RheinEnergieSTADION',
            city: 'Cologne',
            coordinates: [6.875278, 50.933611],
            capacity: 50000
        },
        city: 'Cologne',
        country: 'Germany'
    },
    {
        names: ['TSG 1899 Hoffenheim', '1899 Hoffenheim', 'Hoffenheim'],
        venue: {
            name: 'PreZero Arena',
            city: 'Sinsheim',
            coordinates: [8.891667, 49.239444],
            capacity: 30150
        },
        city: 'Sinsheim',
        country: 'Germany'
    },
    {
        names: ['1. FSV Mainz 05', 'FSV Mainz 05', 'Mainz 05', 'Mainz'],
        venue: {
            name: 'MEWA ARENA',
            city: 'Mainz',
            coordinates: [8.224167, 49.984167],
            capacity: 33305
        },
        city: 'Mainz',
        country: 'Germany'
    }
];

async function fixBundesligaVenues() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('📦 Connected to MongoDB');

        // Clear application cache
        teamSearchCache.clear();
        matchesCache.clear();
        console.log('🧹 Cache cleared');

        // Update each team's venue data
        for (const team of BUNDESLIGA_VENUES) {
            console.log(`\n🔄 Processing ${team.names[0]}...`);
            
            const result = await Team.updateOne(
                { 
                    $or: [
                        { name: { $in: team.names } },
                        { aliases: { $in: team.names } }
                    ]
                },
                {
                    $set: {
                        'venue.name': team.venue.name,
                        'venue.city': team.venue.city,
                        'venue.coordinates': team.venue.coordinates,
                        'venue.capacity': team.venue.capacity,
                        city: team.city,
                        country: team.country
                    },
                    $addToSet: {
                        aliases: { $each: team.names }
                    }
                }
            );

            console.log(`✅ Update result:`, result);

            // Verify the update
            const updatedTeam = await Team.findOne({ 
                $or: [
                    { name: { $in: team.names } },
                    { aliases: { $in: team.names } }
                ]
            });
            
            if (updatedTeam) {
                console.log(`📍 Updated venue data for ${updatedTeam.name}:`, updatedTeam.venue);
            } else {
                console.log(`⚠️ Team not found in database: ${team.names[0]}`);
            }
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('📦 Disconnected from MongoDB');
    }
}

fixBundesligaVenues(); 