const express = require('express');
const leagueService = require('../services/leagueService');
const subscriptionService = require('../services/subscriptionService');
const geocodingService = require('../services/geocodingService');
const User = require('../models/User');
const League = require('../models/League');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Helper function to calculate distance between two points in kilometers
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in kilometers
}

// Helper function to detect country from bounds (same as in matches.js)
function detectCountryFromBounds(bounds) {
    const centerLat = (bounds.northeast.lat + bounds.southwest.lat) / 2;
    const centerLng = (bounds.northeast.lng + bounds.southwest.lng) / 2;
    
    // Find the closest country within threshold
    let searchCountry = null;
    let minDistance = Infinity;
    
    const DISTANCE_THRESHOLD = 800;
    const NEARBY_THRESHOLD = 400;
    const nearbyCountries = [];
    
    for (const [countryName, coords] of Object.entries(COUNTRY_COORDS)) {
        const distance = calculateDistance(centerLat, centerLng, coords.lat, coords.lng);
        if (distance < minDistance && distance < DISTANCE_THRESHOLD) {
            minDistance = distance;
            searchCountry = countryName;
        }
        // Track all countries within nearby threshold for border region handling
        if (distance < NEARBY_THRESHOLD) {
            nearbyCountries.push({ country: countryName, distance });
        }
    }
    
    // Sort nearby countries by distance
    nearbyCountries.sort((a, b) => a.distance - b.distance);
    
    // If no country found, use regional fallback
    if (!searchCountry) {
        if (centerLat > 35 && centerLat < 71 && centerLng > -10 && centerLng < 40) {
            searchCountry = 'Europe-Region';
        } else if (centerLat > -55 && centerLat < 75 && centerLng > -170 && centerLng < -30) {
            searchCountry = 'Americas-Region';
        } else if (centerLat > -50 && centerLat < 75 && centerLng > 60 && centerLng < 180) {
            searchCountry = 'AsiaPacific-Region';
        } else if (centerLat > -40 && centerLat < 40 && centerLng > -25 && centerLng < 60) {
            searchCountry = 'Africa-Region';
        } else {
            const roundedLat = Math.round(centerLat);
            const roundedLng = Math.round(centerLng);
            searchCountry = `Remote-${roundedLat}-${roundedLng}`;
        }
    }
    
    return {
        country: searchCountry,
        centerLat,
        centerLng,
        distance: minDistance === Infinity ? null : minDistance,
        nearbyCountries: nearbyCountries.map(c => c.country)
    };
}

// Country coordinate mapping (approximate country centers for geographic filtering)
const COUNTRY_COORDS = {
    'England': { lat: 52.3555, lng: -1.1743 },
    'Spain': { lat: 40.4637, lng: -3.7492 },
    'Germany': { lat: 51.1657, lng: 10.4515 },
    'France': { lat: 46.6034, lng: 1.8883 },
    'Italy': { lat: 41.8719, lng: 12.5674 },
    'Portugal': { lat: 39.3999, lng: -8.2245 },
    'Netherlands': { lat: 52.1326, lng: 5.2913 },
    'Belgium': { lat: 50.5039, lng: 4.4699 },
    'Austria': { lat: 47.5162, lng: 14.5501 },
    'Croatia': { lat: 45.1000, lng: 15.2000 },
    'Turkey': { lat: 38.9637, lng: 35.2433 },
    'Saudi Arabia': { lat: 23.8859, lng: 45.0792 },
    'USA': { lat: 39.8283, lng: -98.5795 },
    'Brazil': { lat: -14.2350, lng: -51.9253 },
    'Mexico': { lat: 23.6345, lng: -102.5528 },
    'Scotland': { lat: 56.4907, lng: -4.2026 },
    'Switzerland': { lat: 46.8182, lng: 8.2275 },
    'Finland': { lat: 64.0, lng: 26.0 }
};

/**
 * GET /api/leagues/all
 * Get all active leagues in database (for visibility/debugging - not filtered by subscription
 */
router.get('/all', async (req, res) => {
    try {
        const allLeagues = await League.find({ isActive: true })
            .sort({ country: 1, tier: 1, name: 1 })
            .lean();
        
        // Group by country for easier reading
        const leaguesByCountry = {};
        for (const league of allLeagues) {
            const country = league.country || 'Unknown';
            if (!leaguesByCountry[country]) {
                leaguesByCountry[country] = [];
            }
            leaguesByCountry[country].push({
                id: league.apiId,
                name: league.name,
                tier: league.tier || 1,
                country: league.country,
                countryCode: league.countryCode
            });
        }
        
        res.json({
            success: true,
            totalLeagues: allLeagues.length,
            leaguesByCountry,
            allLeagues: allLeagues.map(l => ({
                id: l.apiId,
                name: l.name,
                tier: l.tier || 1,
                country: l.country,
                countryCode: l.countryCode
            }))
        });
    } catch (error) {
        console.error('Error fetching all leagues:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch all leagues',
            error: error.message
        });
    }
});

