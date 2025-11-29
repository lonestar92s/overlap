const axios = require('axios');
const https = require('https');
const subscriptionService = require('./subscriptionService');
const venueService = require('./venueService');
const teamService = require('./teamService');
const weights = require('../config/recommendationWeights');
const { shouldFilterMatch } = require('../utils/matchStatus');

// API-Sports configuration
const API_SPORTS_KEY = process.env.API_SPORTS_KEY || '0ab95ca9f7baeb6fd551af7ca41ed8d2';
const API_SPORTS_BASE_URL = 'https://v3.football.api-sports.io';

// Create HTTPS agent
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

class RecommendationService {
    constructor() {
        this.defaultRadius = 400; // miles
        this.earthRadiusMiles = 3959; // Earth's radius in miles
        this.cache = new Map(); // In-memory cache
        this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    }

    /**
     * Get recommendations for a specific trip
     * @param {string} tripId - The trip ID
     * @param {Object} user - User object with subscription info
     * @param {Object} trip - Trip object with matches and dates
     * @param {boolean} forceRefresh - If true, bypass cache and regenerate recommendations
     * @returns {Object} Object with recommendations, cached flag, and diagnostics
     */
    async getRecommendationsForTrip(tripId, user, trip, forceRefresh = false) {
        try {
            console.log(`🎯 Generating recommendations for trip: ${tripId}${forceRefresh ? ' (force refresh)' : ''}`);
            
            // Validate trip exists (prevent generating recommendations for deleted trips)
            if (!trip) {
                console.log(`❌ Trip not found or deleted: ${tripId}`);
                // Clear any cached recommendations for this trip
                this.invalidateTripCache(tripId);
                return {
                    recommendations: [],
                    cached: false,
                    diagnostics: {
                        reason: 'trip_not_found',
                        message: 'Trip not found or has been deleted'
                    }
                };
            }

            // Ensure tripId is a string for consistent comparison
            const tripIdStr = String(tripId);
            console.log(`🔍 Using tripId: ${tripIdStr} for filtering dismissed recommendations`);
            
            // Check cache first (unless force refresh)
            let cachedResult = null;
            const cacheKey = this.generateCacheKey(tripId, user, trip);
            if (!forceRefresh) {
                cachedResult = this.getFromCache(cacheKey);
                if (cachedResult) {
                    console.log(`⚡ Returning cached recommendations for trip: ${tripId} (cache key: ${cacheKey})`);
                    // Handle both old format (array) and new format (object with recommendations and diagnostics)
                    if (Array.isArray(cachedResult)) {
                        // Legacy format - just an array
                        return {
                            recommendations: cachedResult,
                            cached: true,
                            diagnostics: null
                        };
                    } else {
                        // New format - object with recommendations and diagnostics
                        return {
                            recommendations: cachedResult.recommendations || [],
                            cached: true,
                            diagnostics: cachedResult.diagnostics || null
                        };
                    }
                } else {
                    console.log(`💾 Cache miss for trip: ${tripId} (cache key: ${cacheKey})`);
                }
            } else {
                console.log(`🔄 Force refresh requested - bypassing cache for trip: ${tripId}`);
            }
            
            // Get trip date range
            const tripDates = this.getTripDateRange(trip);
            if (!tripDates.start || !tripDates.end) {
                console.log('❌ Invalid trip dates - trip has no matches to determine date range');
                const diagnostics = {
                    reason: 'invalid_trip_dates',
                    message: 'Trip has no matches to determine date range',
                    tripInfo: {
                        matchCount: trip.matches?.length || 0,
                        hasMatches: (trip.matches?.length || 0) > 0
                    }
                };
                // Don't cache empty results - they should be regenerated when matches are added
                return {
                    recommendations: [],
                    cached: false,
                    diagnostics
                };
            }

            // Get days without matches
            const daysWithoutMatches = this.getDaysWithoutMatches(trip, tripDates);
            if (daysWithoutMatches.length === 0) {
                console.log('✅ Trip already has matches for all days - no recommendations needed');
                const diagnostics = {
                    reason: 'all_days_have_matches',
                    message: 'All days in trip already have matches',
                    tripInfo: {
                        matchCount: trip.matches?.length || 0,
                        dateRange: {
                            start: tripDates.start.toISOString().split('T')[0],
                            end: tripDates.end.toISOString().split('T')[0]
                        },
                        daysWithMatches: trip.matches?.length || 0
                    }
                };
                // Don't cache this - conditions might change if matches are removed
                return {
                    recommendations: [],
                    cached: false,
                    diagnostics
                };
            }

            // Get saved match venues for proximity search
            const savedMatchVenues = await this.extractVenuesFromTrip(trip);
            if (savedMatchVenues.length === 0) {
                console.log('❌ No saved matches with coordinates to base recommendations on');
                const diagnostics = {
                    reason: 'no_venues_with_coordinates',
                    message: 'Trip matches do not have venue coordinates for proximity search',
                    tripInfo: {
                        matchCount: trip.matches?.length || 0,
                        dateRange: {
                            start: tripDates.start.toISOString().split('T')[0],
                            end: tripDates.end.toISOString().split('T')[0]
                        },
                        daysWithoutMatches: daysWithoutMatches.length,
                        venuesWithCoordinates: 0
                    }
                };
                // Don't cache empty results
                return {
                    recommendations: [],
                    cached: false,
                    diagnostics
                };
            }

            // Get user's subscription tier for league filtering
            const subscriptionTier = user.subscription?.tier || 'freemium';
            const restrictedLeagues = subscriptionService.getRestrictedLeagues(subscriptionTier);
            
            // Get user's recommendation radius preference
            const userRadius = user.preferences?.recommendationRadius || this.defaultRadius;

            // Get list of dismissed match IDs for this trip (for diagnostics)
            const dismissedMatchIds = this.getDismissedMatchIdsForTrip(user, tripId);

            // Generate recommendations for each day without matches
            // Return 2-3 top recommendations per day
            const recommendations = [];
            const seenMatchIds = new Set(); // Track matchIds to prevent duplicates
            const maxRecommendationsPerDay = 3; // Show up to 3 recommendations per day
            const debugInfo = {
                daysProcessed: 0,
                daysWithRecommendations: 0,
                totalMatchesFound: 0,
                totalMatchesFiltered: 0,
                dismissedMatches: Array.from(dismissedMatchIds)
            };
            
            for (const day of daysWithoutMatches) {
                debugInfo.daysProcessed++;
                const dayRecommendations = await this.generateRecommendationsForDay(
                    day,
                    savedMatchVenues,
                    tripDates,
                    restrictedLeagues,
                    trip,
                    userRadius,
                    user,
                    tripId,
                    maxRecommendationsPerDay
                );
                
                if (dayRecommendations.length > 0) {
                    debugInfo.daysWithRecommendations++;
                }
                
                // Add all recommendations for this day (deduplication happens in generateRecommendationsForDay)
                for (const recommendation of dayRecommendations) {
                    const matchId = String(recommendation.matchId || recommendation.match?.fixture?.id || recommendation.match?.id);
                    
                    // Only add if we haven't seen this matchId before (across all days)
                    if (!seenMatchIds.has(matchId)) {
                        seenMatchIds.add(matchId);
                        recommendations.push(recommendation);
                        debugInfo.totalMatchesFound++;
                    } else {
                        console.log(`⚠️ Skipping duplicate recommendation for matchId: ${matchId}`);
                        debugInfo.totalMatchesFiltered++;
                    }
                }
            }

            // Build diagnostics
            const diagnostics = {
                reason: recommendations.length === 0 ? 'no_matches_found' : null,
                message: recommendations.length === 0 
                    ? 'No matches found matching criteria (proximity, date, conflicts, or scoring)' 
                    : null,
                tripInfo: {
                    matchCount: trip.matches?.length || 0,
                    dateRange: {
                        start: tripDates.start.toISOString().split('T')[0],
                        end: tripDates.end.toISOString().split('T')[0]
                    },
                    daysWithoutMatches: daysWithoutMatches.length,
                    venuesWithCoordinates: savedMatchVenues.length,
                    userRadius: userRadius
                },
                debugInfo,
                dismissedMatches: Array.from(dismissedMatchIds)
            };

            // Only cache non-empty results (or cache empty results with shorter expiry)
            if (recommendations.length > 0) {
                // Cache successful results with full expiry
                this.setCache(cacheKey, { recommendations, diagnostics });
                console.log(`✅ Generated ${recommendations.length} unique recommendations - cached`);
            } else {
                // Cache empty results with shorter expiry (1 hour instead of 24 hours)
                this.setCache(cacheKey, { recommendations: [], diagnostics }, 60 * 60 * 1000);
                console.log(`⚠️ Generated 0 recommendations - cached with short expiry (1 hour)`);
            }
            
            console.log(`✅ Generated ${recommendations.length} unique recommendations`);
            return {
                recommendations,
                cached: false,
                diagnostics
            };

        } catch (error) {
            console.error('❌ Error generating recommendations:', error);
            return {
                recommendations: [],
                cached: false,
                diagnostics: {
                    reason: 'error',
                    message: `Error generating recommendations: ${error.message}`,
                    error: error.message
                }
            };
        }
    }

