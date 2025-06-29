const mongoose = require('mongoose');
require('dotenv').config();

const Team = require('../models/Team');
const Venue = require('../models/Venue');
const League = require('../models/League');

// Belgian Pro League teams with venue data
const BELGIAN_TEAMS = [
    {
        name: 'Club Brugge KV',
        apiName: 'Club Brugge KV',
        apiId: '569',
        city: 'Brugge',
        venue: { 
            name: 'Jan Breydelstadion', 
            capacity: 29062, 
            coordinates: [3.1890, 51.1956] // [longitude, latitude]
        }
    },
    {
        name: 'Anderlecht',
        apiName: 'Anderlecht',
        apiId: '554',
        city: 'Brussels',
        venue: { 
            name: 'Lotto Park', 
            capacity: 21500, 
            coordinates: [4.2970, 50.8337]
        }
    },
    {
        name: 'Union St. Gilloise',
        apiName: 'Union St. Gilloise',
        apiId: '1393',
        city: 'Brussels',
        venue: { 
            name: 'Rabat Arena', 
            capacity: 8000, 
            coordinates: [4.3370, 50.8100]
        }
    },
    {
        name: 'Standard Liege',
        apiName: 'Standard Liege',
        apiId: '733',
        city: 'Liège',
        venue: { 
            name: 'Stade Maurice Dufrasne', 
            capacity: 27670, 
            coordinates: [5.5425, 50.6097]
        }
    },
    {
        name: 'Genk',
        apiName: 'Genk',
        apiId: '742',
        city: 'Genk',
        venue: { 
            name: 'Luminus Arena', 
            capacity: 25000, 
            coordinates: [5.5180, 50.9597]
        }
    },
    {
        name: 'Gent',
        apiName: 'Gent',
        apiId: '631',
        city: 'Ghent',
        venue: { 
            name: 'Galanco Stadium', 
            capacity: 20000, 
            coordinates: [3.7325, 51.0297]
        }
    },
    {
        name: 'Antwerp',
        apiName: 'Antwerp',
        apiId: '740',
        city: 'Antwerp',
        venue: { 
            name: 'Bosul Stadium', 
            capacity: 16649, 
            coordinates: [4.3947, 51.1889]
        }
    },
    {
        name: 'Charleroi',
        apiName: 'Charleroi',
        apiId: '736',
        city: 'Charleroi',
        venue: { 
            name: 'Stade du Pays de Charleroi', 
            capacity: 15000, 
            coordinates: [4.4447, 50.4097]
        }
    },
    {
        name: 'KV Mechelen',
        apiName: 'KV Mechelen',
        apiId: '266',
        city: 'Mechelen',
        venue: { 
            name: 'Veolia Stadium Achter de Kazerne', 
            capacity: 16672, 
            coordinates: [4.4897, 51.0297]
        }
    },
    {
        name: 'KVC Westerlo',
        apiName: 'KVC Westerlo',
        apiId: '261',
        city: 'Westerlo',
        venue: { 
            name: 'Het Kuipje', 
            capacity: 8035, 
            coordinates: [4.9147, 51.0897]
        }
    },
    {
        name: 'OH Leuven',
        apiName: 'OH Leuven',
        apiId: '260',
        city: 'Leuven',
        venue: { 
            name: 'STADION DEN DREEF', 
            capacity: 10020, 
            coordinates: [4.7097, 50.8597]
        }
    },
    {
        name: 'St. Truiden',
        apiName: 'St. Truiden',
        apiId: '735',
        city: 'Sint-Truiden',
        venue: { 
            name: 'Staaienveld', 
            capacity: 14600, 
            coordinates: [5.1897, 50.8197]
        }
    },
    {
        name: 'Cercle Brugge',
        apiName: 'Cercle Brugge',
        apiId: '741',
        city: 'Brugge',
        venue: { 
            name: 'Jan Breydelstadion', 
            capacity: 29062, 
            coordinates: [3.1890, 51.1956] // Shared with Club Brugge
        }
    },
    {
        name: 'Zulte Waregem',
        apiName: 'Zulte Waregem',
        apiId: '600',
        city: 'Waregem',
        venue: { 
            name: 'Regenboogstadion', 
            capacity: 8500, 
            coordinates: [3.4197, 50.8897]
        }
    },
    {
        name: 'Dender',
        apiName: 'Dender',
        apiId: '6215',
        city: 'Denderleeuw',
        venue: { 
            name: 'Dender Stadium', 
            capacity: 8000, 
            coordinates: [4.0797, 50.8797]
        }
    },
    {
        name: 'RAAL La Louvière',
        apiName: 'RAAL La Louvière',
        apiId: '5902',
        city: 'La Louvière',
        venue: { 
            name: 'RAAL La Louvière Stadium', 
            capacity: 8000, 
            coordinates: [4.1897, 50.4797]
        }
    }
];

