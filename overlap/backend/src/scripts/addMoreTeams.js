const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const Team = require('../models/Team');

// Additional teams to add to the database
const additionalTeams = [
    // MLS Teams
    {
        apiId: 'mls_chicago_fire',
        name: 'Chicago Fire FC',
        aliases: ['Chicago Fire', 'Chicago', 'Fire FC', 'CF97'],
        code: 'CHI',
        founded: 1997,
        logo: 'https://media.api-sports.io/football/teams/1395.png',
        country: 'United States',
        city: 'Chicago',
        venue: {
            name: 'Soldier Field',
            capacity: 61500,
            coordinates: [-87.616667, 41.862222]
        },
        leagues: [{
            leagueId: 'MLS',
            leagueName: 'Major League Soccer',
            season: '2024',
            isActive: true
        }],
        popularity: 65,
        searchCount: 15
    },
    {
        apiId: 'mls_inter_miami',
        name: 'Inter Miami CF',
        aliases: ['Inter Miami', 'Miami', 'IMCF'],
        code: 'MIA',
        founded: 2018,
        logo: 'https://logos.footapi.com/inter-miami.png',
        country: 'United States',
        city: 'Miami',
        venue: {
            name: 'DRV PNK Stadium',
            capacity: 18000,
            coordinates: [-80.161111, 26.193056]
        },
        leagues: [{
            leagueId: 'MLS',
            leagueName: 'Major League Soccer',
            season: '2024',
            isActive: true
        }],
        popularity: 78,
        searchCount: 25
    },
    {
        apiId: 'mls_lafc',
        name: 'Los Angeles FC',
        aliases: ['LAFC', 'Los Angeles FC', 'LA FC'],
        code: 'LAFC',
        founded: 2014,
        logo: 'https://logos.footapi.com/lafc.png',
        country: 'United States',
        city: 'Los Angeles',
        venue: {
            name: 'BMO Stadium',
            capacity: 22000,
            coordinates: [-118.285, 34.012]
        },
        leagues: [{
            leagueId: 'MLS',
            leagueName: 'Major League Soccer',
            season: '2024',
            isActive: true
        }],
        popularity: 72,
        searchCount: 20
    },

    // La Liga Teams
    {
        apiId: 'laliga_cadiz',
        name: 'Cádiz CF',
        aliases: ['Cadiz', 'Cádiz', 'Cadiz CF'],
        code: 'CAD',
        founded: 1910,
        logo: 'https://logos.footapi.com/cadiz.png',
        country: 'Spain',
        city: 'Cádiz',
        venue: {
            name: 'Estadio Nuevo Mirandilla',
            capacity: 20724,
            coordinates: [-6.271944, 36.504167]
        },
        leagues: [{
            leagueId: 'PD',
            leagueName: 'La Liga',
            season: '2024-25',
            isActive: true
        }],
        popularity: 45,
        searchCount: 8
    },
    {
        apiId: 'laliga_atletico',
        name: 'Atlético Madrid',
        aliases: ['Atletico Madrid', 'Atletico', 'Atleti'],
        code: 'ATM',
        founded: 1903,
        logo: 'https://logos.footapi.com/atletico.png',
        country: 'Spain',
        city: 'Madrid',
        venue: {
            name: 'Metropolitano Stadium',
            capacity: 68456,
            coordinates: [-3.599722, 40.436111]
        },
        leagues: [{
            leagueId: 'PD',
            leagueName: 'La Liga',
            season: '2024-25',
            isActive: true
        }],
        popularity: 86,
        searchCount: 35
    },

    // South American Teams
    {
        apiId: 'argentina_river_plate',
        name: 'Club Atlético River Plate',
        aliases: ['River Plate', 'River', 'Los Millonarios'],
        code: 'RIV',
        founded: 1901,
        logo: 'https://logos.footapi.com/river-plate.png',
        country: 'Argentina',
        city: 'Buenos Aires',
        venue: {
            name: 'Estadio Monumental',
            capacity: 70074,
            coordinates: [-58.449722, -34.545556]
        },
        leagues: [{
            leagueId: 'PARG',
            leagueName: 'Primera División Argentina',
            season: '2024',
            isActive: true
        }],
        popularity: 88,
        searchCount: 30
    },
    {
        apiId: 'argentina_boca_juniors',
        name: 'Club Atlético Boca Juniors',
        aliases: ['Boca Juniors', 'Boca', 'Xeneizes'],
        code: 'BOC',
        founded: 1905,
        logo: 'https://logos.footapi.com/boca.png',
        country: 'Argentina',
        city: 'Buenos Aires',
        venue: {
            name: 'La Bombonera',
            capacity: 49000,
            coordinates: [-58.364722, -34.635556]
        },
        leagues: [{
            leagueId: 'PARG',
            leagueName: 'Primera División Argentina',
            season: '2024',
            isActive: true
        }],
        popularity: 90,
        searchCount: 40
    },

    // More Premier League
    {
        apiId: 'pl_tottenham',
        name: 'Tottenham Hotspur FC',
        aliases: ['Tottenham', 'Spurs', 'THFC'],
        code: 'TOT',
        founded: 1882,
        logo: 'https://logos.footapi.com/tottenham.png',
        country: 'England',
        city: 'London',
        venue: {
            name: 'Tottenham Hotspur Stadium',
            capacity: 62850,
            coordinates: [-0.066389, 51.604444]
        },
        leagues: [{
            leagueId: 'PL',
            leagueName: 'Premier League',
            season: '2024-25',
            isActive: true
        }],
        popularity: 82,
        searchCount: 28
    },

    // More Eredivisie
    {
        apiId: 'eredivisie_feyenoord',
        name: 'Feyenoord Rotterdam',
        aliases: ['Feyenoord', 'Rotterdam'],
        code: 'FEY',
        founded: 1908,
        logo: 'https://logos.footapi.com/feyenoord.png',
        country: 'Netherlands',
        city: 'Rotterdam',
        venue: {
            name: 'De Kuip',
            capacity: 51117,
            coordinates: [4.523056, 51.893889]
        },
        leagues: [{
            leagueId: 'ED',
            leagueName: 'Eredivisie',
            season: '2024-25',
            isActive: true
        }],
        popularity: 76,
        searchCount: 18
    },

    // Brazilian Teams
    {
        apiId: 'brazil_flamengo',
        name: 'Clube de Regatas do Flamengo',
        aliases: ['Flamengo', 'Fla', 'Mengão'],
        code: 'FLA',
        founded: 1895,
        logo: 'https://logos.footapi.com/flamengo.png',
        country: 'Brazil',
        city: 'Rio de Janeiro',
        venue: {
            name: 'Maracanã',
            capacity: 78838,
            coordinates: [-43.230556, -22.912222]
        },
        leagues: [{
            leagueId: 'BSA',
            leagueName: 'Campeonato Brasileiro Série A',
            season: '2024',
            isActive: true
        }],
        popularity: 92,
        searchCount: 45
    }
];

async function addMoreTeams() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Check existing teams to avoid duplicates
        const existingApiIds = await Team.find({}, 'apiId').lean();
        const existingIds = new Set(existingApiIds.map(team => team.apiId));

        // Filter out teams that already exist
        const teamsToAdd = additionalTeams.filter(team => !existingIds.has(team.apiId));

        if (teamsToAdd.length === 0) {
            console.log('ℹ️  All teams already exist in database');
            return;
        }

        // Insert new teams
        const insertedTeams = await Team.insertMany(teamsToAdd);
        console.log(`🌱 Added ${insertedTeams.length} new teams`);

        // Display added teams
        console.log('\n📋 Added teams:');
        insertedTeams.forEach(team => {
            console.log(`   ${team.name} (${team.country}) - ${team.code}`);
        });

        // Show total count
        const totalTeams = await Team.countDocuments();
        console.log(`\n📊 Total teams in database: ${totalTeams}`);

        console.log('\n✅ Successfully added more teams!');
        
    } catch (error) {
        console.error('❌ Error adding teams:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
        process.exit(0);
    }
}

// Run the function
if (require.main === module) {
    addMoreTeams();
}

module.exports = { addMoreTeams, additionalTeams }; 