/**
 * GET /api/leagues
 * Get all active leagues (filtered by subscription)
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        // Get user from token (optional - if no token, default to freemium)
        let user = null;
        if (req.user) {
            user = await User.findById(req.user.id);
        }
        
        const leagues = await leagueService.getAllLeagues();
        
        // Filter leagues based on subscription
        const accessibleLeagueIds = await subscriptionService.getAccessibleLeagues(user);
        const filteredLeagues = leagues.filter(league => 
            accessibleLeagueIds.includes(league.apiId)
        );
        
        // Format for frontend consumption
        const formattedLeagues = filteredLeagues.map(league => ({
            id: league.apiId,
            name: league.name,
            tier: league.tier || 1,
            country: league.country,
            countryCode: league.countryCode,
            subscriptionRequired: !subscriptionService.hasLeagueAccess(user, league.apiId)
        }));

        res.json({
            success: true,
            data: formattedLeagues,
            userTier: user?.subscription?.tier || 'freemium'
        });
    } catch (error) {
        console.error('Error fetching leagues:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch leagues',
            error: error.message
        });
    }
});

// Cache for relevant leagues (5 minute TTL)
const relevantLeaguesCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * GET /api/leagues/relevant
 * Get relevant leagues based on geographic bounds (for location-based searches)
 * Filters leagues by proximity to search area and includes international competitions
 * Cached for 5 minutes to improve performance
 */
router.get('/relevant', async (req, res) => {
    try {
        const { neLat, neLng, swLat, swLng } = req.query;
        
        // Create cache key from bounds
        const cacheKey = (neLat && neLng && swLat && swLng) 
            ? `relevant_${neLat}_${neLng}_${swLat}_${swLng}` 
            : 'relevant_all';
        
        // Check cache
        const cached = relevantLeaguesCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            console.log('📦 Returning cached relevant leagues');
            return res.json(cached.data);
        }
        
        if (!neLat || !neLng || !swLat || !swLng) {
            // If no bounds provided, return all active leagues
            const allLeagues = await League.find({ isActive: true }).lean();
            const response = {
                success: true,
                leagues: allLeagues.map(l => ({
                    id: parseInt(l.apiId),
                    name: l.name,
                    country: l.country,
                    apiId: l.apiId
                }))
            };
            
            // Cache the response
            relevantLeaguesCache.set(cacheKey, {
                data: response,
                timestamp: Date.now()
            });
            
            return res.json(response);
        }

        const bounds = {
            northeast: { lat: parseFloat(neLat), lng: parseFloat(neLng) },
            southwest: { lat: parseFloat(swLat), lng: parseFloat(swLng) }
        };

        // Calculate center point of search bounds
        const centerLat = (bounds.northeast.lat + bounds.southwest.lat) / 2;
        const centerLng = (bounds.northeast.lng + bounds.southwest.lng) / 2;

        // Get all active leagues from MongoDB
        const allLeagues = await League.find({ isActive: true }).lean();

        // Detect country from bounds (uses COUNTRY_COORDS for detection, but we'll match by name)
        const countryDetection = detectCountryFromBounds(bounds);
        const detectedCountry = countryDetection.country;
        const nearbyCountries = countryDetection.nearbyCountries || [];

        // Cache for reverse geocoded country (to avoid repeated API calls)
        let reverseGeocodedCountry = null;
        let reverseGeocodeAttempted = false;

        const relevantLeagues = [];

        for (const league of allLeagues) {
            let shouldInclude = false;

            // Always include international competitions
            if (league.country === 'International' || league.country === 'Europe' || 
                league.name.includes('Champions League') || league.name.includes('Europa') ||
                league.name.includes('World Cup') || league.name.includes('European Championship') ||
                league.name.includes('Nations League') || league.name.includes('Friendlies')) {
                shouldInclude = true;
            } else {
                // PRIMARY METHOD: Country name matching (fastest and most accurate)
                // Match league country to detected country or nearby countries
                if (league.country === detectedCountry || nearbyCountries.includes(league.country)) {
                    shouldInclude = true;
                } else {
                    // FALLBACK METHOD: Reverse geocoding for countries not in hardcoded list
                    // Only attempt once per function call and cache the result
                    if (!reverseGeocodeAttempted && detectedCountry && !COUNTRY_COORDS[detectedCountry]) {
                        reverseGeocodeAttempted = true;
                        try {
                            reverseGeocodedCountry = await geocodingService.reverseGeocodeCountry(centerLat, centerLng);
                            if (reverseGeocodedCountry && league.country === reverseGeocodedCountry) {
                                shouldInclude = true;
                            }
                        } catch (error) {
                            console.log(`⚠️ Reverse geocoding failed: ${error.message}`);
                        }
                    } else if (reverseGeocodedCountry && league.country === reverseGeocodedCountry) {
                        // Use cached reverse geocoded country
                        shouldInclude = true;
                    } else {
                        // LAST RESORT: Distance calculation for edge cases
                        // Only use this if country name doesn't match and reverse geocoding failed
                        const countryCoords = COUNTRY_COORDS[league.country];
                        
                        if (countryCoords) {
                            // Calculate distance from search center to country center
                            const distance = calculateDistance(
                                centerLat, centerLng,
                                countryCoords.lat, countryCoords.lng
                            );

                            // Smart distance thresholds based on region
                            const isInEurope = centerLat > 35 && centerLat < 71 && centerLng > -10 && centerLng < 40;
                            const isInNorthAmerica = centerLat > 20 && centerLat < 75 && centerLng > -170 && centerLng < -50;
                            const isInSouthAmerica = centerLat > -55 && centerLat < 15 && centerLng > -85 && centerLng < -30;

                            let maxDistance;
                            if (isInEurope) {
                                maxDistance = 2500; // Europe is densely packed
                            } else if (isInNorthAmerica || isInSouthAmerica) {
                                maxDistance = 3000; // Large countries, be more inclusive
                            } else {
                                maxDistance = 2000; // Default
                            }

                            if (distance <= maxDistance) {
                                shouldInclude = true;
                            }
                        }
                    }
                }
            }

            if (shouldInclude) {
                relevantLeagues.push({
                    id: parseInt(league.apiId),
                    name: league.name,
                    country: league.country,
                    apiId: league.apiId
                });
            }
        }

        // Fallback: if no relevant leagues found, include top European leagues plus international
        let response;
        if (relevantLeagues.length === 0) {
            // Fallback to popular leagues from database (top tier leagues)
            const fallbackLeagues = await League.find({ 
                isActive: true,
                tier: 1
            })
            .sort({ country: 1, name: 1 })
            .limit(8)
            .lean();
            
            response = {
                success: true,
                leagues: fallbackLeagues.map(l => ({
                    id: parseInt(l.apiId),
                    name: l.name,
                    country: l.country,
                    apiId: l.apiId
                }))
            };
        } else {
            response = {
                success: true,
                leagues: relevantLeagues
            };
        }

        // Cache the response
        relevantLeaguesCache.set(cacheKey, {
            data: response,
            timestamp: Date.now()
        });

        res.json(response);

    } catch (error) {
        console.error('Error fetching relevant leagues:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch relevant leagues',
            error: error.message
        });
    }
});

