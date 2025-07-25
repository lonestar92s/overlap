// Auto-detect if running on web or mobile
const API_BASE_URL = typeof window !== 'undefined' && window.location
  ? `http://localhost:3001/api`  // Web browser
  : `http://192.168.1.88:3001/api`; // Mobile device

// Simple token storage for mobile app
let authToken = null;

// For testing purposes, we'll use a default token or create a guest user
const getAuthToken = () => {
  if (authToken) {
    return authToken;
  }
  
  // For now, we'll work without authentication
  // In a real app, you'd implement proper login/signup
  return null;
};

const setAuthToken = (token) => {
  authToken = token;
};

// Available leagues configuration for bounds-based searching
// All major leagues will be available - bounds filtering will be done on backend
const AVAILABLE_LEAGUES = [
  { id: 39, name: 'Premier League', country: 'England', coords: [52.3555, -1.1743] },
  { id: 140, name: 'La Liga', country: 'Spain', coords: [40.4637, -3.7492] },
  { id: 78, name: 'Bundesliga', country: 'Germany', coords: [51.1657, 10.4515] },
  { id: 135, name: 'Serie A', country: 'Italy', coords: [41.8719, 12.5674] },
  { id: 61, name: 'Ligue 1', country: 'France', coords: [46.6034, 1.8883] },
  { id: 2, name: 'Champions League', country: 'Europe', coords: null, isInternational: true },
  { id: 3, name: 'Europa League', country: 'Europe', coords: null, isInternational: true },
  { id: 848, name: 'Europa Conference League', country: 'Europe', coords: null, isInternational: true },
  { id: 94, name: 'Primeira Liga', country: 'Portugal', coords: [39.3999, -8.2245] },
  { id: 88, name: 'Eredivisie', country: 'Netherlands', coords: [52.1326, 5.2913] },
  { id: 144, name: 'Jupiler Pro League', country: 'Belgium', coords: [50.5039, 4.4699] },
  { id: 203, name: 'Süper Lig', country: 'Turkey', coords: [38.9637, 35.2433] },
  { id: 218, name: 'Saudi Pro League', country: 'Saudi Arabia', coords: [23.8859, 45.0792] },
  { id: 253, name: 'Major League Soccer', country: 'USA', coords: [39.8283, -98.5795] },
  { id: 71, name: 'Série A', country: 'Brazil', coords: [-14.2350, -51.9253] },
  { id: 262, name: 'Liga MX', country: 'Mexico', coords: [23.6345, -102.5528] },
  { id: 188, name: 'Scottish Premiership', country: 'Scotland', coords: [56.4907, -4.2026] }
];

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
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

  // NEW: Bounds-based search for map integration
  async searchMatchesByBounds({ bounds, dateFrom, dateTo, competitions = [], teams = [] }) {
    try {
      console.group('🗺️ BOUNDS-BASED SEARCH');
      console.log('Search Parameters:', {
        bounds: bounds ? {
          northeast: `${bounds.northeast.lat}, ${bounds.northeast.lng}`,
          southwest: `${bounds.southwest.lat}, ${bounds.southwest.lng}`
        } : 'No bounds provided',
        dateRange: `${dateFrom} to ${dateTo}`,
        competitions: competitions.length ? competitions : 'All competitions',
        teams: teams.length ? teams : 'All teams'
      });

      // Use specified competitions or all available leagues
      const targetLeagues = competitions.length > 0 
        ? AVAILABLE_LEAGUES.filter(league => competitions.includes(league.id))
        : AVAILABLE_LEAGUES;

      console.log(`📡 Searching ${targetLeagues.length} leagues:`, targetLeagues.map(l => l.name));
      console.groupEnd();

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
            const headers = {
              'Content-Type': 'application/json'
            };
            
            const token = getAuthToken();
            if (token) {
              headers['Authorization'] = `Bearer ${token}`;
            }
            
            const response = await fetch(url, {
              method: 'GET',
              headers
            });
            
            if (!response.ok) {
              if (response.status === 403) {
                // Access denied - subscription required
                console.log(`🚫 ${league.name}: Access denied (subscription required)`);
                return { success: false, data: { response: [] }, league, restricted: true };
              }
              console.log(`❌ ${league.name}: HTTP ${response.status} - ${response.statusText}`);
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            const matchCount = data.response?.length || 0;
            console.log(`✅ ${league.name}: ${matchCount} matches returned`);
            return { success: true, data: data, league };
          } catch (error) {
            console.error(`❌ ${league.name}: ${error.message}`);
            return { success: false, data: { response: [] }, league };
          }
        })
      );

      // Process all matches
      const allMatches = responses.reduce((acc, { data, league }) => {
        const matches = data.response || [];
        
        // Add competition data if missing
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

      // Sort matches chronologically (perfect for travel planning)
      const sortedMatches = [...allMatches].sort((a, b) => {
        const dateA = new Date(a.fixture.date);
        const dateB = new Date(b.fixture.date);
        return dateA.getTime() - dateB.getTime();
      });

      console.log(`🏟️ Found ${sortedMatches.length} matches total`);

      return {
        success: true,
        data: sortedMatches,
        searchParams: {
          bounds,
          dateFrom,
          dateTo,
          competitions,
          teams
        }
      };

    } catch (error) {
      console.error('Error in searchMatchesByBounds:', error);
      return {
        success: false,
        error: error.message || 'Failed to search matches'
      };
    }
  }

  // LEGACY: Keep for backward compatibility during transition
  async searchAllMatchesByLocation(params) {
    console.warn('⚠️ searchAllMatchesByLocation is deprecated - use searchMatchesByBounds instead');
    
    // Convert legacy location-based search to bounds-based search
    // This provides a fallback during the transition period
    if (params.location && params.location.lat && params.location.lon) {
      // Create approximate bounds around the location (roughly 50 mile radius)
      const lat = params.location.lat;
      const lng = params.location.lon;
      const latDelta = 0.5; // Approximately 35 miles
      const lngDelta = 0.5; // Approximately 35 miles
      
      const bounds = {
        northeast: { lat: lat + latDelta, lng: lng + lngDelta },
        southwest: { lat: lat - latDelta, lng: lng - lngDelta }
      };
      
      return this.searchMatchesByBounds({
        bounds,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo
      });
    }
    
    // Fallback to no bounds (show all matches)
    return this.searchMatchesByBounds({
      bounds: null,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo
    });
  }
}

export default new ApiService(); 