    /**
     * Generate multiple recommendations for a specific day (2-3 top matches)
     */
    async generateRecommendationsForDay(day, savedMatchVenues, tripDates, restrictedLeagues, trip, userRadius, user, tripId, maxRecommendations = 3) {
        try {
            // Search for matches on this day and nearby dates
            const searchDates = this.getSearchDates(day, tripDates);
            const allMatches = [];

            // Search for matches on each date
            for (const searchDate of searchDates) {
                const matches = await this.searchMatchesForDate(searchDate, restrictedLeagues);
                allMatches.push(...matches);
            }

            if (allMatches.length === 0) {
                return [];
            }

            // Filter matches by proximity to saved venues
            const nearbyMatches = await this.filterMatchesByProximity(
                allMatches, 
                savedMatchVenues, 
                userRadius
            );

            if (nearbyMatches.length === 0) {
                return [];
            }

            // Remove conflicts with existing trip matches
            const conflictFreeMatches = this.removeConflicts(nearbyMatches, trip);

            if (conflictFreeMatches.length === 0) {
                return [];
            }

            // Filter out dismissed recommendations for this trip (permanent filter)
            console.log(`🔍 Filtering dismissed recommendations for trip ${tripId}, ${conflictFreeMatches.length} matches before filter`);
            const nonDismissedMatches = this.filterDismissedRecommendations(conflictFreeMatches, user, tripId);
            console.log(`🔍 After filtering dismissed: ${nonDismissedMatches.length} matches remaining (had ${conflictFreeMatches.length} before filter)`);

            if (nonDismissedMatches.length === 0) {
                console.log(`⚠️ No non-dismissed matches remaining after filtering for day ${day}. This could mean:`);
                console.log(`   - All matches were dismissed for this trip`);
                console.log(`   - No matches passed the conflict filter`);
                console.log(`   - Filter logic issue`);
                return [];
            }

            // Extract user preferences for scoring
            const userPreferences = {
                favoriteTeams: user.preferences?.favoriteTeams || [],
                favoriteLeagues: user.preferences?.favoriteLeagues || [],
                favoriteVenues: user.preferences?.favoriteVenues || [],
                preferenceStrength: user.preferences?.preferenceStrength || 'standard'
            };

            // Score and rank matches
            const scoredMatches = nonDismissedMatches.map(match => ({
                match,
                score: this.scoreMatch(match, savedMatchVenues, day, trip, userPreferences)
            }));

            // Sort by score (highest first)
            scoredMatches.sort((a, b) => b.score - a.score);
            
            // Filter out negative scores (penalized matches)
            const positiveMatches = scoredMatches.filter(m => m.score > 0);
            
            if (positiveMatches.length === 0) {
                console.log(`No positive-scoring matches found for ${day}`);
                return [];
            }

            // Log scoring info for debugging
            console.log(`📊 Recommendations for ${day}: Found ${positiveMatches.length} positive matches, top scores:`, 
                positiveMatches.slice(0, 5).map(m => ({ 
                    matchId: m.match.id, 
                    score: m.score,
                    teams: `${m.match.teams?.home?.name} vs ${m.match.teams?.away?.name}`
                }))
            );

            // Take top N matches (up to maxRecommendations)
            // Prioritize matches above threshold, but include lower-scoring ones if needed to fill slots
            const aboveThreshold = positiveMatches.filter(m => m.score >= weights.baseScore.minThreshold);
            const belowThreshold = positiveMatches.filter(m => m.score < weights.baseScore.minThreshold && m.score > 0);
            
            // If we have enough above threshold, use those. Otherwise, supplement with below-threshold matches
            let selectedMatches = [];
            if (aboveThreshold.length >= maxRecommendations) {
                selectedMatches = aboveThreshold.slice(0, maxRecommendations);
            } else {
                // Take all above threshold, then fill remaining slots with best below-threshold matches
                selectedMatches = [
                    ...aboveThreshold,
                    ...belowThreshold.slice(0, maxRecommendations - aboveThreshold.length)
                ];
            }

            console.log(`✅ Selected ${selectedMatches.length} recommendations for ${day} (${aboveThreshold.length} above threshold, ${selectedMatches.length - aboveThreshold.length} below threshold)`);

            // Generate recommendations for each selected match
            const recommendations = [];
            for (const scoredMatch of selectedMatches) {
                // Generate alternative dates
                const alternativeDates = this.generateAlternativeDates(scoredMatch.match, day, tripDates);

                recommendations.push({
                    matchId: scoredMatch.match.id,
                    recommendedForDate: day,
                    match: scoredMatch.match,
                    reason: this.generateRecommendationReason(scoredMatch.match, savedMatchVenues),
                    proximity: this.calculateProximityText(scoredMatch.match, savedMatchVenues),
                    score: scoredMatch.score,
                    alternativeDates: alternativeDates
                });
            }

            return recommendations;
        } catch (error) {
            console.error(`❌ Error generating recommendations for ${day}:`, error);
            return [];
        }
    }

