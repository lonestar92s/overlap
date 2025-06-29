const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const Team = require('../models/Team');
const Venue = require('../models/Venue');
const League = require('../models/League');

// Major MLS teams with venue data
const MLS_TEAMS = [
    {
        name: 'Orlando City SC',
        apiName: 'Orlando City SC',
        city: 'Orlando',
        venue: { name: 'Exploria Stadium', capacity: 25500, coordinates: [-81.389, 28.541] }
    },
    {
        name: 'Inter Miami',
        apiName: 'Inter Miami',
        city: 'Fort Lauderdale',
        venue: { name: 'Chase Stadium', capacity: 18000, coordinates: [-80.1610, 26.1926] }
    },
    {
        name: 'Toronto FC',
        apiName: 'Toronto FC',
        city: 'Toronto',
        venue: { name: 'BMO Field', capacity: 28026, coordinates: [-79.4185, 43.6333] }
    },
    {
        name: 'New York Red Bulls',
        apiName: 'New York Red Bulls',
        city: 'Harrison',
        venue: { name: 'Red Bull Arena', capacity: 25000, coordinates: [-74.1502, 40.7369] }
    },
    {
        name: 'New York City FC',
        apiName: 'New York City FC',
        city: 'New York',
        venue: { name: 'Yankee Stadium', capacity: 28743, coordinates: [-73.9266, 40.8296] }
    },
    {
        name: 'Seattle Sounders',
        apiName: 'Seattle Sounders',
        city: 'Seattle',
        venue: { name: 'Lumen Field', capacity: 37722, coordinates: [-122.3317, 47.5952] }
    },
    {
        name: 'Los Angeles Galaxy',
        apiName: 'Los Angeles Galaxy',
        city: 'Carson',
        venue: { name: 'Dignity Health Sports Park', capacity: 27000, coordinates: [-118.2611, 33.8644] }
    },
    {
        name: 'Los Angeles FC',
        apiName: 'Los Angeles FC',
        city: 'Los Angeles',
        venue: { name: 'BMO Stadium', capacity: 22000, coordinates: [-118.2851, 34.0112] }
    },
    {
        name: 'Atlanta United FC',
        apiName: 'Atlanta United FC',
        city: 'Atlanta',
        venue: { name: 'Mercedes-Benz Stadium', capacity: 42500, coordinates: [-84.4008, 33.7573] }
    },
    {
        name: 'Philadelphia Union',
        apiName: 'Philadelphia Union',
        city: 'Chester',
        venue: { name: 'Subaru Park', capacity: 18500, coordinates: [-75.3782, 39.8328] }
    },
    {
        name: 'Columbus Crew',
        apiName: 'Columbus Crew',
        city: 'Columbus',
        venue: { name: 'Field', capacity: 20371, coordinates: [-83.018, 39.968] }
    },
    {
        name: 'CF Montreal',
        apiName: 'CF Montreal',
        city: 'Montreal',
        venue: { name: 'Stade Saputo', capacity: 19619, coordinates: [-73.5529, 45.5618] }
    },
    {
        name: 'DC United',
        apiName: 'DC United',
        city: 'Washington',
        venue: { name: 'Audi Field', capacity: 20000, coordinates: [-77.0122, 38.8679] }
    },
    {
        name: 'FC Dallas',
        apiName: 'FC Dallas',
        city: 'Frisco',
        venue: { name: 'Toyota Stadium', capacity: 20500, coordinates: [-96.8352, 33.1547] }
    },
    {
        name: 'Houston Dynamo',
        apiName: 'Houston Dynamo',
        city: 'Houston',
        venue: { name: 'Shell Energy Stadium', capacity: 22039, coordinates: [-95.3518, 29.7524] }
    },
    {
        name: 'Sporting Kansas City',
        apiName: 'Sporting Kansas City',
        city: 'Kansas City',
        venue: { name: 'Children\'s Mercy Park', capacity: 18467, coordinates: [-94.8233, 39.1219] }
    },
    {
        name: 'Minnesota United FC',
        apiName: 'Minnesota United FC',
        city: 'Saint Paul',
        venue: { name: 'Allianz Field', capacity: 19400, coordinates: [-93.1656, 44.9537] }
    },
    {
        name: 'Nashville SC',
        apiName: 'Nashville SC',
        city: 'Nashville',
        venue: { name: 'GEODIS Park', capacity: 30000, coordinates: [-86.7677, 36.1297] }
    },
    {
        name: 'Austin',
        apiName: 'Austin',
        city: 'Austin',
        venue: { name: 'Q2 Stadium', capacity: 20738, coordinates: [-97.7194, 30.3883] }
    },
    {
        name: 'Real Salt Lake',
        apiName: 'Real Salt Lake',
        city: 'Sandy',
        venue: { name: 'America First Field', capacity: 20213, coordinates: [-111.8927, 40.5825] }
    },
    {
        name: 'Colorado Rapids',
        apiName: 'Colorado Rapids',
        city: 'Commerce City',
        venue: { name: 'Dick\'s Sporting Goods Park', capacity: 18061, coordinates: [-104.8919, 39.8058] }
    },
    {
        name: 'Portland Timbers',
        apiName: 'Portland Timbers',
        city: 'Portland',
        venue: { name: 'Providence Park', capacity: 25218, coordinates: [-122.6917, 45.5214] }
    },
    {
        name: 'San Jose Earthquakes',
        apiName: 'San Jose Earthquakes',
        city: 'San Jose',
        venue: { name: 'PayPal Park', capacity: 18000, coordinates: [-121.9258, 37.3508] }
    },
    {
        name: 'Vancouver Whitecaps',
        apiName: 'Vancouver Whitecaps',
        city: 'Vancouver',
        venue: { name: 'BC Place', capacity: 22120, coordinates: [-123.1116, 49.2766] }
    },
    {
        name: 'New England Revolution',
        apiName: 'New England Revolution',
        city: 'Foxborough',
        venue: { name: 'Gillette Stadium', capacity: 20000, coordinates: [-71.2643, 42.0909] }
    },
    {
        name: 'FC Cincinnati',
        apiName: 'FC Cincinnati',
        city: 'Cincinnati',
        venue: { name: 'TQL Stadium', capacity: 26000, coordinates: [-84.5200, 39.1107] }
    },
    {
        name: 'Charlotte',
        apiName: 'Charlotte',
        city: 'Charlotte',
        venue: { name: 'Bank of America Stadium', capacity: 38000, coordinates: [-80.8533, 35.2258] }
    },
    {
        name: 'St. Louis City',
        apiName: 'St. Louis City',
        city: 'St. Louis',
        venue: { name: 'CITYPARK', capacity: 22500, coordinates: [-90.2107, 38.6441] }
    },
    {
        name: 'San Diego',
        apiName: 'San Diego',
        city: 'San Diego',
        venue: { name: 'Snapdragon Stadium', capacity: 32000, coordinates: [-117.0719, 32.7830] }
    }
];

