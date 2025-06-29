const mongoose = require('mongoose');
const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const Team = require('../models/Team');
const Venue = require('../models/Venue');
const League = require('../models/League');

const API_KEY = process.env.RAPIDAPI_KEY;
const API_HOST = 'api-football-v1.p.rapidapi.com';

const headers = {
    'X-RapidAPI-Key': API_KEY,
    'X-RapidAPI-Host': API_HOST
};

const LEAGUES_TO_SEED = [
    {
        apiId: '253',
        name: 'Major League Soccer',
        shortName: 'MLS',
        country: 'USA',
        countryCode: 'US',
        season: '2024'
    },
    {
        apiId: '71',
        name: 'Brasileirão Série A',
        shortName: 'Brasileirão',
        country: 'Brazil',
        countryCode: 'BR',
        season: '2024'
    }
];

async function fetchTeamsFromAPI(leagueApiId, season) {
    console.log(`🔍 Fetching teams for league ${leagueApiId}, season ${season}...`);
    
    try {
        const response = await axios.get(`https://${API_HOST}/v3/teams`, {
            headers,
            params: {
                league: leagueApiId,
                season: season
            }
        });

        if (response.data.response && response.data.response.length > 0) {
            console.log(`✅ Found ${response.data.response.length} teams`);
            return response.data.response;
        } else {
            console.log(`❌ No teams found for league ${leagueApiId}`);
            return [];
        }
    } catch (error) {
        console.error(`❌ Error fetching teams for league ${leagueApiId}:`, error.message);
        return [];
    }
}

async function createVenueFromTeamData(teamData, leagueInfo) {
    const venue = teamData.venue;
    
    if (!venue || !venue.name) {
        console.log(`⚠️  No venue data for team ${teamData.team.name}`);
        return null;
    }

    const existingVenue = await Venue.findOne({ 
        name: venue.name,
        city: venue.city || teamData.team.name
    });

    if (existingVenue) {
        console.log(`📍 Venue ${venue.name} already exists`);
        return existingVenue._id;
    }

    const newVenue = new Venue({
        name: venue.name,
        address: venue.address || '',
        city: venue.city || teamData.team.name,
        country: leagueInfo.country,
        location: {
            type: 'Point',
            coordinates: venue.coordinates ? [venue.coordinates[1], venue.coordinates[0]] : []
        },
        capacity: venue.capacity || null,
        surface: venue.surface || 'grass',
        website: null
    });

    try {
        await newVenue.save();
        console.log(`✅ Created venue: ${venue.name}`);
        return newVenue._id;
    } catch (error) {
        console.error(`❌ Error creating venue ${venue.name}:`, error.message);
        return null;
    }
}

async function createTeamFromAPIData(teamData, leagueId, venueId, leagueInfo) {
    const team = teamData.team;
    
    const existingTeam = await Team.findOne({ 
        $or: [
            { name: team.name },
            { apiName: team.name }
        ]
    });

    if (existingTeam) {
        console.log(`👥 Team ${team.name} already exists`);
        return existingTeam;
    }

    const newTeam = new Team({
        name: team.name,
        apiName: team.name,
        shortName: team.code || team.name.substring(0, 3).toUpperCase(),
        founded: team.founded || null,
        logo: team.logo || '',
        country: leagueInfo.country,
        city: teamData.venue?.city || team.name,
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
        console.log(`✅ Created team: ${team.name}`);
        return newTeam;
    } catch (error) {
        console.error(`❌ Error creating team ${team.name}:`, error.message);
        return null;
    }
}

async function ensureLeagueExists(leagueConfig) {
    const existingLeague = await League.findOne({ apiId: leagueConfig.apiId });
    
    if (existingLeague) {
        console.log(`🏆 League ${leagueConfig.name} already exists`);
        return existingLeague._id;
    }

    const newLeague = new League({
        apiId: leagueConfig.apiId,
        name: leagueConfig.name,
        shortName: leagueConfig.shortName,
        country: leagueConfig.country,
        countryCode: leagueConfig.countryCode,
        tier: 1,
        season: {
            start: leagueConfig.season,
            end: leagueConfig.season,
            current: true
        },
        isActive: true
    });

    try {
        await newLeague.save();
        console.log(`✅ Created league: ${leagueConfig.name}`);
        return newLeague._id;
    } catch (error) {
        console.error(`❌ Error creating league ${leagueConfig.name}:`, error.message);
        return null;
    }
}

async function seedLeagueTeams(leagueConfig) {
    console.log(`\n🏆 Seeding ${leagueConfig.name} teams...`);

    const leagueId = await ensureLeagueExists(leagueConfig);
    if (!leagueId) {
        console.error(`❌ Failed to create/find league ${leagueConfig.name}`);
        return;
    }

    const teamsData = await fetchTeamsFromAPI(leagueConfig.apiId, leagueConfig.season);
    
    if (teamsData.length === 0) {
        console.log(`⚠️  No teams found for ${leagueConfig.name}`);
        return;
    }

    let successCount = 0;
    let skipCount = 0;

    for (const teamData of teamsData) {
        console.log(`\n📍 Processing ${teamData.team.name}...`);

        const venueId = await createVenueFromTeamData(teamData, leagueConfig);
        const team = await createTeamFromAPIData(teamData, leagueId, venueId, leagueConfig);
        
        if (team) {
            successCount++;
        } else {
            skipCount++;
        }

        await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`\n📊 ${leagueConfig.name} Summary:`);
    console.log(`   ✅ Teams created/updated: ${successCount}`);
    console.log(`   ⚠️  Teams skipped: ${skipCount}`);
}

async function seedMlsAndBrazilianTeams() {
    console.log('🚀 Starting MLS and Brazilian teams seeding...\n');

    if (!API_KEY) {
        console.error('❌ RAPIDAPI_KEY not found in environment variables');
        process.exit(1);
    }

    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/overlap');
        console.log('✅ Connected to MongoDB\n');

        for (const leagueConfig of LEAGUES_TO_SEED) {
            await seedLeagueTeams(leagueConfig);
        }

        console.log('\n🎉 Seeding completed successfully!');
        
        const mlsTeams = await Team.find({ country: 'USA' });
        const brazilianTeams = await Team.find({ country: 'Brazil' });
        
        console.log('\n📊 Final Summary:');
        console.log(`   🇺🇸 MLS teams in database: ${mlsTeams.length}`);
        console.log(`   🇧🇷 Brazilian teams in database: ${brazilianTeams.length}`);

    } catch (error) {
        console.error('❌ Seeding failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
        process.exit(0);
    }
}

if (require.main === module) {
    seedMlsAndBrazilianTeams();
}

module.exports = seedMlsAndBrazilianTeams;
