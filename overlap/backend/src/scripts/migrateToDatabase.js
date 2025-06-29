const mongoose = require('mongoose');
const League = require('../models/League');
const Team = require('../models/Team');
const Venue = require('../models/Venue');

// Import existing venue data
const {
    PREMIER_LEAGUE_VENUES,
    BUNDESLIGA_VENUES,
    SWISS_SUPER_LEAGUE_VENUES,
    LA_LIGA_VENUES,
    LIGUE_1_VENUES,
    EREDIVISIE_VENUES,
    PRIMEIRA_LIGA_VENUES,
    ITALIAN_SERIE_A_VENUES
} = require('../data/venues');

// League definitions
const LEAGUES_DATA = [
    {
        apiId: '39',
        name: 'Premier League',
        shortName: 'EPL',
        country: 'England',
        countryCode: 'GB',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/39.png',
        season: { start: '2025-08-01', end: '2026-05-31', current: true }
    },
    {
        apiId: '78',
        name: 'Bundesliga',
        shortName: 'BL1',
        country: 'Germany',
        countryCode: 'DE',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/78.png',
        season: { start: '2025-08-01', end: '2026-05-31', current: true }
    },
    {
        apiId: '207',
        name: 'Swiss Super League',
        shortName: 'SSL',
        country: 'Switzerland',
        countryCode: 'CH',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/207.png',
        season: { start: '2025-08-01', end: '2026-05-31', current: true }
    },
    {
        apiId: '140',
        name: 'La Liga',
        shortName: 'LL',
        country: 'Spain',
        countryCode: 'ES',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/140.png',
        season: { start: '2025-08-01', end: '2026-05-31', current: true }
    },
    {
        apiId: '61',
        name: 'Ligue 1',
        shortName: 'L1',
        country: 'France',
        countryCode: 'FR',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/61.png',
        season: { start: '2025-08-01', end: '2026-05-31', current: true }
    },
    {
        apiId: '88',
        name: 'Eredivisie',
        shortName: 'ED',
        country: 'Netherlands',
        countryCode: 'NL',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/88.png',
        season: { start: '2025-08-01', end: '2026-05-31', current: true }
    },
    {
        apiId: '94',
        name: 'Primeira Liga',
        shortName: 'PL',
        country: 'Portugal',
        countryCode: 'PT',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/94.png',
        season: { start: '2025-08-01', end: '2026-05-31', current: true }
    },
    {
        apiId: '135',
        name: 'Serie A',
        shortName: 'SA',
        country: 'Italy',
        countryCode: 'IT',
        tier: 1,
        emblem: 'https://media.api-sports.io/football/leagues/135.png',
        season: { start: '2025-08-01', end: '2026-05-31', current: true }
    }
];

// Map venue data to leagues
const VENUE_LEAGUES = [
    { venues: PREMIER_LEAGUE_VENUES, leagueApiId: '39' },
    { venues: BUNDESLIGA_VENUES, leagueApiId: '78' },
    { venues: SWISS_SUPER_LEAGUE_VENUES, leagueApiId: '207' },
    { venues: LA_LIGA_VENUES, leagueApiId: '140' },
    { venues: LIGUE_1_VENUES, leagueApiId: '61' },
    { venues: EREDIVISIE_VENUES, leagueApiId: '88' },
    { venues: PRIMEIRA_LIGA_VENUES, leagueApiId: '94' },
    { venues: ITALIAN_SERIE_A_VENUES, leagueApiId: '135' }
];

async function connectToDatabase() {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/overlap';
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');
        return true;
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        return false;
    }
}

async function migrateLeagues() {
    console.log('🏆 Migrating leagues...');
    
    for (const leagueData of LEAGUES_DATA) {
        try {
            const existingLeague = await League.findOne({ apiId: leagueData.apiId });
            
            if (!existingLeague) {
                const league = new League(leagueData);
                await league.save();
                console.log(`✅ Created league: ${leagueData.name}`);
            } else {
                console.log(`⏭️  League already exists: ${leagueData.name}`);
            }
        } catch (error) {
            console.error(`❌ Error creating league ${leagueData.name}:`, error.message);
        }
    }
}

