const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const Team = require('../models/Team');

// Sample teams data - popular teams from major leagues
const sampleTeams = [
    // Premier League
    {
        apiId: 'pl_liverpool',
        name: 'Liverpool FC',
        aliases: ['Liverpool', 'LFC', 'The Reds'],
        code: 'LIV',
        founded: 1892,
        logo: 'https://media.api-sports.io/football/teams/40.png',
        country: 'England',
        city: 'Liverpool',
        venue: {
            name: 'Anfield',
            capacity: 54074,
            coordinates: [-2.96083, 53.43083]
        },
        leagues: [{
            leagueId: 'PL',
            leagueName: 'Premier League',
            season: '2024-25',
            isActive: true
        }],
        popularity: 95,
        searchCount: 50
    },
    {
        apiId: 'pl_manchester_united',
        name: 'Manchester United FC',
        aliases: ['Manchester United', 'Man United', 'United', 'MUFC'],
        code: 'MUN',
        founded: 1878,
        logo: 'https://media.api-sports.io/football/teams/33.png',
        country: 'England',
        city: 'Manchester',
        venue: {
            name: 'Old Trafford',
            capacity: 74140,
            coordinates: [-2.291389, 53.463056]
        },
        leagues: [{
            leagueId: 'PL',
            leagueName: 'Premier League',
            season: '2024-25',
            isActive: true
        }],
        popularity: 98,
        searchCount: 75
    },
    {
        apiId: 'pl_manchester_city',
        name: 'Manchester City FC',
        aliases: ['Manchester City', 'Man City', 'City', 'MCFC'],
        code: 'MCI',
        founded: 1880,
        logo: 'https://media.api-sports.io/football/teams/50.png',
        country: 'England',
        city: 'Manchester',
        venue: {
            name: 'Etihad Stadium',
            capacity: 55097,
            coordinates: [-2.200278, 53.483056]
        },
        leagues: [{
            leagueId: 'PL',
            leagueName: 'Premier League',
            season: '2024-25',
            isActive: true
        }],
        popularity: 92,
        searchCount: 45
    },
    {
        apiId: 'pl_arsenal',
        name: 'Arsenal FC',
        aliases: ['Arsenal', 'The Gunners', 'AFC'],
        code: 'ARS',
        founded: 1886,
        logo: 'https://media.api-sports.io/football/teams/42.png',
        country: 'England',
        city: 'London',
        venue: {
            name: 'Emirates Stadium',
            capacity: 60704,
            coordinates: [-0.108438, 51.555]
        },
        leagues: [{
            leagueId: 'PL',
            leagueName: 'Premier League',
            season: '2024-25',
            isActive: true
        }],
        popularity: 90,
        searchCount: 40
    },
    {
        apiId: 'pl_chelsea',
        name: 'Chelsea FC',
        aliases: ['Chelsea', 'The Blues', 'CFC'],
        code: 'CHE',
        founded: 1905,
        logo: 'https://media.api-sports.io/football/teams/49.png',
        country: 'England',
        city: 'London',
        venue: {
            name: 'Stamford Bridge',
            capacity: 40834,
            coordinates: [-0.191034, 51.481667]
        },
        leagues: [{
            leagueId: 'PL',
            leagueName: 'Premier League',
            season: '2024-25',
            isActive: true
        }],
        popularity: 88,
        searchCount: 35
    },

    // La Liga
    {
        apiId: 'laliga_real_madrid',
        name: 'Real Madrid CF',
        aliases: ['Real Madrid', 'Madrid', 'Los Blancos', 'RMCF'],
        code: 'RMA',
        founded: 1902,
        logo: 'https://media.api-sports.io/football/teams/541.png',
        country: 'Spain',
        city: 'Madrid',
        venue: {
            name: 'Santiago Bernabéu',
            capacity: 81044,
            coordinates: [-3.688344, 40.453054]
        },
        leagues: [{
            leagueId: 'PD',
            leagueName: 'La Liga',
            season: '2024-25',
            isActive: true
        }],
        popularity: 100,
        searchCount: 80
    },
    {
        apiId: 'laliga_barcelona',
        name: 'FC Barcelona',
        aliases: ['Barcelona', 'Barça', 'Barca', 'FCB'],
        code: 'BAR',
        founded: 1899,
        logo: 'https://media.api-sports.io/football/teams/529.png',
        country: 'Spain',
        city: 'Barcelona',
        venue: {
            name: 'Camp Nou',
            capacity: 99354,
            coordinates: [2.122820, 41.380896]
        },
        leagues: [{
            leagueId: 'PD',
            leagueName: 'La Liga',
            season: '2024-25',
            isActive: true
        }],
        popularity: 97,
        searchCount: 70
    },

    // Bundesliga
    {
        apiId: 'bundesliga_bayern',
        name: 'FC Bayern München',
        aliases: ['Bayern Munich', 'Bayern', 'FCB'],
        code: 'FCB',
        founded: 1900,
        logo: 'https://media.api-sports.io/football/teams/157.png',
        country: 'Germany',
        city: 'Munich',
        venue: {
            name: 'Allianz Arena',
            capacity: 75024,
            coordinates: [11.624420, 48.218775]
        },
        leagues: [{
            leagueId: 'BL1',
            leagueName: 'Bundesliga',
            season: '2024-25',
            isActive: true
        }],
        popularity: 94,
        searchCount: 55
    },
    {
        apiId: 'bundesliga_dortmund',
        name: 'Borussia Dortmund',
        aliases: ['Dortmund', 'BVB', 'Borussia'],
        code: 'BVB',
        founded: 1909,
        logo: 'https://logos.footapi.com/165.png',
        country: 'Germany',
        city: 'Dortmund',
        venue: {
            name: 'Signal Iduna Park',
            capacity: 81365,
            coordinates: [7.451694, 51.492500]
        },
        leagues: [{
            leagueId: 'BL1',
            leagueName: 'Bundesliga',
            season: '2024-25',
            isActive: true
        }],
        popularity: 85,
        searchCount: 30
    },

    // Serie A
    {
        apiId: 'seriea_juventus',
        name: 'Juventus FC',
        aliases: ['Juventus', 'Juve', 'The Old Lady'],
        code: 'JUV',
        founded: 1897,
        logo: 'https://logos.footapi.com/496.png',
        country: 'Italy',
        city: 'Turin',
        venue: {
            name: 'Allianz Stadium',
            capacity: 41507,
            coordinates: [7.641389, 45.109722]
        },
        leagues: [{
            leagueId: 'SA',
            leagueName: 'Serie A',
            season: '2024-25',
            isActive: true
        }],
        popularity: 87,
        searchCount: 32
    },
    {
        apiId: 'seriea_milan',
        name: 'AC Milan',
        aliases: ['Milan', 'AC Milan', 'Rossoneri'],
        code: 'MIL',
        founded: 1899,
        logo: 'https://logos.footapi.com/489.png',
        country: 'Italy',
        city: 'Milan',
        venue: {
            name: 'San Siro',
            capacity: 75923,
            coordinates: [9.123889, 45.478889]
        },
        leagues: [{
            leagueId: 'SA',
            leagueName: 'Serie A',
            season: '2024-25',
            isActive: true
        }],
        popularity: 89,
        searchCount: 38
    },

    // Ligue 1
    {
        apiId: 'ligue1_psg',
        name: 'Paris Saint-Germain FC',
        aliases: ['PSG', 'Paris', 'Paris Saint-Germain'],
        code: 'PSG',
        founded: 1970,
        logo: 'https://logos.footapi.com/85.png',
        country: 'France',
        city: 'Paris',
        venue: {
            name: 'Parc des Princes',
            capacity: 47929,
            coordinates: [2.253056, 48.841389]
        },
        leagues: [{
            leagueId: 'FL1',
            leagueName: 'Ligue 1',
            season: '2024-25',
            isActive: true
        }],
        popularity: 91,
        searchCount: 42
    },

    // Netherlands
    {
        apiId: 'eredivisie_ajax',
        name: 'AFC Ajax',
        aliases: ['Ajax', 'Ajax Amsterdam', 'AFC Ajax'],
        code: 'AJX',
        founded: 1900,
        logo: 'https://logos.footapi.com/610.png',
        country: 'Netherlands',
        city: 'Amsterdam',
        venue: {
            name: 'Johan Cruyff Arena',
            capacity: 54990,
            coordinates: [4.942222, 52.314167]
        },
        leagues: [{
            leagueId: 'ED',
            leagueName: 'Eredivisie',
            season: '2024-25',
            isActive: true
        }],
        popularity: 82,
        searchCount: 25
    },
    {
        apiId: 'eredivisie_psv',
        name: 'PSV Eindhoven',
        aliases: ['PSV', 'PSV Eindhoven', 'Eindhoven'],
        code: 'PSV',
        founded: 1913,
        logo: 'https://logos.footapi.com/618.png',
        country: 'Netherlands',
        city: 'Eindhoven',
        venue: {
            name: 'Philips Stadion',
            capacity: 35000,
            coordinates: [5.467778, 51.441667]
        },
        leagues: [{
            leagueId: 'ED',
            leagueName: 'Eredivisie',
            season: '2024-25',
            isActive: true
        }],
        popularity: 75,
        searchCount: 20
    }
];

async function seedTeams() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Clear existing teams
        await Team.deleteMany({});
        console.log('🗑️  Cleared existing teams');

        // Insert sample teams
        const insertedTeams = await Team.insertMany(sampleTeams);
        console.log(`🌱 Seeded ${insertedTeams.length} teams`);

        // Display seeded teams
        console.log('\n📋 Seeded teams:');
        insertedTeams.forEach(team => {
            console.log(`   ${team.name} (${team.country}) - ${team.code}`);
        });

        console.log('\n✅ Database seeding completed successfully!');
        
    } catch (error) {
        console.error('❌ Error seeding database:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
        process.exit(0);
    }
}

// Run the seeding function
if (require.main === module) {
    seedTeams();
}

module.exports = { seedTeams, sampleTeams }; 