// Major Brazilian teams with venue data
const BRAZILIAN_TEAMS = [
    {
        name: 'Palmeiras',
        apiName: 'Palmeiras',
        city: 'São Paulo',
        venue: { name: 'Allianz Parque', capacity: 43713, coordinates: [-46.6617, -23.5275] }
    },
    {
        name: 'Flamengo',
        apiName: 'Flamengo',
        city: 'Rio de Janeiro',
        venue: { name: 'Estádio do Maracanã', capacity: 78838, coordinates: [-43.2302, -22.9121] }
    },
    {
        name: 'Santos',
        apiName: 'Santos',
        city: 'Santos',
        venue: { name: 'Vila Belmiro', capacity: 16068, coordinates: [-46.3322, -23.9618] }
    },
    {
        name: 'Corinthians',
        apiName: 'Corinthians',
        city: 'São Paulo',
        venue: { name: 'Neo Química Arena', capacity: 49205, coordinates: [-46.4374, -23.5455] }
    },
    {
        name: 'Sao Paulo',
        apiName: 'Sao Paulo',
        city: 'São Paulo',
        venue: { name: 'Estádio do Morumbi', capacity: 67052, coordinates: [-46.7197, -23.6011] }
    },
    {
        name: 'Fluminense',
        apiName: 'Fluminense',
        city: 'Rio de Janeiro',
        venue: { name: 'Estádio do Maracanã', capacity: 78838, coordinates: [-43.2302, -22.9121] }
    },
    {
        name: 'Gremio',
        apiName: 'Gremio',
        city: 'Porto Alegre',
        venue: { name: 'Arena do Grêmio', capacity: 55662, coordinates: [-51.1951, -29.9753] }
    },
    {
        name: 'Internacional',
        apiName: 'Internacional',
        city: 'Porto Alegre',
        venue: { name: 'Estádio Beira-Rio', capacity: 50128, coordinates: [-51.2356, -30.0658] }
    },
    {
        name: 'Atletico-MG',
        apiName: 'Atletico-MG',
        city: 'Belo Horizonte',
        venue: { name: 'Arena MRV', capacity: 46000, coordinates: [-43.9722, -19.8658] }
    },
    {
        name: 'Botafogo',
        apiName: 'Botafogo',
        city: 'Rio de Janeiro',
        venue: { name: 'Estádio Nilton Santos', capacity: 46831, coordinates: [-43.2902, -22.8958] }
    },
    {
        name: 'Vasco DA Gama',
        apiName: 'Vasco DA Gama',
        city: 'Rio de Janeiro',
        venue: { name: 'Estádio São Januário', capacity: 21880, coordinates: [-43.2293, -22.8889] }
    },
    {
        name: 'Cruzeiro',
        apiName: 'Cruzeiro',
        city: 'Belo Horizonte',
        venue: { name: 'Estádio Mineirão', capacity: 61927, coordinates: [-43.9664, -19.8658] }
    },
    {
        name: 'Bahia',
        apiName: 'Bahia',
        city: 'Salvador',
        venue: { name: 'Arena Fonte Nova', capacity: 50025, coordinates: [-38.5044, -12.9786] }
    },
    {
        name: 'Fortaleza EC',
        apiName: 'Fortaleza EC',
        city: 'Fortaleza',
        venue: { name: 'Arena Castelão', capacity: 63903, coordinates: [-38.5211, -3.8075] }
    },
    {
        name: 'Ceara',
        apiName: 'Ceara',
        city: 'Fortaleza',
        venue: { name: 'Arena Castelão', capacity: 63903, coordinates: [-38.5211, -3.8075] }
    },
    {
        name: 'Sport Recife',
        apiName: 'Sport Recife',
        city: 'Recife',
        venue: { name: 'Arena de Pernambuco', capacity: 44300, coordinates: [-34.9558, -8.0392] }
    },
    {
        name: 'Vitoria',
        apiName: 'Vitoria',
        city: 'Salvador',
        venue: { name: 'Estádio Manoel Barradas', capacity: 35632, coordinates: [-38.4558, -12.9439] }
    },
    {
        name: 'Juventude',
        apiName: 'Juventude',
        city: 'Caxias do Sul',
        venue: { name: 'Estádio Alfredo Jaconi', capacity: 19924, coordinates: [-51.1694, -29.1678] }
    },
    {
        name: 'RB Bragantino',
        apiName: 'RB Bragantino',
        city: 'Bragança Paulista',
        venue: { name: 'Estádio Nabi Abi Chedid', capacity: 17724, coordinates: [-46.5458, -22.9517] }
    },
    {
        name: 'Mirassol',
        apiName: 'Mirassol',
        city: 'Mirassol',
        venue: { name: 'Estádio José Maria de Campos Maia', capacity: 15000, coordinates: [-49.5139, -20.8217] }
    }
];

