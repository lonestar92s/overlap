const axios = require('axios');
const RAILWAY_URL = 'https://friendly-gratitude-production-3f31.up.railway.app/api';
const EMAIL = 'aluko17@icloud.com';
const PASSWORD = 'test1234';
async function testWorldCup() {
  try {
    // Step 1: Login
    const loginResponse = await axios.post(`${RAILWAY_URL}/auth/login`, {
      email: EMAIL,
      password: PASSWORD
    });
    const token = loginResponse.data.token;
    // Step 2: Test World Cup endpoint
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
    // Display match details with locations
    if (worldCupResponse.data.response && worldCupResponse.data.response.length > 0) {
      worldCupResponse.data.response.forEach((match, index) => {
        const venue = match.fixture?.venue || {};
        const teams = match.teams || {};
        if (venue.coordinates && venue.coordinates.length === 2) {
        }
      });
    } else {
    }
    // Show full response structure
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