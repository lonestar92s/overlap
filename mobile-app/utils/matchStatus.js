/**
 * Match Status Utility Functions
 * Handles determining if matches are past/upcoming and formatting status display
 */

/**
 * Check if a match has already happened
 * @param {string} matchDate - ISO date string from match data
 * @returns {boolean} - true if match is in the past
 */
export const isMatchPast = (matchDate) => {
  if (!matchDate) return false;
  
  const matchTime = new Date(matchDate);
  const now = new Date();
  
  return matchTime < now;
};

/**
 * Get match status for display
 * @param {Object} match - Match object with status and date info
 * @returns {Object} - Status info with text, type, and styling
 */
export const getMatchStatus = (match) => {
  if (!match) return { text: 'Unknown', type: 'unknown', isPast: false };
  
  const { status, utcDate } = match;
  const isPast = isMatchPast(utcDate);
  
  // If we have explicit status from API, use that
  if (status?.long) {
    const statusText = status.long;
    
    if (statusText === 'Not Started') {
      return { text: 'Upcoming', type: 'upcoming', isPast: false };
    } else if (statusText === 'Finished') {
      return { text: 'Completed', type: 'completed', isPast: true };
    } else if (statusText === 'Live') {
      return { text: 'Live', type: 'live', isPast: false };
    } else if (statusText.includes('Half Time')) {
      return { text: 'Half Time', type: 'live', isPast: false };
    } else if (statusText.includes('Extra Time')) {
      return { text: 'Extra Time', type: 'live', isPast: false };
    }
  }
  
  // Fallback: determine status based on date
  if (isPast) {
    return { text: 'Completed', type: 'completed', isPast: true };
  } else {
    return { text: 'Upcoming', type: 'upcoming', isPast: false };
  }
};

/**
 * Get match result for completed matches
 * @param {Object} match - Match object with score data
 * @returns {Object|null} - Result info or null if match not completed
 */
export const getMatchResult = (match) => {
  if (!match || !isMatchPast(match.utcDate)) return null;
  
  const { score, teams } = match;
  
  if (!score?.fullTime?.home || !score?.fullTime?.away) return null;
  
  const homeScore = score.fullTime.home;
  const awayScore = score.fullTime.away;
  
  let result = 'Draw';
  let winner = null;
  
  if (homeScore > awayScore) {
    result = 'Home Win';
    winner = teams?.home?.name || 'Home Team';
  } else if (awayScore > homeScore) {
    result = 'Away Win';
    winner = teams?.away?.name || 'Away Team';
  }
  
  return {
    homeScore,
    awayScore,
    result,
    winner,
    isDraw: result === 'Draw'
  };
};

/**
 * Format match date for display
 * @param {string} matchDate - ISO date string
 * @param {boolean} isPast - Whether match is in the past
 * @returns {string} - Formatted date string
 */
export const formatMatchDate = (matchDate, isPast = false) => {
  if (!matchDate) return '';
  
  const matchTime = new Date(matchDate);
  const now = new Date();
  const diffTime = Math.abs(now - matchTime);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (isPast) {
    if (diffDays === 1) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays} days ago`;
    return matchTime.toLocaleDateString();
  } else {
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays <= 7) return `In ${diffDays} days`;
    return matchTime.toLocaleDateString();
  }
};








