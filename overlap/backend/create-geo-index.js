const mongoose = require('mongoose');
require('dotenv').config();

async function createGeoIndex() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/overlap');
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;
        
        // Check existing indexes
        const venues = db.collection('venues');
        const indexes = await venues.indexes();
        console.log('Existing venue indexes:', indexes.map(idx => ({ name: idx.name, key: idx.key })));

        // Create geospatial index if it doesn't exist
        try {
            const result = await venues.createIndex({ location: '2dsphere' });
            console.log('Created geospatial index:', result);
        } catch (error) {
            if (error.code === 85) {
                console.log('Geospatial index already exists');
            } else {
                throw error;
            }
        }

        // Verify index was created
        const newIndexes = await venues.indexes();
        console.log('Updated venue indexes:', newIndexes.map(idx => ({ name: idx.name, key: idx.key })));

        // Test a sample venue document
        const sampleVenue = await venues.findOne({});
        if (sampleVenue) {
            console.log('Sample venue structure:', {
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