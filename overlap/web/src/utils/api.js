// Utility function to get the correct backend URL
export const getBackendUrl = () => {
  // If running on localhost, use localhost
  // Otherwise, use the current hostname (for mobile/network access)
  const hostname = window.location.hostname;
  return hostname === 'localhost' ? 'http://localhost:3001' : `http://${hostname}:3001`;
};

// API base URLs
export const API_BASE_URL = getBackendUrl();

// Common fetch wrapper with authentication
export const apiRequest = async (url, options = {}) => {
  const token = localStorage.getItem('token');
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    },
  };

  const response = await fetch(url, { ...defaultOptions, ...options });
  return response;
};

// Recommendation API functions
export const recommendationAPI = {
  // Get recommendations for a specific trip
  async getRecommendations(tripId) {
    const response = await apiRequest(`${API_BASE_URL}/api/recommendations/trips/${tripId}/recommendations`);
    if (!response.ok) {
      throw new Error('Failed to fetch recommendations');
    }
    return response.json();
  },

  // Track user interaction with a recommendation
  async trackRecommendation(matchId, action, tripId, recommendedDate, score, reason) {
    const response = await apiRequest(`${API_BASE_URL}/api/recommendations/${matchId}/track`, {
      method: 'POST',
      body: JSON.stringify({
        action,
        tripId,
        recommendedDate,
        score,
        reason
      })
    });
    if (!response.ok) {
      throw new Error('Failed to track recommendation');
    }
    return response.json();
  },

  // Get recommendation history
  async getRecommendationHistory() {
    const response = await apiRequest(`${API_BASE_URL}/api/recommendations/history`);
    if (!response.ok) {
      throw new Error('Failed to fetch recommendation history');
    }
    return response.json();
  },

  // Get recommendation analytics
  async getRecommendationAnalytics() {
    const response = await apiRequest(`${API_BASE_URL}/api/recommendations/analytics`);
    if (!response.ok) {
      throw new Error('Failed to fetch recommendation analytics');
    }
    return response.json();
  }
}; 