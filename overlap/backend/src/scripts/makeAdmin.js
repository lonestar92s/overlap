require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
/**
 * Promote an existing user to admin role
 * Usage: node src/scripts/makeAdmin.js user@example.com
 */
const makeAdmin = async () => {
    try {
        // Get email from command line argument
        const email = process.argv[2];
        if (!email) {
            console.error('❌ Error: Email address is required');
            process.exit(1);
        }
        // Connect to MongoDB
        const mongoUri = process.env.MONGO_URL || process.env.MONGODB_URI;
        if (!mongoUri) {
            console.error('❌ Error: MONGODB_URI or MONGO_URL environment variable must be set');
            process.exit(1);
        }
        // Log which MongoDB we're connecting to (but hide credentials)
        const safeUri = mongoUri.replace(/mongodb:\/\/([^:]+):([^@]+)@/, 'mongodb://***:***@');
        const isRailway = mongoUri.includes('railway') || mongoUri.includes('rlwy.net') || mongoUri.includes('proxy.rlwy.net');
        const isLocal = mongoUri.includes('localhost') || mongoUri.includes('127.0.0.1');
        await mongoose.connect(mongoUri);
        // Find user by email
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            console.error(`❌ Error: User with email "${email}" not found`);
            await mongoose.disconnect();
            process.exit(1);
        }
        // Check if already admin
        if (user.role === 'admin') {
            await mongoose.disconnect();
            process.exit(0);
        }
        // Promote to admin
        user.role = 'admin';
        await user.save();
        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
        }
        process.exit(1);
    }
};
makeAdmin();