    /**
     * Search for matches on a specific date
     */
    async searchMatchesForDate(date, restrictedLeagues) {
        try {
            // Get all accessible leagues (not restricted)
            const allLeagues = await this.getAllAccessibleLeagues(restrictedLeagues);
            
            if (allLeagues.length === 0) {
                return [];
            }

            // Search for matches in accessible leagues
            const requests = allLeagues.map(leagueId => 
                axios.get(`${API_SPORTS_BASE_URL}/fixtures`, {
                    params: { 
                        league: leagueId, 
                        date: date,
                        season: new Date().getFullYear() // Current season
                    },
                    headers: { 'x-apisports-key': API_SPORTS_KEY },
                    httpsAgent,
                    timeout: 10000
                }).then(r => ({ type: 'league', id: leagueId, data: r.data }))
                  .catch(() => ({ type: 'league', id: leagueId, data: { response: [] } }))
            );

            const settled = await Promise.allSettled(requests);
            const fixtures = [];

            for (const s of settled) {
                if (s.status === 'fulfilled') {
                    const payload = s.value;
                    if (payload?.data?.response?.length) {
                        fixtures.push(...payload.data.response);
                    }
                }
            }

            // Transform matches to our format
            const transformed = await this.transformMatches(fixtures);
            
            // Filter out matches that are in progress or completed
            return transformed.filter(match => !shouldFilterMatch(match));

        } catch (error) {
            console.error(`❌ Error searching matches for ${date}:`, error);
            return [];
        }
    }

