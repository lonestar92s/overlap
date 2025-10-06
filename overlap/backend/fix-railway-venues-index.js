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

        console.log('🔌 Connecting to Railway MongoDB...');
        await mongoose.connect(mongoUrl);
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;
        
        // Check if venues collection exists
        const collections = await db.listCollections().toArray();
        const venuesExists = collections.some(col => col.name === 'venues');
        console.log('📊 venues collection exists:', venuesExists);
        
        if (venuesExists) {
            const venues = db.collection('venues');
            
            // Check existing indexes
            const indexes = await venues.indexes();
            console.log('📋 Existing venues indexes:', indexes.map(idx => ({ name: idx.name, key: idx.key })));

            // Create geospatial index if it doesn't exist
            try {
                const result = await venues.createIndex({ location: '2dsphere' });
                console.log('✅ Created geospatial index on venues:', result);
            } catch (error) {
                if (error.code === 85) {
                    console.log('ℹ️ Geospatial index already exists on venues');
                } else {
                    throw error;
                }
            }

            // Verify index was created
            const newIndexes = await venues.indexes();
            console.log('📋 Updated venues indexes:', newIndexes.map(idx => ({ name: idx.name, key: idx.key })));

            // Test a sample document
            const sampleDoc = await venues.findOne({ location: { $exists: true } });
            if (sampleDoc) {
                console.log('📄 Sample venues document structure:', {
                    _id: sampleDoc._id,
                    name: sampleDoc.name,
                    city: sampleDoc.city,
                    location: sampleDoc.location,
                    hasLocationField: !!sampleDoc.location
                });
            } else {
                console.log('⚠️ No documents with location field found in venues collection');
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
                
                console.log('🧪 Test geoNear query successful:', testResult.length > 0 ? 'Found venues' : 'No venues found');
            } catch (testError) {
                console.error('❌ Test geoNear query failed:', testError.message);
            }
        } else {
            console.log('❌ venues collection does not exist');
        }

        console.log('✅ Fix completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error fixing venues index:', error);
        process.exit(1);
    }
}

fixRailwayVenuesIndex();
