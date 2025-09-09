const axios = require('axios');

const API_SPORTS_KEY = process.env.API_SPORTS_KEY || '0ab95ca9f7baeb6fd551af7ca41ed8d2';
const API_SPORTS_BASE_URL = 'https://v3.football.api-sports.io';

async function findWomensLeagues() {
    try {
        console.log('🔍 Searching for women\'s football leagues...\n');
        
        // Get all leagues
        const response = await axios.get(`${API_SPORTS_BASE_URL}/leagues`, {
            params: { country: 'England' }, // Start with England
            headers: { 'x-apisports-key': API_SPORTS_KEY }
        });

        if (response.data && response.data.response) {
            const leagues = response.data.response;
            
            console.log('🏴󠁧󠁢󠁥󠁮󠁧󠁿 England Leagues:');
            leagues.forEach(league => {
                if (league.league.name.toLowerCase().includes('women') || 
                    league.league.name.toLowerCase().includes('wsl') ||
                    league.league.name.toLowerCase().includes('super league')) {
                    console.log(`✅ ${league.league.name} - ID: ${league.league.id}`);
                }
            });
            
            console.log('\n🌍 All Leagues (searching for women\'s):');
            const allLeaguesResponse = await axios.get(`${API_SPORTS_BASE_URL}/leagues`, {
                headers: { 'x-apisports-key': API_SPORTS_KEY }
            });
            
            if (allLeaguesResponse.data && allLeaguesResponse.data.response) {
                const allLeagues = allLeaguesResponse.data.response;
                const womensLeagues = allLeagues.filter(league => 
                    league.league.name.toLowerCase().includes('women') ||
                    league.league.name.toLowerCase().includes('wsl') ||
                    league.league.name.toLowerCase().includes('super league')
                );
                
                womensLeagues.forEach(league => {
                    console.log(`✅ ${league.league.name} (${league.country.name}) - ID: ${league.league.id}`);
                });
                
                if (womensLeagues.length === 0) {
                    console.log('❌ No women\'s leagues found');
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
}

findWomensLeagues();

