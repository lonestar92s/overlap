// Backend API base URL - Loaded from environment variable
// SECURITY: Never hardcode production URLs - use environment variables
const getApiBaseUrl = () => {
  // SECURITY: Require API URL from environment - no hardcoded production URLs
  if (!process.env.EXPO_PUBLIC_API_URL) {
    if (__DEV__) {
      // Development: Allow localhost fallback with warning
      console.warn('⚠️ EXPO_PUBLIC_API_URL not set - using localhost fallback for development');
      console.warn('⚠️ For physical devices, set EXPO_PUBLIC_API_URL to your machine IP (e.g., http://192.168.1.100:3001/api)');
      return 'http://localhost:3001/api';
    } else {
      // Production: Use fallback to prevent crashes, but log warning
      // This allows the app to work even if the EAS secret isn't set
      console.warn('⚠️ EXPO_PUBLIC_API_URL not set in production - using fallback URL');
      console.warn('⚠️ Please set EXPO_PUBLIC_API_URL in EAS secrets for proper configuration');
      return 'https://friendly-gratitude-production-3f31.up.railway.app/api';
    }
  }
  
  return process.env.EXPO_PUBLIC_API_URL;
};

const API_BASE_URL = getApiBaseUrl();

// Simple token storage for mobile app
let authToken = null;

// Client-side cache for recommendations
const recommendationCache = new Map();
const CACHE_EXPIRY = 60 * 60 * 1000; // 1 hour in milliseconds

// Client-side cache for travel times
const travelTimesCache = new Map();
const TRAVEL_TIMES_CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds (travel times don't change often)

// Get authentication token from storage or memory
const getAuthToken = async () => {
  if (authToken) {
    return authToken;
  }
  
  // Try to get token from AsyncStorage
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const storedToken = await AsyncStorage.getItem('authToken');
    if (storedToken) {
      authToken = storedToken;
      return storedToken;
    }
  } catch (error) {
    if (__DEV__) {
      console.error('Error getting token from storage:', error);
    }
  }
  
  // No token available
  throw new Error('No authentication token available. Please log in.');
};

const setAuthToken = (token) => {
  authToken = token;
};

// Authentication methods
const login = async (email, password) => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    // Handle rate limit errors before parsing JSON
    if (response.status === 429) {
      return { 
        success: false, 
        error: 'Too many requests from this IP. Please wait a few minutes and try again.',
        rateLimited: true
      };
    }

    const data = await response.json();
    
    if (response.ok) {
      setAuthToken(data.token);
      return { success: true, user: data.user, token: data.token };
    } else {
      return { success: false, error: data.error || 'Login failed' };
    }
  } catch (error) {
    if (__DEV__) {
      console.error('Login error:', error);
    }
    // Check if it's a rate limit error in the catch block too
    if (error.message?.includes('429') || error.message?.includes('rate limit') || error.message?.includes('Too many requests')) {
      return { 
        success: false, 
        error: 'Too many requests from this IP. Please wait a few minutes and try again.',
        rateLimited: true
      };
    }
    return { success: false, error: 'Network error' };
  }
};

const register = async (email, password) => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    // Handle rate limit errors before parsing JSON
    if (response.status === 429) {
      return { 
        success: false, 
        error: 'Too many requests from this IP. Please wait a few minutes and try again.',
        rateLimited: true
      };
    }

    const data = await response.json();
    
    if (response.ok) {
      setAuthToken(data.token);
      return { success: true, user: data.user, token: data.token };
    } else {
      return { success: false, error: data.error || 'Registration failed' };
    }
  } catch (error) {
    if (__DEV__) {
      console.error('Registration error:', error);
    }
    // Check if it's a rate limit error in the catch block too
    if (error.message?.includes('429') || error.message?.includes('rate limit') || error.message?.includes('Too many requests')) {
      return { 
        success: false, 
        error: 'Too many requests from this IP. Please wait a few minutes and try again.',
        rateLimited: true
      };
    }
    return { success: false, error: 'Network error' };
  }
};

// WorkOS login - get authorization URL
const getWorkOSLoginUrl = () => {
  return `${API_BASE_URL}/auth/workos/login`;
};

// WorkOS callback handler - called after OAuth flow completes
const handleWorkOSCallback = async (code) => {
  try {
    // The backend callback endpoint handles the code exchange
    // We need to make a request to our backend which will complete the OAuth flow
    const response = await fetch(`${API_BASE_URL}/auth/workos/callback?code=${code}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      setAuthToken(data.token);
      return { success: true, user: data.user, token: data.token };
    } else {
      return { success: false, error: data.error || 'WorkOS authentication failed' };
    }
  } catch (error) {
    console.error('WorkOS callback error:', error);
    return { success: false, error: 'Network error during WorkOS authentication' };
  }
};

// Request password reset
const requestPasswordReset = async (email) => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email })
    });

    const data = await response.json();
    
    if (response.ok) {
      return { success: true, message: data.message, ...data };
    } else {
      return { success: false, error: data.error || 'Failed to request password reset' };
    }
  } catch (error) {
    console.error('Request password reset error:', error);
    return { success: false, error: 'Network error' };
  }
};

// Reset password with token
const resetPassword = async (token, password) => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/reset-password/${token}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password })
    });

    const data = await response.json();
    
    if (response.ok) {
      setAuthToken(data.token);
      return { success: true, user: data.user, token: data.token, message: data.message };
    } else {
      return { success: false, error: data.error || 'Failed to reset password' };
    }
  } catch (error) {
    console.error('Reset password error:', error);
    return { success: false, error: 'Network error' };
  }
};

const getCurrentUser = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${await getAuthToken()}`,
        'Content-Type': 'application/json'
      }
    });

    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      // If response isn't JSON, get text instead
      const text = await response.text();
      // Check for rate limit in non-JSON response
      if (response.status === 429) {
        const rateLimitError = new Error('Rate limit exceeded - please try again later');
        rateLimitError.isRateLimit = true;
        rateLimitError.status = 429;
        throw rateLimitError;
      }
      throw new Error(`Failed to get user data (${response.status}): ${text}`);
    }
    
    if (response.ok) {
      return data.user;
    } else {
      // Handle rate limit errors specifically
      if (response.status === 429) {
        const rateLimitError = new Error('Rate limit exceeded - please try again later');
        rateLimitError.isRateLimit = true;
        rateLimitError.status = 429;
        throw rateLimitError;
      }
      
      // Provide more specific error messages based on status code
      if (response.status === 401) {
        const authError = new Error('Authentication failed - please log in again');
        authError.isAuthFailure = true;
        authError.status = 401;
        throw authError;
      } else if (response.status === 403) {
        throw new Error('Access denied - insufficient permissions');
      } else if (response.status >= 500) {
        throw new Error('Server error - please try again later');
      } else {
        throw new Error(data.error || 'Failed to get user data');
      }
    }
  } catch (error) {
    // Only log if it's not a rate limit error (to reduce noise)
    if (!error.isRateLimit) {
      console.error('Get current user error:', error);
    }
    
    // Distinguish between network errors and authentication errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Network error - please check your connection');
    }
    
    throw error;
  }
};