async function createVenueForTeam(teamData, country) {
    const existingVenue = await Venue.findOne({ 
        name: teamData.venue.name,
        city: teamData.city
    });

    if (existingVenue) {
        console.log(`📍 Venue ${teamData.venue.name} already exists`);
        return existingVenue._id;
    }

    const newVenue = new Venue({
        name: teamData.venue.name,
        address: '',
        city: teamData.city,
        country: country,
        location: {
            type: 'Point',
            coordinates: teamData.venue.coordinates
        },
        capacity: teamData.venue.capacity,
        surface: 'grass',
        website: null
    });

    try {
        await newVenue.save();
        console.log(`✅ Created venue: ${teamData.venue.name}`);
        return newVenue._id;
    } catch (error) {
        console.error(`❌ Error creating venue ${teamData.venue.name}:`, error.message);
        return null;
    }
}

async function createTeam(teamData, leagueId, venueId, country) {
    const existingTeam = await Team.findOne({ 
        $or: [
            { name: teamData.name },
            { apiName: teamData.apiName }
        ]
    });

    if (existingTeam) {
        // Update with venue and API name if missing
        if (!existingTeam.venueId && venueId) {
            existingTeam.venueId = venueId;
        }
        if (!existingTeam.apiName) {
            existingTeam.apiName = teamData.apiName;
        }
        await existingTeam.save();
        console.log(`👥 Updated existing team: ${teamData.name}`);
        return existingTeam;
    }

    const newTeam = new Team({
        name: teamData.name,
        apiName: teamData.apiName,
        shortName: teamData.name.substring(0, 3).toUpperCase(),
        founded: null,
        logo: '',
        country: country,
        city: teamData.city,
        leagueId: leagueId,
        venueId: venueId,
        colors: {
            primary: '#000000',
            secondary: '#FFFFFF'
        },
        isActive: true
    });

    try {
        await newTeam.save();
        console.log(`✅ Created team: ${teamData.name}`);
        return newTeam;
    } catch (error) {
        console.error(`❌ Error creating team ${teamData.name}:`, error.message);
        return null;
    }
}

