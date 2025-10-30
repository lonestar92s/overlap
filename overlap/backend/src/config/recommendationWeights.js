/**
 * Recommendation Scoring Weight Configuration
 * 
 * This file defines the scoring weights and multipliers for the recommendation system.
 * All weights are additive unless specified as multipliers.
 */

module.exports = {
    // Base Scores (Applied to all matches)
    baseScore: {
        minThreshold: 30, // Minimum score to show a recommendation
        default: 10 // Base points every match starts with
    },

    // Preference-Based Scoring
    preferences: {
        // Favorite Teams
        favoriteTeam: {
            // Direct match: one of the teams playing is user's favorite
            playing: 50, // Strong boost when favorite team is playing
            sameCity: 10, // Small boost if match is in same city as favorite team
            sameCountry: 5, // Minimal boost if match is in same country
            sameLeague: 15 // Medium boost if match involves teams from favorite team's league
        },

        // Favorite Leagues
        favoriteLeague: {
            // Match is in a favorite league
            directMatch: 30, // Strong boost for favorite league matches
            tier: {
                // Additional boost based on league tier within favorites
                tier1: 10, // Top tier leagues (Premier League, La Liga, etc.)
                tier2: 5,  // Second tier
                tier3: 2   // Lower tiers
            }
        },

        // Favorite Venues
        favoriteVenue: {
            // Match is at a favorite venue
            directMatch: 40, // Very strong boost for favorite venues
            // Proximity to favorite venues (if venue has coordinates)
            proximity: {
                within5miles: 25,   // Within 5 miles of a favorite venue
                within25miles: 20,  // Within 25 miles
                within50miles: 15,  // Within 50 miles
                within100miles: 10, // Within 100 miles
                beyond: 0
            }
        }
    },

    // Context-Based Scoring (Trip Recommendations)
    context: {
        // Proximity to saved matches in trip (0-40 points)
        proximity: {
            within10miles: 40,
            within25miles: 35,
            within50miles: 30,
            within100miles: 25,
            within200miles: 20,
            beyond: 15
        },

        // Temporal alignment (0-30 points)
        temporal: {
            exactDate: 30,      // Match is exactly on target date
            within1day: 25,     // ±1 day from target
            within2days: 20,    // ±2 days
            within3days: 15,    // ±3 days
            beyond: 10
        },

        // League quality (0-20 points)
        leagueQuality: {
            topTier: 20,        // Premier League, La Liga, Serie A, Bundesliga, Ligue 1
            secondTier: 15,     // Championship, La Liga 2, etc.
            other: 10           // All other leagues
        },

        // Venue characteristics (0-10 points)
        venue: {
            highCapacity: 10,   // Stadiums with >50k capacity
            mediumCapacity: 7,  // 20k-50k capacity
            lowCapacity: 5      // <20k capacity
        }
    },

    // Penalties (Negative scores)
    penalties: {
        alreadySaved: -100,        // Match already saved by user
        recentlyDismissed: -30,    // User dismissed this recommendation recently
        recentlyVisitedVenue: -20, // User visited this venue recently
        timeConflict: -50,         // Time conflict with existing trip match
        outsideRadius: 0           // Not within user's recommendation radius (filtered, not penalized)
    },

    // Bonuses (Additional positive scores)
    bonuses: {
        weekendMatch: 15,          // Match on Saturday or Sunday
        highProfileMatch: 25,      // Derby, big teams, finals
        derby: 30,                 // Local derby or rivalry
        cupFinal: 35,              // Cup final or championship match
        nearDefaultLocation: 40    // Close to user's default location (if set)
    },

    // Preference Strength Multipliers
    // Users can adjust how strongly preferences influence recommendations
    preferenceStrength: {
        light: {
            favoriteTeam: 0.5,     // Half weight
            favoriteLeague: 0.5,
            favoriteVenue: 0.5
        },
        standard: {
            favoriteTeam: 1.0,    // Full weight (default)
            favoriteLeague: 1.0,
            favoriteVenue: 1.0
        },
        strong: {
            favoriteTeam: 1.5,    // 50% boost
            favoriteLeague: 1.5,
            favoriteVenue: 1.5
        }
    },

    // Top Leagues by ID (for quality scoring)
    topLeagues: {
        tier1: ['39', '140', '135', '61', '78'], // Premier League, La Liga, Serie A, Ligue 1, Bundesliga
        tier2: ['40', '41', '79', '94', '88'],   // Championship, League One, Bundesliga 2, Primeira Liga, Eredivisie
        tier3: ['203', '144', '113', '218']      // Süper Lig, Jupiler Pro League, Belgian Pro League, etc.
    }
};

