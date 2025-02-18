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

// Helper function to extract search parameters from GPT response
export const extractSearchParams = (gptResponse) => {
    return {
        location: gptResponse.location,
        dateRange: {
            start: gptResponse.dateRange?.start,
            end: gptResponse.dateRange?.end
        },
        leagues: gptResponse.leagues,
        maxDistance: gptResponse.maxDistance,
        preferences: {
            teams: gptResponse.teams,
            matchTypes: gptResponse.matchTypes
        }
    };
}; 