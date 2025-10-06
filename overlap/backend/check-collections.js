const mongoose = require('mongoose');
require('dotenv').config();

async function checkCollections() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/overlap');
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;
        
        // List all collections
        const collections = await db.listCollections().toArray();
        console.log('All collections in database:');
        collections.forEach(col => {
            console.log(`- ${col.name}`);
        });

        // Check venues collection structure
        const venues = db.collection('venues');
        const sampleVenue = await venues.findOne({});
        if (sampleVenue) {
            console.log('\nSample venue document:');
            console.log(JSON.stringify(sampleVenue, null, 2));
        }

        // Check if there are any geospatial queries being made
        console.log('\nChecking for geospatial indexes...');
        for (const col of collections) {
            const collection = db.collection(col.name);
            const indexes = await collection.indexes();
            const geoIndexes = indexes.filter(idx => 
                Object.values(idx.key).some(val => val === '2dsphere')
            );
            if (geoIndexes.length > 0) {
                console.log(`${col.name} has geospatial indexes:`, geoIndexes.map(idx => idx.key));
            }
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkCollections();
