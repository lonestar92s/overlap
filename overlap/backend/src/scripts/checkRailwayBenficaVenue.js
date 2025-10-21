const mongoose = require('mongoose');
const Venue = require('../models/Venue');

async function checkRailwayBenficaVenue() {
    try {
        // Connect to Railway MongoDB using the environment variable
        const mongoUrl = process.env.MONGO_URL || process.env.MONGODB_URI;
        
        if (!mongoUrl) {
            console.error('❌ No MongoDB URL found. Please set MONGO_URL or MONGODB_URI');
            console.log('💡 You can get the MongoDB URL from Railway dashboard');
            process.exit(1);
        }

        console.log('🔌 Connecting to Railway MongoDB...');
        await mongoose.connect(mongoUrl);
        console.log('✅ Connected to Railway MongoDB');
        
        // Find all venues that might be Benfica's stadium
        console.log('\n🔍 Searching for Benfica venues...');
        
        const benficaVenues = await Venue.find({
            $or: [
                { name: { $regex: /benfica/i } },
                { name: { $regex: /luz/i } },
                { name: { $regex: /estadio.*lisboa/i } },
                { aliases: { $regex: /benfica/i } },
                { aliases: { $regex: /luz/i } }
            ]
        });
        
        console.log(`📊 Found ${benficaVenues.length} potential Benfica venues:`);
        
        benficaVenues.forEach((venue, index) => {
            console.log(`\n🏟️  Venue ${index + 1}:`);
            console.log(`   Name: ${venue.name}`);
            console.log(`   Venue ID: ${venue.venueId}`);
            console.log(`   City: ${venue.city}`);
            console.log(`   Country: ${venue.country}`);
            console.log(`   Aliases: ${venue.aliases ? venue.aliases.join(', ') : 'None'}`);
            console.log(`   Coordinates: ${venue.coordinates ? `[${venue.coordinates.join(', ')}]` : 'None'}`);
            console.log(`   Location: ${venue.location?.coordinates ? `[${venue.location.coordinates.join(', ')}]` : 'None'}`);
            console.log(`   Last Updated: ${venue.lastUpdated}`);
        });
        
        // Also search for venues in Lisbon
        console.log('\n🏙️  Searching for all venues in Lisbon...');
        const lisbonVenues = await Venue.find({ 
            $or: [
                { city: { $regex: /lisbon/i } },
                { city: { $regex: /lisboa/i } }
            ]
        });
        
        console.log(`📊 Found ${lisbonVenues.length} venues in Lisbon:`);
        lisbonVenues.forEach((venue, index) => {
            console.log(`\n🏟️  Lisbon Venue ${index + 1}:`);
            console.log(`   Name: ${venue.name}`);
            console.log(`   Venue ID: ${venue.venueId}`);
            console.log(`   City: ${venue.city}`);
            console.log(`   Aliases: ${venue.aliases ? venue.aliases.join(', ') : 'None'}`);
        });
        
        console.log('\n✨ Database check completed');
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Disconnected from Railway MongoDB');
    }
}

checkRailwayBenficaVenue();