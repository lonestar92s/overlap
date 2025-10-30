// Backend API base URL - Use Railway production backend
// Override with EXPO_PUBLIC_API_URL environment variable if needed for local testing
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 
  'https://friendly-gratitude-production-3f31.up.railway.app/api';

// Simple token storage for mobile app
let authToken = null;

// Client-side cache for recommendations
const recommendationCache = new Map();
const CACHE_EXPIRY = 60 * 60 * 1000; // 1 hour in milliseconds

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
    console.error('Error getting token from storage:', error);
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

    const data = await response.json();
    
    if (response.ok) {
      setAuthToken(data.token);
      return { success: true, user: data.user, token: data.token };
    } else {
      return { success: false, error: data.error || 'Login failed' };
    }
  } catch (error) {
    console.error('Login error:', error);
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

    const data = await response.json();
    
    if (response.ok) {
      setAuthToken(data.token);
      return { success: true, user: data.user, token: data.token };
    } else {
      return { success: false, error: data.error || 'Registration failed' };
    }
  } catch (error) {
    console.error('Registration error:', error);
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

    const data = await response.json();
    
    if (response.ok) {
      return data.user;
    } else {
      // Provide more specific error messages based on status code
      if (response.status === 401) {
        throw new Error('Authentication failed - please log in again');
      } else if (response.status === 403) {
        throw new Error('Access denied - insufficient permissions');
      } else if (response.status >= 500) {
        throw new Error('Server error - please try again later');
      } else {
        throw new Error(data.error || 'Failed to get user data');
      }
    }
  } catch (error) {
    console.error('Get current user error:', error);
    
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

  // Helper method to create fetch requests with timeout
  async fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const response = await fetch(url, { 
        ...options, 
        signal: controller.signal 
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
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
  async getTrips() {
    try {
      const response = await fetch(`${this.baseURL}/trips`, {
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
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch trip');
      }
      
      return { success: true, data: data.trip || data };
    } catch (error) {
      console.error('Error fetching trip:', error);
      return { success: false, error: error.message };
    }
  }

  async createTrip(name, description = '') {
    try {
      const token = await getAuthToken();
      const response = await fetch(`${this.baseURL}/trips`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, description })
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to create trip');
      }
      
      return data;
    } catch (error) {
      console.error('Error creating trip:', error);
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
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to update trip');
      }
      
      return data;
    } catch (error) {
      console.error('Error updating trip:', error);
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
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to add match to trip');
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
  getRelevantLeagues(searchBounds) {
    if (!searchBounds || !searchBounds.northeast || !searchBounds.southwest) {
      console.log('🔍 getRelevantLeagues: No bounds provided, returning all leagues');
      return AVAILABLE_LEAGUES; // Fallback to all leagues if no bounds
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
      console.log('⚠️ No relevant leagues found, using fallback');
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
  async searchMatchesByBounds({ bounds, dateFrom, dateTo, competitions = [], teams = [] }) {
    try {
      // Use specified competitions or geographically filter leagues
      const targetLeagues = competitions.length > 0 
        ? AVAILABLE_LEAGUES.filter(league => competitions.includes(league.id))
        : this.getRelevantLeagues(bounds);

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
          const url = `${API_BASE_URL}/matches/competitions/${league.id}?${params}`;
          try {
            const headers = { 'Content-Type': 'application/json' };
            const token = await getAuthToken();
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const response = await fetch(url, { method: 'GET', headers });
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

      return {
        success: true,
        data: sortedMatches,
        searchParams: { bounds, dateFrom, dateTo, competitions, teams }
      };

    } catch (error) {
      console.error('Error in searchMatchesByBounds:', error);
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
        throw new Error(data.message || 'Failed to fetch recommended matches');
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching recommended matches:', error);
      if (error.name === 'AbortError') {
        throw new Error('Request timed out - please try again');
      }
      throw error;
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
  async getRecommendations(tripId, forceRefresh = false) {
    try {
      console.log('🎯 API Service - Getting recommendations for trip:', tripId);
      
      // Check client-side cache first
      if (!forceRefresh) {
        const cacheKey = `recommendations:${tripId}`;
        const cached = recommendationCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY) {
          console.log('⚡ API Service - Returning cached recommendations');
          return {
            ...cached.data,
            cached: true
          };
        }
      }
      
      const response = await fetch(`${this.baseURL}/recommendations/trips/${tripId}/recommendations`, {
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      console.log('🎯 API Service - Recommendations response:', { status: response.status, data });
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch recommendations');
      }
      
      // Cache the response
      const cacheKey = `recommendations:${tripId}`;
      recommendationCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });
      
      return data;
    } catch (error) {
      console.error('Error fetching recommendations:', error);
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
      
      const data = await response.json();
      console.log('📊 API Service - Track recommendation response:', { status: response.status, data });
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to track recommendation');
      }
      
      return data;
    } catch (error) {
      console.error('Error tracking recommendation:', error);
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

  clearAllCache() {
    recommendationCache.clear();
    console.log('🗑️ API Service - Cleared all cache');
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