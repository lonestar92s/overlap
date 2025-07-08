const mongoose = require('mongoose');
const Team = require('../models/Team');
const Venue = require('../models/Venue');

// Import venue data from frontend
const VENUE_DATA = {
    // Premier League
    "Arsenal FC": {
        stadium: "Emirates Stadium",
        location: "London",
        coordinates: [-0.108438, 51.555],
        country: "England"
    },
    "Aston Villa FC": {
        stadium: "Villa Park",
        location: "Birmingham",
        coordinates: [-1.884746, 52.509],
        country: "England"
    },
    "Manchester United FC": {
        stadium: "Old Trafford",
        location: "Manchester",
        coordinates: [-2.291389, 53.463056],
        country: "England"
    },
    "Manchester City FC": {
        stadium: "Etihad Stadium",
        location: "Manchester",
        coordinates: [-2.200278, 53.483056],
        country: "England"
    },
    "Liverpool FC": {
        stadium: "Anfield",
        location: "Liverpool",
        coordinates: [-2.96083, 53.43083],
        country: "England"
    },
    "Chelsea FC": {
        stadium: "Stamford Bridge",
        location: "London",
        coordinates: [-0.191034, 51.481667],
        country: "England"
    },
    "Tottenham Hotspur FC": {
        stadium: "Tottenham Hotspur Stadium",
        location: "London",
        coordinates: [-0.066389, 51.604444],
        country: "England"
    },
    
    // La Liga
    "Real Madrid CF": {
        stadium: "Santiago Bernabéu",
        location: "Madrid",
        coordinates: [-3.688333, 40.453056],
        country: "Spain"
    },
    "FC Barcelona": {
        stadium: "Spotify Camp Nou",
        location: "Barcelona",
        coordinates: [2.122917, 41.380898],
        country: "Spain"
    },
    "Atlético de Madrid": {
        stadium: "Cívitas Metropolitano",
        location: "Madrid",
        coordinates: [-3.599722, 40.436111],
        country: "Spain"
    },
    
    // Bundesliga
    "FC Bayern München": {
        stadium: "Allianz Arena",
        location: "Munich",
        coordinates: [11.624722, 48.218889],
        country: "Germany"
    },
    "Borussia Dortmund": {
        stadium: "Signal Iduna Park",
        location: "Dortmund",
        coordinates: [7.451667, 51.492778],
        country: "Germany"
    },
    
    // Primeira Liga
    "SL Benfica": {
        stadium: "Estádio da Luz",
        location: "Lisbon",
        coordinates: [-9.184674, 38.752827],
        country: "Portugal"
    },
    "FC Porto": {
        stadium: "Estádio do Dragão",
        location: "Porto",
        coordinates: [-8.583533, 41.161758],
        country: "Portugal"
    },
    "Sporting CP": {
        stadium: "Estádio José Alvalade",
        location: "Lisbon",
        coordinates: [-9.160944, 38.761444],
        country: "Portugal"
    }
};

async function migrateVenueCoordinates() {
    console.log('🏟️  Starting venue coordinates migration...');
    
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const [teamName, venueData] of Object.entries(VENUE_DATA)) {
        try {
            console.log(`\n📍 Processing ${teamName}...`);
            
            // Find team
            const team = await Team.findOne({ name: teamName });
            if (!team) {
                console.log(`⚠️  Team not found: ${teamName}`);
                skipped++;
                continue;
            }
            
            // Find or create venue
            let venue = await Venue.findOne({ 
                name: venueData.stadium,
                city: venueData.location
            });
            
            if (!venue) {
                venue = new Venue({
                    name: venueData.stadium,
                    city: venueData.location,
                    country: venueData.country,
                    countryCode: team.countryCode,
                    location: {
                        type: 'Point',
                        coordinates: venueData.coordinates
                    },
                    surface: 'Natural grass'
                });
                await venue.save();
                console.log(`✅ Created venue: ${venueData.stadium}`);
            } else if (!venue.location?.coordinates?.length) {
                venue.location = {
                    type: 'Point',
                    coordinates: venueData.coordinates
                };
                await venue.save();
                console.log(`✅ Updated venue coordinates: ${venueData.stadium}`);
            }
            
            // Update team with venue reference and legacy coordinates
            team.venueId = venue._id;
            team.venue = {
                name: venueData.stadium,
                coordinates: venueData.coordinates
            };
            await team.save();
            
            console.log(`✅ Updated team: ${teamName}`);
            updated++;
            
        } catch (error) {
            console.error(`❌ Error processing ${teamName}:`, error.message);
            errors++;
        }
    }
    
    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ⚠️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
}

// Connect to MongoDB and run migration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/overlap';

console.log('🔌 Connecting to MongoDB at:', MONGODB_URI);

mongoose.connect(MONGODB_URI, { 
    useNewUrlParser: true,
    useUnifiedTopology: true 
})
    .then(async () => {
        console.log('📦 Connected to MongoDB');
        
        // Test connection by counting venues
        const venueCount = await Venue.countDocuments();
        console.log(`📊 Current venue count: ${venueCount}`);
        
        return migrateVenueCoordinates();
    })
    .then(() => {
        console.log('\n✨ Migration complete!');
        
        // Verify the changes
        return Venue.find({
            name: { 
                $in: Object.values(VENUE_DATA).map(v => v.stadium)
            }
        }).select('name city location');
    })
    .then((venues) => {
        console.log('\n🏟️ Migrated venues:', venues.map(v => ({
            name: v.name,
            city: v.city,
            coordinates: v.location?.coordinates
        })));
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }); 