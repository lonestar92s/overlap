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
            console.log('Usage: node src/scripts/makeAdmin.js user@example.com');
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
        
        console.log(`🔌 Connecting to MongoDB: ${isRailway ? '✅ Railway' : isLocal ? '⚠️ LOCAL' : '✅ Remote'} - ${safeUri}`);
        
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        // Find user by email
        const user = await User.findOne({ email: email.toLowerCase() });
        
        if (!user) {
            console.error(`❌ Error: User with email "${email}" not found`);
            await mongoose.disconnect();
            process.exit(1);
        }

        // Check if already admin
        if (user.role === 'admin') {
            console.log(`ℹ️  User "${email}" is already an admin`);
            await mongoose.disconnect();
            process.exit(0);
        }

        // Promote to admin
        user.role = 'admin';
        await user.save();

        console.log(`✅ Successfully promoted "${email}" to admin role`);
        console.log(`📧 User email: ${user.email}`);
        console.log(`👤 User role: ${user.role}`);
        console.log(`🆔 User ID: ${user._id}`);

        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
        }
        process.exit(1);
    }
};

makeAdmin();


