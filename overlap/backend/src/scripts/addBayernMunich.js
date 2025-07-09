const mongoose = require('mongoose');
const Team = require('../models/Team');
const Venue = require('../models/Venue');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/overlap', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function addBayernMunich() {
    try {
        // First, create the venue
        const venue = new Venue({
            name: 'Allianz Arena',
            city: 'Munich',
            country: 'Germany',
            countryCode: 'DE',
            location: {
                type: 'Point',
                coordinates: [11.624736, 48.218791] // [longitude, latitude] for Allianz Arena
            },
            address: 'Werner-Heisenberg-Allee 25, 80939 München, Germany',
            capacity: 75024,
            isActive: true
        });

        await venue.save();
        console.log('✅ Venue created:', venue);

        // Then create the team with proper mapping
        const team = new Team({
            apiId: '157', // API-Sports ID for Bayern Munich
            name: 'Bayern Munich',
            aliases: ['Bayern München', 'FC Bayern München', 'FC Bayern Munich'],
            code: 'BAY',
            founded: 1900,
            logo: 'https://media.api-sports.io/football/teams/157.png',
            country: 'Germany',
            city: 'Munich',
            venue: {
                name: 'Allianz Arena',
                capacity: 75024,
                coordinates: [11.624736, 48.218791]
            },
            leagues: [{
                leagueId: '78', // Bundesliga ID
                leagueName: 'Bundesliga',
                season: '2024',
                isActive: true
            }],
            searchCount: 1,
            popularity: 1,
            lastUpdated: new Date(),
            apiSource: 'api-sports'
        });

        await team.save();
        console.log('✅ Team created:', team);

        console.log('✅ Successfully added Bayern Munich with venue data');
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

addBayernMunich(); 