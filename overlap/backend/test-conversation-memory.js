require('dotenv').config();

const testConversationMemory = async () => {
    const API_BASE_URL = 'https://friendly-gratitude-production-3f31.up.railway.app/api';
    
    console.log('🧠 Testing Conversation Memory System\n');
    
    // Simulate conversation history
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
    
    // Test 1: Initial broad query
    console.log('📝 Test 1: Initial broad query');
    console.log('Query: "Show me matches in London next month"');
    
    try {
        const response1 = await fetch(`${API_BASE_URL}/search/natural-language`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                query: 'Show me matches in London next month',
                conversationHistory: []
            })
        });
        
        const data1 = await response1.json();
 
    } catch (error) {
        console.error('❌ Test 1 failed:', error.message);
    }
    
    // Test 2: Follow-up query with context
    console.log('📝 Test 2: Follow-up query with context');
    console.log('Query: "Just premier league"');
    console.log('Context: Previous search was London + November 2025');
    
    try {
        const response2 = await fetch(`${API_BASE_URL}/search/natural-language`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                query: 'Just premier league',
                conversationHistory: conversationHistory
            })
        });
        
        const data2 = await response2.json();
    
    } catch (error) {
        console.error('❌ Test 2 failed:', error.message);
    }
    
    // Test 3: Another follow-up with more context
    console.log('📝 Test 3: Another follow-up with more context');
    console.log('Query: "Only Arsenal"');
    console.log('Context: Previous search was London + November 2025 + Premier League');
    
    // Update conversation history with Premier League context
    const updatedHistory = [
        ...conversationHistory,
        {
            isBot: true,
            data: {
                parsed: {
                    location: { city: 'London', country: 'United Kingdom' },
                    dateRange: { start: '2025-11-01', end: '2025-11-30' },
                    leagues: [{ id: 39, name: 'Premier League' }],
                    teams: []
                }
            }
        }
    ];
    
    try {
        const response3 = await fetch(`${API_BASE_URL}/search/natural-language`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                query: 'Only Arsenal',
                conversationHistory: updatedHistory
            })
        });
        
        const data3 = await response3.json();

        
    } catch (error) {
        console.error('❌ Test 3 failed:', error.message);
    }
    
    console.log('🎉 Conversation Memory Test Complete!');
};

// Run the test
testConversationMemory().catch(console.error);


