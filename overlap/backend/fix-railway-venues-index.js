const mongoose = require('mongoose');
require('dotenv').config();
async function fixRailwayVenuesIndex() {
    try {
        // Use Railway MongoDB URL (replace with your actual URL)
        const mongoUrl = process.env.MONGODB_URI || process.env.RAILWAY_MONGODB_URL;
        if (!mongoUrl) {
            console.error('❌ No MongoDB URL found. Please set MONGODB_URI or RAILWAY_MONGODB_URL');
            process.exit(1);
        }
        await mongoose.connect(mongoUrl);
        const db = mongoose.connection.db;
        // Check if venues collection exists
        const collections = await db.listCollections().toArray();
        const venuesExists = collections.some(col => col.name === 'venues');
        if (venuesExists) {
            const venues = db.collection('venues');
            // Check existing indexes
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
            // Test a sample document
            const sampleDoc = await venues.findOne({ location: { $exists: true } });
            if (sampleDoc) {
                    _id: sampleDoc._id,
                    name: sampleDoc.name,
                    city: sampleDoc.city,
                    location: sampleDoc.location,
                    hasLocationField: !!sampleDoc.location
                });
            } else {
            }
            // Test the geoNear query
            try {
                const testResult = await venues.find({
                    location: {
                        $near: {
                            $geometry: {
                                type: 'Point',
                                coordinates: [2.3522, 48.8566] // Paris coordinates
                            },
                            $maxDistance: 50000 // 50km
                        }
                    }
                }).limit(1).toArray();
            } catch (testError) {
                console.error('❌ Test geoNear query failed:', testError.message);
            }
        } else {
        }
        process.exit(0);
    } catch (error) {
        console.error('❌ Error fixing venues index:', error);
        process.exit(1);
    }
}
fixRailwayVenuesIndex();
