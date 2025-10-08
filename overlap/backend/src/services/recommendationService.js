const axios = require('axios');
const https = require('https');
const subscriptionService = require('./subscriptionService');
const venueService = require('./venueService');
const teamService = require('./teamService');

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
     * @returns {Array} Array of recommendations
     */
    async getRecommendationsForTrip(tripId, user, trip) {
        try {
            console.log(`🎯 Generating recommendations for trip: ${tripId}`);
            
            // Check cache first
            const cacheKey = this.generateCacheKey(tripId, user, trip);
            const cachedResult = this.getFromCache(cacheKey);
            if (cachedResult) {
                console.log(`⚡ Returning cached recommendations for trip: ${tripId}`);
                return {
                    recommendations: cachedResult,
                    cached: true
                };
            }
            
            // Get trip date range
            const tripDates = this.getTripDateRange(trip);
            if (!tripDates.start || !tripDates.end) {
                console.log('❌ Invalid trip dates');
                return {
                    recommendations: [],
                    cached: false
                };
            }

            // Get days without matches
            const daysWithoutMatches = this.getDaysWithoutMatches(trip, tripDates);
            if (daysWithoutMatches.length === 0) {
                console.log('✅ Trip already has matches for all days');
                return {
                    recommendations: [],
                    cached: false
                };
            }

            // Get saved match venues for proximity search
            const savedMatchVenues = await this.extractVenuesFromTrip(trip);
            if (savedMatchVenues.length === 0) {
                console.log('❌ No saved matches with coordinates to base recommendations on');
                return {
                    recommendations: [],
                    cached: false
                };
            }

            // Get user's subscription tier for league filtering
            const subscriptionTier = user.subscription?.tier || 'freemium';
            const restrictedLeagues = subscriptionService.getRestrictedLeagues(subscriptionTier);
            
            // Get user's recommendation radius preference
            const userRadius = user.preferences?.recommendationRadius || this.defaultRadius;

            // Generate recommendations for each day without matches
            const recommendations = [];
            for (const day of daysWithoutMatches) {
                const recommendation = await this.generateRecommendationForDay(
                    day,
                    savedMatchVenues,
                    tripDates,
                    restrictedLeagues,
                    trip,
                    userRadius
                );
                
                if (recommendation) {
                    recommendations.push(recommendation);
                }
            }

            // Cache the results
            this.setCache(cacheKey, recommendations);
            
            console.log(`✅ Generated ${recommendations.length} recommendations`);
            return {
                recommendations,
                cached: false
            };

        } catch (error) {
            console.error('❌ Error generating recommendations:', error);
            return {
                recommendations: [],
                cached: false
            };
        }
    }

    /**
     * Generate a recommendation for a specific day
     */
    async generateRecommendationForDay(day, savedMatchVenues, tripDates, restrictedLeagues, trip, userRadius) {
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
                return null;
            }

            // Filter matches by proximity to saved venues
            const nearbyMatches = await this.filterMatchesByProximity(
                allMatches, 
                savedMatchVenues, 
                userRadius
            );

            if (nearbyMatches.length === 0) {
                return null;
            }

            // Remove conflicts with existing trip matches
            const conflictFreeMatches = this.removeConflicts(nearbyMatches, trip);

            if (conflictFreeMatches.length === 0) {
                return null;
            }

            // Score and rank matches
            const scoredMatches = conflictFreeMatches.map(match => ({
                match,
                score: this.scoreMatch(match, savedMatchVenues, day, trip)
            }));

            // Sort by score and get the best match
            scoredMatches.sort((a, b) => b.score - a.score);
            const bestMatch = scoredMatches[0];

            if (bestMatch.score < 30) { // Minimum score threshold
                return null;
            }

            // Generate alternative dates
            const alternativeDates = this.generateAlternativeDates(bestMatch.match, day, tripDates);

            return {
                matchId: bestMatch.match.id,
                recommendedForDate: day,
                match: bestMatch.match,
                reason: this.generateRecommendationReason(bestMatch.match, savedMatchVenues),
                proximity: this.calculateProximityText(bestMatch.match, savedMatchVenues),
                score: bestMatch.score,
                alternativeDates: alternativeDates
            };

        } catch (error) {
            console.error(`❌ Error generating recommendation for ${day}:`, error);
            return null;
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
            return await this.transformMatches(fixtures);

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
     * Score a match based on various factors
     */
    scoreMatch(match, savedVenues, targetDate, trip) {
        let score = 0;

        // Proximity score (0-40 points)
        if (match._proximityData) {
            const distance = match._proximityData.closestDistance;
            if (distance <= 10) score += 40;
            else if (distance <= 25) score += 35;
            else if (distance <= 50) score += 30;
            else if (distance <= 100) score += 25;
            else if (distance <= 200) score += 20;
            else score += 15;
        }

        // Temporal score (0-30 points)
        const matchDate = new Date(match.fixture.date);
        const targetDateObj = new Date(targetDate);
        const dayDiff = Math.abs((matchDate - targetDateObj) / (1000 * 60 * 60 * 24));
        
        if (dayDiff === 0) score += 30; // Exact date
        else if (dayDiff === 1) score += 25; // ±1 day
        else if (dayDiff === 2) score += 20; // ±2 days
        else score += 10; // Further away

        // League quality score (0-20 points)
        const leagueId = match.league.id;
        if (['39', '140', '135', '61', '78'].includes(leagueId)) { // Top leagues
            score += 20;
        } else if (['40', '41', '135', '61', '78'].includes(leagueId)) { // Good leagues
            score += 15;
        } else {
            score += 10; // Other leagues
        }

        // Venue popularity score (0-10 points)
        // This could be enhanced with actual venue data
        score += 5; // Base score for now

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
        if (!trip.matches || trip.matches.length === 0) {
            return { start: null, end: null };
        }

        const dates = trip.matches.map(match => new Date(match.date));
        return {
            start: new Date(Math.min(...dates)),
            end: new Date(Math.max(...dates))
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
            '97', // Taca de Portugal
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

        // Check if cache has expired
        if (Date.now() - cached.timestamp > this.cacheExpiry) {
            this.cache.delete(key);
            return null;
        }

        return cached.data;
    }

    setCache(key, data) {
        this.cache.set(key, {
            data: data,
            timestamp: Date.now()
        });

        // Clean up old cache entries periodically
        this.cleanupCache();
    }

    cleanupCache() {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > this.cacheExpiry) {
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
