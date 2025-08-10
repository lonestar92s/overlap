const mongoose = require('mongoose');
const User = require('../models/User');
const subscriptionService = require('../services/subscriptionService');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/flight-match-finder')
  .then(async () => {
    try {
      // Find the test user
      const testUser = await User.findOne({ email: 'test@mobileapp.com' });
      
      if (!testUser) {
        console.log('❌ Test user not found. Please run createTestUser.js first.');
        await mongoose.disconnect();
        return;
      }
      
      // Update to Pro tier
      subscriptionService.updateUserTier(testUser, 'pro');
      await testUser.save();
      
      console.log('✅ Test user updated to PRO tier successfully!');
      console.log('\n📱 Mobile app now has access to:');
      console.log('   - All leagues (no restrictions)');
      console.log('   - Championship and League One matches');
      console.log('   - Full search capabilities');
      
      await mongoose.disconnect();
    } catch (error) {
      console.error('❌ Error updating test user:', error);
      await mongoose.disconnect();
    }
  })
  .catch(console.error); 
const User = require('../models/User');
const subscriptionService = require('../services/subscriptionService');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/flight-match-finder')
  .then(async () => {
    try {
      // Find the test user
      const testUser = await User.findOne({ email: 'test@mobileapp.com' });
      
      if (!testUser) {
        console.log('❌ Test user not found. Please run createTestUser.js first.');
        await mongoose.disconnect();
        return;
      }
      
      // Update to Pro tier
      subscriptionService.updateUserTier(testUser, 'pro');
      await testUser.save();
      
      console.log('✅ Test user updated to PRO tier successfully!');
      console.log('\n📱 Mobile app now has access to:');
      console.log('   - All leagues (no restrictions)');
      console.log('   - Championship and League One matches');
      console.log('   - Full search capabilities');
      
      await mongoose.disconnect();
    } catch (error) {
      console.error('❌ Error updating test user:', error);
      await mongoose.disconnect();
    }
  })
  .catch(console.error); 
 