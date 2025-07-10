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

// Helper function to calculate distance between two points in miles
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Filter leagues based on distance from search location
const filterRelevantLeagues = (allLeagues, searchLocation, maxLeagueDistance = 500) => {
  if (!searchLocation?.lat || !searchLocation?.lon) {
    // If no location provided, return all leagues
    return allLeagues;
  }

  const relevantLeagues = allLeagues.filter(league => {
    // Always include international competitions
    if (league.isInternational) {
      return true;
    }
    
    // Skip leagues without coordinates
    if (!league.coords || league.coords.length !== 2) {
      return false;
    }
    
    // Calculate distance from search location to league's country center
    const [leagueLat, leagueLon] = league.coords;
    const distance = calculateDistance(
      searchLocation.lat, 
      searchLocation.lon, 
      leagueLat, 
      leagueLon
    );
    
    return distance <= maxLeagueDistance;
  });

  return relevantLeagues;
};

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

  // Replace the natural language search with the correct multi-league search pattern
  async searchAllMatchesByLocation({ location, dateFrom, dateTo, maxDistance = 100 }) {
    try {
             // Get all available leagues with country coordinates for distance-based filtering
       // Note: Championship (40) and League One (41) are excluded as they're restricted for freemium users
       const allLeagues = [
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

      console.log('🔍 Starting match search with dates:', { dateFrom, dateTo });
      console.log(`📍 Searching within ${maxDistance} miles of location`);
      
      // Filter leagues based on distance from search location
      const relevantLeagues = filterRelevantLeagues(allLeagues, location, 500);
      
      console.log(`🌍 Filtered leagues: ${relevantLeagues.length}/${allLeagues.length} leagues`);
      console.log(`📋 Searching leagues:`, relevantLeagues.map(l => `${l.name} (${l.country})`).join(', '));
      
      if (relevantLeagues.length === 0) {
        console.log('⚠️ No relevant leagues found for this location');
        return {
          success: true,
          data: [],
          searchParams: { maxDistance, location, dateFrom, dateTo }
        };
      }

      // Format dates for API
      const formattedDates = {
        from: dateFrom,
        to: dateTo
      };

             // Fetch relevant leagues in parallel (distance-filtered)
       const responses = await Promise.all(
         relevantLeagues.map(async (league) => {
           // Build URL with query parameters including maxDistance
           const params = new URLSearchParams({
             dateFrom: formattedDates.from,
             dateTo: formattedDates.to,
             maxDistance: maxDistance.toString(),
             ...(location?.lat && { userLat: location.lat }),
             ...(location?.lon && { userLon: location.lon })
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
                 console.log(`⚠️ Access denied to ${league.name} - subscription required`);
                 return { success: false, data: { response: [] }, league, restricted: true };
               }
               throw new Error(`HTTP ${response.status}: ${response.statusText}`);
             }
             
             const data = await response.json();
             return { success: true, data: data, league };
           } catch (error) {
             console.error(`Error fetching matches for league ${league.name}:`, error);
             return { success: false, data: { response: [] }, league };
           }
         })
       );

      // Process all matches in a single pass (matching web app pattern)
      const allMatches = responses.reduce((acc, { data, league }) => {
        // The API response is already in the correct format
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

      // Sort matches by date and time (chronological order for travel planning)
      const sortedMatches = [...allMatches].sort((a, b) => {
        const dateA = new Date(a.fixture.date);
        const dateB = new Date(b.fixture.date);
        return dateA.getTime() - dateB.getTime();
      });

      console.log(`📅 Total matches found within ${maxDistance} miles: ${sortedMatches.length}`);
      
      // Log matches by competition for debugging
      const matchesByCompetition = {};
      sortedMatches.forEach(match => {
        const compId = match.competition?.id;
        const compName = match.competition?.name;
        if (!matchesByCompetition[compId]) {
          matchesByCompetition[compId] = { name: compName, count: 0 };
        }
        matchesByCompetition[compId].count++;
      });
      console.log('Matches by competition:', matchesByCompetition);

      return {
        success: true,
        data: sortedMatches,
        searchParams: {
          maxDistance,
          location,
          dateFrom,
          dateTo
        }
      };

    } catch (error) {
      console.error('Error in searchMatchesByLocation:', error);
      return {
        success: false,
        error: error.message || 'Failed to search matches'
      };
    }
  }
}

export default new ApiService(); 