require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const TierAccess = require('../models/TierAccess');
const League = require('../models/League');
const subscriptionService = require('../services/subscriptionService');

/**
 * Diagnostic script to check subscription tier issues
 * Usage: node src/scripts/diagnoseSubscriptionTier.js user@example.com
 */
const diagnoseSubscriptionTier = async () => {
    try {
        const email = process.argv[2];
        
        if (!email) {
            console.error('❌ Error: Email address is required');
            console.log('Usage: node src/scripts/diagnoseSubscriptionTier.js user@example.com');
            process.exit(1);
        }

        const mongoUri = process.env.MONGO_PUBLIC_URL || 
                       process.env.MONGODB_URI || 
                       process.env.MONGO_URL || 
                       'mongodb://localhost:27017/flight-match-finder';
        
        const safeUri = mongoUri.replace(/mongodb:\/\/([^:]+):([^@]+)@/, 'mongodb://***:***@');
        const isRailway = mongoUri.includes('railway') || mongoUri.includes('rlwy.net') || mongoUri.includes('proxy.rlwy.net');
        const isLocal = mongoUri.includes('localhost') || mongoUri.includes('127.0.0.1');
        
        console.log(`🔌 Connecting to MongoDB: ${isRailway ? '✅ Railway' : isLocal ? '⚠️ LOCAL' : '✅ Remote'} - ${safeUri}\n`);
        
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB\n');

        // Find user
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            console.error(`❌ User with email "${email}" not found`);
            await mongoose.disconnect();
            process.exit(1);
        }

        console.log('📋 USER SUBSCRIPTION INFO:');
        console.log(`   Email: ${user.email}`);
        console.log(`   Tier: ${user.subscription?.tier || 'NOT SET'}`);
        console.log(`   Start Date: ${user.subscription?.startDate || 'N/A'}`);
        console.log(`   Is Active: ${user.subscription?.isActive || false}\n`);

        // Check pro tier configuration
        const proTierConfig = await TierAccess.findOne({ tier: 'pro' }).lean();
        console.log('📋 PRO TIER CONFIGURATION:');
        if (proTierConfig) {
            console.log(`   Allowed Leagues Count: ${proTierConfig.allowedLeagues?.length || 0}`);
            console.log(`   Restricted Leagues Count: ${proTierConfig.restrictedLeagues?.length || 0}`);
            if (proTierConfig.allowedLeagues && proTierConfig.allowedLeagues.length > 0) {
                console.log(`   Allowed Leagues (first 10): ${proTierConfig.allowedLeagues.slice(0, 10).join(', ')}`);
            } else {
                console.log(`   ⚠️  Allowed Leagues: EMPTY ARRAY`);
            }
            if (proTierConfig.restrictedLeagues && proTierConfig.restrictedLeagues.length > 0) {
                console.log(`   Restricted Leagues: ${proTierConfig.restrictedLeagues.join(', ')}`);
            } else {
                console.log(`   Restricted Leagues: None (empty array)`);
            }
            console.log(`   Description: ${proTierConfig.description || 'N/A'}\n`);
        } else {
            console.log('   ⚠️  Pro tier configuration NOT FOUND in database\n');
        }

        // Get all leagues count
        const allLeagues = await League.find({ isActive: true }).select('apiId').lean();
        const allLeagueIds = allLeagues.map(l => l.apiId.toString());
        console.log(`📊 Total Active Leagues in Database: ${allLeagueIds.length}\n`);

        // Test what leagues user can access using the service
        console.log('🔄 Testing accessible leagues using subscriptionService...');
        const accessibleLeagues = await subscriptionService.getAccessibleLeagues(user);
        console.log('📋 ACCESSIBLE LEAGUES FOR USER:');
        console.log(`   Count: ${accessibleLeagues.length}`);
        if (accessibleLeagues.length > 0) {
            console.log(`   First 20: ${accessibleLeagues.slice(0, 20).join(', ')}`);
        } else {
            console.log(`   ⚠️  NO LEAGUES ACCESSIBLE - This is the problem!`);
        }
        console.log();

        // Check if pro tier should have all leagues
        if (user.subscription?.tier === 'pro') {
            const expectedCount = allLeagueIds.length;
            const actualCount = accessibleLeagues.length;
            
            console.log('🔍 ANALYSIS:');
            if (actualCount === expectedCount) {
                console.log(`   ✅ User has access to all ${expectedCount} leagues (correct for pro tier)`);
            } else {
                console.log(`   ❌ ISSUE FOUND: User should have access to ${expectedCount} leagues, but only has ${actualCount}`);
                console.log(`   Missing: ${expectedCount - actualCount} leagues`);
                
                // Find missing leagues
                const missing = allLeagueIds.filter(id => !accessibleLeagues.includes(id));
                if (missing.length > 0) {
                    console.log(`   Missing League IDs (first 20): ${missing.slice(0, 20).join(', ')}`);
                }
                console.log();
                
                // Check the tier access cache
                console.log('🔍 CHECKING TIER ACCESS CACHE:');
                await subscriptionService.initializeTierAccess();
                const tierConfig = subscriptionService.tierAccess?.pro;
                if (tierConfig) {
                    console.log(`   Pro tier allowedLeagues in cache: ${tierConfig.allowedLeagues?.length || 0}`);
                    console.log(`   Pro tier restrictedLeagues in cache: ${tierConfig.restrictedLeagues?.length || 0}`);
                } else {
                    console.log(`   ⚠️  Pro tier config not found in cache`);
                }
            }
        } else {
            console.log(`ℹ️  User tier is "${user.subscription?.tier || 'freemium'}", not pro tier`);
        }

        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
        }
        process.exit(1);
    }
};

diagnoseSubscriptionTier();