    /**
     * Transform API matches to our format
     */
    async transformMatches(fixtures) {
        const transformedMatches = [];

        for (const match of fixtures) {
            try {
                const venue = match.fixture?.venue;
                let venueInfo = null;
                
                if (venue?.id) {
                    // Try to get venue coordinates from local database
                    const localVenue = await venueService.getVenueByApiId(venue.id);
                    if (localVenue) {
                        venueInfo = {
                            id: venue.id,
                            name: localVenue.name,
                            city: localVenue.city,
                            country: localVenue.country,
                            coordinates: localVenue.coordinates || localVenue.location?.coordinates
                        };
                    } else {
                        venueInfo = {
                            id: venue.id,
                            name: venue.name,
                            city: venue.city,
                            country: match.league?.country,
                            coordinates: null
                        };
                    }
                }

                if (!venueInfo) {
                    venueInfo = {
                        id: venue?.id || null,
                        name: venue?.name || 'Unknown Venue',
                        city: venue?.city || 'Unknown City',
                        country: match.league?.country || 'Unknown Country',
                        coordinates: null
                    };
                }

                const transformed = {
                    id: match.fixture.id,
                    fixture: {
                        id: match.fixture.id,
                        date: match.fixture.date,
                        venue: venueInfo,
                        status: match.fixture.status
                    },
                    league: {
                        id: match.league.id,
                        name: match.league.name,
                        country: match.league.country,
                        logo: match.league.logo
                    },
                    teams: {
                        home: { 
                            id: match.teams.home.id, 
                            name: await teamService.mapApiNameToTeam(match.teams.home.name), 
                            logo: match.teams.home.logo 
                        },
                        away: { 
                            id: match.teams.away.id, 
                            name: await teamService.mapApiNameToTeam(match.teams.away.name), 
                            logo: match.teams.away.logo 
                        }
                    }
                };

                transformedMatches.push(transformed);

            } catch (error) {
                console.error('❌ Error transforming match:', error);
                continue;
            }
        }

        return transformedMatches;
    }

