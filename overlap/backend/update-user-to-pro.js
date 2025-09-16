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

async function updateUserToPro() {
  try {
    // Connect to MongoDB using Railway's connection string
    const mongoUri = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/overlap';
    console.log('Connecting to MongoDB with URI:', mongoUri ? 'Found' : 'Not found');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Find the user first
    const user = await User.findOne({ email: 'aluko17@icloud.com' });
    
    if (!user) {
      console.log('❌ User not found: aluko17@icloud.com');
      return;
    }

    console.log('✅ User found: aluko17@icloud.com');
    console.log('📧 Email:', user.email);
    console.log('📅 Current Status:');
    console.log('  Subscription Type:', user.subscription || 'Not set');
    console.log('  Is Pro:', user.isPro || false);
    console.log('  Plan:', user.plan || 'Not set');

    // Update user to pro
    const updateResult = await User.updateOne(
      { email: 'aluko17@icloud.com' },
      {
        $set: {
          subscription: 'pro',
          isPro: true,
          plan: 'pro',
          updatedAt: new Date()
        }
      }
    );

    if (updateResult.modifiedCount > 0) {
      console.log('\n🎉 SUCCESS! User updated to PRO status');
      console.log('📊 Updated fields:');
      console.log('  subscription: free → pro');
      console.log('  isPro: false → true');
      console.log('  plan: free → pro');
      console.log('  updatedAt: updated to current timestamp');
      
      // Verify the update
      const updatedUser = await User.findOne({ email: 'aluko17@icloud.com' });
      console.log('\n✅ Verification:');
      console.log('  Subscription Type:', updatedUser.subscription);
      console.log('  Is Pro:', updatedUser.isPro);
      console.log('  Plan:', updatedUser.plan);
      console.log('  Updated At:', updatedUser.updatedAt);
      
    } else {
      console.log('❌ No changes made. User might already be pro or update failed.');
    }

  } catch (error) {
    console.error('❌ Error updating user status:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the script
updateUserToPro();
