/**
 * Utility functions for transforming recommendations for map display
 * Ensures consistent data shape across screens
 */

/**
 * Transform a saved match to the format expected by the map component
 * @param {Object} match - Saved match from trip
 * @returns {Object} Transformed match for map display
 */
export const transformMatchForMap = (match) => {
  // Transform the saved match data back to the structure expected by MatchMapView
  let venueData = match.venueData;
  
  // If venueData doesn't have coordinates, try to create a basic venue object
  if (!venueData || !venueData.coordinates) {
    venueData = {
      name: match.venue || 'Unknown Venue',
      city: match.venueData?.city || 'Unknown City',
      country: match.venueData?.country || 'Unknown Country',
      coordinates: null // Will be filtered out by map component
    };
  }
  
  return {
    ...match,
    id: match.matchId,
    fixture: {
      id: match.matchId,
      date: match.date,
      venue: venueData
    },
    teams: {
      home: match.homeTeam,
      away: match.awayTeam
    },
    league: { name: match.league }
  };
};

/**
 * Transform a recommendation to the format expected by the map component
 * @param {Object} recommendation - Recommendation object
 * @returns {Object} Transformed recommendation for map display
 */
export const transformRecommendationForMap = (recommendation) => {
  const match = recommendation.match || recommendation;
  return {
    ...match,
    id: match.id || match.matchId || match.fixture?.id,
    fixture: {
      id: match.id || match.matchId || match.fixture?.id,
      date: match.fixture?.date,
      venue: match.fixture?.venue
    },
    teams: match.teams,
    league: match.league,
    _isRecommendation: true, // Flag to identify as recommendation
    _recommendationData: recommendation // Store full recommendation data
  };
};

/**
 * Transform an array of recommendations for map display
 * @param {Array} recommendations - Array of recommendation objects
 * @returns {Array} Array of transformed recommendations
 */
export const transformRecommendationsForMap = (recommendations) => {
  if (!recommendations || !Array.isArray(recommendations)) {
    return [];
  }
  
  return recommendations.map(transformRecommendationForMap);
};

/**
 * Transform an array of saved matches for map display
 * @param {Array} matches - Array of saved match objects
 * @returns {Array} Array of transformed matches
 */
export const transformMatchesForMap = (matches) => {
  if (!matches || !Array.isArray(matches)) {
    return [];
  }
  
  return matches.map(transformMatchForMap);
};