async function createVenueForTeam(teamData, country, countryCode) {
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
        countryCode: countryCode,
        location: {
            type: 'Point',
            coordinates: teamData.venue.coordinates
        },
        capacity: teamData.venue.capacity,
        surface: 'Natural grass',
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

async function seedBelgianTeams() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('📊 Connected to MongoDB');

        // Find or create Belgian Pro League
        let belgianLeague = await League.findOne({ apiId: '144' });
        
        if (!belgianLeague) {
            belgianLeague = new League({
                apiId: '144',
                name: 'Belgian Pro League',
                shortName: 'Pro League',
                country: 'Belgium',
                countryCode: 'BE',
                tier: 1,
                season: {
                    start: '2025-08-01',
                    end: '2026-05-31',
                    current: true
                },
                isActive: true,
                emblem: 'https://media.api-sports.io/football/leagues/144.png'
            });
            await belgianLeague.save();
            console.log('✅ Created Belgian Pro League');
        } else {
            console.log('📍 Belgian Pro League already exists');
        }

        console.log('\n🇧🇪 Seeding Belgian Pro League teams...\n');

        for (const teamData of BELGIAN_TEAMS) {
            try {
                // Create venue
                const venueId = await createVenueForTeam(teamData, 'Belgium', 'BE');
                if (!venueId) continue;

                // Check if team already exists
                const existingTeam = await Team.findOne({ apiId: teamData.apiId });
                
                if (existingTeam) {
                    // Update existing team with venue info
                    existingTeam.venueId = venueId;
                    existingTeam.leagueId = belgianLeague._id;
                    existingTeam.venue = {
                        name: teamData.venue.name,
                        capacity: teamData.venue.capacity,
                        coordinates: teamData.venue.coordinates
                    };
                    await existingTeam.save();
                    console.log(`✅ Updated team: ${teamData.name}`);
                } else {
                    // Create new team
                    const newTeam = new Team({
                        apiId: teamData.apiId,
                        name: teamData.name,
                        apiName: teamData.apiName,
                        shortName: teamData.name.split(' ')[0],
                        country: 'Belgium',
                        countryCode: 'BE',
                        city: teamData.city,
                        leagueId: belgianLeague._id,
                        venueId: venueId,
                        venue: {
                            name: teamData.venue.name,
                            capacity: teamData.venue.capacity,
                            coordinates: teamData.venue.coordinates
                        }
                    });
                    await newTeam.save();
                    console.log(`✅ Created team: ${teamData.name}`);
                }

                // Update venue with home team reference
                const team = existingTeam || await Team.findOne({ apiId: teamData.apiId });
                await Venue.findByIdAndUpdate(venueId, { homeTeamId: team._id });

            } catch (error) {
                console.error(`❌ Error processing ${teamData.name}:`, error.message);
            }
        }

        console.log('\n🎉 Belgian Pro League teams seeded successfully!');
        console.log(`📊 Total teams: ${BELGIAN_TEAMS.length}`);

    } catch (error) {
        console.error('❌ Error seeding Belgian teams:', error);
    } finally {
        await mongoose.connection.close();
        console.log('📊 Database connection closed');
    }
}

// Run the script
if (require.main === module) {
    seedBelgianTeams();
}

module.exports = { seedBelgianTeams }; 