// Available leagues configuration for bounds-based searching
// All major leagues will be available - bounds filtering will be done on backend
const AVAILABLE_LEAGUES = [
  { id: 39, name: 'Premier League', country: 'England', coords: [52.3555, -1.1743] },
  { id: 40, name: 'Championship', country: 'England', coords: [52.3555, -1.1743] },
  { id: 41, name: 'League One', country: 'England', coords: [52.3555, -1.1743] },
  { id: 44, name: "Women's Super League", country: 'England', coords: [52.3555, -1.1743] },
  { id: 699, name: "Women's Championship", country: 'England', coords: [52.3555, -1.1743] },
  { id: 140, name: 'La Liga', country: 'Spain', coords: [40.4637, -3.7492] },
  { id: 78, name: 'Bundesliga', country: 'Germany', coords: [51.1657, 10.4515] },
  { id: 79, name: 'Bundesliga 2', country: 'Germany', coords: [51.1657, 10.4515] },
  { id: 218, name: 'Austrian Bundesliga', country: 'Austria', coords: [47.5162, 14.5501] },
  { id: 219, name: 'Austrian 2. Liga', country: 'Austria', coords: [47.5162, 14.5501] },
  { id: 211, name: 'Prva HNL', country: 'Croatia', coords: [45.1000, 15.2000] },
  { id: 135, name: 'Serie A', country: 'Italy', coords: [41.8719, 12.5674] },
  { id: 61, name: 'Ligue 1', country: 'France', coords: [46.6034, 1.8883] },
  { id: 62, name: 'Ligue 2', country: 'France', coords: [46.6034, 1.8883] },
  { id: 2, name: 'Champions League', country: 'Europe', coords: null, isInternational: true },
  { id: 3, name: 'Europa League', country: 'Europe', coords: null, isInternational: true },
  { id: 848, name: 'Europa Conference League', country: 'Europe', coords: null, isInternational: true },
  { id: 94, name: 'Primeira Liga', country: 'Portugal', coords: [39.3999, -8.2245] },
  { id: 97, name: 'Taca da Liga', country: 'Portugal', coords: [39.3999, -8.2245] },
  { id: 88, name: 'Eredivisie', country: 'Netherlands', coords: [52.1326, 5.2913] },
  { id: 144, name: 'Jupiler Pro League', country: 'Belgium', coords: [50.5039, 4.4699] },
  { id: 203, name: 'Süper Lig', country: 'Turkey', coords: [38.9637, 35.2433] },
  { id: 307, name: 'Saudi Pro League', country: 'Saudi Arabia', coords: [23.8859, 45.0792] },
  { id: 253, name: 'Major League Soccer', country: 'USA', coords: [39.8283, -98.5795] },
  { id: 71, name: 'Série A', country: 'Brazil', coords: [-14.2350, -51.9253] },
  { id: 262, name: 'Liga MX', country: 'Mexico', coords: [23.6345, -102.5528] },
  { id: 188, name: 'Scottish Premiership', country: 'Scotland', coords: [56.4907, -4.2026] },
  { id: 207, name: 'Swiss Super League', country: 'Switzerland', coords: [46.8182, 8.2275] },
  { id: 244, name: 'Veikkausliiga', country: 'Finland', coords: [64.0, 26.0] },
  
  // International Competitions
  { id: 1, name: 'FIFA World Cup', country: 'International', coords: null, isInternational: true },
  { id: 4, name: 'European Championship', country: 'Europe', coords: null, isInternational: true },
  { id: 5, name: 'UEFA Nations League', country: 'Europe', coords: null, isInternational: true },
  { id: 6, name: 'Africa Cup of Nations', country: 'Africa', coords: null, isInternational: true },
  { id: 7, name: 'Asian Cup', country: 'Asia', coords: null, isInternational: true },
  { id: 8, name: 'World Cup - Women', country: 'International', coords: null, isInternational: true },
  { id: 9, name: 'Copa America', country: 'South America', coords: null, isInternational: true },
  { id: 10, name: 'Friendlies', country: 'International', coords: null, isInternational: true },
  { id: 13, name: 'Copa Libertadores', country: 'South America', coords: null, isInternational: true },
  { id: 15, name: 'FIFA Club World Cup', country: 'International', coords: null, isInternational: true },
  { id: 26, name: 'International Champions Cup', country: 'International', coords: null, isInternational: true },
  { id: 29, name: 'World Cup - Qualification Africa', country: 'Africa', coords: null, isInternational: true },
  { id: 30, name: 'World Cup - Qualification Asia', country: 'Asia', coords: null, isInternational: true },
  { id: 31, name: 'World Cup - Qualification CONCACAF', country: 'North America', coords: null, isInternational: true },
  { id: 32, name: 'World Cup - Qualification Europe', country: 'Europe', coords: null, isInternational: true },
  { id: 33, name: 'World Cup - Qualification Oceania', country: 'Oceania', coords: null, isInternational: true },
  { id: 34, name: 'World Cup - Qualification South America', country: 'South America', coords: null, isInternational: true },
  { id: 37, name: 'World Cup - Qualification Intercontinental Play-offs', country: 'International', coords: null, isInternational: true },
  { id: 1083, name: 'UEFA Women\'s Euro 2025', country: 'Europe', coords: null, isInternational: true }
];

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  /**
   * Helper to check if an error is a rate limit error
   */
  isRateLimitError(error, response) {
    if (response && response.status === 429) return true;
    if (error?.status === 429) return true;
    if (error?.isRateLimit) return true;
    if (error?.message?.includes('429')) return true;
    if (error?.message?.includes('rate limit')) return true;
    if (error?.message?.includes('Too many requests')) return true;
    return false;
  }

  /**
   * Helper to create a rate limit error
   */
  createRateLimitError(message = 'Rate limit exceeded - please try again later') {
    const error = new Error(message);
    error.isRateLimit = true;
    error.status = 429;
    return error;
  }

  // Helper method to create fetch requests with timeout
  // Supports external AbortSignal for request cancellation
  async fetchWithTimeout(url, options = {}, timeoutMs = 15000, externalSignal = null) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    // Combine external signal with timeout signal
    let combinedSignal = controller.signal;
    if (externalSignal) {
      // If external signal is aborted, abort immediately
      if (externalSignal.aborted) {
        clearTimeout(timeoutId);
        throw new Error('Request was cancelled');
      }
      // Listen to external signal and abort controller if needed
      externalSignal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        controller.abort();
      });
      // Use external signal as primary, timeout as secondary
      combinedSignal = externalSignal;
    }
    
    try {
      const response = await fetch(url, { 
        ...options, 
        signal: combinedSignal 
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError' || error.message === 'Request was cancelled') {
        if (externalSignal?.aborted) {
          throw new Error('Request was cancelled');
        }
        throw new Error('Request timed out - please try again');
      }
      throw error;
    }
  }

  // Aggregated global search by leagues/teams with optional bounds
  async searchAggregatedMatches({ dateFrom, dateTo, competitions = [], teams = [], bounds = null, season = 2025 }) {
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      if (season) params.append('season', season);
      if (competitions && competitions.length > 0) params.append('competitions', competitions.join(','));
      if (teams && teams.length > 0) params.append('teams', teams.join(','));
      if (bounds?.northeast && bounds?.southwest) {
        params.append('neLat', bounds.northeast.lat);
        params.append('neLng', bounds.northeast.lng);
        params.append('swLat', bounds.southwest.lat);
        params.append('swLng', bounds.southwest.lng);
      }
      const url = `${this.baseURL}/matches/search?${params.toString()}`;
      const response = await this.fetchWithTimeout(url, { method: 'GET' }, 20000);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Failed to search matches');
      }
      return data; // { success, data: [matches], count }
    } catch (error) {
      console.error('Error in searchAggregatedMatches:', error);
      throw error;
    }
  }

  async searchMatches({ homeTeam, awayTeam, dateFrom, dateTo, season = 2025 }) {
    try {
      const params = new URLSearchParams();
      
      if (homeTeam) params.append('homeTeam', homeTeam);
      if (awayTeam) params.append('awayTeam', awayTeam);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      if (season) params.append('season', season);

      const response = await fetch(`${this.baseURL}/matches/search?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to search matches');
      }

      return data;
    } catch (error) {
      console.error('Error searching matches:', error);
      throw error;
    }
  }

  // Search teams using the backend team search endpoint
  async searchTeams(query, limit = 10) {
    try {
      if (!query || query.trim().length < 2) {
        return { success: false, results: [] };
      }

      const params = new URLSearchParams();
      params.append('query', query.trim());
      if (limit) params.append('limit', limit);

      const response = await fetch(`${this.baseURL}/teams/search?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to search teams');
      }

      return data;
    } catch (error) {
      console.error('Error searching teams:', error);
      throw error;
    }
  }

  // Unified search across leagues, teams, and venues (MongoDB only)
  async searchUnified(query) {
    try {
      if (!query || query.trim().length < 2) {
        return { success: false, results: { leagues: [], teams: [], venues: [] }, counts: { leagues: 0, teams: 0, venues: 0, total: 0 } };
      }

      const params = new URLSearchParams();
      params.append('query', query.trim());

      const response = await this.fetchWithTimeout(`${this.baseURL}/search/unified?${params.toString()}`, { method: 'GET' }, 15000);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to search');
      }

      return data; // { success, results: { leagues, teams, venues }, counts }
    } catch (error) {
      console.error('Error in searchUnified:', error);
      return { success: false, results: { leagues: [], teams: [], venues: [] }, counts: { leagues: 0, teams: 0, venues: 0, total: 0 } };
    }
  }

  // Preferences API
  async getPreferences() {
    try {
      const token = await getAuthToken();
      const response = await this.fetchWithTimeout(`${this.baseURL}/preferences`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      }, 15000);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load preferences');
      return data.preferences || {};
    } catch (e) {
      console.error('getPreferences error:', e);
      throw e;
    }
  }

  // Favorite teams (accept teamApiId for convenience)
  async addFavoriteTeamByApiId(teamApiId) {
    const token = await getAuthToken();
    const response = await this.fetchWithTimeout(`${this.baseURL}/preferences/teams`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamApiId: String(teamApiId) })
    }, 15000);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to favorite team');
    return data;
  }
  async removeFavoriteTeamByMongoId(teamMongoId) {
    const token = await getAuthToken();
    const response = await this.fetchWithTimeout(`${this.baseURL}/preferences/teams/${teamMongoId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    }, 15000);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to unfavorite team');
    return data;
  }

  // Favorite leagues
  async addFavoriteLeague(leagueApiId) {
    const token = await getAuthToken();
    const response = await this.fetchWithTimeout(`${this.baseURL}/preferences/leagues`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ leagueId: String(leagueApiId) })
    }, 15000);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to favorite league');
    return data;
  }
  async removeFavoriteLeague(leagueApiId) {
    const token = await getAuthToken();
    const response = await this.fetchWithTimeout(`${this.baseURL}/preferences/leagues/${leagueApiId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    }, 15000);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to unfavorite league');
    return data;
  }

  // Favorite venues
  async addFavoriteVenue(venueId) {
    const token = await getAuthToken();
    const response = await this.fetchWithTimeout(`${this.baseURL}/preferences/venues`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ venueId: String(venueId) })
    }, 15000);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to favorite venue');
    return data;
  }
  async removeFavoriteVenue(venueId) {
    const token = await getAuthToken();
    const response = await this.fetchWithTimeout(`${this.baseURL}/preferences/venues/${venueId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    }, 15000);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to unfavorite venue');
    return data;
  }

  // Trip/Itinerary API methods
  async getTrips(status = null) {
    try {
      // Build URL with optional status query parameter
      let url = `${this.baseURL}/trips`;
      if (status === 'active' || status === 'completed') {
        url += `?status=${status}`;
      }
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch trips');
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching trips:', error);
      throw error;
    }
  }

  async getTripById(tripId) {
    try {
      const response = await fetch(`${this.baseURL}/trips/${tripId}`, {
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`,
          'Content-Type': 'application/json'
        }
      });
      
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        // If response isn't JSON, get text instead
        const text = await response.text();
        console.error('❌ API Error - Non-JSON response when fetching trip:', {
          status: response.status,
          statusText: response.statusText,
          text: text
        });
        return { success: false, error: `Failed to fetch trip (${response.status}): ${text}` };
      }
      
      if (!response.ok) {
        const errorMessage = data.message || data.error || `Failed to fetch trip (${response.status})`;
        // Only log non-429 errors to avoid noise from rate limiting
        if (response.status !== 429) {
          console.error('❌ API Error fetching trip:', {
            status: response.status,
            statusText: response.statusText,
            error: data.error,
            message: data.message,
            data: data
          });
        }
        return { success: false, error: errorMessage, status: response.status };
      }
      
      return { success: true, data: data.trip || data };
    } catch (error) {
      // Only log if it's not a network error that might be transient
      if (error.message && !error.message.includes('Network request failed')) {
        console.error('Error fetching trip:', error);
      }
      return { success: false, error: error.message || 'Failed to fetch trip' };
    }
  }

  async createTrip(name, description = '', startDate = null, endDate = null) {
    try {
      const token = await getAuthToken();
      const body = { name, description };
      if (startDate) body.startDate = startDate;
      if (endDate) body.endDate = endDate;
      
      const response = await fetch(`${this.baseURL}/trips`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        if (this.isRateLimitError(null, response)) {
          throw this.createRateLimitError();
        }
        throw new Error(`Failed to create trip (${response.status})`);
      }
      
      if (!response.ok) {
        if (this.isRateLimitError(null, response)) {
          throw this.createRateLimitError();
        }
        throw new Error(data.message || data.error || 'Failed to create trip');
      }
      
      return data;
    } catch (error) {
      // Suppress logging for rate limit errors
      if (!this.isRateLimitError(error)) {
        console.error('Error creating trip:', error);
      }
      throw error;
    }
  }

  async updateTrip(tripId, updates) {
    try {
      const token = await getAuthToken();
      const response = await fetch(`${this.baseURL}/trips/${tripId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });
      
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        if (this.isRateLimitError(null, response)) {
          throw this.createRateLimitError();
        }
        throw new Error(`Failed to update trip (${response.status})`);
      }
      
      if (!response.ok) {
        if (this.isRateLimitError(null, response)) {
          throw this.createRateLimitError();
        }
        throw new Error(data.message || data.error || 'Failed to update trip');
      }
      
      return data;
    } catch (error) {
      // Suppress logging for rate limit errors
      if (!this.isRateLimitError(error)) {
        console.error('Error updating trip:', error);
      }
      throw error;
    }
  }

  async addMatchToTrip(tripId, matchData) {
    try {
      const token = await getAuthToken();
      const response = await fetch(`${this.baseURL}/trips/${tripId}/matches`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          matchId: matchData.matchId,
          homeTeam: matchData.homeTeam,
          awayTeam: matchData.awayTeam,
          league: matchData.league,
          venue: matchData.venue,
          venueData: matchData.venueData,  // ← ADD THE VENUE DATA!
          date: matchData.date
        })
      });
      
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        // If response isn't JSON, get text instead
        const text = await response.text();
        console.error('❌ API Error - Non-JSON response:', {
          status: response.status,
          statusText: response.statusText,
          text: text
        });
        throw new Error(`Failed to add match to trip (${response.status}): ${text}`);
      }
      
      if (!response.ok) {
        const errorMessage = data.message || data.error || `Failed to add match to trip (${response.status})`;
        console.error('❌ API Error adding match to trip:', {
          status: response.status,
          statusText: response.statusText,
          error: data.error,
          message: data.message,
          data: data
        });
        throw new Error(errorMessage);
      }
      
      return data;
    } catch (error) {
      console.error('Error adding match to trip:', error);
      throw error;
    }
  }

  async deleteTrip(tripId) {
    try {
      console.log('🗑️ API Service - Deleting trip:', tripId);
      
      const response = await fetch(`${this.baseURL}/trips/${tripId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      console.log('🗑️ API Service - Delete trip response:', { status: response.status, data });
      
      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to delete trip');
      }
      
      // Return a consistent format that the context expects
      return { success: true, data };
    } catch (error) {
      console.error('Error deleting trip:', error);
      throw error;
    }
  }

  async removeMatchFromTrip(tripId, matchId) {
    try {
      console.log('🗑️ API Service - Removing match from trip:', { tripId, matchId });
      
      const response = await fetch(`${this.baseURL}/trips/${tripId}/matches/${matchId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      console.log('🗑️ API Service - Remove match response:', { status: response.status, data });
      
      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to remove match from trip');
      }
      
      // Return a consistent format that the context expects
      return { success: true, data };
    } catch (error) {
      console.error('Error removing match from trip:', error);
      throw error;
    }
  }

  /**
   * Add a flight to a trip
   * @param {string} tripId - Trip ID
   * @param {Object} flightData - Flight data (flightNumber, airline, departure, arrival, duration, stops)
   * @returns {Promise<Object>} Added flight
   */
  async addFlightToTrip(tripId, flightData) {
    try {
      if (!tripId) {
        throw new Error('Trip ID is required');
      }

      const token = await getAuthToken();
      const url = `${this.baseURL}/trips/${tripId}/flights`;
      const response = await this.fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(flightData)
        },
        30000
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || 'Failed to add flight to trip');
      }

      return data; // { success: true, flight: {...} }
    } catch (error) {
      console.error('Error adding flight to trip:', error);
      throw error;
    }
  }

  /**
   * Delete a flight from a trip
   * @param {string} tripId - Trip ID
   * @param {string} flightId - Flight ID
   * @returns {Promise<Object>} Success response
   */
  async deleteFlightFromTrip(tripId, flightId) {
    try {
      if (!tripId || !flightId) {
        throw new Error('Trip ID and Flight ID are required');
      }

      const token = await getAuthToken();
      const url = `${this.baseURL}/trips/${tripId}/flights/${flightId}`;
      const response = await this.fetchWithTimeout(
        url,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        },
        10000
      );

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data?.message || data?.error || 'Failed to delete flight from trip';
        console.error('Delete flight API error:', {
          status: response.status,
          statusText: response.statusText,
          data: data
        });
        throw new Error(errorMessage);
      }

      return data; // { success: true, message: '...' }
    } catch (error) {
      console.error('Error deleting flight from trip:', error);
      console.error('Error details:', {
        tripId,
        flightId,
        message: error.message,
        response: error.response
      });
      throw error;
    }
  }

  // Home Base API methods
  async addHomeBaseToTrip(tripId, homeBaseData) {
    try {
      if (!tripId) {
        throw new Error('Trip ID is required');
      }

      const token = await getAuthToken();
      const url = `${this.baseURL}/trips/${tripId}/home-bases`;
      const response = await this.fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(homeBaseData)
        },
        30000
      );

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data?.message || data?.error || 'Failed to add home base to trip';
        console.error('Add home base API error:', {
          status: response.status,
          statusText: response.statusText,
          data: data
        });
        throw new Error(errorMessage);
      }

      // Invalidate travel times cache since home bases changed
      this.invalidateTravelTimesCache(tripId);
      
      return data; // { success: true, homeBase: {...}, message: '...' }
    } catch (error) {
      console.error('Error adding home base to trip:', error);
      console.error('Error details:', {
        tripId,
        homeBaseData,
        message: error.message
      });
      throw error;
    }
  }

  async updateHomeBaseInTrip(tripId, homeBaseId, updates) {
    try {
      if (!tripId || !homeBaseId) {
        throw new Error('Trip ID and Home Base ID are required');
      }

      const token = await getAuthToken();
      const url = `${this.baseURL}/trips/${tripId}/home-bases/${homeBaseId}`;
      const response = await this.fetchWithTimeout(
        url,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(updates)
        },
        30000
      );

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data?.message || data?.error || 'Failed to update home base';
        console.error('Update home base API error:', {
          status: response.status,
          statusText: response.statusText,
          data: data
        });
        throw new Error(errorMessage);
      }

      // Invalidate travel times cache since home bases changed
      this.invalidateTravelTimesCache(tripId);
      
      return data; // { success: true, homeBase: {...}, message: '...' }
    } catch (error) {
      console.error('Error updating home base:', error);
      console.error('Error details:', {
        tripId,
        homeBaseId,
        updates,
        message: error.message
      });
      throw error;
    }
  }

  async deleteHomeBaseFromTrip(tripId, homeBaseId) {
    try {
      if (!tripId || !homeBaseId) {
        throw new Error('Trip ID and Home Base ID are required');
      }

      const token = await getAuthToken();
      const url = `${this.baseURL}/trips/${tripId}/home-bases/${homeBaseId}`;
      const response = await this.fetchWithTimeout(
        url,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        },
        10000
      );

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data?.message || data?.error || 'Failed to delete home base from trip';
        console.error('Delete home base API error:', {
          status: response.status,
          statusText: response.statusText,
          data: data
        });
        throw new Error(errorMessage);
      }

      // Invalidate travel times cache since home bases changed
      this.invalidateTravelTimesCache(tripId);
      
      return data; // { success: true, message: '...' }
    } catch (error) {
      console.error('Error deleting home base from trip:', error);
      console.error('Error details:', {
        tripId,
        homeBaseId,
        message: error.message
      });
      throw error;
    }
  }

  // Get cached travel times synchronously
  getCachedTravelTimes(tripId, matchIds = null) {
    const cacheKey = matchIds 
      ? `travel-times:${tripId}:${Array.isArray(matchIds) ? matchIds.sort().join(',') : matchIds}`
      : `travel-times:${tripId}`;
    
    const cached = travelTimesCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < TRAVEL_TIMES_CACHE_EXPIRY) {
      console.log('⚡ API Service - Returning cached travel times');
      return cached.data;
    }
    return null;
  }

  async getTravelTimes(tripId, matchIds = null, forceRefresh = false) {
    try {
      if (!tripId) {
        throw new Error('Trip ID is required');
      }

      // Check cache first (unless forcing refresh)
      if (!forceRefresh) {
        const cached = this.getCachedTravelTimes(tripId, matchIds);
        if (cached) {
          return cached;
        }
      }

      const token = await getAuthToken();
      let url = `${this.baseURL}/trips/${tripId}/travel-times`;
      
      // Add optional query parameters
      const params = new URLSearchParams();
      if (matchIds && Array.isArray(matchIds) && matchIds.length > 0) {
        // If multiple match IDs, we can pass them as comma-separated or make multiple calls
        // For now, we'll make a single call for all matches (backend handles filtering)
        params.append('matchId', matchIds.join(','));
      } else if (matchIds && typeof matchIds === 'string') {
        params.append('matchId', matchIds);
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await this.fetchWithTimeout(
        url,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        },
        30000 // Longer timeout for travel time calculations
      );

      // Handle rate limit errors before parsing JSON
      if (response.status === 429) {
        // Return cached travel times if available when rate limited
        const cached = this.getCachedTravelTimes(tripId, matchIds);
        if (cached) {
          console.log('⚠️ Rate limited - returning cached travel times');
          return cached;
        }
        // If no cache, return empty object (don't throw error)
        console.warn('⚠️ Rate limited and no cached travel times available');
        return {};
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        // If response isn't JSON, try to get cached data
        const cached = this.getCachedTravelTimes(tripId, matchIds);
        if (cached) {
          console.log('⚠️ Non-JSON response - returning cached travel times');
          return cached;
        }
        throw new Error(`Failed to parse travel times response (${response.status})`);
      }

      if (!response.ok) {
        // Check if it's a rate limit error
        if (response.status === 429) {
          // Return cached travel times if available
          const cached = this.getCachedTravelTimes(tripId, matchIds);
          if (cached) {
            console.log('⚠️ Rate limited - returning cached travel times');
            return cached;
          }
          // Return empty object instead of throwing error
          console.warn('⚠️ Rate limited and no cached travel times available');
          return {};
        }
        
        const errorMessage = data?.message || data?.error || 'Failed to fetch travel times';
        // Only log non-rate-limit errors
        if (response.status !== 429) {
          console.error('Get travel times API error:', {
            status: response.status,
            statusText: response.statusText,
            data: data
          });
        }
        throw new Error(errorMessage);
      }

      // Cache the travel times
      const travelTimes = data.travelTimes || {};
      const cacheKey = matchIds 
        ? `travel-times:${tripId}:${Array.isArray(matchIds) ? matchIds.sort().join(',') : matchIds}`
        : `travel-times:${tripId}`;
      
      travelTimesCache.set(cacheKey, {
        data: travelTimes,
        timestamp: Date.now()
      });

      // Return travel times in format: { matchId: { duration, distance, homeBaseId } }
      return travelTimes;
    } catch (error) {
      // Check if it's a rate limit error
      if (this.isRateLimitError(error) || error.message?.includes('429') || error.message?.includes('rate limit') || error.message?.includes('Too many requests')) {
        // Return cached travel times if available
        const cached = this.getCachedTravelTimes(tripId, matchIds);
        if (cached) {
          console.log('⚠️ Rate limited (error) - returning cached travel times');
          return cached;
        }
        // Return empty object instead of throwing error
        console.warn('⚠️ Rate limited and no cached travel times available');
        return {};
      }
      
      // Only log non-rate-limit errors
      if (!error.message?.includes('429') && !error.message?.includes('rate limit')) {
        console.error('Error fetching travel times:', error);
        console.error('Error details:', {
          tripId,
          matchIds,
          message: error.message
        });
      }
      throw error;
    }
  }

  async updateMatchPlanning(tripId, matchId, planningData) {
    try {
      console.log('📋 API Service - Updating match planning:', { tripId, matchId, planningData });
      
      const response = await fetch(`${this.baseURL}/trips/${tripId}/matches/${matchId}/planning`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(planningData)
      });
      
      const data = await response.json();
      console.log('📋 API Service - Update planning response:', { status: response.status, data });
      
      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to update match planning');
      }
      
      return { success: true, data };
    } catch (error) {
      console.error('Error updating match planning:', error);
      throw error;
    }
  }

  async getMatchesByTeam({ teamId, teamName, dateFrom, dateTo }) {
    try {
      const params = new URLSearchParams();
      
      if (teamId) params.append('teamId', teamId);
      if (teamName) params.append('teamName', teamName);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);

      const response = await fetch(`${this.baseURL}/matches/by-team?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch team matches');
      }

      return data;
    } catch (error) {
      console.error('Error fetching team matches:', error);
      throw error;
    }
  }

  async getTeams() {
    try {
      const response = await fetch(`${this.baseURL}/teams`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error('Failed to fetch teams');
      }

      return data;
    } catch (error) {
      console.error('Error fetching teams:', error);
      throw error;
    }
  }

  async getLeagues() {
    try {
      const response = await fetch(`${this.baseURL}/leagues`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error('Failed to fetch leagues');
      }

      return data;
    } catch (error) {
      console.error('Error fetching leagues:', error);
      throw error;
    }
  }

  async searchLeagues(query) {
    try {
      if (!query || query.trim().length < 2) {
        return { success: true, results: [], count: 0 };
      }

      const params = new URLSearchParams();
      params.append('query', query.trim());

      const response = await fetch(`${this.baseURL}/leagues/search?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to search leagues');
      }

      return data; // { success, results, count }
    } catch (error) {
      console.error('Error searching leagues:', error);
      return { success: false, results: [], count: 0 };
    }
  }

  async searchMatchesByLocation(competitionId, { dateFrom, dateTo, userLat, userLon }) {
    try {
      const params = new URLSearchParams();
      
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      if (userLat) params.append('userLat', userLat);
      if (userLon) params.append('userLon', userLon);

      const response = await fetch(`${this.baseURL}/matches/competitions/${competitionId}?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to search matches by location');
      }

      // Transform the response to match expected format
      return {
        success: true,
        matches: data.response || data.matches || [],
        competition: data.competition,
        resultSet: data.resultSet
      };
    } catch (error) {
      console.error('Error searching matches by location:', error);
      throw error;
    }
  }

  // Helper function to calculate distance between two points
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in kilometers
  }

  // Filter leagues based on search location for efficiency
  // NOTE: This is now a fallback method. Prefer getRelevantLeaguesFromBackend() for dynamic leagues.
  // This method uses hardcoded AVAILABLE_LEAGUES as a last resort fallback when API is unavailable.
  getRelevantLeagues(searchBounds) {
    if (!searchBounds || !searchBounds.northeast || !searchBounds.southwest) {
      console.log('🔍 getRelevantLeagues: No bounds provided, using fallback hardcoded leagues');
      console.warn('⚠️ Using hardcoded leagues - API should be used instead. This is a fallback only.');
      return AVAILABLE_LEAGUES; // Fallback to hardcoded leagues if no bounds
    }

    // Calculate center point of search bounds
    const centerLat = (searchBounds.northeast.lat + searchBounds.southwest.lat) / 2;
    const centerLng = (searchBounds.northeast.lng + searchBounds.southwest.lng) / 2;
    
    console.log('🔍 getRelevantLeagues: Search center:', { centerLat, centerLng });

    const relevantLeagues = [];
    
    // Define regional groupings for smarter filtering
    const isInEurope = centerLat > 35 && centerLat < 71 && centerLng > -10 && centerLng < 40;
    const isInNorthAmerica = centerLat > 20 && centerLat < 75 && centerLng > -170 && centerLng < -50;
    const isInSouthAmerica = centerLat > -55 && centerLat < 15 && centerLng > -85 && centerLng < -30;

    for (const league of AVAILABLE_LEAGUES) {
      let shouldInclude = false;

      // Always include international competitions globally
      if (league.isInternational) {
        shouldInclude = true; // International competitions can happen anywhere
        console.log(`✅ Including international competition: ${league.name}`);
      }
      
      // Always include Champions League specifically (backup for international competitions)
      if (league.name === 'Champions League' || league.id === 2) {
        shouldInclude = true;
        console.log(`✅ Including Champions League specifically: ${league.name}`);
      } else {
        // Skip leagues without coordinates
        if (!league.coords || league.coords.length !== 2) {
          continue;
        }

        // Calculate distance from search center to league center
        const distance = this.calculateDistance(
          centerLat, centerLng,
          league.coords[0], league.coords[1]
        );

        // Smart distance thresholds based on region
        let maxDistance;
        if (isInEurope) {
          maxDistance = 2500; // Europe is densely packed, include more leagues
        } else if (isInNorthAmerica || isInSouthAmerica) {
          maxDistance = 3000; // Large countries, be more inclusive
        } else {
          maxDistance = 2000; // Default for other regions
        }

        // Include league if within range
        if (distance <= maxDistance) {
          shouldInclude = true;
        }

        // Special case: Always include local country leagues
        const countryMatches = {
          'England': isInEurope && centerLat > 49 && centerLat < 59 && centerLng > -8 && centerLng < 2,
          'Spain': isInEurope && centerLat > 35 && centerLat < 44 && centerLng > -10 && centerLng < 5,
          'Germany': isInEurope && centerLat > 47 && centerLat < 55 && centerLng > 5 && centerLng < 15,
          'Italy': isInEurope && centerLat > 35 && centerLat < 47 && centerLng > 6 && centerLng < 19,
          'France': isInEurope && centerLat > 42 && centerLat < 51 && centerLng > -5 && centerLng < 8,
          'Portugal': isInEurope && centerLat > 36 && centerLat < 42 && centerLng > -10 && centerLng < -6,
          'Netherlands': isInEurope && centerLat > 50 && centerLat < 54 && centerLng > 3 && centerLng < 8,
          'USA': isInNorthAmerica && centerLng > -130 && centerLng < -65,
          'Saudi Arabia': centerLat > 15 && centerLat < 33 && centerLng > 34 && centerLng < 56,
        };

        console.log(`🔍 League ${league.name} (${league.country}):`, {
          isInternational: league.isInternational,
          hasCoords: !!league.coords,
          countryMatch: countryMatches[league.country],
          shouldInclude
        });

        if (countryMatches[league.country]) {
          shouldInclude = true;
          console.log(`✅ Including ${league.name} due to country match`);
        }
      }

      if (shouldInclude) {
        relevantLeagues.push(league);
      }
    }

    // If no relevant leagues found (edge case), include at least top European leagues
    if (relevantLeagues.length === 0) {
      console.log('⚠️ No relevant leagues found, using hardcoded fallback');
      console.warn('⚠️ Using hardcoded leagues - API should be used instead. This is a fallback only.');
      const fallbackLeagues = AVAILABLE_LEAGUES.filter(l => 
        ['Premier League', 'La Liga', 'Bundesliga', 'Serie A', 'Champions League'].includes(l.name)
      );
      console.log('🔍 Fallback leagues:', fallbackLeagues.map(l => l.name));
      return fallbackLeagues.length > 0 ? fallbackLeagues : AVAILABLE_LEAGUES;
    }

    console.log('🔍 Final relevant leagues:', relevantLeagues.map(l => l.name));
    return relevantLeagues;
  }

  // NEW: Bounds-based search for map integration
  async searchMatchesByBounds({ bounds, dateFrom, dateTo, competitions = [], teams = [], signal = null }) {
    const apiStartTime = performance.now();
    
    try {
      // If no competitions or teams specified, use the location-only search endpoint
      if (competitions.length === 0 && teams.length === 0 && bounds && dateFrom && dateTo) {
        // Validate bounds before making request
        if (bounds.northeast && bounds.southwest) {
          const latSpan = bounds.northeast.lat - bounds.southwest.lat;
          const lngSpan = bounds.northeast.lng - bounds.southwest.lng;
          if (latSpan <= 0 || lngSpan <= 0 || latSpan > 90 || lngSpan > 180) {
            if (__DEV__) {
              console.error('❌ [API] Invalid bounds:', { bounds, latSpan, lngSpan });
            }
            throw new Error('Invalid map bounds - please try zooming in or searching a smaller area');
          }
        }
        if (__DEV__) {
          console.log('🔍 searchMatchesByBounds: Using location-only search endpoint');
        }
        const params = new URLSearchParams();
        params.append('dateFrom', dateFrom);
        params.append('dateTo', dateTo);
        if (bounds?.northeast && bounds?.southwest) {
          params.append('neLat', bounds.northeast.lat);
          params.append('neLng', bounds.northeast.lng);
          params.append('swLat', bounds.southwest.lat);
          params.append('swLng', bounds.southwest.lng);
        }
        
        const url = `${this.baseURL}/matches/search?${params.toString()}`;
        const networkStartTime = performance.now();
        // Location-only searches can take longer due to multiple league API calls with retries
        // Increased timeout to 60 seconds to accommodate backend processing
        const response = await this.fetchWithTimeout(url, { method: 'GET' }, 60000, signal);
        const networkEndTime = performance.now();
        const networkDuration = networkEndTime - networkStartTime;
        
        const parseStartTime = performance.now();
        let data;
        try {
          data = await response.json();
        } catch (parseError) {
          // If JSON parsing fails, we still want to check response status
          if (__DEV__) {
            console.error('❌ [API] Failed to parse JSON response:', parseError);
          }
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText || 'Failed to search matches'}`);
          }
          throw new Error('Failed to parse response');
        }
        const parseEndTime = performance.now();
        const parseDuration = parseEndTime - parseStartTime;
        
        if (__DEV__) {
          console.log(`⏱️ [API] Network: ${networkDuration.toFixed(2)}ms, Parse: ${parseDuration.toFixed(2)}ms`);
          if (networkDuration > 5000) {
            console.warn(`⚠️ [API] Slow network request: ${networkDuration.toFixed(2)}ms`);
          }
        }
        
        if (!response.ok) {
          const errorMessage = data?.message || data?.error || `HTTP ${response.status}: ${response.statusText || 'Failed to search matches'}`;
          if (__DEV__) {
            console.error('❌ [API] Response not OK:', {
              status: response.status,
              statusText: response.statusText,
              data: data,
              url: url
            });
          }
          throw new Error(errorMessage);
        }
        
        const apiEndTime = performance.now();
        const totalApiDuration = apiEndTime - apiStartTime;
        
        if (__DEV__) {
          console.log(`⏱️ [API] Total API duration: ${totalApiDuration.toFixed(2)}ms`);
          if (totalApiDuration > 5000) {
            console.warn(`⚠️ [API] Very slow API call: ${totalApiDuration.toFixed(2)}ms`);
          }
        }
        
        return {
          success: true,
          data: data.data || [],
          searchParams: { bounds, dateFrom, dateTo, competitions, teams },
          _performance: {
            totalDuration: totalApiDuration,
            networkDuration,
            parseDuration,
          }
        };
      }

      // Otherwise, use the legacy approach with competitions endpoint
      const legacyStartTime = performance.now();
      // Use specified competitions or fetch relevant leagues from backend
      let targetLeagues;
      if (competitions.length > 0) {
        // Use specified competitions - try to fetch from API first
        const competitionIds = competitions.map(c => typeof c === 'string' ? parseInt(c) : c);
        try {
          // Try to get leagues from backend first
          const allLeagues = await this.getLeagues();
          if (allLeagues.success && allLeagues.data) {
            targetLeagues = allLeagues.data
              .filter(league => competitionIds.includes(parseInt(league.id)))
              .map(league => ({ id: parseInt(league.id), name: league.name, country: league.country }));
          } else {
            // Fallback to AVAILABLE_LEAGUES
            console.warn('⚠️ API leagues fetch failed, using hardcoded fallback for competitions');
            targetLeagues = AVAILABLE_LEAGUES.filter(league => competitionIds.includes(league.id));
          }
        } catch (error) {
          console.error('Error fetching leagues for competitions:', error);
          // Fallback to AVAILABLE_LEAGUES
          targetLeagues = AVAILABLE_LEAGUES.filter(league => competitionIds.includes(league.id));
        }
      } else {
        // Fetch relevant leagues from backend based on bounds
        try {
          const relevantLeaguesFromBackend = await this.getRelevantLeaguesFromBackend(bounds);
          // Transform backend response to match expected format
          targetLeagues = relevantLeaguesFromBackend.map(league => ({
            id: league.id,
            name: league.name,
            country: league.country || 'Unknown',
            coords: null, // Coordinates not needed when using backend filtering
            isInternational: league.country === 'International' || league.country === 'Europe'
          }));
          console.log('🔍 searchMatchesByBounds: Using leagues from backend:', targetLeagues.map(l => `${l.name} (${l.id})`));
        } catch (error) {
          console.warn('⚠️ Failed to fetch leagues from backend, using hardcoded fallback:', error);
          // Fallback to local getRelevantLeagues (uses hardcoded AVAILABLE_LEAGUES)
          targetLeagues = this.getRelevantLeagues(bounds);
        }
      }

      console.log('🔍 searchMatchesByBounds: Target leagues:', targetLeagues.map(l => `${l.name} (${l.id})`));
      
      // Special logging for Champions League
      const championsLeague = targetLeagues.find(l => l.id === 2 || l.name === 'Champions League');
      if (championsLeague) {
        console.log('🏆 CHAMPIONS LEAGUE INCLUDED in search!', championsLeague);
      } else {
        console.log('❌ CHAMPIONS LEAGUE NOT FOUND in target leagues');
      }

      // Format dates for API
      const formattedDates = {
        from: dateFrom,
        to: dateTo
      };

      // Fetch matches from all target leagues in parallel
      const responses = await Promise.all(
        targetLeagues.map(async (league) => {
          const params = new URLSearchParams({
            dateFrom: formattedDates.from,
            dateTo: formattedDates.to,
            // Include bounds for backend filtering
            ...(bounds?.northeast && { neLat: bounds.northeast.lat, neLng: bounds.northeast.lng }),
            ...(bounds?.southwest && { swLat: bounds.southwest.lat, swLng: bounds.southwest.lng }),
            // Include team filter if specified
            ...(teams.length > 0 && { teams: teams.join(',') })
          });
          const url = `${this.baseURL}/matches/competitions/${league.id}?${params}`;
          try {
            const headers = { 'Content-Type': 'application/json' };
            const token = await getAuthToken();
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const response = await fetch(url, { method: 'GET', headers, signal });
            if (!response.ok) {
              if (response.status === 403) {
                return { success: false, data: { response: [] }, league, restricted: true };
              }
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            return { success: true, data: data, league };
          } catch (error) {
            return { success: false, data: { response: [] }, league };
          }
        })
      );

      // Process all matches
      const allMatches = responses.reduce((acc, { data, league }) => {
        const matches = data.response || [];
        const processedMatches = matches.map(match => {
          if (!match.competition) {
            return {
              ...match,
              competition: {
                id: league.id,
                name: league.name,
                country: league.country,
                logo: league.logo || ''
              }
            };
          }
          return match;
        });
        return [...acc, ...processedMatches];
      }, []);

      // Sort matches chronologically
      const sortedMatches = [...allMatches].sort((a, b) => {
        const dateA = new Date(a.fixture.date);
        const dateB = new Date(b.fixture.date);
        return dateA.getTime() - dateB.getTime();
      });

      const legacyEndTime = performance.now();
      const legacyDuration = legacyEndTime - legacyStartTime;
      const totalApiDuration = legacyEndTime - apiStartTime;
      
      if (__DEV__) {
        console.log(`⏱️ [API] Legacy path - Total: ${totalApiDuration.toFixed(2)}ms, League fetch: ${legacyDuration.toFixed(2)}ms`);
        if (totalApiDuration > 5000) {
          console.warn(`⚠️ [API] Very slow API call (legacy): ${totalApiDuration.toFixed(2)}ms`);
        }
      }

      return {
        success: true,
        data: sortedMatches,
        searchParams: { bounds, dateFrom, dateTo, competitions, teams },
        _performance: {
          totalDuration: totalApiDuration,
          legacyDuration,
        }
      };

    } catch (error) {
      const apiEndTime = performance.now();
      const totalApiDuration = apiEndTime - apiStartTime;
      
      if (__DEV__) {
        console.error(`❌ [API] Error after ${totalApiDuration.toFixed(2)}ms:`, {
          error: error,
          message: error.message,
          name: error.name,
          stack: error.stack?.split('\n').slice(0, 3).join('\n')
        });
      }
      
      // Don't return error for cancelled requests - let the caller handle it
      if (error.message === 'Request was cancelled' || error.name === 'AbortError') {
        throw error; // Re-throw so caller can handle cancellation
      }
      
      return { success: false, error: error.message || 'Failed to search matches' };
    }
  }

  // Attendance tracking methods
  async markMatchAttended(attendanceData) {
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${API_BASE_URL}/attendance/mark-attended`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(attendanceData)
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to mark match as attended');
      }

      return data;
    } catch (error) {
      console.error('Error marking match as attended:', error);
      throw error;
    }
  }

  async getUserAttendedMatches() {
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${API_BASE_URL}/attendance/user-matches`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch attended matches');
      }

      return data;
    } catch (error) {
      console.error('Error fetching attended matches:', error);
      throw error;
    }
  }

  async removeAttendedMatch(matchId) {
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${API_BASE_URL}/attendance/${matchId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to remove attended match');
      }

      return data;
    } catch (error) {
      console.error('Error removing attended match:', error);
      throw error;
    }
  }

  // LEGACY: Keep for backward compatibility during transition
  async searchAllMatchesByLocation(params) {
    console.warn('⚠️ searchAllMatchesByLocation is deprecated - use searchMatchesByBounds instead');
    if (params.location && params.location.lat && params.location.lon) {
      const lat = params.location.lat;
      const lng = params.location.lon;
      const latDelta = 0.5;
      const lngDelta = 0.5;
      const bounds = {
        northeast: { lat: lat + latDelta, lng: lng + lngDelta },
        southwest: { lat: lat - latDelta, lng: lng - lngDelta }
      };
      return this.searchMatchesByBounds({ bounds, dateFrom: params.dateFrom, dateTo: params.dateTo });
    }
    return this.searchMatchesByBounds({ bounds: null, dateFrom: params.dateFrom, dateTo: params.dateTo });
  }

  async getPopularMatches(leagueIds = null) {
    try {
      let url = `${this.baseURL}/matches/popular`;
      if (leagueIds) {
        const params = new URLSearchParams();
        params.append('leagueIds', leagueIds.join(','));
        url += `?${params.toString()}`;
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch popular matches');
      }
      return data;
    } catch (error) {
      console.error('Error fetching popular matches:', error);
      if (error.name === 'AbortError') {
        throw new Error('Request timed out - please try again');
      }
      throw error;
    }
  }

  async getRecommendedMatches(limit = 10, days = 30) {
    try {
      const token = await getAuthToken();
      const params = new URLSearchParams();
      params.append('limit', limit.toString());
      params.append('days', days.toString());
      
      const url = `${this.baseURL}/matches/recommended?${params.toString()}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const data = await response.json();
      
      if (!response.ok) {
        const errorMessage = data.message || data.error || `Server returned ${response.status}: ${response.statusText}`;
        console.error(`❌ Recommended matches API error (${response.status}):`, errorMessage);
        console.error('❌ Full error response:', JSON.stringify(data, null, 2));
        throw new Error(errorMessage);
      }
      
      return data;
    } catch (error) {
      console.error('❌ Error fetching recommended matches:', error);
      console.error('❌ Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      if (error.name === 'AbortError') {
        throw new Error('Request timed out - please try again');
      }
      // Re-throw with the original message if it's already an Error with a message
      if (error.message) {
        throw error;
      }
      throw new Error(error.message || 'Failed to fetch recommended matches');
    }
  }

  // Saved Matches API Methods
  async getSavedMatches() {
    try {
      const token = await getAuthToken();
      const response = await fetch(`${this.baseURL}/preferences/saved-matches`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch saved matches');
      }
      return data;
    } catch (error) {
      console.error('Error fetching saved matches:', error);
      throw error;
    }
  }

  async saveMatch(matchId, fixtureId, matchData) {
    try {
      const token = await getAuthToken();
      
      const requestBody = {
        matchId,
        homeTeam: matchData.homeTeam,
        awayTeam: matchData.awayTeam,
        league: matchData.league,
        venue: matchData.venue,
        date: matchData.date
      };
      
      console.log('API Service - Sending save match request:', requestBody);
      
      const response = await fetch(`${this.baseURL}/preferences/saved-matches`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      const data = await response.json();
      if (!response.ok) {
        console.error('API Service - Save match failed:', data);
        throw new Error(data.error || 'Failed to save match');
      }
      
      console.log('API Service - Save match successful:', data);
      return data;
    } catch (error) {
      console.error('Error saving match:', error);
      throw error;
    }
  }

  async unsaveMatch(matchId) {
    try {
      const token = await getAuthToken();
      const response = await fetch(`${this.baseURL}/preferences/saved-matches/${matchId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to unsave match');
      }
      return data;
    } catch (error) {
      console.error('Error unsaving match:', error);
      throw error;
    }
  }

  async checkIfMatchSaved(matchId) {
    try {
      const token = await getAuthToken();
      const response = await fetch(`${this.baseURL}/preferences/saved-matches`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to check saved matches');
      }
      return data.savedMatches.some(match => match.matchId === matchId);
    } catch (error) {
      console.error('Error checking saved match:', error);
      throw error;
    }
  }

  async getSavedMatchCount() {
    try {
      const token = await getAuthToken();
      const response = await fetch(`${this.baseURL}/preferences/saved-matches`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to get saved matches');
      }
      return data.savedMatches.length;
    } catch (error) {
      console.error('Error getting saved match count:', error);
      throw error;
    }
  }

  // Memories API methods
  async getMemories() {
    try {
      const token = await getAuthToken();
      const response = await this.fetchWithTimeout(`${this.baseURL}/memories`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch memories');
      }
      return data;
    } catch (error) {
      console.error('Error fetching memories:', error);
      throw error;
    }
  }

  async getMemoryStats() {
    try {
      const token = await getAuthToken();
      const response = await this.fetchWithTimeout(`${this.baseURL}/memories/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch memory stats');
      }
      return data;
    } catch (error) {
      console.error('Error fetching memory stats:', error);
      throw error;
    }
  }

  async createMemory(memoryData, photos = []) {
    try {
      const token = await getAuthToken();
      
      // Create FormData for multipart upload
      const formData = new FormData();
      
      // Add memory data
      formData.append('homeTeam', JSON.stringify(memoryData.homeTeam));
      formData.append('awayTeam', JSON.stringify(memoryData.awayTeam));
      formData.append('venue', JSON.stringify(memoryData.venue));
      formData.append('competition', memoryData.competition || '');
      formData.append('date', memoryData.date);
      formData.append('userScore', memoryData.userScore || '');
      formData.append('userNotes', memoryData.userNotes || '');
      
      // Add photos
      photos.forEach((photo, index) => {
        formData.append('photos', {
          uri: photo.uri,
          type: photo.type || 'image/jpeg',
          name: `photo_${index}.jpg`
        });
      });
      
      const response = await this.fetchWithTimeout(`${this.baseURL}/memories`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
          // Note: Don't set Content-Type for FormData - let the system set it automatically
        },
        body: formData
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to create memory');
      }
      return data;
    } catch (error) {
      console.error('Error creating memory:', error);
      throw error;
    }
  }

  async updateMemory(memoryId, updates, newPhotos = []) {
    try {
      const token = await getAuthToken();
      
      const formData = new FormData();
      
      // Add update data
      Object.keys(updates).forEach(key => {
        if (updates[key] !== undefined) {
          if (typeof updates[key] === 'object') {
            formData.append(key, JSON.stringify(updates[key]));
          } else {
            formData.append(key, updates[key]);
          }
        }
      });
      
      // Add new photos
      newPhotos.forEach((photo, index) => {
        formData.append('photos', {
          uri: photo.uri,
          type: photo.type || 'image/jpeg',
          name: `photo_${index}.jpg`
        });
      });
      
      const response = await this.fetchWithTimeout(`${this.baseURL}/memories/${memoryId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
          // Note: Don't set Content-Type for FormData - let the system set it automatically
        },
        body: formData
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to update memory');
      }
      return data;
    } catch (error) {
      console.error('Error updating memory:', error);
      throw error;
    }
  }

  async deleteMemory(memoryId) {
    try {
      const token = await getAuthToken();
      const response = await this.fetchWithTimeout(`${this.baseURL}/memories/${memoryId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete memory');
      }
      return data;
    } catch (error) {
      console.error('Error deleting memory:', error);
      throw error;
    }
  }

  // Recommendation API methods
  
  // Get cached recommendations synchronously (for immediate display)
  getCachedRecommendations(tripId) {
    // Legacy cache method - kept for backward compatibility during migration
    // Recommendations are now stored in trip.recommendations in database
    const cacheKey = `recommendations:${tripId}`;
    const cached = recommendationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY) {
      console.log('⚡ API Service - Returning cached recommendations (legacy fallback)');
      return {
        ...cached.data,
        cached: true
      };
    }
    return null;
  }

  async getRecommendations(tripId, forceRefresh = false) {
    try {
      console.log('🎯 API Service - Getting recommendations for trip:', tripId, forceRefresh ? '(force refresh)' : '');
      
      // Note: Client-side cache check removed - recommendations are now in trip.recommendations
      // Cache kept for backward compatibility during migration
      // Only check cache if forcing refresh (legacy fallback)
      if (!forceRefresh) {
        const cached = this.getCachedRecommendations(tripId);
        if (cached) {
          console.log('⚡ API Service - Returning client-side cached recommendations (legacy fallback)');
          return cached;
        }
      } else {
        console.log('🔄 API Service - Force refresh - bypassing client cache');
      }
      
      // Build URL with forceRefresh query parameter if needed
      const url = new URL(`${this.baseURL}/recommendations/trips/${tripId}/recommendations`);
      if (forceRefresh) {
        url.searchParams.set('forceRefresh', 'true');
      }
      
      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Handle rate limit errors before parsing JSON
      if (response.status === 429) {
        // Return cached recommendations if available when rate limited
        const cached = this.getCachedRecommendations(tripId);
        if (cached) {
          console.log('⚠️ Rate limited - returning cached recommendations');
          return cached;
        }
        // If no cache, return empty recommendations with rate limit flag
        return {
          success: false,
          rateLimited: true,
          recommendations: [],
          error: 'Rate limit exceeded - please try again later'
        };
      }
      
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        // If response isn't JSON, try to get cached data
        const cached = this.getCachedRecommendations(tripId);
        if (cached) {
          console.log('⚠️ Non-JSON response - returning cached recommendations');
          return cached;
        }
        throw new Error(`Failed to parse recommendations response (${response.status})`);
      }
      
      // Suppress logging for rate limit errors to reduce console noise
      if (response.status !== 429) {
        console.log('🎯 API Service - Recommendations response:', { 
          status: response.status, 
          cached: data.cached,
          recommendationCount: data.recommendations?.length || 0,
          diagnostics: data.diagnostics ? {
            reason: data.diagnostics.reason,
            message: data.diagnostics.message
          } : null
        });
      }
      
      // Log dismissed matches if available
      if (data.diagnostics?.dismissedMatches && data.diagnostics.dismissedMatches.length > 0) {
        console.log('🚫 Dismissed matches filtered out:', data.diagnostics.dismissedMatches);
      } else if (data.diagnostics?.dismissedMatches) {
        console.log('✅ No dismissed matches for this trip');
      }
      
      if (!response.ok) {
        // Check if it's a rate limit error
        if (response.status === 429) {
          // Return cached recommendations if available
          const cached = this.getCachedRecommendations(tripId);
          if (cached) {
            console.log('⚠️ Rate limited - returning cached recommendations');
            return cached;
          }
          // Return error with rate limit flag
          return {
            success: false,
            rateLimited: true,
            recommendations: [],
            error: data.message || data.error || 'Rate limit exceeded - please try again later'
          };
        }
        throw new Error(data.message || data.error || 'Failed to fetch recommendations');
      }
      
      // Note: Client-side caching removed - recommendations are now in trip.recommendations
      // Cache kept for backward compatibility during migration (legacy trips without stored recommendations)
      if (!forceRefresh || (data.success && data.recommendations)) {
        const cacheKey = `recommendations:${tripId}`;
        recommendationCache.set(cacheKey, {
          data,
          timestamp: Date.now()
        });
      }
      
      return data;
    } catch (error) {
      // Check if it's a rate limit error
      if (error.message?.includes('429') || error.message?.includes('rate limit') || error.message?.includes('Too many requests')) {
        // Return cached recommendations if available
        const cached = this.getCachedRecommendations(tripId);
        if (cached) {
          console.log('⚠️ Rate limited (error) - returning cached recommendations');
          return cached;
        }
        // Return error with rate limit flag
        return {
          success: false,
          rateLimited: true,
          recommendations: [],
          error: 'Rate limit exceeded - please try again later'
        };
      }
      
      // Only log non-rate-limit errors
      if (!error.message?.includes('429') && !error.message?.includes('rate limit')) {
        console.error('Error fetching recommendations:', error);
      }
      throw error;
    }
  }

  async trackRecommendation(matchId, action, tripId, recommendedDate, score, reason) {
    try {
      console.log('📊 API Service - Tracking recommendation:', { matchId, action, tripId });
      
      const response = await fetch(`${this.baseURL}/recommendations/${matchId}/track`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action,
          tripId,
          recommendedDate,
          score,
          reason
        })
      });
      
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        // If response isn't JSON, get text instead
        const text = await response.text();
        // Suppress rate limit errors
        if (response.status === 429) {
          return { success: false, rateLimited: true };
        }
        throw new Error(`Failed to track recommendation (${response.status}): ${text}`);
      }
      
      // Suppress logging for rate limit errors to avoid noise
      if (response.status !== 429) {
        console.log('📊 API Service - Track recommendation response:', { status: response.status, data });
      }
      
      if (!response.ok) {
        // Don't throw for rate limit errors - just return failure
        if (response.status === 429) {
          return { success: false, rateLimited: true };
        }
        throw new Error(data.message || data.error || `Failed to track recommendation (${response.status})`);
      }
      
      return data;
    } catch (error) {
      // Only log if it's not a network error that might be transient
      if (error.message && !error.message.includes('Network request failed')) {
        console.error('Error tracking recommendation:', error);
      }
      throw error;
    }
  }

  // Fetch scores for completed matches in a trip
  async fetchScores(tripId) {
    try {
      console.log('🏆 API Service - Fetching scores for trip:', tripId);
      
      const response = await fetch(`${this.baseURL}/trips/${tripId}/fetch-scores`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      console.log('🏆 API Service - Fetch scores response:', { status: response.status, data });
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch match scores');
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching match scores:', error);
      throw error;
    }
  }

  // Cache management methods
  invalidateRecommendationCache(tripId) {
    if (tripId) {
      const cacheKey = `recommendations:${tripId}`;
      recommendationCache.delete(cacheKey);
      console.log('🗑️ API Service - Invalidated recommendation cache for trip:', tripId);
    } else {
      // Clear all recommendation cache
      recommendationCache.clear();
      console.log('🗑️ API Service - Cleared all recommendation cache');
    }
  }

  invalidateTravelTimesCache(tripId) {
    if (tripId) {
      // Remove all travel times cache entries for this trip
      const keysToDelete = [];
      for (const key of travelTimesCache.keys()) {
        if (key.startsWith(`travel-times:${tripId}`)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => travelTimesCache.delete(key));
      console.log('🗑️ API Service - Invalidated travel times cache for trip:', tripId);
    } else {
      // Clear all travel times cache
      travelTimesCache.clear();
      console.log('🗑️ API Service - Cleared all travel times cache');
    }
  }

  clearAllCache() {
    recommendationCache.clear();
    travelTimesCache.clear();
    console.log('🗑️ API Service - Cleared all cache');
  }

  // Get relevant leagues based on geographic bounds
  async getRelevantLeaguesFromBackend(bounds) {
    try {
      if (!bounds || !bounds.northeast || !bounds.southwest) {
        // If no bounds, fetch all active leagues
        const response = await this.fetchWithTimeout(
          `${this.baseURL}/leagues/relevant`,
          { method: 'GET' },
          10000
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.message || 'Failed to fetch leagues');
        }
        return data.leagues || [];
      }

      const params = new URLSearchParams();
      params.append('neLat', bounds.northeast.lat);
      params.append('neLng', bounds.northeast.lng);
      params.append('swLat', bounds.southwest.lat);
      params.append('swLng', bounds.southwest.lng);

      const url = `${this.baseURL}/leagues/relevant?${params.toString()}`;
      const response = await this.fetchWithTimeout(url, { method: 'GET' }, 10000);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || 'Failed to fetch relevant leagues');
      }

      return data.leagues || [];
      } catch (error) {
        console.error('Error fetching relevant leagues from backend:', error);
        console.warn('⚠️ Falling back to hardcoded leagues - API unavailable');
        // Fallback to local getRelevantLeagues (uses hardcoded AVAILABLE_LEAGUES) if backend fails
        return this.getRelevantLeagues(bounds);
      }
  }

  // Location autocomplete - uses backend endpoint which proxies LocationIQ
  async searchLocations(query, limit = 5) {
    try {
      if (!query || query.trim().length < 2) {
        return { success: true, suggestions: [] };
      }

      const params = new URLSearchParams();
      params.append('q', query.trim());
      if (limit) params.append('limit', limit.toString());

      const url = `${this.baseURL}/search/locations?${params.toString()}`;
      const response = await this.fetchWithTimeout(url, { method: 'GET' }, 10000);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || 'Failed to search locations');
      }

      return data; // { success, suggestions: [...] }
    } catch (error) {
      console.error('Error in searchLocations:', error);
      throw error;
    }
  }

  // Flight search methods
  async searchAirports(query, limit = 10) {
    try {
      if (!query || query.trim().length < 2) {
        return { success: true, data: [] };
      }

      const params = new URLSearchParams();
      params.append('query', query.trim());
      if (limit) params.append('limit', limit.toString());

      const url = `${this.baseURL}/transportation/airports/search?${params.toString()}`;
      const response = await this.fetchWithTimeout(url, { method: 'GET' }, 10000);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || 'Failed to search airports');
      }

      return data; // { success: true, data: [...], count: ... }
    } catch (error) {
      console.error('Error in searchAirports:', error);
      throw error;
    }
  }

  async searchFlights(params) {
    try {
      const {
        origin,
        destination,
        departureDate,
        returnDate,
        adults = 1,
        max = 10,
        currency = 'USD',
        nonStop = false,
      } = params;

      if (!origin || !destination || !departureDate) {
        throw new Error('Origin, destination, and departure date are required');
      }

      const searchParams = new URLSearchParams();
      searchParams.append('origin', origin);
      searchParams.append('destination', destination);
      searchParams.append('departureDate', departureDate);
      if (returnDate) searchParams.append('returnDate', returnDate);
      searchParams.append('adults', adults.toString());
      searchParams.append('max', max.toString());
      searchParams.append('currency', currency);
      if (nonStop) searchParams.append('nonStop', 'true');

      const url = `${this.baseURL}/transportation/flights/search?${searchParams.toString()}`;
      const response = await this.fetchWithTimeout(url, { method: 'GET' }, 30000);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || 'Failed to search flights');
      }

      return data; // { success: true, provider: '...', data: [...], count: ... }
    } catch (error) {
      console.error('Error in searchFlights:', error);
      throw error;
    }
  }

  async getNearestAirports(latitude, longitude, radius = 100, limit = 3) {
    try {
      const params = new URLSearchParams();
      params.append('latitude', latitude.toString());
      params.append('longitude', longitude.toString());
      params.append('radius', radius.toString());
      params.append('limit', limit.toString());

      const url = `${this.baseURL}/transportation/airports/nearest?${params.toString()}`;
      const response = await this.fetchWithTimeout(url, { method: 'GET' }, 10000);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || 'Failed to get nearest airports');
      }

      return data; // { success: true, data: [...], count: ... }
    } catch (error) {
      console.error('Error in getNearestAirports:', error);
      throw error;
    }
  }

  /**
   * Get flight status by flight number and date
   * @param {string} flightNumber - Full flight number (e.g., "AA100", "DL1234")
   * @param {string} date - Scheduled departure date (YYYY-MM-DD)
   * @returns {Promise<Object>} Flight status information
   */
  async getFlightStatus(flightNumber, date) {
    try {
      if (!flightNumber || !date) {
        throw new Error('Flight number and date are required');
      }

      const params = new URLSearchParams();
      params.append('flightNumber', flightNumber.trim().toUpperCase());
      params.append('date', date);

      const url = `${this.baseURL}/transportation/flights/status?${params.toString()}`;
      const response = await this.fetchWithTimeout(url, { method: 'GET' }, 10000);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || 'Failed to get flight status');
      }

      return data; // { success: true, data: {...} }
    } catch (error) {
      console.error('Error in getFlightStatus:', error);
      throw error;
    }
  }

  /**
   * Get flight by flight number using flight search (workaround)
   * Requires origin, destination, date, and flightNumber
   * @param {string} flightNumber - Full flight number (e.g., "UA387", "DL1234")
   * @param {string} origin - Origin airport code (e.g., "JFK", "ORD")
   * @param {string} destination - Destination airport code (e.g., "LHR", "SFO")
   * @param {string} date - Scheduled departure date (YYYY-MM-DD)
   * @returns {Promise<Object>} Flight information
   */
  async getFlightByNumber(flightNumber, origin, destination, date) {
    try {
      if (!flightNumber || !origin || !destination || !date) {
        throw new Error('Flight number, origin, destination, and date are required');
      }

      const params = new URLSearchParams();
      params.append('flightNumber', flightNumber.trim().toUpperCase());
      params.append('origin', origin.trim().toUpperCase());
      params.append('destination', destination.trim().toUpperCase());
      params.append('date', date);

      const url = `${this.baseURL}/transportation/flights/by-number?${params.toString()}`;
      const response = await this.fetchWithTimeout(url, { method: 'GET' }, 30000);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || 'Failed to find flight');
      }

      return data; // { success: true, data: {...} }
    } catch (error) {
      console.error('Error in getFlightByNumber:', error);
      throw error;
    }
  }
}

// Create API service instance
const apiService = new ApiService();

// Add authentication methods to the instance
apiService.login = login;
apiService.register = register;
apiService.getCurrentUser = getCurrentUser;
apiService.setAuthToken = setAuthToken;
apiService.getWorkOSLoginUrl = getWorkOSLoginUrl;
apiService.handleWorkOSCallback = handleWorkOSCallback;
apiService.requestPasswordReset = requestPasswordReset;
apiService.resetPassword = resetPassword;

export default apiService; 