    /**
     * Filter matches by proximity to saved venues
     */
    async filterMatchesByProximity(matches, savedVenues, radiusMiles) {
        const nearbyMatches = [];

        for (const match of matches) {
            if (!match.fixture.venue.coordinates) {
                continue; // Skip matches without coordinates
            }

            const matchCoords = match.fixture.venue.coordinates;
            let isNearby = false;
            let closestVenue = null;
            let closestDistance = Infinity;

            for (const savedVenue of savedVenues) {
                if (!savedVenue.coordinates) {
                    continue;
                }

                const distance = this.calculateDistance(
                    matchCoords[1], matchCoords[0], // lat, lng
                    savedVenue.coordinates[1], savedVenue.coordinates[0]
                );

                if (distance <= radiusMiles) {
                    isNearby = true;
                    if (distance < closestDistance) {
                        closestDistance = distance;
                        closestVenue = savedVenue;
                    }
                }
            }

            if (isNearby) {
                match._proximityData = {
                    closestVenue,
                    closestDistance
                };
                nearbyMatches.push(match);
            }
        }

        return nearbyMatches;
    }

    /**
     * Remove matches that conflict with existing trip matches
     */
    removeConflicts(matches, trip) {
        return matches.filter(match => {
            const matchDate = new Date(match.fixture.date);
            const matchTime = matchDate.getTime();

            // Check against existing trip matches
            for (const existingMatch of trip.matches) {
                const existingDate = new Date(existingMatch.date);
                const existingTime = existingDate.getTime();

                // Same date and time (within 3 hours) = conflict
                const timeDiff = Math.abs(matchTime - existingTime);
                const threeHours = 3 * 60 * 60 * 1000; // 3 hours in milliseconds

                if (timeDiff < threeHours) {
                    return false; // Conflict found
                }
            }

            return true; // No conflict
        });
    }

    /**
     * Get list of dismissed match IDs for a specific trip (for diagnostics)
     */
    getDismissedMatchIdsForTrip(user, tripId) {
        const dismissedMatchIds = new Set();
        
        if (!user || !user.recommendationHistory || user.recommendationHistory.length === 0) {
            return dismissedMatchIds;
        }

        if (!tripId || tripId === 'undefined' || tripId === 'null') {
            return dismissedMatchIds;
        }

        const tripIdStr = String(tripId).trim();
        
        for (const entry of user.recommendationHistory) {
            if (
                entry.action === 'dismissed' &&
                entry.tripId &&
                entry.matchId
            ) {
                const entryTripIdStr = String(entry.tripId).trim();
                if (entryTripIdStr === tripIdStr) {
                    dismissedMatchIds.add(String(entry.matchId));
                }
            }
        }

        return dismissedMatchIds;
    }

