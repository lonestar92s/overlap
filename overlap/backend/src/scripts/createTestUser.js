const mongoose = require('mongoose');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/flight-match-finder')
  .then(async () => {
    try {
      // Check if test user already exists
      let testUser = await User.findOne({ email: 'test@mobileapp.com' });
      
      if (!testUser) {
        // Create test user
        testUser = new User({
          email: 'test@mobileapp.com',
          password: 'testpassword123',
          profile: {
            firstName: 'Test',
            lastName: 'User'
          },
          preferences: {
            defaultLocation: {
              city: '',
              country: ''
            },
            favoriteTeams: [],
            favoriteLeagues: [],
            defaultSearchRadius: 100,
            currency: 'USD',
            notifications: {
              email: true,
              matchReminders: false,
              priceAlerts: false
            }
          }
        });
        
        await testUser.save();
        console.log('✅ Test user created successfully');
      } else {
        console.log('✅ Test user already exists');
      }
      
      // Generate token
      const token = jwt.sign(
        { userId: testUser._id },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '30d' }
      );
      
      console.log('\n🔑 Test User Token:');
      console.log('Bearer', token);
      console.log('\n📱 Add this token to your mobile app for testing heart functionality');
      console.log('\n📧 Email: test@mobileapp.com');
      console.log('🔐 Password: testpassword123');
      
      await mongoose.disconnect();
    } catch (error) {
      console.error('❌ Error creating test user:', error);
      await mongoose.disconnect();
    }
  })
  .catch(console.error); 
 