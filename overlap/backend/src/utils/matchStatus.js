/**
 * Match Status Utility Functions
 * Handles determining if matches are past/upcoming and filtering for recommendations
 */

/**
 * Check if a match has already happened (completed)
 * @param {string} matchDate - ISO date string from match data
 * @returns {boolean} - true if match is in the past
 */
function isMatchPast(matchDate) {
    if (!matchDate) return false;
    
    const matchTime = new Date(matchDate);
    const now = new Date();
    
    return matchTime < now;
}

/**
 * Check if a match is in progress (live)
 * @param {Object} match - Match object with status info
 * @returns {boolean} - true if match is currently live/in progress
 */
function isMatchLive(match) {
    if (!match) return false;
    
    // Check status from fixture.status or match.status
    const status = match.fixture?.status || match.status;
    
    if (status?.long) {
        const statusText = status.long.toLowerCase();
        if (statusText === 'live' || 
            statusText === 'in play' || 
            statusText.includes('half') ||
            statusText.includes('extra time')) {
            return true;
        }
    }
    
    if (status?.short) {
        const statusText = status.short.toUpperCase();
        if (statusText === 'LIVE' || 
            statusText === '1H' || 
            statusText === '2H' || 
            statusText === 'HT' ||
            statusText === 'ET' ||
            statusText === 'PEN') {
            return true;
        }
    }
    
    // Fallback: Check if match started recently (within last 3 hours) but hasn't finished
    const matchDate = match.fixture?.date || match.utcDate || match.date;
    if (matchDate && isMatchPast(matchDate)) {
        const matchTime = new Date(matchDate);
        const now = new Date();
        const hoursDiff = (now - matchTime) / (1000 * 60 * 60);
        
        // If match started less than 3 hours ago and status isn't "finished", might be live
        if (hoursDiff > 0 && hoursDiff < 3) {
            const statusLong = status?.long?.toLowerCase() || '';
            if (!statusLong.includes('finished') && !statusLong.includes('completed')) {
                return true;
            }
        }
    }
    
    return false;
}

/**
 * Check if a match is completed (finished)
 * @param {Object} match - Match object with status info
 * @returns {boolean} - true if match is completed/finished
 */
function isMatchCompleted(match) {
    if (!match) return false;
    
    // Check status from fixture.status or match.status
    const status = match.fixture?.status || match.status;
    
    if (status?.long) {
        const statusText = status.long.toLowerCase();
        if (statusText === 'finished' || 
            statusText === 'match finished' || 
            statusText === 'completed') {
            return true;
        }
    }
    
    if (status?.short) {
        const statusText = status.short.toUpperCase();
        if (statusText === 'FT' || 
            statusText === 'AET' || 
            statusText === 'PEN') {
            return true;
        }
    }
    
    // Fallback: Check if match date is in the past and not live
    const matchDate = match.fixture?.date || match.utcDate || match.date;
    if (matchDate && isMatchPast(matchDate) && !isMatchLive(match)) {
        return true;
    }
    
    return false;
}

/**
 * Check if a match should be filtered out from recommendations
 * Filters out matches that are in progress or completed
 * @param {Object} match - Match object with status info
 * @returns {boolean} - true if match should be filtered out (is live or completed)
 */
function shouldFilterMatch(match) {
    if (!match) return true; // Filter out invalid matches
    
    return isMatchLive(match) || isMatchCompleted(match);
}

/**
 * Get match status type
 * @param {Object} match - Match object with status info
 * @returns {string} - Status type: 'upcoming', 'live', 'completed', 'unknown'
 */
function getMatchStatusType(match) {
    if (!match) return 'unknown';
    
    if (isMatchLive(match)) return 'live';
    if (isMatchCompleted(match)) return 'completed';
    
    return 'upcoming';
}

module.exports = {
    isMatchPast,
    isMatchLive,
    isMatchCompleted,
    shouldFilterMatch,
    getMatchStatusType
};