    /**
     * Filter out matches that have been dismissed for a specific trip
     * Dismissals are permanent per trip (not time-limited, not global)
     */
    filterDismissedRecommendations(matches, user, tripId) {
        // Early return if no matches to filter
        if (!matches || matches.length === 0) {
            console.log('⚠️ filterDismissedRecommendations: No matches provided, returning empty array');
            return matches || [];
        }

        // Early return if no user or no recommendation history
        if (!user || !user.recommendationHistory || user.recommendationHistory.length === 0) {
            console.log(`✅ filterDismissedRecommendations: No recommendation history, returning all ${matches.length} matches`);
            return matches; // No history, return all matches
        }

        // Early return if no tripId
        if (!tripId || tripId === 'undefined' || tripId === 'null') {
            console.log(`⚠️ filterDismissedRecommendations: Invalid tripId (${tripId}), returning all ${matches.length} matches`);
            return matches; // No tripId, can't filter
        }

        // Get dismissed matchIds for this specific trip
        const dismissedMatchIds = new Set();
        const tripIdStr = String(tripId).trim();
        console.log(`🔍 Checking recommendation history for tripId: ${tripIdStr} (${user.recommendationHistory.length} total history entries)`);
        
        for (const entry of user.recommendationHistory) {
            if (
                entry.action === 'dismissed' &&
                entry.tripId &&
                entry.matchId
            ) {
                const entryTripIdStr = String(entry.tripId).trim();
                // Compare tripIds (handle both ObjectId and string formats)
                if (entryTripIdStr === tripIdStr) {
                    dismissedMatchIds.add(String(entry.matchId));
                    console.log(`  → Found dismissed match ${entry.matchId} for trip ${tripIdStr}`);
                }
            }
        }

        if (dismissedMatchIds.size === 0) {
            console.log(`✅ No dismissed matches found for trip ${tripIdStr}, returning all ${matches.length} matches`);
            return matches; // No dismissals for this trip
        }

        console.log(`🚫 Found ${dismissedMatchIds.size} dismissed matchIds for trip ${tripIdStr}:`, Array.from(dismissedMatchIds));

        // Filter out dismissed matches
        const filtered = matches.filter(match => {
            const matchId = String(match.id || match.fixture?.id);
            const isDismissed = dismissedMatchIds.has(matchId);
            
            if (isDismissed) {
                console.log(`🚫 Filtering out dismissed match ${matchId} for trip ${tripIdStr}`);
            }
            
            return !isDismissed;
        });

        console.log(`🚫 Filtered ${matches.length - filtered.length} dismissed matches for trip ${tripIdStr} (${filtered.length} remaining out of ${matches.length} original)`);
        return filtered;
    }

    /**
     * Score a match based on various factors including user preferences
     */
    scoreMatch(match, savedVenues, targetDate, trip, userPreferences = {}) {
        let score = weights.baseScore.default;

        // Proximity score (0-40 points)
        if (match._proximityData) {
            const distance = match._proximityData.closestDistance;
            if (distance <= 10) score += weights.context.proximity.within10miles;
            else if (distance <= 25) score += weights.context.proximity.within25miles;
            else if (distance <= 50) score += weights.context.proximity.within50miles;
            else if (distance <= 100) score += weights.context.proximity.within100miles;
            else if (distance <= 200) score += weights.context.proximity.within200miles;
            else score += weights.context.proximity.beyond;
        }

        // Temporal score (0-30 points)
        const matchDate = new Date(match.fixture.date);
        const targetDateObj = new Date(targetDate);
        const dayDiff = Math.abs((matchDate - targetDateObj) / (1000 * 60 * 60 * 24));
        
        if (dayDiff === 0) score += weights.context.temporal.exactDate;
        else if (dayDiff === 1) score += weights.context.temporal.within1day;
        else if (dayDiff === 2) score += weights.context.temporal.within2days;
        else score += weights.context.temporal.beyond;

        // League quality score (0-20 points)
        const leagueId = String(match.league.id);
        if (weights.topLeagues.tier1.includes(leagueId)) {
            score += weights.context.leagueQuality.topTier;
        } else if (weights.topLeagues.tier2.includes(leagueId)) {
            score += weights.context.leagueQuality.secondTier;
        } else {
            score += weights.context.leagueQuality.other;
        }

        // Preference-based scoring
        const strengthMult = weights.preferenceStrength[userPreferences.preferenceStrength || 'standard'];

        // Favorite Teams scoring
        if (userPreferences.favoriteTeams && userPreferences.favoriteTeams.length > 0) {
            const homeTeamId = String(match.teams?.home?.id);
            const awayTeamId = String(match.teams?.away?.id);
            
            for (const favTeam of userPreferences.favoriteTeams) {
                // Handle both populated and unpopulated team references
                const favTeamId = favTeam.teamId?.apiId || favTeam.apiId || String(favTeam.teamId);
                if (homeTeamId === favTeamId || awayTeamId === favTeamId) {
                    score += weights.preferences.favoriteTeam.playing * strengthMult.favoriteTeam;
                    break; // Only count once per match
                }
            }
        }

        // Favorite Leagues scoring
        if (userPreferences.favoriteLeagues && userPreferences.favoriteLeagues.length > 0) {
            const matchLeagueId = String(match.league?.id);
            if (userPreferences.favoriteLeagues.includes(matchLeagueId)) {
                let leagueBoost = weights.preferences.favoriteLeague.directMatch * strengthMult.favoriteLeague;
                // Add tier bonus if applicable
                if (weights.topLeagues.tier1.includes(matchLeagueId)) {
                    leagueBoost += weights.preferences.favoriteLeague.tier.tier1 * strengthMult.favoriteLeague;
                }
                score += leagueBoost;
            }
        }

        // Favorite Venues scoring
        if (userPreferences.favoriteVenues && userPreferences.favoriteVenues.length > 0 && match.fixture?.venue?.id) {
            const matchVenueId = String(match.fixture.venue.id);
            for (const favVenue of userPreferences.favoriteVenues) {
                const favVenueId = String(favVenue.venueId);
                if (matchVenueId === favVenueId) {
                    score += weights.preferences.favoriteVenue.directMatch * strengthMult.favoriteVenue;
                    break;
                }
            }
        }

        return score;
    }

