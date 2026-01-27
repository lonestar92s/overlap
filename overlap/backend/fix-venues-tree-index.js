const mongoose = require('mongoose');
require('dotenv').config();
async function fixVenuesTreeIndex() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/overlap');
        const db = mongoose.connection.db;
        // Check if venuesTree collection exists
        const collections = await db.listCollections().toArray();
        const venuesTreeExists = collections.some(col => col.name === 'venuesTree');
        if (venuesTreeExists) {
            const venuesTree = db.collection('venuesTree');
            // Check existing indexes
            const indexes = await venuesTree.indexes();
            // Create geospatial index if it doesn't exist
            try {
                const result = await venuesTree.createIndex({ location: '2dsphere' });
            } catch (error) {
                if (error.code === 85) {
                } else {
                    throw error;
                }
            }
            // Verify index was created
            const newIndexes = await venuesTree.indexes();
            // Test a sample document
            const sampleDoc = await venuesTree.findOne({});
            if (sampleDoc) {
                    _id: sampleDoc._id,
                    location: sampleDoc.location,
                    hasLocationField: !!sampleDoc.location
                });
            } else {
            }
        } else {
            await db.createCollection('venuesTree');
        }
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}
fixVenuesTreeIndex();
