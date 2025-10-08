require('dotenv').config();

const debugConversation = async () => {
    const API_BASE_URL = 'https://friendly-gratitude-production-3f31.up.railway.app/api';
    
    console.log('🔍 Debugging Conversation Memory System\n');
    
    // Test 1: Check what the backend receives
    console.log('📝 Test 1: Check what the backend receives');
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
    
    console.log('📤 Request body:');
    console.log(JSON.stringify(requestBody, null, 2));
    console.log('');
    
    try {
        const response = await fetch(`${API_BASE_URL}/search/natural-language`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        
        const data = await response.json();
        console.log('📥 Response:');
        console.log(JSON.stringify(data, null, 2));
        console.log('');
        
        // Check if the conversation state management worked
        console.log('🔍 Analysis:');
        console.log('- Location inherited:', data.parsed?.location ? 'YES' : 'NO');
        console.log('- Date range inherited:', data.parsed?.dateRange ? 'YES' : 'NO');
        console.log('- Leagues parsed:', data.parsed?.leagues?.length > 0 ? 'YES' : 'NO');
        console.log('- Error message:', data.parsed?.errorMessage || 'None');
        console.log('');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
    
    // Test 2: Check if the issue is with the conversation history structure
    console.log('📝 Test 2: Check conversation history structure');
    console.log('Conversation history structure:');
    console.log('- Length:', conversationHistory.length);
    console.log('- First message isBot:', conversationHistory[0].isBot);
    console.log('- First message has data:', !!conversationHistory[0].data);
    console.log('- First message has parsed:', !!conversationHistory[0].data?.parsed);
    console.log('- First message has location:', !!conversationHistory[0].data?.parsed?.location);
    console.log('- First message has dateRange:', !!conversationHistory[0].data?.parsed?.dateRange);
    console.log('- First message has errorMessage:', !!conversationHistory[0].data?.parsed?.errorMessage);
    console.log('');
    
    // Test 3: Check if the issue is with the query parsing
    console.log('📝 Test 3: Check query parsing without conversation history');
    try {
        const response2 = await fetch(`${API_BASE_URL}/search/natural-language`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: "just premier league" })
        });
        
        const data2 = await response2.json();
        console.log('📥 Response without conversation history:');
        console.log(JSON.stringify(data2, null, 2));
        console.log('');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
    
    console.log('🎉 Debug Complete!');
};

// Run the debug
debugConversation().catch(console.error);


