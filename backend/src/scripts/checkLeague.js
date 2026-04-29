const mongoose = require('mongoose');
const League = require('../models/League');
// League ID to check (first arg)
// MongoDB URI (optional second arg, or use env vars)
const LEAGUE_ID = process.argv[2] || '45';
const MONGO_URI_ARG = process.argv[3];
async function checkLeague() {
    try {
        // Connect to MongoDB - prioritize command line arg, then env vars, then localhost
        const mongoUri = MONGO_URI_ARG || 
                        process.env.MONGO_PUBLIC_URL || 
                        process.env.MONGODB_URI || 
                        process.env.MONGO_URL || 
                        'mongodb://localhost:27017/flight-match-finder';
        // Detect which database we're connecting to
        const safeUri = mongoUri.replace(/mongodb:\/\/([^:]+):([^@]+)@/, 'mongodb://***:***@');
        const isRailway = mongoUri.includes('railway') || mongoUri.includes('rlwy.net') || mongoUri.includes('proxy.rlwy.net') || mongoUri.includes('mongodb.railway.internal');
        const isLocal = mongoUri.includes('localhost') || mongoUri.includes('127.0.0.1');
        // Warn if using internal Railway hostname from local machine
        if (mongoUri.includes('mongodb.railway.internal') && !process.env.RAILWAY_ENVIRONMENT) {
        }
        await mongoose.connect(mongoUri);
        // Check if league exists
        const league = await League.findOne({ apiId: LEAGUE_ID.toString() }).lean();
        if (league) {
        } else {
        }
        await mongoose.disconnect();
        process.exit(league ? 0 : 1);
    } catch (error) {
        console.error('❌ Error checking league:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}
checkLeague();
