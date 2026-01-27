require('dotenv').config();
const debugConversation = async () => {
    const API_BASE_URL = 'https://friendly-gratitude-production-3f31.up.railway.app/api';
    // Test 1: Check what the backend receives
    const conversationHistory = [
        {
            isBot: true,
            data: {
                parsed: {
                    location: { city: 'London', country: 'United Kingdom' },
                    dateRange: { start: '2025-11-01', end: '2025-11-30' },
                    leagues: [],
                    teams: []
                }
            }
        }
    ];
    const requestBody = {
        query: "just premier league",
        conversationHistory: conversationHistory
    };
    try {
        const response = await fetch(`${API_BASE_URL}/search/natural-language`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        const data = await response.json();
        // Check if the conversation state management worked
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
    // Test 2: Check if the issue is with the conversation history structure
    // Test 3: Check if the issue is with the query parsing
    try {
        const response2 = await fetch(`${API_BASE_URL}/search/natural-language`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: "just premier league" })
        });
        const data2 = await response2.json();
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
};
// Run the debug
debugConversation().catch(console.error);
