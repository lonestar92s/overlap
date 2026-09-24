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
/**
 * Remove duplicate matches from a trip (same matchId, string-normalized).
 * Keeps the first occurrence of each matchId.
 * Mutates trip.matches when it is a Mongoose document array or plain array.
 * @param {Object} trip - Trip with matches array
 * @returns {{ changed: boolean, removedCount: number }}
 */
function dedupeTripMatches(trip) {
    if (!trip || !Array.isArray(trip.matches) || trip.matches.length < 2) {
        return { changed: false, removedCount: 0 };
    }
    const seen = new Set();
    const unique = [];
    let removedCount = 0;
    for (const match of trip.matches) {
        const id = match?.matchId != null ? String(match.matchId) : null;
        if (id == null || id === '') {
            unique.push(match);
            continue;
        }
        if (seen.has(id)) {
            removedCount += 1;
            continue;
        }
        seen.add(id);
        // Normalize stored matchId to string for consistent future comparisons
        if (match.matchId != null && typeof match.matchId !== 'string') {
            match.matchId = id;
        }
        unique.push(match);
    }
    if (removedCount === 0) {
        return { changed: false, removedCount: 0 };
    }
    // Same assignment pattern as DELETE /matches — persists on parent user.save()
    trip.matches = unique;
    return { changed: true, removedCount };
}

/**
 * Find a match on a trip by matchId (string-normalized).
 */
function findTripMatch(trip, matchId) {
    if (!trip?.matches || matchId == null) return null;
    const target = String(matchId);
    return trip.matches.find(m => m?.matchId != null && String(m.matchId) === target) || null;
}

module.exports = {
    isTripCompleted,
    isTripActive,
    dedupeTripMatches,
    findTripMatch
};
