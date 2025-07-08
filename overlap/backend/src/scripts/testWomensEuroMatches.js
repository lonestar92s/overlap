const axios = require('axios');
const https = require('https');

const API_SPORTS_KEY = process.env.API_SPORTS_KEY || '0ab95ca9f7baeb6fd551af7ca41ed8d2';
const API_SPORTS_BASE_URL = 'https://v3.football.api-sports.io';

// Create HTTPS agent that allows self-signed certificates
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

async function testWomensEuroMatches() {
    try {
        // Parameters for Women's Euro 2025
        const params = {
            league: '1083',  // Women's Euro ID
            season: 2025,
            from: '2025-07-02',
            to: '2025-07-27'
        };

        console.log('🔍 Fetching Women\'s Euro 2025 matches...');
        console.log('Parameters:', params);

        const response = await axios.get(`${API_SPORTS_BASE_URL}/fixtures`, {
            headers: {
                'x-apisports-key': API_SPORTS_KEY
            },
            params,
            httpsAgent
        });

        if (!response.data?.response || response.data.response.length === 0) {
            console.log('⚠️  No matches found for Women\'s Euro 2025');
            console.log('API Response:', JSON.stringify(response.data, null, 2));
        } else {
            console.log(`✅ Found ${response.data.response.length} matches for Women's Euro 2025`);
            
            // Print match details
            response.data.response.forEach(match => {
                console.log(`\n🏟️  Match: ${match.teams.home.name} vs ${match.teams.away.name}`);
                console.log(`📅 Date: ${match.fixture.date}`);
                console.log(`📍 Venue: ${match.fixture.venue.name}, ${match.fixture.venue.city}`);
            });
        }

    } catch (error) {
        console.error('❌ Error fetching matches:', error.response?.data || error.message);
        if (error.response?.data) {
            console.log('API Error Details:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

// Run the test
testWomensEuroMatches(); 