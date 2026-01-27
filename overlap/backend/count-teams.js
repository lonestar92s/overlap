const mongoose = require('mongoose');
require('dotenv').config();
async function analyzeTeams() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/overlap');
        const Team = require('./src/models/Team');
        // Get total count
        const totalCount = await Team.countDocuments();
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
        teamsByLeague.forEach(league => {
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
        teamsByCountry.forEach(country => {
        });
        // Sample team data
        const sampleTeam = await Team.findOne().populate('leagueId venueId');
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