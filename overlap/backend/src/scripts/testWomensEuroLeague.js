const axios = require('axios');
const https = require('https');

const API_SPORTS_KEY = process.env.API_SPORTS_KEY || '0ab95ca9f7baeb6fd551af7ca41ed8d2';
const API_SPORTS_BASE_URL = 'https://v3.football.api-sports.io';

// Create HTTPS agent that allows self-signed certificates
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

async function testWomensEuroLeague() {
    try {
        console.log('🔍 Searching for Women\'s Euro league...');

        const response = await axios.get(`${API_SPORTS_BASE_URL}/leagues`, {
            headers: {
                'x-apisports-key': API_SPORTS_KEY
            },
            params: {
                search: 'Women Euro'
            },
            httpsAgent
        });

        if (!response.data?.response || response.data.response.length === 0) {
            console.log('⚠️  No leagues found matching Women\'s Euro');
            console.log('API Response:', JSON.stringify(response.data, null, 2));
        } else {
            console.log(`✅ Found ${response.data.response.length} matching leagues:`);
            
            // Print league details
            response.data.response.forEach(league => {
                console.log('\n🏆 League Details:');
                console.log(`Name: ${league.league.name}`);
                console.log(`ID: ${league.league.id}`);
                console.log(`Type: ${league.league.type}`);
                console.log(`Country: ${league.country.name}`);
                if (league.seasons) {
                    console.log('Seasons:');
                    league.seasons.forEach(season => {
                        console.log(`  - Year: ${season.year}, Start: ${season.start}, End: ${season.end}`);
                    });
                }
            });
        }

    } catch (error) {
        console.error('❌ Error searching leagues:', error.response?.data || error.message);
        if (error.response?.data) {
            console.log('API Error Details:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

// Run the test
testWomensEuroLeague(); 