    /**
     * Generate alternative dates for a match
     */
    generateAlternativeDates(match, targetDate, tripDates) {
        const alternatives = [];
        const matchDate = new Date(match.fixture.date);
        const targetDateObj = new Date(targetDate);

        // Find matches on nearby dates (±1, ±2 days)
        for (let i = -2; i <= 2; i++) {
            if (i === 0) continue; // Skip the original date

            const altDate = new Date(targetDateObj);
            altDate.setDate(altDate.getDate() + i);

            // Check if alternative date is within trip range
            if (altDate >= tripDates.start && altDate <= tripDates.end) {
                alternatives.push(altDate.toISOString().split('T')[0]);
            }
        }

        return alternatives.slice(0, 2); // Return max 2 alternatives
    }

    /**
     * Generate recommendation reason text
     */
    generateRecommendationReason(match, savedVenues) {
        if (match._proximityData) {
            const closestVenue = match._proximityData.closestVenue;
            const distance = Math.round(match._proximityData.closestDistance);
            return `Near your ${closestVenue.name} match (${distance} miles away)`;
        }
        return 'Recommended match in your trip area';
    }

    /**
     * Calculate proximity text
     */
    calculateProximityText(match, savedVenues) {
        if (match._proximityData) {
            const distance = Math.round(match._proximityData.closestDistance);
            return `${distance} miles from ${match._proximityData.closestVenue.name}`;
        }
        return 'In your trip area';
    }

    // Helper methods

    getTripDateRange(trip) {
        // First, check if trip has explicit startDate and endDate
        if (trip.startDate && trip.endDate) {
            const start = new Date(trip.startDate);
            const end = new Date(trip.endDate);
            
            // Validate dates
            if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
                console.log(`📅 Using trip startDate/endDate: ${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`);
                return { start, end };
            }
        }

        // Fall back to calculating from matches if no explicit dates
        if (!trip.matches || trip.matches.length === 0) {
            console.log('⚠️ No trip dates and no matches - cannot determine date range');
            return { start: null, end: null };
        }

        const dates = trip.matches.map(match => new Date(match.date)).filter(d => !isNaN(d.getTime()));
        if (dates.length === 0) {
            console.log('⚠️ No valid match dates found');
            return { start: null, end: null };
        }

        const calculatedStart = new Date(Math.min(...dates));
        const calculatedEnd = new Date(Math.max(...dates));
        console.log(`📅 Calculated date range from matches: ${calculatedStart.toISOString().split('T')[0]} to ${calculatedEnd.toISOString().split('T')[0]}`);
        
