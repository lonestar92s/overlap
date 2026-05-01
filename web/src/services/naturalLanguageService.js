import axios from 'axios';

const BACKEND_URL = 'http://localhost:3001';

export const processNaturalLanguageQuery = async (query) => {
    try {
        const response = await axios.post(`${BACKEND_URL}/api/search/natural-language`, {
            query
        });
        return response.data;
    } catch (error) {
        console.error('Error processing natural language query:', error);
        throw error;
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
        matches: response.matches || [],
        count: response.count || 0,
        parsed: {
            teams: response.parsed?.teams || [],
            leagues: response.parsed?.leagues || [],
            location: response.parsed?.location,
            dateRange: response.parsed?.dateRange,
            distance: response.parsed?.distance
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