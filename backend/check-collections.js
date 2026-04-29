const mongoose = require('mongoose');
require('dotenv').config();
async function checkCollections() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/overlap');
        const db = mongoose.connection.db;
        // List all collections
        const collections = await db.listCollections().toArray();
        collections.forEach(col => {
        });
        // Check venues collection structure
        const venues = db.collection('venues');
        const sampleVenue = await venues.findOne({});
        if (sampleVenue) {
        }
        // Check if there are any geospatial queries being made
        for (const col of collections) {
            const collection = db.collection(col.name);
            const indexes = await collection.indexes();
            const geoIndexes = indexes.filter(idx => 
                Object.values(idx.key).some(val => val === '2dsphere')
            );
            if (geoIndexes.length > 0) {
            }
        }
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}
checkCollections();
