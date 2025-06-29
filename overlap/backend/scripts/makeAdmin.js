const mongoose = require('mongoose');
const User = require('../src/models/User');
require('dotenv').config({ path: './.env' });

async function makeAdmin() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        // Get email from command line args
        const email = process.argv[2];
        
        if (!email) {
            console.error('❌ Usage: node makeAdmin.js <email>');
            console.log('Example: node makeAdmin.js john@example.com');
            process.exit(1);
        }
        
        console.log(`🔍 Looking for user: ${email}`);
        
        // Find user and update role
        const user = await User.findOne({ email: email });
        
        if (!user) {
            console.error(`❌ User with email ${email} not found`);
            console.log('💡 Make sure the user has registered an account first');
            process.exit(1);
        }
        
        if (user.role === 'admin') {
            console.log(`🎯 ${email} is already an admin`);
        } else {
            console.log(`🔄 Promoting ${email} to admin...`);
            user.role = 'admin';
            await user.save();
            console.log(`🎉 Successfully promoted ${email} to admin!`);
            console.log(`👤 User: ${user.profile?.firstName || 'N/A'} ${user.profile?.lastName || 'N/A'}`);
        }
        
        console.log('\n📋 Admin privileges include:');
        console.log('   • Access to Admin Dashboard (/admin)');
        console.log('   • Manage unmapped teams');
        console.log('   • Edit venue data');
        console.log('   • Promote/demote other users');
        console.log('   • View system statistics');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

console.log('🛠️  Admin User Promotion Script');
console.log('================================');
makeAdmin(); 