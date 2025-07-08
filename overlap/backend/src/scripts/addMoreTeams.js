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
            coordinates: [2.12282, 41.380896]
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
    {
        apiId: 'laliga_atletico',
        name: 'Atlético de Madrid',
        aliases: ['Atletico Madrid', 'Atletico', 'Atleti'],
        code: 'ATM',
        founded: 1903,
        logo: 'https://media.api-sports.io/football/teams/530.png',
        country: 'Spain',
        city: 'Madrid',
        venue: {
            name: 'Cívitas Metropolitano',
            capacity: 68456,
            coordinates: [-3.599722, 40.436111]
        },
        leagues: [{
            leagueId: 'PD',
            leagueName: 'La Liga',
            season: '2024-25',
            isActive: true
        }],
        popularity: 90,
        searchCount: 50
    },
    {
        apiId: 'laliga_athletic',
        name: 'Athletic Club',
        aliases: ['Athletic Bilbao', 'Bilbao'],
        code: 'ATH',
        founded: 1898,
        logo: 'https://media.api-sports.io/football/teams/531.png',
        country: 'Spain',
        city: 'Bilbao',
        venue: {
            name: 'San Mamés',
            capacity: 53289,
            coordinates: [-2.949468, 43.264133]
        },
        leagues: [{
            leagueId: 'PD',
            leagueName: 'La Liga',
            season: '2024-25',
            isActive: true
        }],
        popularity: 75,
        searchCount: 30
    },
    {
        apiId: 'laliga_real_sociedad',
        name: 'Real Sociedad',
        aliases: ['La Real', 'Sociedad'],
        code: 'RSO',
        founded: 1909,
        logo: 'https://media.api-sports.io/football/teams/548.png',
        country: 'Spain',
        city: 'San Sebastian',
        venue: {
            name: 'Reale Arena',
            capacity: 39500,
            coordinates: [-1.973692, 43.301479]
        },
        leagues: [{
            leagueId: 'PD',
            leagueName: 'La Liga',
            season: '2024-25',
            isActive: true
        }],
        popularity: 70,
        searchCount: 25
    },
    {
        apiId: 'laliga_betis',
        name: 'Real Betis',
        aliases: ['Betis', 'Real Betis Balompié'],
        code: 'BET',
        founded: 1907,
        logo: 'https://media.api-sports.io/football/teams/543.png',
        country: 'Spain',
        city: 'Seville',
        venue: {
            name: 'Estadio Benito Villamarín',
            capacity: 60721,
            coordinates: [-5.981687, 37.356497]
        },
        leagues: [{
            leagueId: 'PD',
            leagueName: 'La Liga',
            season: '2024-25',
            isActive: true
        }],
        popularity: 65,
        searchCount: 20
    },
    {
        apiId: 'laliga_valencia',
        name: 'Valencia CF',
        aliases: ['Valencia', 'Los Che'],
        code: 'VAL',
        founded: 1919,
        logo: 'https://media.api-sports.io/football/teams/532.png',
        country: 'Spain',
        city: 'Valencia',
        venue: {
            name: 'Mestalla',
            capacity: 48600,
            coordinates: [-0.358010, 39.474989]
        },
        leagues: [{
            leagueId: 'PD',
            leagueName: 'La Liga',
            season: '2024-25',
            isActive: true
        }],
        popularity: 70,
        searchCount: 25
    },
    {
        apiId: 'laliga_villarreal',
        name: 'Villarreal CF',
        aliases: ['Villarreal', 'Yellow Submarine'],
        code: 'VIL',
        founded: 1923,
        logo: 'https://media.api-sports.io/football/teams/533.png',
        country: 'Spain',
        city: 'Villarreal',
        venue: {
            name: 'Estadio de la Cerámica',
            capacity: 23500,
            coordinates: [-0.103828, 39.944218]
        },
        leagues: [{
            leagueId: 'PD',
            leagueName: 'La Liga',
            season: '2024-25',
            isActive: true
        }],
        popularity: 65,
        searchCount: 20
    },
    {
        apiId: 'laliga_sevilla',
        name: 'Sevilla FC',
        aliases: ['Sevilla', 'Sevillistas'],
        code: 'SEV',
        founded: 1890,
        logo: 'https://media.api-sports.io/football/teams/536.png',
        country: 'Spain',
        city: 'Seville',
        venue: {
            name: 'Ramón Sánchez-Pizjuán',
            capacity: 43883,
            coordinates: [-5.970123, 37.383934]
        },
        leagues: [{
            leagueId: 'PD',
            leagueName: 'La Liga',
            season: '2024-25',
            isActive: true
        }],
        popularity: 75,
        searchCount: 30
    },
    {
        apiId: 'laliga_osasuna',
        name: 'CA Osasuna',
        aliases: ['Osasuna', 'Los Rojillos'],
        code: 'OSA',
        founded: 1920,
        logo: 'https://media.api-sports.io/football/teams/727.png',
        country: 'Spain',
        city: 'Pamplona',
        venue: {
            name: 'El Sadar',
            capacity: 23576,
            coordinates: [-1.636712, 42.795928]
        },
        leagues: [{
            leagueId: 'PD',
            leagueName: 'La Liga',
            season: '2024-25',
            isActive: true
        }],
        popularity: 50,
        searchCount: 15
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
    },

    // Bundesliga Teams
    {
        name: 'FC Bayern München',
        apiId: '157',
        apiName: 'Bayern München',
        aliases: ['Bayern Munich', 'Bayern', 'FCB'],
        code: 'BAY',
        founded: 1900,
        logo: 'https://media.api-sports.io/football/teams/157.png',
        country: 'Germany',
        city: 'München',
        venue: {
            name: 'Allianz Arena',
            capacity: 75024,
            coordinates: [11.624722, 48.218889]
        }
    },
    {
        name: 'SC Freiburg',
        apiId: '160',
        apiName: 'SC Freiburg',
        aliases: ['Freiburg', 'SCF'],
        code: 'SCF',
        founded: 1904,
        logo: 'https://media.api-sports.io/football/teams/160.png',
        country: 'Germany',
        city: 'Freiburg',
        venue: {
            name: 'Europa-Park Stadion',
            capacity: 34700,
            coordinates: [7.881667, 48.020278]
        }
    },
    {
        name: 'VfL Wolfsburg',
        apiId: '161',
        apiName: 'VfL Wolfsburg',
        aliases: ['Wolfsburg', 'VfL'],
        code: 'WOB',
        founded: 1945,
        logo: 'https://media.api-sports.io/football/teams/161.png',
        country: 'Germany',
        city: 'Wolfsburg',
        venue: {
            name: 'Volkswagen Arena',
            capacity: 30000,
            coordinates: [10.803889, 52.431944]
        }
    },
    {
        name: 'Borussia Mönchengladbach',
        apiId: '163',
        apiName: 'Borussia Mönchengladbach',
        aliases: ['Gladbach', 'BMG'],
        code: 'BMG',
        founded: 1900,
        logo: 'https://media.api-sports.io/football/teams/163.png',
        country: 'Germany',
        city: 'Mönchengladbach',
        venue: {
            name: 'Borussia-Park',
            capacity: 54057,
            coordinates: [6.385278, 51.174722]
        }
    },
    {
        name: '1. FSV Mainz 05',
        apiId: '164',
        apiName: 'FSV Mainz 05',
        aliases: ['Mainz', 'FSV'],
        code: 'M05',
        founded: 1905,
        logo: 'https://media.api-sports.io/football/teams/164.png',
        country: 'Germany',
        city: 'Mainz',
        venue: {
            name: 'MEWA ARENA',
            capacity: 33305,
            coordinates: [8.221944, 49.984167]
        }
    },
    {
        name: '1. FC Heidenheim',
        apiId: '180',
        apiName: '1. FC Heidenheim',
        aliases: ['Heidenheim', 'FCH'],
        code: 'FCH',
        founded: 1846,
        logo: 'https://media.api-sports.io/football/teams/180.png',
        country: 'Germany',
        city: 'Heidenheim',
        venue: {
            name: 'Voith-Arena',
            capacity: 15000,
            coordinates: [10.149722, 48.676389]
        }
    },
    {
        name: '1. FC Union Berlin',
        apiId: '182',
        apiName: 'Union Berlin',
        aliases: ['Union Berlin', 'FCU'],
        code: 'UNB',
        founded: 1966,
        logo: 'https://media.api-sports.io/football/teams/182.png',
        country: 'Germany',
        city: 'Berlin',
        venue: {
            name: 'Stadion An der Alten Försterei',
            capacity: 22012,
            coordinates: [13.568333, 52.457222]
        }
    },
    {
        name: 'FC St. Pauli',
        apiId: '178',
        apiName: 'FC St. Pauli',
        aliases: ['St. Pauli', 'FCSP'],
        code: 'STP',
        founded: 1910,
        logo: 'https://media.api-sports.io/football/teams/178.png',
        country: 'Germany',
        city: 'Hamburg',
        venue: {
            name: 'Millerntor-Stadion',
            capacity: 29546,
            coordinates: [9.967778, 53.554722]
        }
    },
    {
        name: '1. FC Köln',
        apiId: '192',
        apiName: '1.FC Köln',
        aliases: ['Köln', 'Cologne', 'FC Cologne'],
        code: 'KOE',
        founded: 1948,
        logo: 'https://media.api-sports.io/football/teams/192.png',
        country: 'Germany',
        city: 'Köln',
        venue: {
            name: 'RheinEnergieSTADION',
            capacity: 50000,
            coordinates: [6.875278, 50.933611]
        }
    },
    {
        name: 'TSG 1899 Hoffenheim',
        apiId: '167',
        apiName: '1899 Hoffenheim',
        aliases: ['Hoffenheim', 'TSG'],
        code: 'TSG',
        founded: 1899,
        logo: 'https://media.api-sports.io/football/teams/167.png',
        country: 'Germany',
        city: 'Sinsheim',
        venue: {
            name: 'PreZero Arena',
            capacity: 30150,
            coordinates: [8.891944, 49.239167]
        }
    },
    {
        name: 'Bayer 04 Leverkusen',
        apiId: '168',
        apiName: 'Bayer Leverkusen',
        aliases: ['Leverkusen', 'B04'],
        code: 'B04',
        founded: 1904,
        logo: 'https://media.api-sports.io/football/teams/168.png',
        country: 'Germany',
        city: 'Leverkusen',
        venue: {
            name: 'BayArena',
            capacity: 30210,
            coordinates: [6.973056, 51.038056]
        }
    },
    {
        name: 'Borussia Dortmund',
        apiId: '165',
        apiName: 'Borussia Dortmund',
        aliases: ['Dortmund', 'BVB'],
        code: 'BVB',
        founded: 1909,
        logo: 'https://media.api-sports.io/football/teams/165.png',
        country: 'Germany',
        city: 'Dortmund',
        venue: {
            name: 'Signal Iduna Park',
            capacity: 81365,
            coordinates: [7.451667, 51.492778]
        }
    },
    {
        name: 'Eintracht Frankfurt',
        apiId: '169',
        apiName: 'Eintracht Frankfurt',
        aliases: ['Frankfurt', 'SGE'],
        code: 'SGE',
        founded: 1899,
        logo: 'https://media.api-sports.io/football/teams/169.png',
        country: 'Germany',
        city: 'Frankfurt',
        venue: {
            name: 'Deutsche Bank Park',
            capacity: 51500,
            coordinates: [8.645278, 50.068611]
        }
    },
    {
        name: 'FC Augsburg',
        apiId: '170',
        apiName: 'FC Augsburg',
        aliases: ['Augsburg', 'FCA'],
        code: 'FCA',
        founded: 1907,
        logo: 'https://media.api-sports.io/football/teams/170.png',
        country: 'Germany',
        city: 'Augsburg',
        venue: {
            name: 'WWK Arena',
            capacity: 30660,
            coordinates: [10.885556, 48.323889]
        }
    },
    {
        name: 'Hamburger SV',
        apiId: '171',
        apiName: 'Hamburger SV',
        aliases: ['Hamburg', 'HSV'],
        code: 'HSV',
        founded: 1887,
        logo: 'https://media.api-sports.io/football/teams/171.png',
        country: 'Germany',
        city: 'Hamburg',
        venue: {
            name: 'Volksparkstadion',
            capacity: 57000,
            coordinates: [9.898611, 53.587222]
        }
    },
    {
        name: 'RB Leipzig',
        apiId: '173',
        apiName: 'RB Leipzig',
        aliases: ['Leipzig', 'RBL'],
        code: 'RBL',
        founded: 2009,
        logo: 'https://media.api-sports.io/football/teams/173.png',
        country: 'Germany',
        city: 'Leipzig',
        venue: {
            name: 'Red Bull Arena',
            capacity: 47069,
            coordinates: [12.348333, 51.345833]
        }
    },
    {
        name: 'VfB Stuttgart',
        apiId: '172',
        apiName: 'VfB Stuttgart',
        aliases: ['Stuttgart', 'VfB'],
        code: 'VFB',
        founded: 1893,
        logo: 'https://media.api-sports.io/football/teams/172.png',
        country: 'Germany',
        city: 'Stuttgart',
        venue: {
            name: 'MHPArena',
            capacity: 60449,
            coordinates: [9.231944, 48.792222]
        }
    },
    {
        name: 'SV Werder Bremen',
        apiId: '162',
        apiName: 'Werder Bremen',
        aliases: ['Bremen', 'SVW'],
        code: 'SVW',
        founded: 1899,
        logo: 'https://media.api-sports.io/football/teams/162.png',
        country: 'Germany',
        city: 'Bremen',
        venue: {
            name: 'Weser-Stadion',
            capacity: 42100,
            coordinates: [8.837222, 53.066389]
        }
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