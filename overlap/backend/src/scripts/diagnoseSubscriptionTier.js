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
            process.exit(1);
        }
        const mongoUri = process.env.MONGO_PUBLIC_URL || 
                       process.env.MONGODB_URI || 
                       process.env.MONGO_URL || 
                       'mongodb://localhost:27017/flight-match-finder';
        const safeUri = mongoUri.replace(/mongodb:\/\/([^:]+):([^@]+)@/, 'mongodb://***:***@');
        const isRailway = mongoUri.includes('railway') || mongoUri.includes('rlwy.net') || mongoUri.includes('proxy.rlwy.net');
        const isLocal = mongoUri.includes('localhost') || mongoUri.includes('127.0.0.1');
        await mongoose.connect(mongoUri);
        // Find user
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            console.error(`❌ User with email "${email}" not found`);
            await mongoose.disconnect();
            process.exit(1);
        }
        // Check pro tier configuration
        const proTierConfig = await TierAccess.findOne({ tier: 'pro' }).lean();
        if (proTierConfig) {
            if (proTierConfig.allowedLeagues && proTierConfig.allowedLeagues.length > 0) {
            } else {
            }
            if (proTierConfig.restrictedLeagues && proTierConfig.restrictedLeagues.length > 0) {
            } else {
            }
        } else {
        }
        // Get all leagues count
        const allLeagues = await League.find({ isActive: true }).select('apiId').lean();
        const allLeagueIds = allLeagues.map(l => l.apiId.toString());
        // Test what leagues user can access using the service
        const accessibleLeagues = await subscriptionService.getAccessibleLeagues(user);
        if (accessibleLeagues.length > 0) {
        } else {
        }
        // Check if pro tier should have all leagues
        if (user.subscription?.tier === 'pro') {
            const expectedCount = allLeagueIds.length;
            const actualCount = accessibleLeagues.length;
            if (actualCount === expectedCount) {
            } else {
                // Find missing leagues
                const missing = allLeagueIds.filter(id => !accessibleLeagues.includes(id));
                if (missing.length > 0) {
                }
                // Check the tier access cache
                await subscriptionService.initializeTierAccess();
                const tierConfig = subscriptionService.tierAccess?.pro;
                if (tierConfig) {
                } else {
                }
            }
        } else {
        }
        await mongoose.disconnect();
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
