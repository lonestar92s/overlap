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
  
  // Check multiple possible locations for status
  const status = match.status || match.fixture?.status;
  const utcDate = match.utcDate || match.fixture?.date;
  const isPast = isMatchPast(utcDate);
  
  
  // If we have explicit status from API, use that
  if (status?.long) {
    const statusText = status.long;
    
    if (statusText === 'Not Started') {
      return { text: 'Upcoming', type: 'upcoming', isPast: false };
    } else if (statusText === 'Match Finished' || statusText === 'Finished') {
      return { text: 'Completed', type: 'completed', isPast: true };
    } else if (statusText === 'Live' || statusText === 'In Play') {
      return { text: 'Live', type: 'live', isPast: false };
    } else if (statusText.includes('Half') || statusText === 'Halftime') {
      return { text: 'Half Time', type: 'live', isPast: false };
    } else if (statusText.includes('Extra Time')) {
      return { text: 'Extra Time', type: 'live', isPast: false };
    } else if (statusText.includes('Suspended') || statusText.includes('Postponed')) {
      return { text: 'Suspended', type: 'suspended', isPast: false };
    }
  }
  
  // Check short status as well
  if (status?.short) {
    const statusText = status.short;
    
    if (statusText === 'LIVE' || statusText === '1H' || statusText === '2H') {
      return { text: 'Live', type: 'live', isPast: false };
    } else if (statusText === 'HT') {
      return { text: 'Half Time', type: 'live', isPast: false };
    } else if (statusText === 'FT') {
      return { text: 'Completed', type: 'completed', isPast: true };
    } else if (statusText === 'NS') {
      return { text: 'Upcoming', type: 'upcoming', isPast: false };
    } else if (statusText === 'PST' || statusText === 'SUSP') {
      return { text: 'Suspended', type: 'suspended', isPast: false };
    }
  }
  
  // Fallback: determine status based on date and time
  if (isPast) {
    // For past matches, check if they're likely still in progress
    const matchTime = new Date(utcDate);
    const now = new Date();
    const timeDiff = now - matchTime;
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    
    // If match started less than 3 hours ago, it might still be live
    if (hoursDiff < 3 && hoursDiff > 0) {
      console.log('🔍 Time-based live detection:', {
        matchTime: utcDate,
        now: new Date().toISOString(),
        hoursDiff,
        isLikelyLive: true
      });
      return { text: 'Live', type: 'live', isPast: false };
    }
    
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
  if (!match) return null;
  
  const { score, teams } = match;
  const matchStatus = getMatchStatus(match);
  
  // For live matches, use halftime score if available
  // For completed matches, use fulltime score
  let homeScore, awayScore;
  
  if (matchStatus.type === 'live' && score?.halftime?.home !== null && score?.halftime?.away !== null) {
    homeScore = score.halftime.home;
    awayScore = score.halftime.away;
  } else if (matchStatus.type === 'completed' && score?.fullTime?.home !== null && score?.fullTime?.away !== null) {
    homeScore = score.fullTime.home;
    awayScore = score.fullTime.away;
  } else {
    return null;
  }
  
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
    isDraw: result === 'Draw',
    isLive: matchStatus.type === 'live',
    type: matchStatus.type
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






