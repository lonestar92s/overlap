/**
 * Trip Utility Functions
 * Handles determining if trips are completed based on their matches
 */

const { isMatchCompleted } = require('./matchStatus');

/**
 * Check if a trip is completed (all matches are finished)
 * A trip is considered completed only if:
 * 1. It has at least one match
 * 2. All matches in the trip are completed
 * 
 * Matches without date/status cannot be completed (per requirement)
 * @param {Object} trip - Trip object with matches array
 * @returns {boolean} - true if trip has matches and all are completed
 */
function isTripCompleted(trip) {
    if (!trip || !trip.matches || trip.matches.length === 0) {
        return false; // Empty trips are not considered completed
    }
    
    // Check if all matches are completed
    // Note: Matches without date/status cannot be completed (as mentioned)
    return trip.matches.every(match => {
        // Skip matches without date (cannot be completed)
        if (!match.date) {
            return false; // Match without date = not completed, so trip is not completed
        }
        
        // Convert trip match format to format expected by isMatchCompleted
        // Trip matches have: date, finalScore { home, away, status }
        const matchObj = {
            fixture: {
                date: match.date instanceof Date ? match.date.toISOString() : match.date,
                status: match.finalScore?.status ? {
                    short: match.finalScore.status,
                    long: match.finalScore.status === 'FT' ? 'Match Finished' : 
                          match.finalScore.status === 'AET' ? 'Match Finished (AET)' :
                          match.finalScore.status === 'PEN' ? 'Match Finished (PEN)' : null
                } : null
            },
            date: match.date instanceof Date ? match.date.toISOString() : match.date
        };
        
        return isMatchCompleted(matchObj);
    });
}

/**
 * Check if a trip is active (has at least one uncompleted match)
 * @param {Object} trip - Trip object with matches array
 * @returns {boolean} - true if trip has matches and at least one is not completed
 */
function isTripActive(trip) {
    if (!trip || !trip.matches || trip.matches.length === 0) {
        return false; // Empty trips are not considered active
    }
    
    // Trip is active if it has matches and at least one is not completed
    return !isTripCompleted(trip);
}

module.exports = {
    isTripCompleted,
    isTripActive
};

