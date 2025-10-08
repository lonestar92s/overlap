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
        console.log('✅ Response:', data1.message || 'Success');
        console.log('📍 Location:', data1.parsed?.location);
        console.log('📅 Date Range:', data1.parsed?.dateRange);
        console.log('🏆 Is Broad Query:', data1.parsed?.isBroadQuery);
        console.log('💡 Suggestions:', data1.parsed?.suggestions);
        console.log('');
        
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
        console.log('✅ Response:', data2.message || 'Success');
        console.log('📍 Location (should inherit from context):', data2.parsed?.location);
        console.log('📅 Date Range (should inherit from context):', data2.parsed?.dateRange);
        console.log('🏆 Leagues (should be Premier League):', data2.parsed?.leagues);
        console.log('🏆 Is Broad Query:', data2.parsed?.isBroadQuery);
        console.log('');
        
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
        console.log('✅ Response:', data3.message || 'Success');
        console.log('📍 Location (should inherit):', data3.parsed?.location);
        console.log('📅 Date Range (should inherit):', data3.parsed?.dateRange);
        console.log('🏆 Leagues (should inherit Premier League):', data3.parsed?.leagues);
        console.log('⚽ Teams (should be Arsenal):', data3.parsed?.teams);
        console.log('🏆 Is Broad Query:', data3.parsed?.isBroadQuery);
        console.log('');
        
    } catch (error) {
        console.error('❌ Test 3 failed:', error.message);
    }
    
    console.log('🎉 Conversation Memory Test Complete!');
};

// Run the test
testConversationMemory().catch(console.error);


