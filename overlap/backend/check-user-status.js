const mongoose = require('mongoose');
require('dotenv').config();

// User schema (based on what I saw in your codebase)
const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  trips: [{
    name: String,
    description: String,
    matches: [Object],
    createdAt: Date,
    updatedAt: Date
  }],
  preferences: {
    defaultLocation: Object,
    favoriteTeams: [Object],
    favoriteLeagues: [Object],
    defaultSearchRadius: Number,
    currency: String,
    notifications: Object
  },
  savedMatches: [Object],
  memories: [Object],
  subscription: {
    type: String,
    default: 'free'
  },
  isPro: {
    type: Boolean,
    default: false
  },
  plan: {
    type: String,
    default: 'free'
  }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

async function checkUserStatus() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/overlap';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Find the user
    const user = await User.findOne({ email: 'aluko17@icloud.com' });
    
    if (!user) {
      console.log('❌ User not found: aluko17@icloud.com');
      return;
    }

    console.log('✅ User found: aluko17@icloud.com');
    console.log('📧 Email:', user.email);
    console.log('📅 Created:', user.createdAt);
    console.log('🔄 Updated:', user.updatedAt);
    
    // Check subscription status
    console.log('\n📊 Subscription Status:');
    console.log('  Subscription Type:', user.subscription || 'Not set');
    console.log('  Is Pro:', user.isPro || false);
    console.log('  Plan:', user.plan || 'Not set');
    
    // Check user activity
    console.log('\n📈 User Activity:');
    console.log('  Trips Created:', user.trips?.length || 0);
    console.log('  Saved Matches:', user.savedMatches?.length || 0);
    console.log('  Memories:', user.memories?.length || 0);
    
    // Check if user is pro based on any field
    const isProUser = user.isPro || 
                     user.subscription === 'pro' || 
                     user.plan === 'pro' ||
                     user.subscription === 'premium' ||
                     user.plan === 'premium';
    
    console.log('\n🎯 Pro User Status:', isProUser ? '✅ YES' : '❌ NO');

  } catch (error) {
    console.error('❌ Error checking user status:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the script
checkUserStatus();