/**
 * GET /api/leagues/search
 * Search leagues by name or country
 * Returns results from database first, then falls back to API if needed
 */
router.get('/search', async (req, res) => {
    try {
        const { query } = req.query;
        
        if (!query || query.length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Search query must be at least 2 characters'
            });
        }

        // Search in database using leagueService
        const leagues = await leagueService.searchLeagues(query, { limit: 20 });

        // Format results for response
        const formattedLeagues = leagues.map(league => ({
            id: league.apiId,
            name: league.name,
            country: league.country,
            countryCode: league.countryCode,
            tier: league.tier || 1,
            emblem: league.emblem || null,
            isActive: league.isActive !== false
        }));

        res.json({
            success: true,
            results: formattedLeagues,
            count: formattedLeagues.length
        });

    } catch (error) {
        console.error('League search error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to search leagues'
        });
    }
});

/**
 * GET /api/leagues/stats/cache
 * Get league service cache statistics
 */
router.get('/stats/cache', async (req, res) => {
    try {
        const stats = leagueService.getCacheStats();
        res.json({
            success: true,
            cacheStats: stats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting league cache stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get cache statistics',
            error: error.message
        });
    }
});

/**
 * GET /api/leagues/country/:countryCode
 * Get leagues for a specific country
 */
router.get('/country/:countryCode', async (req, res) => {
    try {
        const { countryCode } = req.params;
        const leagues = await leagueService.getLeaguesForCountry(countryCode);
        
        // Format for frontend consumption
        const formattedLeagues = leagues.map(league => ({
            id: league.apiId,
            name: league.name,
            tier: league.tier || 1,
            country: league.country,
            countryCode: league.countryCode
        }));

        res.json({
            success: true,
            data: formattedLeagues
        });
    } catch (error) {
        console.error(`Error fetching leagues for country ${req.params.countryCode}:`, error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch leagues for country',
            error: error.message
        });
    }
});

/**
 * GET /api/leagues/:leagueId
 * Get specific league information
 */
router.get('/:leagueId', async (req, res) => {
    try {
        const { leagueId } = req.params;
        const league = await leagueService.getLeagueById(leagueId);
        
        if (!league) {
            return res.status(404).json({
                success: false,
                message: 'League not found'
            });
        }

        // Format for frontend consumption
        const formattedLeague = {
            id: league.apiId,
            name: league.name,
            tier: league.tier || 1,
            country: league.country,
            countryCode: league.countryCode,
            emblem: league.emblem
        };

        res.json({
            success: true,
            data: formattedLeague
        });
    } catch (error) {
        console.error(`Error fetching league ${req.params.leagueId}:`, error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch league',
            error: error.message
        });
    }
});

module.exports = router; 