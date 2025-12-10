const axios = require('axios');

const RAILWAY_URL = 'https://friendly-gratitude-production-3f31.up.railway.app/api';
const EMAIL = 'aluko17@icloud.com';
const PASSWORD = 'test1234';

async function testWorldCup() {
  try {
    console.log('🔐 Logging in...');
    
    // Step 1: Login
    const loginResponse = await axios.post(`${RAILWAY_URL}/auth/login`, {
      email: EMAIL,
      password: PASSWORD
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Authenticated successfully\n');
    
    // Step 2: Test World Cup endpoint
    console.log('🌍 Testing World Cup endpoint...');
    console.log('   Competition ID: 1 (World Cup)');
    console.log('   Date range: 2026-06-24 to 2026-06-25\n');
    
    const worldCupResponse = await axios.get(`${RAILWAY_URL}/matches/competitions/1`, {
      params: {
        dateFrom: '2026-06-24',
        dateTo: '2026-06-25'
      },
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Response received:');
    console.log(`   Status: ${worldCupResponse.status}`);
    console.log(`   Total results: ${worldCupResponse.data.results || 0}`);
    console.log(`   Matches found: ${worldCupResponse.data.response?.length || 0}\n`);
    
    // Display match details with locations
    if (worldCupResponse.data.response && worldCupResponse.data.response.length > 0) {
      console.log('📍 Match locations:');
      worldCupResponse.data.response.forEach((match, index) => {
        const venue = match.fixture?.venue || {};
        const teams = match.teams || {};
        
        console.log(`\n   Match ${index + 1}:`);
        console.log(`   Teams: ${teams.home?.name || 'TBD'} vs ${teams.away?.name || 'TBD'}`);
        console.log(`   Date: ${match.fixture?.date || 'N/A'}`);
        console.log(`   Venue: ${venue.name || 'N/A'}`);
        console.log(`   City: ${venue.city || 'N/A'}`);
        console.log(`   Country: ${venue.country || 'N/A'}`);
        if (venue.coordinates && venue.coordinates.length === 2) {
          console.log(`   Coordinates: [${venue.coordinates[0]}, ${venue.coordinates[1]}]`);
        }
      });
    } else {
      console.log('⚠️  No matches found for this date range');
      console.log('   This could mean:');
      console.log('   - No matches scheduled yet for these dates');
      console.log('   - API-Sports doesn\'t have data for World Cup 2026 yet');
      console.log('   - Season parameter issue (should be 2026)');
    }
    
    // Show full response structure
    console.log('\n📋 Full response structure:');
    console.log(JSON.stringify(worldCupResponse.data, null, 2));
    
  } catch (error) {
    if (error.response) {
      console.error('❌ API Error:');
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Message: ${JSON.stringify(error.response.data, null, 2)}`);
      
      if (error.response.status === 401) {
        console.error('\n💡 Authentication failed. Please check your credentials.');
      } else if (error.response.status === 403) {
        console.error('\n💡 Access denied. World Cup might require a subscription tier.');
      }
    } else if (error.request) {
      console.error('❌ Network Error:');
      console.error('   No response received from server');
      console.error('   Check if Railway endpoint is accessible');
    } else {
      console.error('❌ Error:', error.message);
    }
    process.exit(1);
  }
}

testWorldCup();