async function migrateVenuesAndTeams() {
    console.log('🏟️  Migrating venues and teams...');
    
    for (const { venues, leagueApiId } of VENUE_LEAGUES) {
        const league = await League.findOne({ apiId: leagueApiId });
        if (!league) {
            console.error(`❌ League not found for API ID: ${leagueApiId}`);
            continue;
        }
        
        console.log(`\n📍 Processing ${league.name} venues...`);
        
        for (const [teamName, venueData] of Object.entries(venues)) {
            try {
                // Create venue
                const existingVenue = await Venue.findOne({ 
                    name: venueData.stadium,
                    city: venueData.city 
                });
                
                let venue;
                if (!existingVenue) {
                    venue = new Venue({
                        name: venueData.stadium,
                        city: venueData.city,
                        country: venueData.country,
                        countryCode: league.countryCode,
                        location: {
                            type: 'Point',
                            coordinates: venueData.coordinates
                        },
                        capacity: venueData.capacity || null,
                        ticketUrl: venueData.ticketUrl || null,
                        website: venueData.website || null,
                        surface: 'Natural grass'
                    });
                    await venue.save();
                    console.log(`  ✅ Created venue: ${venueData.stadium}`);
                } else {
                    venue = existingVenue;
                    console.log(`  ⏭️  Venue already exists: ${venueData.stadium}`);
                }
                
                // Create or update team
                const existingTeam = await Team.findOne({ name: teamName });
                
                if (!existingTeam) {
                    const team = new Team({
                        apiId: `temp-${Date.now()}-${Math.random()}`, // Temporary until we get real API IDs
                        name: teamName,
                        shortName: teamName.split(' ').pop(), // Simple short name extraction
                        country: venueData.country,
                        countryCode: league.countryCode,
                        city: venueData.city,
                        leagueId: league._id,
                        venueId: venue._id,
                        // Legacy venue data for backwards compatibility
                        venue: {
                            name: venueData.stadium,
                            capacity: venueData.capacity,
                            coordinates: venueData.coordinates
                        }
                    });
                    await team.save();
                    
                    // Update venue with home team reference
                    venue.homeTeamId = team._id;
                    await venue.save();
                    
                    console.log(`  ✅ Created team: ${teamName}`);
                } else {
                    // Update existing team with new relationships
                    existingTeam.leagueId = league._id;
                    existingTeam.venueId = venue._id;
                    existingTeam.countryCode = league.countryCode;
                    await existingTeam.save();
                    
                    // Update venue with home team reference
                    venue.homeTeamId = existingTeam._id;
                    await venue.save();
                    
                    console.log(`  ✅ Updated team: ${teamName}`);
                }
                
            } catch (error) {
                console.error(`❌ Error processing ${teamName}:`, error.message);
            }
        }
    }
}

async function generateStats() {
    const leagueCount = await League.countDocuments();
    const teamCount = await Team.countDocuments();
    const venueCount = await Venue.countDocuments();
    
    console.log('\n📊 Migration Statistics:');
    console.log(`  Leagues: ${leagueCount}`);
    console.log(`  Teams: ${teamCount}`);
    console.log(`  Venues: ${venueCount}`);
    
    // Show sample data
    console.log('\n🏆 Sample leagues:');
    const leagues = await League.find().limit(3);
    leagues.forEach(league => {
        console.log(`  ${league.name} (${league.country})`);
    });
    
    console.log('\n🏟️  Sample venues:');
    const venues = await Venue.find().populate('homeTeamId').limit(3);
    venues.forEach(venue => {
        const team = venue.homeTeamId ? venue.homeTeamId.name : 'No team';
        console.log(`  ${venue.name} in ${venue.city} - Home: ${team}`);
    });
}

async function runMigration() {
    console.log('🚀 Starting database migration...\n');
    
    const connected = await connectToDatabase();
    if (!connected) {
        process.exit(1);
    }
    
    try {
        await migrateLeagues();
        await migrateVenuesAndTeams();
        await generateStats();
        
        console.log('\n🎉 Migration completed successfully!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Disconnected from MongoDB');
    }
}

// Run migration if called directly
if (require.main === module) {
    runMigration();
}

module.exports = { runMigration }; 