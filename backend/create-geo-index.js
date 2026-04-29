const mongoose = require('mongoose');
require('dotenv').config();
async function createGeoIndex() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/overlap');
        const db = mongoose.connection.db;
        // Check existing indexes
        const venues = db.collection('venues');
        const indexes = await venues.indexes();
        // Create geospatial index if it doesn't exist
        try {
            const result = await venues.createIndex({ location: '2dsphere' });
        } catch (error) {
            if (error.code === 85) {
            } else {
                throw error;
            }
        }
        // Verify index was created
        const newIndexes = await venues.indexes();
        // Test a sample venue document
        const sampleVenue = await venues.findOne({});
        if (sampleVenue) {
                _id: sampleVenue._id,
                name: sampleVenue.name,
                location: sampleVenue.location
            });
        }
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}
createGeoIndex(); 