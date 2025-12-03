/**
 * Match Data Utilities
 * 
 * Common utilities for extracting and formatting match data
 * (team names, venue info, etc.)
 */

/**
 * Extract team name from match data
 * Handles multiple possible data structures
 * @param {Object} team - Team object from match data
 * @param {string} fallback - Fallback name if team not found
 * @returns {string} - Team name
 */
export const getTeamName = (team, fallback = 'Unknown') => {
  if (!team) return fallback;
  
  if (typeof team === 'string') {
    return team;
  }
  
  if (team.name) {
    return team.name;
  }
  
  return fallback;
};

/**
 * Extract home team name from match
 * @param {Object} match - Match object
 * @returns {string} - Home team name
 */
export const getHomeTeamName = (match) => {
  return getTeamName(
    match?.teams?.home || match?.homeTeam,
    'Unknown Home Team'
  );
};

/**
 * Extract away team name from match
 * @param {Object} match - Match object
 * @returns {string} - Away team name
 */
export const getAwayTeamName = (match) => {
  return getTeamName(
    match?.teams?.away || match?.awayTeam,
    'Unknown Away Team'
  );
};

/**
 * Extract league name from match
 * @param {Object} match - Match object
 * @returns {string} - League name
 */
export const getLeagueName = (match) => {
  if (!match) return 'Unknown League';
  
  return match?.league?.name || 
         match?.competition?.name || 
         'Unknown League';
};

/**
 * Extract venue name from match
 * @param {Object} match - Match object
 * @returns {string} - Venue name
 */
export const getVenueName = (match) => {
  if (!match) return 'Unknown Venue';
  
  return match?.fixture?.venue?.name || 
         match?.venue?.name || 
         'Unknown Venue';
};

/**
 * Extract venue city from match
 * @param {Object} match - Match object
 * @returns {string|null} - Venue city or null
 */
export const getVenueCity = (match) => {
  if (!match) return null;
  
  return match?.fixture?.venue?.city || 
         match?.venue?.city || 
         null;
};

export default {
  getTeamName,
  getHomeTeamName,
  getAwayTeamName,
  getLeagueName,
  getVenueName,
  getVenueCity
};

