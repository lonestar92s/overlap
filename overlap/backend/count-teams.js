const mongoose = require('mongoose');
require('dotenv').config();

async function analyzeTeams() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/overlap');
        console.log('Connected to MongoDB');

        const Team = require('./src/models/Team');
        
        // Get total count
        const totalCount = await Team.countDocuments();
        console.log(`\nTotal teams in database: ${totalCount}`);
        
        // Count by league
        const teamsByLeague = await Team.aggregate([
            {
                $lookup: {
                    from: 'leagues',
                    localField: 'leagueId',
                    foreignField: '_id',
                    as: 'league'
                }
            },
            { $unwind: '$league' },
            {
                $group: {
                    _id: '$league.name',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);
        
        console.log('\nTeams by league:');
        teamsByLeague.forEach(league => {
            console.log(`${league._id}: ${league.count} teams`);
        });
        
        // Count by country
        const teamsByCountry = await Team.aggregate([
            {
                $group: {
                    _id: '$country',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);
        
        console.log('\nTeams by country:');
        teamsByCountry.forEach(country => {
            console.log(`${country._id}: ${country.count} teams`);
        });

        // Sample team data
        const sampleTeam = await Team.findOne().populate('leagueId venueId');
        console.log('\nSample team structure:', {
            name: sampleTeam.name,
            apiName: sampleTeam.apiName,
            aliases: sampleTeam.aliases,
            league: sampleTeam.leagueId?.name,
            venue: sampleTeam.venueId?.name
        });

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

analyzeTeams(); 