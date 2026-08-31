const { getPersistedAuthToken } = require('./secureAuthStorage');

// Use the same API URL logic as the main API service
// Override with EXPO_PUBLIC_API_URL environment variable if needed for local testing
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 
  'https://friendly-gratitude-production-3f31.up.railway.app/api';

const VALID_SOURCES = new Set(['ask_agent_modal', 'messages_screen', 'map_results', 'unknown']);

function normalizeSource(source) {
  if (typeof source === 'string' && VALID_SOURCES.has(source)) {
    return source;
  }
  return 'unknown';
}

export const processNaturalLanguageQuery = async (query, conversationHistory = [], options = {}) => {
    try {
        const token = await getPersistedAuthToken();
        if (!token) {
            return {
                success: false,
                code: 'AUTH',
                message: 'Please sign in again to use Ask Agent.',
                suggestions: ['Log out and log back in', 'Try again after signing in'],
            };
        }

        const source = normalizeSource(options.source);

        console.log('🤖 Natural Language Service - Sending query:', query);
        console.log('🤖 Natural Language Service - Conversation history length:', conversationHistory.length);
        console.log('🤖 Natural Language Service - API URL:', `${API_BASE_URL}/search/natural-language`);
        
        const response = await fetch(`${API_BASE_URL}/search/natural-language`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ 
                query,
                source,
                conversationHistory: conversationHistory.slice(-5) // Only send last 5 messages to avoid token limits
            })
        });
        
        console.log('🤖 Natural Language Service - Response status:', response.status);
        console.log('🤖 Natural Language Service - Response ok:', response.ok);
        
        const data = response.ok
            ? await response.json()
            : await response.json().catch(() => ({}));

        if (response.status === 401) {
            return {
                success: false,
                code: 'AUTH',
                message: 'Your session expired. Please sign in again.',
                suggestions: ['Log out and log back in'],
            };
        }

        if (!response.ok) {
            console.error('🤖 Natural Language Service - API Error:', response.status, data);
            // Same shape as a failed NL search; never echo response bodies (often HTML or technical).
            return {
                success: false,
                code: 'HTTP_ERROR',
                message: "We couldn't reach the search service. Please try again.",
                suggestions: Array.isArray(data.suggestions) ? data.suggestions : [
                    'Check your connection and try again',
                    'Try a simpler query with a city and a date range',
                ],
            };
        }

        console.log('🤖 Natural Language Service - Response data:', data);
        return data;
    } catch (error) {
        console.error('🤖 Natural Language Service - Error:', error);
        console.error('🤖 Natural Language Service - Error details:', {
            message: error.message,
            name: error.name,
            stack: error.stack
        });
        return {
            success: false,
            code: 'NETWORK',
            message: "We couldn't complete that search. Check your connection and try again.",
            suggestions: ['Check your internet connection', 'Try again in a few seconds'],
        };
    }
};

// Enhanced helper function to extract search parameters from enhanced response
export const extractSearchParams = (response) => {
    // Handle low confidence responses
    if (!response.success || response.confidence < 30) {
        return {
            error: response.message || "Could not understand your search query",
            suggestions: response.suggestions || [],
            confidence: response.confidence || 0
        };
    }

    // Extract parameters from successful response
    const params = {
        // Direct matches from response
        matches: response.matches || [],
        confidence: response.confidence,
        
        // Parsed entities for display
        parsed: {
            teams: response.parsed?.teams || [],
            leagues: response.parsed?.leagues || [],
            location: response.parsed?.location,
            dateRange: response.parsed?.dateRange,
            distance: response.parsed?.distance
        },
        
        // Legacy format for backward compatibility
        location: response.parsed?.location,
        dateRange: response.parsed?.dateRange,
        leagues: response.parsed?.leagues?.map(l => l.id) || [],
        maxDistance: response.parsed?.distance,
        preferences: {
            teams: response.parsed?.teams?.map(t => t.id) || [],
            matchTypes: []
        }
    };

    return params;
};

// Helper to format search results for display
export const formatSearchResults = (response) => {
    if (!response.success) {
        return {
            success: false,
            message: response.message,
            suggestions: response.suggestions || []
        };
    }

    return {
        success: true,
        query: response.query,
        confidence: response.confidence,
        message: response.message, // Preserve conversational messages
        matches: response.matches || [],
        count: response.count || 0,
        suggestions: response.suggestions || [], // Preserve suggestions
        parsed: {
            teams: response.parsed?.teams || [],
            leagues: response.parsed?.leagues || [],
            location: response.parsed?.location,
            dateRange: response.parsed?.dateRange,
            distance: response.parsed?.distance,
            isBroadQuery: response.parsed?.isBroadQuery || false
        }
    };
};

// Enhanced examples for Phase 1 capabilities
export const getSearchExamples = () => [
    "Arsenal vs Chelsea matches in London between March 15-30",
    "Premier League games within 50 miles of Manchester next month",
    "Liverpool away games in Spain this weekend",
    "Barcelona matches at home in La Liga next weekend",
    "Championship matches in Birmingham this month",
    "All matches in Germany during first weekend of April"
];
