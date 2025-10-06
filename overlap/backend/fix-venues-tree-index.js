const mongoose = require('mongoose');
require('dotenv').config();

async function fixVenuesTreeIndex() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/overlap');
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;
        
        // Check if venuesTree collection exists
        const collections = await db.listCollections().toArray();
        const venuesTreeExists = collections.some(col => col.name === 'venuesTree');
        console.log('venuesTree collection exists:', venuesTreeExists);
        
        if (venuesTreeExists) {
            const venuesTree = db.collection('venuesTree');
            
            // Check existing indexes
            const indexes = await venuesTree.indexes();
            console.log('Existing venuesTree indexes:', indexes.map(idx => ({ name: idx.name, key: idx.key })));

            // Create geospatial index if it doesn't exist
            try {
                const result = await venuesTree.createIndex({ location: '2dsphere' });
                console.log('Created geospatial index on venuesTree:', result);
            } catch (error) {
                if (error.code === 85) {
                    console.log('Geospatial index already exists on venuesTree');
                } else {
                    throw error;
                }
            }

            // Verify index was created
            const newIndexes = await venuesTree.indexes();
            console.log('Updated venuesTree indexes:', newIndexes.map(idx => ({ name: idx.name, key: idx.key })));

            // Test a sample document
            const sampleDoc = await venuesTree.findOne({});
            if (sampleDoc) {
                console.log('Sample venuesTree document structure:', {
                    _id: sampleDoc._id,
                    location: sampleDoc.location,
                    hasLocationField: !!sampleDoc.location
                });
            } else {
                console.log('No documents found in venuesTree collection');
            }
        } else {
            console.log('venuesTree collection does not exist. Creating it...');
            await db.createCollection('venuesTree');
            console.log('Created venuesTree collection');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

fixVenuesTreeIndex();