async function seedMajorTeams() {
    console.log('🚀 Starting major MLS and Brazilian teams seeding...\n');

    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/overlap');
        console.log('✅ Connected to MongoDB\n');

        // Get league IDs
        const mlsLeague = await League.findOne({ apiId: '253' });
        const brazilLeague = await League.findOne({ apiId: '71' });

        if (!mlsLeague || !brazilLeague) {
            console.error('❌ Required leagues not found in database');
            process.exit(1);
        }

        // Seed MLS teams
        console.log('🇺🇸 Seeding MLS teams...');
        let mlsSuccess = 0;
        for (const teamData of MLS_TEAMS) {
            console.log(`\n📍 Processing ${teamData.name}...`);
            const venueId = await createVenueForTeam(teamData, 'USA');
            const team = await createTeam(teamData, mlsLeague._id, venueId, 'USA');
            if (team) mlsSuccess++;
        }

        // Seed Brazilian teams
        console.log('\n🇧🇷 Seeding Brazilian teams...');
        let brazilSuccess = 0;
        for (const teamData of BRAZILIAN_TEAMS) {
            console.log(`\n📍 Processing ${teamData.name}...`);
            const venueId = await createVenueForTeam(teamData, 'Brazil');
            const team = await createTeam(teamData, brazilLeague._id, venueId, 'Brazil');
            if (team) brazilSuccess++;
        }

        console.log('\n�� Seeding completed successfully!');
        console.log(`📊 Final Summary:`);
        console.log(`   🇺🇸 MLS teams processed: ${mlsSuccess}/${MLS_TEAMS.length}`);
        console.log(`   🇧🇷 Brazilian teams processed: ${brazilSuccess}/${BRAZILIAN_TEAMS.length}`);

    } catch (error) {
        console.error('❌ Seeding failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
        process.exit(0);
    }
}

if (require.main === module) {
    seedMajorTeams();
}

module.exports = seedMajorTeams;
