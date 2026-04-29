const axios = require('axios');
const https = require('https');
const API_SPORTS_KEY = process.env.API_SPORTS_KEY || '8d2f7b16e7d7c9b5b6c7f3e4a5d8e9f0';
const API_SPORTS_BASE_URL = 'https://v3.football.api-sports.io';
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});
async function debugVenueStructure() {
    try {
        const response = await axios.get(`${API_SPORTS_BASE_URL}/fixtures`, {
            headers: {
                'x-apisports-key': API_SPORTS_KEY
            },
            params: {
                league: 253, // MLS
                season: 2025,
                last: 5 // Get last 5 fixtures
            },
            httpsAgent
        });
        if (response.data && response.data.response && response.data.response.length > 0) {
            const fixture = response.data.response[0];
        } else {
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
    }
}
debugVenueStructure(); 