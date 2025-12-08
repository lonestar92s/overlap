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
            console.log('⚠️  WARNING: Using mongodb.railway.internal from local machine may not work!');
            console.log('   You need the PUBLIC connection string (with proxy.rlwy.net or containers-us-west-xxx.railway.app)\n');
        }
        
        console.log(`🔍 Checking if league ID ${LEAGUE_ID} is onboarded...`);
        console.log(`🔌 Connecting to: ${isRailway ? '✅ Railway' : isLocal ? '⚠️ LOCAL' : '✅ Remote'} - ${safeUri}`);
        console.log(`📝 Using URI from: ${MONGO_URI_ARG ? 'command line arg' : process.env.MONGO_PUBLIC_URL ? 'MONGO_PUBLIC_URL' : process.env.MONGODB_URI ? 'MONGODB_URI' : process.env.MONGO_URL ? 'MONGO_URL' : 'default (localhost)'}\n`);
        
        await mongoose.connect(mongoUri);

        // Check if league exists
        const league = await League.findOne({ apiId: LEAGUE_ID.toString() }).lean();

        if (league) {
            console.log('✅ League is onboarded!');
            console.log('\n📋 League Details:');
            console.log(`   ID: ${league.apiId}`);
            console.log(`   Name: ${league.name}`);
            console.log(`   Short Name: ${league.shortName}`);
            console.log(`   Country: ${league.country}`);
            console.log(`   Country Code: ${league.countryCode}`);
            console.log(`   Tier: ${league.tier}`);
            console.log(`   Active: ${league.isActive ? 'Yes' : 'No'}`);
            console.log(`   Emblem: ${league.emblem || 'N/A'}`);
            console.log(`   Season: ${league.season?.start} - ${league.season?.end}`);
            console.log(`   Last Updated: ${league.lastUpdated || league.updatedAt || 'N/A'}`);
        } else {
            console.log('❌ League is NOT onboarded.');
            console.log(`\n💡 To onboard this league, you can:`);
            console.log(`   1. Use the Admin Dashboard: League Onboarding tab`);
            console.log(`   2. Run: node src/scripts/onboardAllLeagues.js (bulk onboarding)`);
            console.log(`   3. Use the API endpoint: POST /admin/leagues/onboard`);
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

