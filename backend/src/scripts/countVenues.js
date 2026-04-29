const mongoose = require('mongoose');
const Venue = require('../models/Venue');
async function countVenues() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/overlap');
        const totalVenues = await Venue.countDocuments();
        // Check venues with coordinates
        const venuesWithCoords = await Venue.countDocuments({
            'location.coordinates': { $exists: true, $ne: [] }
        });
        // Sample some venues to check raw data
        const sampleVenues = await Venue.find().limit(5).lean();
        sampleVenues.forEach(venue => {
        });
        mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}
countVenues(); 