        return {
            start: calculatedStart,
            end: calculatedEnd
        };
    }

    getDaysWithoutMatches(trip, tripDates) {
        const daysWithMatches = new Set();
        
        trip.matches.forEach(match => {
            const date = new Date(match.date).toISOString().split('T')[0];
            daysWithMatches.add(date);
        });

        const daysWithoutMatches = [];
        const current = new Date(tripDates.start);
        const end = new Date(tripDates.end);

        while (current <= end) {
            const dateStr = current.toISOString().split('T')[0];
            if (!daysWithMatches.has(dateStr)) {
                daysWithoutMatches.push(dateStr);
            }
            current.setDate(current.getDate() + 1);
        }

        return daysWithoutMatches;
    }

    async extractVenuesFromTrip(trip) {
        const venues = [];
        
        for (const match of trip.matches) {
            if (match.venueData && match.venueData.coordinates) {
                // Venue already has coordinates
                venues.push({
                    name: match.venue,
                    coordinates: match.venueData.coordinates,
                    city: match.venueData.city,
                    country: match.venueData.country
                });
            } else if (match.venueData && match.venueData.name && match.venueData.city) {
                // Try to geocode the venue
                try {
                    const geocodingService = require('./geocodingService');
                    const coordinates = await geocodingService.geocodeVenueCoordinates(
                        match.venueData.name,
                        match.venueData.city,
                        match.venueData.country
                    );
                    
                    if (coordinates) {
                        venues.push({
                            name: match.venue,
                            coordinates: coordinates,
                            city: match.venueData.city,
                            country: match.venueData.country
                        });
                        console.log(`✅ Geocoded venue for recommendations: ${match.venue} at [${coordinates[0]}, ${coordinates[1]}]`);
                    } else {
                        console.log(`⚠️ Could not geocode venue for recommendations: ${match.venue}`);
                    }
                } catch (error) {
                    console.error(`❌ Error geocoding venue ${match.venue}:`, error);
                }
            } else {
                console.log(`⚠️ Match ${match.matchId} has insufficient venue data for recommendations`);
            }
        }

        return venues;
    }

    getSearchDates(day, tripDates) {
        const searchDates = [day];
        const dayObj = new Date(day);

        // Add ±1 day for flexibility
        for (let i = -1; i <= 1; i++) {
            if (i === 0) continue;
            
            const altDate = new Date(dayObj);
            altDate.setDate(altDate.getDate() + i);
            
            // Only include if within trip range
            if (altDate >= tripDates.start && altDate <= tripDates.end) {
                searchDates.push(altDate.toISOString().split('T')[0]);
            }
        }

        return searchDates;
    }

    async getAllAccessibleLeagues(restrictedLeagues) {
        // This would typically come from a database or configuration
        // For now, return common league IDs, excluding restricted ones
        const allLeagues = [
            '39', // Premier League
            '40', // Championship
            '41', // League One
            '140', // La Liga
            '135', // Serie A
            '61', // Ligue 1
            '78', // Bundesliga
            '88', // Eredivisie
            '94', // Primeira Liga
            '97', // Taca da Liga
            '203', // Süper Lig
            '113', // Belgian Pro League
            '144', // Jupiler Pro League
        ];

        return allLeagues.filter(leagueId => !restrictedLeagues.includes(leagueId));
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return this.earthRadiusMiles * c;
    }

    // Cache methods
    generateCacheKey(tripId, user, trip) {
        // Create a cache key based on trip ID, user subscription, and trip content
        const userKey = `${user._id}-${user.subscription?.tier || 'freemium'}-${user.preferences?.recommendationRadius || this.defaultRadius}`;
        const tripKey = `${tripId}-${trip.matches?.length || 0}-${JSON.stringify(trip.matches?.map(m => m.id).sort())}`;
        return `recommendations:${userKey}:${tripKey}`;
    }

    getFromCache(key) {
        const cached = this.cache.get(key);
        if (!cached) {
            return null;
        }

        // Check if cache has expired (use custom expiry if set, otherwise default)
        const expiry = cached.expiry || this.cacheExpiry;
        if (Date.now() - cached.timestamp > expiry) {
            console.log(`⏰ Cache expired for key: ${key} (age: ${Math.round((Date.now() - cached.timestamp) / 1000 / 60)} minutes)`);
            this.cache.delete(key);
            return null;
        }

        return cached.data;
    }

    setCache(key, data, customExpiry = null) {
        const expiry = customExpiry || this.cacheExpiry;
        this.cache.set(key, {
            data: data,
            timestamp: Date.now(),
            expiry: expiry
        });

        // Clean up old cache entries periodically
        this.cleanupCache();
    }

    cleanupCache() {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            const expiry = value.expiry || this.cacheExpiry;
            if (now - value.timestamp > expiry) {
                this.cache.delete(key);
            }
        }
    }

    // Method to invalidate cache for a specific trip
    invalidateTripCache(tripId) {
        for (const key of this.cache.keys()) {
            if (key.includes(`:${tripId}-`)) {
                this.cache.delete(key);
            }
        }
    }

    // Method to invalidate cache for a specific user
    invalidateUserCache(userId) {
        for (const key of this.cache.keys()) {
            if (key.includes(`:${userId}-`)) {
                this.cache.delete(key);
            }
        }
    }
}

module.exports = new RecommendationService();
