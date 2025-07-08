const mongoose = require('mongoose');
const Venue = require('../models/Venue');

async function countVenues() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/overlap');
        console.log('Connected to MongoDB');

        const totalVenues = await Venue.countDocuments();
        console.log(`\nTotal venues in database: ${totalVenues}`);

        // Check venues with coordinates
        const venuesWithCoords = await Venue.countDocuments({
            'location.coordinates': { $exists: true, $ne: [] }
        });
        console.log(`Venues with coordinates: ${venuesWithCoords}`);

        // Sample some venues to check raw data
        const sampleVenues = await Venue.find().limit(5).lean();
        console.log('\nSample venues (raw data):');
        sampleVenues.forEach(venue => {
            console.log('\n', JSON.stringify(venue, null, 2));
        });

        mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

countVenues(); 