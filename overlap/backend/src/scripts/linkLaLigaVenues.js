const mongoose = require('mongoose');
const Team = require('../models/Team');
const Venue = require('../models/Venue');
require('dotenv').config();

// Mapping of team names to venue names (for cases where names don't match exactly)
const TEAM_VENUE_MAPPING = {
    'Barcelona': ['Camp Nou', 'Spotify Camp Nou'],
    'Real Madrid': ['Santiago Bernabéu', 'Estadio Santiago Bernabéu'],
    'Atletico Madrid': ['Wanda Metropolitano', 'Metropolitano'],
    'Valencia': ['Mestalla', 'Estadio de Mestalla'],
    'Villarreal': ['Estadio de la Cerámica', 'Cerámica'],
    'Sevilla': ['Ramón Sánchez-Pizjuán', 'Estadio Ramón Sánchez Pizjuán'],
    'Celta Vigo': ['Balaídos', 'Abanca-Balaídos'],
    'Levante': ['Estadi Ciutat de València'],
    'Espanyol': ['RCDE Stadium', 'Estadi Cornellà-El Prat'],
    'Athletic Club': ['San Mamés', 'Estadio San Mamés'],
    'Real Betis': ['Benito Villamarín', 'Estadio Benito Villamarín'],
    'Getafe': ['Coliseum', 'Estadio Coliseum'],
    'Girona': ['Montilivi', 'Estadi Municipal de Montilivi'],
    'Real Sociedad': ['Reale Arena', 'Anoeta'],
    'Rayo Vallecano': ['Vallecas', 'Estadio de Vallecas'],
    'Elche': ['Martínez Valero', 'Estadio Manuel Martínez Valero'],
    'Mallorca': ['Son Moix', 'Estadi Mallorca Son Moix']
};

async function linkLaLigaVenues() {
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

        // Get all La Liga teams
        const teams = await Team.find({ 'leagues.leagueId': '140' });
        console.log(`🔍 Found ${teams.length} La Liga teams\n`);

        let linked = 0;
        let notFound = [];
        let alreadyLinked = 0;

        for (const team of teams) {
            // Skip if already has venue with coordinates
            if (team.venue && team.venue.coordinates && Array.isArray(team.venue.coordinates) && team.venue.coordinates.length === 2) {
                console.log(`⏭️  ${team.name}: Already has venue with coordinates`);
                alreadyLinked++;
                continue;
            }

            console.log(`\n🔍 Processing: ${team.name}`);

            // Try to find venue by team name mapping first
            let venue = null;
            const venueNames = TEAM_VENUE_MAPPING[team.name] || [team.name];
            
            for (const venueName of venueNames) {
                // Try exact match
                venue = await Venue.findOne({
                    name: { $regex: new RegExp(`^${venueName}$`, 'i') },
                    country: { $in: ['Spain', 'España'] }
                });

                if (venue) break;

                // Try partial match
                venue = await Venue.findOne({
                    name: { $regex: new RegExp(venueName, 'i') },
                    country: { $in: ['Spain', 'España'] }
                });

                if (venue) break;
            }

            // If not found by name, try by city
            if (!venue && team.city) {
                venue = await Venue.findOne({
                    city: { $regex: new RegExp(team.city, 'i') },
                    country: { $in: ['Spain', 'España'] }
                });
            }

            if (venue && venue.coordinates && Array.isArray(venue.coordinates) && venue.coordinates.length === 2) {
                // Update team with venue data
                team.venue = {
                    name: venue.name,
                    coordinates: venue.coordinates,
                    capacity: venue.capacity || null
                };
                
                // Also update city if missing
                if (!team.city && venue.city) {
                    team.city = venue.city;
                }

                await team.save();
                console.log(`✅ Linked: ${team.name} → ${venue.name}`);
                console.log(`   Coordinates: [${venue.coordinates[0]}, ${venue.coordinates[1]}]`);
                linked++;
            } else {
                console.log(`❌ No venue found for: ${team.name}`);
                notFound.push({
                    team: team.name,
                    city: team.city || 'unknown',
                    searchedVenues: venueNames
                });
            }
        }

        console.log(`\n📊 Summary:`);
        console.log(`   ✅ Linked: ${linked}`);
        console.log(`   ⏭️  Already linked: ${alreadyLinked}`);
        console.log(`   ❌ Not found: ${notFound.length}`);

        if (notFound.length > 0) {
            console.log(`\n❌ Teams without venues:`);
            notFound.forEach(item => {
                console.log(`   - ${item.team} (${item.city})`);
            });
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n📦 Disconnected from MongoDB');
    }
}

linkLaLigaVenues();

