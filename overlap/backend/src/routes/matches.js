const express = require('express');
const axios = require('axios');
const https = require('https');
const venueService = require('../services/venueService');
const leagueService = require('../services/leagueService');
const teamService = require('../services/teamService');
const subscriptionService = require('../services/subscriptionService');
const geocodingService = require('../services/geocodingService');
const recommendationService = require('../services/recommendationService');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();
const Team = require('../models/Team');
const League = require('../models/League');
const { matchesCache, popularMatchesCache } = require('../utils/cache');
const { shouldFilterMatch } = require('../utils/matchStatus');

// Create HTTPS agent with SSL certificate check disabled (for development only)
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

// API-Sports configuration
const API_SPORTS_KEY = process.env.API_SPORTS_KEY || '0ab95ca9f7baeb6fd551af7ca41ed8d2';
const API_SPORTS_BASE_URL = 'https://v3.football.api-sports.io';

// Cache for venue data to avoid repeated API calls
const venueCache = new Map();

// Function to fetch venue data from API-Football
async function getVenueFromApiFootball(venueId) {
    if (!venueId) {
        return null;
    }
    // Check cache first
    if (venueCache.has(venueId)) {
        return venueCache.get(venueId);
    }
    try {
        const response = await axios.get(`${API_SPORTS_BASE_URL}/venues`, {
            params: { id: venueId },
            headers: { 'x-apisports-key': API_SPORTS_KEY },
            httpsAgent,
            timeout: 3000
        });
        if (response.data && response.data.response && response.data.response.length > 0) {
            const venueData = response.data.response[0];
            venueCache.set(venueId, venueData);
            console.log(`✅ Fetched venue: ${venueData.name} (ID: ${venueId}) - Image: ${venueData.image ? 'Yes' : 'No'}`);
            return venueData;
        }
        return null;
    } catch (error) {
        console.log(`❌ Failed to fetch venue ${venueId}: ${error.message}`);
        return null;
    }
}

// Function to transform API-Sports data to match frontend expectations
async function transformApiSportsData(apiResponse, competitionId, bounds = null, searchSessionId = 'unknown') {
    const fixtures = apiResponse.response || [];
    const leagueName = await leagueService.getLeagueNameById(competitionId);

    console.log(`🔍 transformApiSportsData: Processing ${fixtures.length} fixtures for league ${competitionId} (${leagueName})`);
    if (fixtures.length > 0) {
        console.log(`🔍 Sample fixture structure:`, {
            fixture: fixtures[0].fixture,
            teams: fixtures[0].teams,
            league: fixtures[0].league,
            venue: fixtures[0].fixture?.venue
        });
    }

    return {
        filters: {},
        resultSet: {
            count: fixtures.length,
            competitions: competitionId.toString(),
            first: fixtures.length > 0 ? fixtures[0].fixture.date.split('T')[0] : null,
            last: fixtures.length > 0 ? fixtures[fixtures.length - 1].fixture.date.split('T')[0] : null
        },
        competition: {
            id: competitionId.toString(),
            name: leagueName,
            code: leagueName.replace(/\s+/g, '').substring(0, 3).toUpperCase(),
            type: 'LEAGUE',
            emblem: fixtures.length > 0 ? fixtures[0].league.logo : null
        },
        response: await (async () => {
            const transformedFixtures = [];

            for (let i = 0; i < fixtures.length; i++) {
                const fx = fixtures[i];
                try {
                    // Resolve venue
                    const venue = await (async () => {
                        const apiVenue = fx.fixture?.venue || {};
                        let apiFootballVenue = null; // Declare outside the if block

                        // Prefer local DB for PL (39)
                        if (parseInt(competitionId) === 39 && apiVenue?.id) {
                            const localVenue = await venueService.getVenueByApiId(apiVenue.id);
                            if (localVenue) {
                                return {
                                    id: apiVenue.id,
                                    name: localVenue.name,
                                    city: localVenue.city,
                                    country: localVenue.country,
                                    coordinates: localVenue.coordinates || localVenue.location?.coordinates,
                                    capacity: localVenue.capacity,
                                    surface: localVenue.surface,
                                    address: localVenue.address,
                                    image: localVenue.image
                                };
                            }
                        }

                        // API venue by ID
                        if (apiVenue?.id) {
                            apiFootballVenue = await getVenueFromApiFootball(apiVenue.id);
                            if (apiFootballVenue) {
                                // Don't return early - let geocoding handle coordinates
                                // Just store the venue data for later processing
                            }
                        }

                        // Look up by name in our DB
                        if (apiVenue?.name) {
                            const byName = await venueService.getVenueByName(apiVenue.name, apiVenue.city);
                            if (byName?.coordinates) {
                                return {
                                    id: apiVenue.id || `venue-${apiVenue.name.replace(/\s+/g, '-').toLowerCase()}`,
                                    name: byName.name,
                                    city: byName.city,
                                    country: byName.country,
                                    coordinates: byName.coordinates
                                };
                            }
                        }

                        // Team venue fallback
                        const mappedHome = await teamService.mapApiNameToTeam(fx.teams.home.name);
                        const team = await Team.findOne({
                            $or: [
                                { name: mappedHome },
                                { name: { $regex: new RegExp(`^${mappedHome}$`, 'i') } },
                                { apiName: mappedHome },
                                { aliases: mappedHome }
                            ]
                        });
                        if (team?.venue?.coordinates) {
                            return {
                                id: `venue-${mappedHome.replace(/\s+/g, '-').toLowerCase()}`,
                                name: team.venue.name,
                                city: team.city || team.venue.city,
                                country: team.country,
                                coordinates: team.venue.coordinates
                            };
                        }
                        if (team) {
                            const venueData = await venueService.getVenueForTeam(mappedHome);
                            if (venueData?.coordinates) {
                                return {
                                    id: `venue-${mappedHome.replace(/\s+/g, '-').toLowerCase()}`,
                                    name: venueData.stadium || venueData.name,
                                    city: venueData.city,
                                    country: venueData.country,
                                    coordinates: venueData.coordinates
                                };
                            }
                        }

                        // Build minimal venue and geocode as last resort
                        const minimal = {
                            id: apiVenue?.id || null,
                            name: apiVenue?.name || null,
                            city: apiVenue?.city || null,
                            country: fx.league?.country || null,
                            coordinates: null,
                            capacity: apiFootballVenue?.capacity || null,
                            surface: apiFootballVenue?.surface || null,
                            address: apiFootballVenue?.address || null,
                            image: apiFootballVenue?.image || null
                        };

                        // Handle Champions League/Europa League fixtures where venue data is in fixture.venue
                        // For European competitions, always check fixture.venue as it's the primary source
                        if (fx.fixture?.venue?.name && (
                            parseInt(competitionId) === 2 || // Champions League
                            parseInt(competitionId) === 3 || // Europa League  
                            parseInt(competitionId) === 848 || // Europa Conference League
                            fx.league?.country === 'World' // Other European competitions
                        )) {
                            minimal.name = fx.fixture.venue.name;
                            minimal.city = fx.fixture.venue.city;
                            // For European competitions, try to infer country from league or use a fallback
                            if (!minimal.country) {
                                minimal.country = fx.league?.country || 'Europe';
                            }
                            console.log(`🏟️ Extracted venue data from fixture.venue for European competition: ${minimal.name}, ${minimal.city}, ${minimal.country}`);
                        }

                        if (!minimal.coordinates && minimal.name && minimal.city) {
                            try {
                                // Try geocoding with venue name + city + country
                                const geocodeQuery = minimal.country ? 
                                    `${minimal.name}, ${minimal.city}, ${minimal.country}` :
                                    `${minimal.name}, ${minimal.city}`;
                                
                                console.log(`🔍 Attempting geocoding for: ${geocodeQuery}`);
                                const coords = await geocodingService.geocodeVenueCoordinates(
                                    minimal.name,
                                    minimal.city,
                                    minimal.country
                                );
                                console.log(`🎯 Geocoding result for ${minimal.name}:`, coords);
                                if (coords) {
                                    // Persist for future
                                    const savedVenue = await venueService.saveVenueWithCoordinates({
                                        venueId: apiVenue?.id || null,
                                        name: minimal.name,
                                        city: minimal.city,
                                        country: minimal.country,
                                        coordinates: coords
                                    });
                                    console.log(`💾 Venue saved to DB:`, savedVenue ? 'success' : 'failed');
                                    minimal.coordinates = coords;
                                }
                            } catch (e) {
                                console.error(`❌ Geocoding error for ${minimal.name}:`, e.message);
                            }
                        }
                        return minimal;
                    })();

                    // Build transformed fixture
                    const transformed = {
                        area: {
                            id: 2072,
                            name: fx.league.country || 'Unknown',
                            code: fx.league.country?.substring(0, 3).toUpperCase() || 'UNK',
                            flag: fx.league.flag || null
                        },
                        competition: {
                            id: competitionId.toString(),
                            name: leagueName,
                            code: leagueName.replace(/\s+/g, '').substring(0, 3).toUpperCase(),
                            type: 'LEAGUE',
                            emblem: fx.league.logo
                        },
                        season: {
                            id: fx.league.season || new Date().getFullYear(),
                            startDate: `${fx.league.season || new Date().getFullYear()}-08-01`,
                            endDate: `${(fx.league.season || new Date().getFullYear()) + 1}-05-31`,
                            currentMatchday: fx.league.round?.match(/\d+/)?.[0] || 1,
                            winner: null
                        },
                        id: fx.fixture.id,
                        utcDate: fx.fixture.date,
                        status: fx.fixture.status.long === 'Match Finished' ? 'FINISHED' :
                               fx.fixture.status.long === 'Not Started' ? 'SCHEDULED' : 'LIVE',
                        matchday: fx.league.round?.match(/\d+/)?.[0] || 1,
                        stage: 'REGULAR_SEASON',
                        group: null,
                        lastUpdated: new Date().toISOString(),
                        fixture: {
                            id: fx.fixture.id,
                            date: fx.fixture.date,
                            venue: venue,
                            status: fx.fixture.status
                        },
                    // Add status at root level for easier access
                    status: fx.fixture.status,
                    
                    // Debug status data
                    _debug: {
                        originalStatus: fx.fixture.status,
                        statusLong: fx.fixture.status?.long,
                        statusShort: fx.fixture.status?.short,
                        statusElapsed: fx.fixture.status?.elapsed
                    },
                        league: {
                            id: competitionId.toString(),
                            name: leagueName
                        },
                        teams: {
                            home: {
                                id: fx.teams.home.id,
                                name: await teamService.mapApiNameToTeam(fx.teams.home.name),
                                logo: fx.teams.home.logo
                            },
                            away: {
                                id: fx.teams.away.id,
                                name: await teamService.mapApiNameToTeam(fx.teams.away.name),
                                logo: fx.teams.away.logo
                            }
                        },
                        score: {
                            winner: fx.goals.home > fx.goals.away ? 'HOME' :
                                    fx.goals.away > fx.goals.home ? 'AWAY' :
                                    fx.goals.home === fx.goals.away && fx.goals.home !== null ? 'DRAW' : null,
                            duration: 'REGULAR',
                            fullTime: { home: fx.goals.home, away: fx.goals.away },
                            halfTime: {
                                home: fx.score?.halftime?.home || null,
                                away: fx.score?.halftime?.away || null
                            }
                        }
                    };

                    // Bounds filtering/push logic
                    const hasCoords = Array.isArray(transformed.fixture.venue.coordinates);
                    if (bounds) {
                        console.log(`📍 [${searchSessionId}] Venue: ${transformed.fixture.venue.name} - coords: ${JSON.stringify(transformed.fixture.venue.coordinates)}`);
                        if (hasCoords && isWithinBounds(transformed.fixture.venue.coordinates, bounds, searchSessionId)) {
                            transformedFixtures.push(transformed);
                            console.log(`✅ [${searchSessionId}] Venue INCLUDED: ${transformed.fixture.venue.name}`);
                        } else {
                            console.log(`🚫 [${searchSessionId}] Venue filtered out: ${transformed.fixture.venue.name} - hasCoords: ${hasCoords}, coords: ${JSON.stringify(transformed.fixture.venue.coordinates)}`);
                        }
                    } else {
                        // No bounds: include even without coordinates so lists still show
                        transformedFixtures.push(transformed);
                    }
                } catch (err) {
                    console.error(`❌ Error processing fixture ${fx.fixture?.id}:`, err);
                }
            }

            console.log(`📊 [${searchSessionId}] Final result: ${transformedFixtures.length} fixtures after bounds filtering`);
            return transformedFixtures;
        })()
    };
}

// Function to check if coordinates are within bounds
function isWithinBounds(coordinates, bounds, searchSessionId = 'unknown') {
    if (!coordinates || !bounds || coordinates.length !== 2) {
        console.log(`🚫 [${searchSessionId}] isWithinBounds failed validation: coords=${JSON.stringify(coordinates)}, bounds=${JSON.stringify(bounds)}`);
        return false;
    }
    const [lon, lat] = coordinates;
    const { northeast, southwest } = bounds;
    const result = lat >= southwest.lat && lat <= northeast.lat &&
           lon >= southwest.lng && lon <= northeast.lng;
    
    console.log(`🔍 [${searchSessionId}] Bounds check: venue coords [${lon}, ${lat}] vs bounds NE[${northeast.lat}, ${northeast.lng}] SW[${southwest.lat}, ${southwest.lng}] = ${result}`);
    
    return result;
}

// Function to calculate distance between two points in miles
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Function to calculate distance in kilometers (for geographic league filtering)
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in kilometers
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

// Helper function to filter leagues by geographic relevance
async function getRelevantLeagueIds(bounds) {
    // Calculate center point of search bounds
    const centerLat = (bounds.northeast.lat + bounds.southwest.lat) / 2;
    const centerLng = (bounds.northeast.lng + bounds.southwest.lng) / 2;

    // Get all active leagues from MongoDB
    const allLeagues = await League.find({ isActive: true }).select('apiId country name').lean();

    // Define regional groupings
    const isInEurope = centerLat > 35 && centerLat < 71 && centerLng > -10 && centerLng < 40;
    const isInNorthAmerica = centerLat > 20 && centerLat < 75 && centerLng > -170 && centerLng < -50;
    const isInSouthAmerica = centerLat > -55 && centerLat < 15 && centerLng > -85 && centerLng < -30;

    const relevantLeagueIds = [];

    for (const league of allLeagues) {
        let shouldInclude = false;

        // Always include international competitions
        if (league.country === 'International' || league.country === 'Europe' || 
            league.name.includes('Champions League') || league.name.includes('Europa') ||
            league.name.includes('World Cup') || league.name.includes('European Championship') ||
            league.name.includes('Nations League') || league.name.includes('Friendlies')) {
            shouldInclude = true;
        } else {
            // Get country coordinates if available
            const countryCoords = COUNTRY_COORDS[league.country];
            
            if (countryCoords) {
                // Calculate distance from search center to country center (in kilometers)
                const distance = calculateDistanceKm(
                    centerLat, centerLng,
                    countryCoords.lat, countryCoords.lng
                );

                // Smart distance thresholds based on region
                // Made more restrictive to avoid including irrelevant leagues (e.g., Serie A for Manchester searches)
                let maxDistance;
                if (isInEurope) {
                    maxDistance = 800; // Europe: more restrictive - only include nearby countries
                } else if (isInNorthAmerica || isInSouthAmerica) {
                    maxDistance = 3000; // Large countries, be more inclusive
                } else {
                    maxDistance = 2000; // Default
                }

                if (distance <= maxDistance) {
                    shouldInclude = true;
                }
            } else {
                // For countries without coordinates, use country matching based on bounds
                const countryMatches = {
                    'England': isInEurope && centerLat > 49 && centerLat < 59 && centerLng > -8 && centerLng < 2,
                    'Spain': isInEurope && centerLat > 35 && centerLat < 44 && centerLng > -10 && centerLng < 5,
                    'Germany': isInEurope && centerLat > 47 && centerLat < 55 && centerLng > 5 && centerLng < 15,
                    'Italy': isInEurope && centerLat > 35 && centerLat < 47 && centerLng > 6 && centerLng < 19,
                    'France': isInEurope && centerLat > 42 && centerLat < 51 && centerLng > -5 && centerLng < 8,
                    'Portugal': isInEurope && centerLat > 36 && centerLat < 42 && centerLng > -10 && centerLng < -6,
                    'Netherlands': isInEurope && centerLat > 50 && centerLat < 54 && centerLng > 3 && centerLng < 8,
                    'USA': isInNorthAmerica && centerLng > -130 && centerLng < -65,
                    'Mexico': isInNorthAmerica && centerLat > 14 && centerLat < 33 && centerLng > -118 && centerLng < -86,
                    'Saudi Arabia': centerLat > 15 && centerLat < 33 && centerLng > 34 && centerLng < 56,
                };

                if (countryMatches[league.country]) {
                    shouldInclude = true;
                }
            }
        }

        if (shouldInclude) {
            const leagueId = parseInt(league.apiId);
            if (!isNaN(leagueId)) {
                relevantLeagueIds.push(leagueId);
            }
        }
    }

    // Fallback: if no relevant leagues found, include top European leagues plus international
    if (relevantLeagueIds.length === 0) {
        const fallbackApiIds = ['39', '140', '78', '135', '61', '62', '2', '3']; // PL, La Liga, Bundesliga, Serie A, Ligue 1, Ligue 2, UCL, UEL
        const fallbackLeagues = await League.find({ 
            apiId: { $in: fallbackApiIds },
            isActive: true 
        }).select('apiId').lean();
        
        return fallbackLeagues.map(l => parseInt(l.apiId)).filter(id => !isNaN(id));
    }

    return relevantLeagueIds;
}

// Get matches for a competition
router.get('/competitions/:competitionId', authenticateToken, async (req, res) => {
    try {
        const { competitionId } = req.params;
        const { dateFrom, dateTo, neLat, neLng, swLat, swLng } = req.query;
        const bounds = (neLat && neLng && swLat && swLng) ? {
            northeast: { lat: parseFloat(neLat), lng: parseFloat(neLng) },
            southwest: { lat: parseFloat(swLat), lng: parseFloat(swLng) }
        } : null;
        
        if (bounds) {
            console.log(`🗺️ Received bounds: NE[${bounds.northeast.lat}, ${bounds.northeast.lng}] SW[${bounds.southwest.lat}, ${bounds.southwest.lng}]`);
            
            // Calculate bounds dimensions to check if they're reasonable
            const latSpan = bounds.northeast.lat - bounds.southwest.lat;
            const lngSpan = bounds.northeast.lng - bounds.southwest.lng;
            console.log(`📏 Bounds dimensions: Lat span: ${latSpan.toFixed(6)}°, Lng span: ${lngSpan.toFixed(6)}°`);
            
            // Check if bounds seem too large (might indicate a buffer zone or zoom issue)
            if (latSpan > 10 || lngSpan > 10) {
                console.log(`⚠️ WARNING: Bounds seem very large - possible zoom out or buffer zone issue`);
            }
        }

        let user = null;
        if (req.user) {
            user = await User.findById(req.user.id);
            if (!user) {
                user = {
                    _id: req.user.id,
                    subscription: {
                        tier: 'pro',
                        isActive: true,
                        startDate: new Date(),
                        endDate: null
                    }
                };
            }
        }
        const hasAccess = subscriptionService.hasLeagueAccess(user, competitionId);
        if (!hasAccess) {
            return res.status(403).json({
                error: 'Subscription Required',
                message: 'Access to this league requires a higher subscription tier',
                currentTier: user?.subscription?.tier || 'freemium'
            });
        }

        const boundsKey = bounds ? `${bounds.northeast.lat}-${bounds.northeast.lng}-${bounds.southwest.lat}-${bounds.southwest.lng}` : 'no-bounds';
        const cacheKey = `matches:${competitionId}:${dateFrom}:${dateTo}:${boundsKey}`;
        
        // Generate unique search session ID for tracking
        const searchSessionId = `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        console.log(`🔍 [${searchSessionId}] Starting search for competition ${competitionId} with bounds: ${bounds ? 'YES' : 'NO'}`);
        
        // Special logging for Champions League
        if (competitionId === '2' || competitionId === 2) {
            console.log(`🏆 [${searchSessionId}] CHAMPIONS LEAGUE SEARCH DETECTED! Competition ID: ${competitionId}`);
            console.log(`🏆 [${searchSessionId}] Date range: ${dateFrom} to ${dateTo}`);
            console.log(`🏆 [${searchSessionId}] Bounds: ${bounds ? JSON.stringify(bounds) : 'NO BOUNDS'}`);
        }
        
        const cachedData = matchesCache.get(cacheKey);
        if (cachedData) {
            console.log(`🔍 [${searchSessionId}] Returning cached data`);
            return res.json(cachedData);
        }

        const apiResponse = await axios.get(`${API_SPORTS_BASE_URL}/fixtures`, {
            params: { league: competitionId, season: '2025', from: dateFrom, to: dateTo },
            headers: { 'x-apisports-key': API_SPORTS_KEY },
            httpsAgent
        });

        // Special logging for Champions League API response
        if (competitionId === '2' || competitionId === 2) {
            console.log(`🏆 [${searchSessionId}] Champions League API Response:`, {
                totalResults: apiResponse.data.results || 0,
                hasResponse: !!apiResponse.data.response,
                responseLength: apiResponse.data.response?.length || 0,
                firstMatch: apiResponse.data.response?.[0] ? {
                    id: apiResponse.data.response[0].id,
                    teams: `${apiResponse.data.response[0].teams?.home?.name} vs ${apiResponse.data.response[0].teams?.away?.name}`,
                    date: apiResponse.data.response[0].fixture?.date,
                    venue: apiResponse.data.response[0].fixture?.venue?.name,
                    city: apiResponse.data.response[0].fixture?.venue?.city
                } : 'No matches'
            });
        }

        const transformedData = await transformApiSportsData(apiResponse.data, competitionId, bounds, searchSessionId);
        
        // Special logging for Champions League after transformation
        if (competitionId === '2' || competitionId === 2) {
            console.log(`🏆 [${searchSessionId}] Champions League After Transformation:`, {
                totalMatches: transformedData.response?.length || 0,
                hasMatches: !!transformedData.response && transformedData.response.length > 0,
                firstMatch: transformedData.response?.[0] ? {
                    id: transformedData.response[0].id,
                    teams: `${transformedData.response[0].teams?.home?.name} vs ${transformedData.response[0].teams?.away?.name}`,
                    venue: transformedData.response[0].fixture?.venue?.name,
                    city: transformedData.response[0].fixture?.venue?.city,
                    coordinates: transformedData.response[0].fixture?.venue?.coordinates
                } : 'No matches'
            });
        }
        
        matchesCache.set(cacheKey, transformedData);
        res.json(transformedData);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch matches' });
    }
});

// Database venue management endpoint
router.get('/venues/stats', async (req, res) => {
    try {
        const stats = await venueService.getCacheStats();
        res.json({ success: true, databaseStats: stats, timestamp: new Date().toISOString() });
    } catch (error) {
        console.error('Error getting venue stats:', error);
        res.status(500).json({ success: false, error: 'Failed to get venue statistics', message: error.message });
    }
});

// Search for matches between specific teams
router.get('/search', async (req, res) => {
    try {
        const { homeTeam, awayTeam, dateFrom, dateTo, season = 2025, competitions, teams, neLat, neLng, swLat, swLng } = req.query;

        // Location-only search: if bounds and date range are provided without competitions/teams/teams
        const hasBounds = neLat && neLng && swLat && swLng;
        const hasCompetitionsOrTeams = (competitions && competitions.trim() !== '') || (teams && teams.trim() !== '');
        const hasTeamMatchup = homeTeam || awayTeam;
        
        if (hasBounds && dateFrom && dateTo && !hasCompetitionsOrTeams && !hasTeamMatchup) {
            // Location-only search: use geographic filtering to find relevant leagues
            
            // PHASE 1: Buffer Zones - Expand bounds by 30% to prevent gaps when panning
            const originalBounds = {
                northeast: { lat: parseFloat(neLat), lng: parseFloat(neLng) },
                southwest: { lat: parseFloat(swLat), lng: parseFloat(swLng) }
            };
            
            const boundsLatSpan = originalBounds.northeast.lat - originalBounds.southwest.lat;
            const boundsLngSpan = originalBounds.northeast.lng - originalBounds.southwest.lng;
            const bufferPercent = 0.3; // 30% buffer
            
            const bounds = {
                northeast: {
                    lat: originalBounds.northeast.lat + (boundsLatSpan * bufferPercent),
                    lng: originalBounds.northeast.lng + (boundsLngSpan * bufferPercent)
                },
                southwest: {
                    lat: originalBounds.southwest.lat - (boundsLatSpan * bufferPercent),
                    lng: originalBounds.southwest.lng - (boundsLngSpan * bufferPercent)
                }
            };
            
            // PHASE 1: Country-Level Caching - Determine country from bounds center
            const searchCenterLat = (bounds.northeast.lat + bounds.southwest.lat) / 2;
            const searchCenterLng = (bounds.northeast.lng + bounds.southwest.lng) / 2;
            
            // Find which country the search center is in
            let searchCountry = null;
            let minDistance = Infinity;
            for (const [countryName, coords] of Object.entries(COUNTRY_COORDS)) {
                const distance = calculateDistanceKm(searchCenterLat, searchCenterLng, coords.lat, coords.lng);
                if (distance < minDistance && distance < 500) { // Within 500km of country center
                    minDistance = distance;
                    searchCountry = countryName;
                }
            }
            
            // Use country + date range for cache key (not exact bounds)
            const cacheKey = `location-search:${searchCountry || 'unknown'}:${dateFrom}:${dateTo}:${season}`;
            
            // Check cache first
            const cachedData = matchesCache.get(cacheKey);
            if (cachedData) {
                console.log(`✅ Location-only search: Cache hit for ${searchCountry || 'unknown'}, ${dateFrom} to ${dateTo}`);
                // Still filter by original bounds (not buffered bounds) for display
                // DEBUG: Include matches without coordinates for debugging
                const filteredMatches = cachedData.data.filter(match => {
                    const coords = match.fixture?.venue?.coordinates;
                    
                    // Include matches with coordinates within bounds
                    if (coords && Array.isArray(coords) && coords.length === 2) {
                        const [lon, lat] = coords;
                        return lat >= originalBounds.southwest.lat && lat <= originalBounds.northeast.lat &&
                               lon >= originalBounds.southwest.lng && lon <= originalBounds.northeast.lng;
                    }
                    
                    // DEBUG: Include matches without coordinates (marked for debugging)
                    if (match.fixture?.venue?.missingCoordinates) {
                        return true; // Include for debugging
                    }
                    
                    return false;
                });
                
                // Count matches with/without coordinates for debugging
                const withCoords = filteredMatches.filter(m => m.fixture?.venue?.coordinates).length;
                const withoutCoords = filteredMatches.filter(m => m.fixture?.venue?.missingCoordinates).length;
                
                return res.json({ 
                    success: true, 
                    data: filteredMatches, 
                    count: filteredMatches.length,
                    fromCache: true,
                    debug: {
                        withCoordinates: withCoords,
                        withoutCoordinates: withoutCoords,
                        totalInCache: cachedData.data.length
                    }
                });
            }
            
            console.log(`🔍 Location-only search: Cache miss for ${searchCountry || 'unknown'}, ${dateFrom} to ${dateTo} - fetching from API`);
            
            // Get relevant league IDs using geographic filtering (similar to /leagues/relevant)
            const majorLeagueIds = await getRelevantLeagueIds(bounds);
            
            if (majorLeagueIds.length === 0) {
                console.log('⚠️ No relevant leagues found after filtering, using fallback');
                // Fallback to essential leagues
                majorLeagueIds.push(39, 140, 78, 135, 61, 62, 2, 3);
            }
            
            console.log(`🔍 Location-only search: Using ${majorLeagueIds.length} geographically-relevant leagues (filtered from all active leagues)`);
            console.log(`🔍 Location-only search: League IDs being searched:`, majorLeagueIds);
            
            // Get league names for detailed logging
            const leagueDocs = await League.find({ apiId: { $in: majorLeagueIds.map(id => id.toString()) } }).select('apiId name country').lean();
            const leagueInfo = leagueDocs.map(l => `${l.name} (${l.apiId}, ${l.country})`).join(', ');
            console.log(`🔍 Location-only search: League names being searched: ${leagueInfo}`);
            console.log(`🔍 Location-only search: Date range: ${dateFrom} to ${dateTo}, Season: ${season}`);
            
            // PHASE 1: Retry Logic with Exponential Backoff
            async function fetchWithRetry(leagueId, maxRetries = 3) {
                for (let attempt = 0; attempt < maxRetries; attempt++) {
                    try {
                        const response = await axios.get(`${API_SPORTS_BASE_URL}/fixtures`, {
                            params: { league: leagueId, season: season, from: dateFrom, to: dateTo },
                            headers: { 'x-apisports-key': API_SPORTS_KEY },
                            httpsAgent,
                            timeout: 10000
                        });
                        console.log(`✅ League ${leagueId} API call successful (attempt ${attempt + 1}): ${response.data?.response?.length || 0} fixtures`);
                        return { type: 'league', id: leagueId, data: response.data, success: true };
                    } catch (error) {
                        const isLastAttempt = attempt === maxRetries - 1;
                        const errorMsg = error.message || error.response?.status || 'Unknown error';
                        
                        if (isLastAttempt) {
                            console.error(`❌ League ${leagueId} API call failed after ${maxRetries} attempts: ${errorMsg}`);
                            return { type: 'league', id: leagueId, data: { response: [] }, success: false };
                        } else {
                            const delayMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
                            console.warn(`⚠️ League ${leagueId} API call failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${delayMs}ms: ${errorMsg}`);
                            await new Promise(resolve => setTimeout(resolve, delayMs));
                        }
                    }
                }
            }
            
            const requests = [];
            for (const leagueId of majorLeagueIds) {
                requests.push(fetchWithRetry(leagueId));
            }

            const settled = await Promise.allSettled(requests);
            const fixtures = [];
            const leagueStats = {};
            for (const s of settled) {
                if (s.status === 'fulfilled') {
                    const payload = s.value;
                    const fixtureCount = payload?.data?.response?.length || 0;
                    leagueStats[payload.id] = fixtureCount;
                    if (fixtureCount > 0) {
                        fixtures.push(...payload.data.response);
                        console.log(`📊 League ${payload.id}: ${fixtureCount} fixtures added`);
                    }
                } else {
                    console.error(`❌ League request failed:`, s.reason);
                }
            }
            console.log(`📊 Location-only search API results by league:`, leagueStats);
            console.log(`📊 Total fixtures collected: ${fixtures.length}`);

            // Dedupe by fixture id
            const seen = new Set();
            const uniqueFixtures = fixtures.filter(fx => {
                const id = fx.fixture?.id;
                if (!id || seen.has(id)) return false;
                seen.add(id);
                return true;
            });

            console.log(`📊 After deduplication: ${uniqueFixtures.length} unique fixtures`);
            console.log(`📊 Unique fixture IDs:`, uniqueFixtures.map(f => f.fixture?.id).slice(0, 20).join(', '));

            // Transform and filter by bounds
            const transformedMatches = [];
            let matchesWithoutCoords = 0;
            let matchesFilteredOut = 0;
            let matchesByLeague = {}; // Track matches by league for logging
            
            for (const match of uniqueFixtures) {
                const leagueId = match.league?.id;
                if (!matchesByLeague[leagueId]) {
                    matchesByLeague[leagueId] = { total: 0, transformed: 0, noCoords: 0, filteredOut: 0 };
                }
                matchesByLeague[leagueId].total++;
                const venue = match.fixture?.venue;
                let venueInfo = null;
                if (venue?.id) {
                    // Always fetch venue data from API-Football to get image (MongoDB doesn't store images)
                    // This is cached, so subsequent calls are fast
                    let apiVenueData = null;
                    try {
                        apiVenueData = await getVenueFromApiFootball(venue.id);
                    } catch (error) {
                        console.log(`⚠️ Failed to fetch venue data for ID ${venue.id}: ${error.message}`);
                    }
                    
                    const localVenue = await venueService.getVenueByApiId(venue.id);
                    const localCoords = localVenue?.coordinates || localVenue?.location?.coordinates;
                    
                    if (localVenue && localCoords) {
                        // MongoDB has venue with coordinates - use it, but get image from API
                        venueInfo = {
                            id: venue.id,
                            name: localVenue.name,
                            city: localVenue.city,
                            country: localVenue.country,
                            coordinates: localCoords,
                            image: apiVenueData?.image || null // Use image from API-Football (MongoDB doesn't store images)
                        };
                    } else if (apiVenueData) {
                        // MongoDB doesn't have venue OR doesn't have coordinates - use API-Sports data
                        // API-Sports venue data - check for coordinates in multiple places
                        const apiCoords = apiVenueData.coordinates || 
                                         (Array.isArray(apiVenueData.location) ? apiVenueData.location : null) ||
                                         (apiVenueData.lat && apiVenueData.lng ? [apiVenueData.lng, apiVenueData.lat] : null) ||
                                         venue?.coordinates || null;
                        
                        venueInfo = {
                            id: venue.id,
                            name: apiVenueData.name || localVenue?.name || venue?.name,
                            city: apiVenueData.city || localVenue?.city || venue?.city,
                            country: apiVenueData.country || localVenue?.country || venue?.country,
                            coordinates: apiCoords,
                            image: apiVenueData.image || null // Use image from API-Football
                        };
                    } else if (localVenue) {
                        // MongoDB has venue but no coordinates, and API-Sports also failed - use MongoDB data without coords
                        // This will trigger the fallback logic to include based on country matching
                        venueInfo = {
                            id: venue.id,
                            name: localVenue.name,
                            city: localVenue.city,
                            country: localVenue.country,
                            coordinates: null, // No coordinates available
                            image: apiVenueData?.image || null // Use image from API-Football if we fetched it
                        };
                    }
                }
                
                // Fallback: If venue lookup by ID failed, try name-based lookup (handles duplicate venues)
                // This is important because API-Sports might assign different venueIds to the same stadium for different teams
                if (!venueInfo || (!venueInfo.coordinates && venue?.name)) {
                    const byName = await venueService.getVenueByName(venue?.name, venue?.city);
                    if (byName && byName.coordinates) {
                        // Found venue by name with coordinates - use it (this handles duplicate venue records)
                        venueInfo = {
                            id: venue?.id || venueInfo?.id || null,
                            name: byName.name || venue?.name,
                            city: byName.city || venue?.city,
                            country: byName.country || venue?.country || match.league?.country,
                            coordinates: byName.coordinates,
                            image: venueInfo?.image || null
                        };
                        console.log(`📍 Found venue by name fallback: ${byName.name} (had coordinates, venueId lookup failed or had no coords)`);
                    }
                }
                
                // CRITICAL: If venue still has no coordinates but we have name/city, geocode and save it
                // This ensures every match gets coordinates - the missing piece!
                if (venueInfo && !venueInfo.coordinates && venueInfo.name && venueInfo.city) {
                    try {
                        console.log(`🔍 Geocoding venue (missing coordinates): ${venueInfo.name}, ${venueInfo.city}, ${venueInfo.country}`);
                        const geocodedCoords = await geocodingService.geocodeVenueCoordinates(
                            venueInfo.name,
                            venueInfo.city,
                            venueInfo.country || match.league?.country
                        );
                        
                        if (geocodedCoords) {
                            console.log(`✅ Geocoded ${venueInfo.name}: [${geocodedCoords[0]}, ${geocodedCoords[1]}]`);
                            
                            // Save to MongoDB for future use
                            const savedVenue = await venueService.saveVenueWithCoordinates({
                                venueId: venue?.id || venueInfo.id || null,
                                name: venueInfo.name,
                                city: venueInfo.city,
                                country: venueInfo.country || match.league?.country,
                                coordinates: geocodedCoords
                            });
                            
                            if (savedVenue) {
                                console.log(`💾 Saved venue to MongoDB: ${venueInfo.name}`);
                            }
                            
                            // Update venueInfo with geocoded coordinates
                            venueInfo.coordinates = geocodedCoords;
                        } else {
                            console.log(`⚠️ Geocoding failed for ${venueInfo.name}`);
                        }
                    } catch (geocodeError) {
                        console.error(`❌ Geocoding error for ${venueInfo.name}:`, geocodeError.message);
                    }
                }
                
                if (!venueInfo) {
                    const mappedHome = await teamService.mapApiNameToTeam(match.teams.home.name);
                    const team = await Team.findOne({
                        $or: [
                            { name: mappedHome },
                            { name: { $regex: new RegExp(`^${mappedHome}$`, 'i') } },
                            { apiName: mappedHome },
                            { aliases: mappedHome }
                        ]
                    });
                    
                    // If team has venueId, try to lookup venue from Venue collection first
                    if (team?.venue?.venueId) {
                        const Venue = require('../models/Venue');
                        const linkedVenue = await Venue.findOne({ venueId: team.venue.venueId });
                        if (linkedVenue) {
                            const coords = linkedVenue.coordinates || linkedVenue.location?.coordinates;
                            if (coords && Array.isArray(coords) && coords.length === 2) {
                                venueInfo = {
                                    id: venue?.id || linkedVenue.venueId || null,
                                    name: linkedVenue.name || team.venue.name || 'Unknown Venue',
                                    city: linkedVenue.city || team.city || 'Unknown City',
                                    country: linkedVenue.country || team.country || match.league?.country || 'Unknown Country',
                                    coordinates: coords
                                };
                            }
                        }
                    }
                    
                    // Fallback to team.venue.coordinates if venueId lookup didn't work
                    if (!venueInfo && team?.venue?.coordinates) {
                        venueInfo = {
                            id: venue?.id || team.venue.venueId || `venue-${mappedHome.replace(/\s+/g, '-').toLowerCase()}`,
                            name: team.venue.name || venue?.name || 'Unknown Venue',
                            city: team.city || venue?.city || 'Unknown City',
                            country: team.country || match.league?.country || 'Unknown Country',
                            coordinates: team.venue.coordinates
                        };
                    }
                    
                    if (!venueInfo) {
                        // Create venueInfo from available data
                        const venueName = venue?.name || team?.venue?.name || 'Unknown Venue';
                        const venueCity = venue?.city || team?.city || 'Unknown City';
                        const venueCountry = match.league?.country || team?.country || 'Unknown Country';
                        
                        venueInfo = {
                            id: venue?.id || null,
                            name: venueName,
                            city: venueCity,
                            country: venueCountry,
                            coordinates: venue?.coordinates || null
                        };
                        
                        // CRITICAL: If still no coordinates but we have name/city, geocode it
                        if (!venueInfo.coordinates && venueName !== 'Unknown Venue' && venueCity !== 'Unknown City') {
                            try {
                                console.log(`🔍 Geocoding venue from team fallback: ${venueName}, ${venueCity}, ${venueCountry}`);
                                const geocodedCoords = await geocodingService.geocodeVenueCoordinates(
                                    venueName,
                                    venueCity,
                                    venueCountry
                                );
                                
                                if (geocodedCoords) {
                                    console.log(`✅ Geocoded ${venueName}: [${geocodedCoords[0]}, ${geocodedCoords[1]}]`);
                                    
                                    // Save to MongoDB
                                    const savedVenue = await venueService.saveVenueWithCoordinates({
                                        venueId: venue?.id || null,
                                        name: venueName,
                                        city: venueCity,
                                        country: venueCountry,
                                        coordinates: geocodedCoords
                                    });
                                    
                                    // Also update team if it exists
                                    if (team && !team.venue?.coordinates) {
                                        if (!team.venue) team.venue = {};
                                        // If we saved a venue, link it by venueId
                                        if (savedVenue && savedVenue.venueId) {
                                            team.venue.venueId = savedVenue.venueId;
                                        }
                                        team.venue.name = venueName;
                                        team.venue.coordinates = geocodedCoords;
                                        team.city = venueCity;
                                        await team.save();
                                        console.log(`💾 Updated team ${team.name} with venue coordinates${savedVenue?.venueId ? ` (venueId: ${savedVenue.venueId})` : ''}`);
                                    }
                                    
                                    venueInfo.coordinates = geocodedCoords;
                                }
                            } catch (geocodeError) {
                                console.error(`❌ Geocoding error for ${venueName}:`, geocodeError.message);
                            }
                        }
                    }
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
                        home: { id: match.teams.home.id, name: await teamService.mapApiNameToTeam(match.teams.home.name), logo: match.teams.home.logo },
                        away: { id: match.teams.away.id, name: await teamService.mapApiNameToTeam(match.teams.away.name), logo: match.teams.away.logo }
                    }
                };

                // Filter by bounds - For domestic leagues, include all matches from that country
                // For international leagues or foreign leagues, use strict bounds filtering
                let shouldInclude = false;
                
                // Calculate bounds size to determine if this is a city-level or country-level search
                const boundsLatSpan = bounds.northeast.lat - bounds.southwest.lat;
                const boundsLngSpan = bounds.northeast.lng - bounds.southwest.lng;
                const isCityLevelSearch = boundsLatSpan < 1.0 && boundsLngSpan < 1.0; // Less than ~111km span
                
                // Determine search country from bounds center using COUNTRY_COORDS mapping
                const searchCenterLat = (bounds.northeast.lat + bounds.southwest.lat) / 2;
                const searchCenterLng = (bounds.northeast.lng + bounds.southwest.lng) / 2;
                
                // Find which country the search center is in by checking COUNTRY_COORDS
                let searchCountry = null;
                let minDistance = Infinity;
                for (const [countryName, coords] of Object.entries(COUNTRY_COORDS)) {
                    const distance = calculateDistanceKm(searchCenterLat, searchCenterLng, coords.lat, coords.lng);
                    if (distance < minDistance && distance < 500) { // Within 500km of country center
                        minDistance = distance;
                        searchCountry = countryName;
                    }
                }
                
                // For city-level searches: include all matches from domestic leagues in the same country
                // This ensures Ligue 1 and Ligue 2 matches appear when searching in France
                const isDomesticLeague = searchCountry && match.league?.country && 
                                        searchCountry.toLowerCase() === match.league.country.toLowerCase();
                
                if (venueInfo.coordinates && Array.isArray(venueInfo.coordinates) && venueInfo.coordinates.length === 2) {
                    // Validate coordinates are numbers
                    const [lon, lat] = venueInfo.coordinates;
                    if (typeof lon === 'number' && typeof lat === 'number' && 
                        !isNaN(lon) && !isNaN(lat) &&
                        lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90) {
                        // PHASE 1: For caching, include ALL matches (we'll filter by original bounds when returning)
                        // This ensures cache contains all country matches for instant zoom-out
                        if (isCityLevelSearch && isDomesticLeague) {
                            // Include all domestic league matches for city searches (for caching)
                            shouldInclude = true;
                            console.log(`✅ Match included (domestic league, city search): ${venueInfo.name}, ${venueInfo.city} - Coords: [${lon}, ${lat}] (League: ${match.league.name}, ID: ${match.fixture.id})`);
                        } else if (isWithinBounds(venueInfo.coordinates, bounds)) {
                            // Include matches within buffered bounds (for caching)
                            shouldInclude = true;
                        } else {
                            // Still include matches outside buffered bounds if they're in the country
                            // We'll filter by original bounds when returning to client
                            // This ensures cache has all country matches
                            if (isDomesticLeague) {
                                shouldInclude = true;
                                console.log(`✅ Match included (domestic league, outside buffered bounds but in country): ${venueInfo.name}, ${venueInfo.city} - Coords: [${lon}, ${lat}] (League: ${match.league.name}, ID: ${match.fixture.id})`);
                            } else {
                                matchesFilteredOut++;
                                matchesByLeague[leagueId].filteredOut++;
                                console.log(`📍 Match filtered (outside bounds, not domestic): ${venueInfo.name}, ${venueInfo.city} - Coords: [${lon}, ${lat}] (League: ${match.league.name}, ID: ${match.fixture.id})`);
                            }
                        }
                    } else {
                        matchesWithoutCoords++;
                        matchesByLeague[leagueId].noCoords++;
                        console.log(`⚠️ Match excluded (invalid coordinates): ${venueInfo.name}, ${venueInfo.city} - Coords: ${JSON.stringify(venueInfo.coordinates)} (League: ${match.league.name}, ID: ${match.fixture.id})`);
                    }
                } else {
                    matchesWithoutCoords++;
                    matchesByLeague[leagueId].noCoords++;
                    
                    // DEBUG MODE: Include matches without coordinates if they're from relevant leagues
                    // This helps us understand what matches are being filtered out
                    const isRelevantLeague = majorLeagueIds.includes(leagueId);
                    
                    if (isRelevantLeague) {
                        // Include match but mark it as missing coordinates
                        transformed.fixture.venue = {
                            ...venueInfo,
                            coordinates: null,
                            missingCoordinates: true,
                            debugNote: 'Match included for debugging - missing coordinates'
                        };
                        shouldInclude = true; // Mark for inclusion
                        console.log(`🔍 DEBUG: Match included without coordinates: ${venueInfo?.name || 'Unknown'}, ${venueInfo?.city || 'Unknown'}, ${venueInfo?.country || 'Unknown'} (League: ${match.league.name}, ID: ${match.fixture.id})`);
                    } else {
                        // Exclude non-relevant league matches without coordinates
                        console.log(`⚠️ Match excluded (no coordinates, not relevant league): ${venueInfo?.name || 'Unknown'}, ${venueInfo?.city || 'Unknown'}, ${venueInfo?.country || 'Unknown'} (League: ${match.league.name}, ID: ${match.fixture.id})`);
                    }
                }
                
                if (shouldInclude) {
                    transformedMatches.push(transformed);
                    matchesByLeague[leagueId].transformed++;
                }
            }
            
            console.log(`📊 Location-only search filtering stats: ${transformedMatches.length} included, ${matchesWithoutCoords} without coordinates, ${matchesFilteredOut} filtered out (outside bounds)`);
            console.log(`📊 Matches by league breakdown:`, JSON.stringify(matchesByLeague, null, 2));
            console.log(`📊 Final transformed matches count: ${transformedMatches.length}`);
            console.log(`📊 Final transformed match IDs:`, transformedMatches.map(m => m.id).slice(0, 20).join(', '));

            // Sort by date
            transformedMatches.sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));
            
            // PHASE 1: Cache the results (all country matches, not filtered by bounds)
            const cacheData = {
                success: true,
                data: transformedMatches, // Store all matches, not filtered by bounds
                count: transformedMatches.length
            };
            matchesCache.set(cacheKey, cacheData);
            console.log(`✅ Location-only search: Cached ${transformedMatches.length} matches for ${searchCountry || 'unknown'}, ${dateFrom} to ${dateTo}`);
            
            // Filter by original bounds (not buffered bounds) for this specific request
            // DEBUG: Include matches without coordinates for debugging
            const filteredMatches = transformedMatches.filter(match => {
                const coords = match.fixture?.venue?.coordinates;
                
                // Include matches with coordinates within bounds
                if (coords && Array.isArray(coords) && coords.length === 2) {
                    const [lon, lat] = coords;
                    return lat >= originalBounds.southwest.lat && lat <= originalBounds.northeast.lat &&
                           lon >= originalBounds.southwest.lng && lon <= originalBounds.northeast.lng;
                }
                
                // DEBUG: Include matches without coordinates (marked for debugging)
                if (match.fixture?.venue?.missingCoordinates) {
                    return true; // Include for debugging
                }
                
                return false;
            });
            
            // Count matches with/without coordinates for debugging
            const withCoords = filteredMatches.filter(m => m.fixture?.venue?.coordinates).length;
            const withoutCoords = filteredMatches.filter(m => m.fixture?.venue?.missingCoordinates).length;
            
            return res.json({ 
                success: true, 
                data: filteredMatches, 
                count: filteredMatches.length,
                fromCache: false,
                totalMatches: transformedMatches.length, // Total matches in cache
                debug: {
                    withCoordinates: withCoords,
                    withoutCoordinates: withoutCoords,
                    totalInCache: transformedMatches.length
                }
            });
        }

        // Aggregated search path when competitions/teams are provided
        if ((competitions && competitions.trim() !== '') || (teams && teams.trim() !== '')) {
            if (!dateFrom || !dateTo) {
                return res.status(400).json({ success: false, message: 'dateFrom and dateTo are required when searching by competitions/teams' });
            }
            const leagueIds = (competitions ? competitions.split(',') : []).map(v => v.trim()).filter(Boolean);
            const teamIds = (teams ? teams.split(',') : []).map(v => v.trim()).filter(Boolean);
            const bounds = (neLat && neLng && swLat && swLng) ? {
                northeast: { lat: parseFloat(neLat), lng: parseFloat(neLng) },
                southwest: { lat: parseFloat(swLat), lng: parseFloat(swLng) }
            } : null;

            const requests = [];
            // League requests
            for (const leagueId of leagueIds) {
                requests.push(
                    axios.get(`${API_SPORTS_BASE_URL}/fixtures`, {
                        params: { league: leagueId, season: season, from: dateFrom, to: dateTo },
                        headers: { 'x-apisports-key': API_SPORTS_KEY },
                        httpsAgent,
                        timeout: 10000
                    }).then(r => ({ type: 'league', id: leagueId, data: r.data }))
                      .catch(() => ({ type: 'league', id: leagueId, data: { response: [] } }))
                );
            }
            // Team requests
            for (const teamId of teamIds) {
                requests.push(
                    axios.get(`${API_SPORTS_BASE_URL}/fixtures`, {
                        params: { team: teamId, season: season, from: dateFrom, to: dateTo },
                        headers: { 'x-apisports-key': API_SPORTS_KEY },
                        httpsAgent,
                        timeout: 10000
                    }).then(r => ({ type: 'team', id: teamId, data: r.data }))
                      .catch(() => ({ type: 'team', id: teamId, data: { response: [] } }))
                );
            }

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

            // Dedupe by fixture id
            const seen = new Set();
            const uniqueFixtures = fixtures.filter(fx => {
                const id = fx.fixture?.id;
                if (!id || seen.has(id)) return false;
                seen.add(id);
                return true;
            });

            // Transform similar to popular route (include coordinates when available)
            const transformedMatches = [];
            for (const match of uniqueFixtures) {
                const venue = match.fixture?.venue;
                
                // DEBUG: Log fixture venue structure to see what's included
                if (transformedMatches.length === 0) { // Only log first match to avoid spam
                    console.log('🔍 DEBUG - Fixture venue structure:', JSON.stringify({
                        hasVenue: !!venue,
                        venueId: venue?.id,
                        venueName: venue?.name,
                        venueCity: venue?.city,
                        venueCountry: venue?.country,
                        venueImage: venue?.image,
                        venueKeys: venue ? Object.keys(venue) : [],
                        fullVenue: venue
                    }, null, 2));
                }
                
                let venueInfo = null;
                if (venue?.id) {
                    // Always fetch venue data from API-Football to get image (MongoDB doesn't store images)
                    // This is cached, so subsequent calls are fast
                    let apiVenueData = null;
                    try {
                        apiVenueData = await getVenueFromApiFootball(venue.id);
                    } catch (error) {
                        console.log(`⚠️ Failed to fetch venue data for ID ${venue.id}: ${error.message}`);
                    }
                    
                    const localVenue = await venueService.getVenueByApiId(venue.id);
                    
                    if (localVenue) {
                        // Use MongoDB data but get image from API-Football
                        venueInfo = {
                            id: venue.id,
                            name: localVenue.name,
                            city: localVenue.city,
                            country: localVenue.country,
                            coordinates: localVenue.coordinates || localVenue.location?.coordinates,
                            image: apiVenueData?.image || null // Use image from API-Football (MongoDB doesn't store images)
                        };
                    } else if (apiVenueData) {
                        // No MongoDB data, use API-Football data
                        venueInfo = {
                            id: venue.id,
                            name: apiVenueData.name,
                            city: apiVenueData.city,
                            country: apiVenueData.country,
                            coordinates: null,
                            image: apiVenueData.image || null
                        };
                    }
                }
                if (!venueInfo) {
                    // Try team venue fallback if no venue ID
                    const mappedHome = await teamService.mapApiNameToTeam(match.teams.home.name);
                    const team = await Team.findOne({
                        $or: [
                            { name: mappedHome },
                            { name: { $regex: new RegExp(`^${mappedHome}$`, 'i') } },
                            { apiName: mappedHome },
                            { aliases: mappedHome }
                        ]
                    });
                    
                    if (team?.venue?.coordinates) {
                        venueInfo = {
                            id: venue?.id || `venue-${mappedHome.replace(/\s+/g, '-').toLowerCase()}`,
                            name: team.venue.name || venue?.name || 'Unknown Venue',
                            city: team.city || venue?.city || 'Unknown City',
                            country: team.country || match.league?.country || 'Unknown Country',
                            coordinates: team.venue.coordinates,
                            image: team.venue?.image || venue?.image || null  // Include venue image
                        };
                    } else {
                        // Try to get venue image from API-Football if we have venue ID
                        let venueImage = null;
                        if (venue?.id) {
                            try {
                                const v = await getVenueFromApiFootball(venue.id);
                                venueImage = v?.image || null;
                            } catch (error) {
                                // Silently fail - image is optional
                            }
                        }
                        
                        venueInfo = {
                            id: venue?.id || null,
                            name: venue?.name || 'Unknown Venue',
                            city: venue?.city || 'Unknown City',
                            country: match.league?.country || 'Unknown Country',
                            coordinates: venue?.coordinates || null,  // Use API coordinates if available
                            image: venueImage || venue?.image || null  // Include venue image
                        };
                    }
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
                        home: { id: match.teams.home.id, name: await teamService.mapApiNameToTeam(match.teams.home.name), logo: match.teams.home.logo },
                        away: { id: match.teams.away.id, name: await teamService.mapApiNameToTeam(match.teams.away.name), logo: match.teams.away.logo }
                    }
                };

                // Bounds filtering if provided and we have coordinates
                if (bounds) {
                    if (transformed.fixture.venue.coordinates && isWithinBounds(transformed.fixture.venue.coordinates, bounds)) {
                        transformedMatches.push(transformed);
                    }
                } else {
                    // For global, include only those with coordinates
                    if (transformed.fixture.venue.coordinates) {
                        transformedMatches.push(transformed);
                    }
                }
            }

            // Sort by date
            transformedMatches.sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));
            return res.json({ success: true, data: transformedMatches, count: transformedMatches.length });
        }

        // Fallback: original team-vs-team search
        if (!homeTeam && !awayTeam) {
            // Check if location and date range are provided but bounds weren't processed
            if (hasBounds && dateFrom && dateTo) {
                return res.status(400).json({ success: false, message: 'Location search requires bounds (neLat, neLng, swLat, swLng), dateFrom, and dateTo' });
            }
            return res.status(400).json({ success: false, message: 'At least one team must be specified, or provide location bounds with date range, or competitions/teams' });
        }
        const params = { season: season };
        if (homeTeam && awayTeam) {
            params.h2h = `${homeTeam}-${awayTeam}`;
        } else if (homeTeam) {
            params.team = homeTeam;
        } else if (awayTeam) {
            params.team = awayTeam;
        }
        if (dateFrom) params.from = dateFrom;
        if (dateTo) params.to = dateTo;

        const response = await axios.get(`${API_SPORTS_BASE_URL}/fixtures`, {
            headers: { 'x-apisports-key': API_SPORTS_KEY },
            params,
            httpsAgent
        });

        if (!response.data || !response.data.response) {
            return res.json({ success: true, data: { matches: [], count: 0 } });
        }

        const matches = await Promise.all(response.data.response.map(async fixture => {
            const homeTeamName = await teamService.mapApiNameToTeam(fixture.teams.home.name);
            const venueData = await venueService.getVenueForTeam(homeTeamName);
            return {
                fixture: {
                    id: fixture.fixture.id,
                    date: fixture.fixture.date,
                    status: fixture.fixture.status,
                    venue: venueData ? {
                        id: venueData.name || fixture.fixture.venue?.name,
                        name: venueData.name || fixture.fixture.venue?.name || 'Unknown Venue',
                        city: venueData.city || fixture.fixture.venue?.city || 'Unknown City',
                        country: venueData.country || 'Unknown Country'
                    } : {
                        id: fixture.fixture.venue?.id || null,
                        name: fixture.fixture.venue?.name || 'Unknown Venue',
                        city: fixture.fixture.venue?.city || 'Unknown City',
                        country: fixture.league.country || 'Unknown Country'
                    }
                },
                league: {
                    id: fixture.league.id,
                    name: fixture.league.name,
                    logo: fixture.league.logo
                },
                teams: {
                    home: {
                        id: fixture.teams.home.id,
                        name: homeTeamName,
                        logo: await (async () => {
                            const mappedTeamName = await teamService.mapApiNameToTeam(fixture.teams.home.name);
                            const team = await Team.findOne({ name: mappedTeamName });
                            return team?.logo || fixture.teams.home.logo;
                        })()
                    },
                    away: {
                        id: fixture.teams.away.id,
                        name: await teamService.mapApiNameToTeam(fixture.teams.away.name),
                        logo: await (async () => {
                            const mappedTeamName = await teamService.mapApiNameToTeam(fixture.teams.away.name);
                            const team = await Team.findOne({ name: mappedTeamName });
                            return team?.logo || fixture.teams.away.logo;
                        })()
                    }
                },
                goals: { home: fixture.goals.home, away: fixture.goals.away },
                score: fixture.score
            };
        }));

        res.json({ success: true, data: { matches, count: matches.length } });
    } catch (error) {
        console.error('Error searching matches:', error);
        res.status(500).json({ success: false, message: 'Failed to search matches', error: error.message });
    }
});

// Get matches for a specific team
router.get('/by-team', async (req, res) => {
    try {
        const { teamId, teamName, dateFrom, dateTo } = req.query;
        if (!teamId && !teamName) {
            return res.status(400).json({ success: false, message: 'Either teamId or teamName is required' });
        }
        const cacheKey = `matches_${teamId || teamName}_${dateFrom || 'all'}_${dateTo || 'all'}`;
        const cachedMatches = matchesCache.get(cacheKey);
        if (cachedMatches) {
            return res.json({ success: true, matches: cachedMatches, fromCache: true });
        }
        const params = { team: teamId, season: new Date().getFullYear() };
        if (dateFrom) params.from = dateFrom;
        if (dateTo) params.to = dateTo;

        const response = await axios.get(`${API_SPORTS_BASE_URL}/fixtures`, {
            params,
            headers: { 'x-apisports-key': API_SPORTS_KEY }
        });

        const matches = await transformApiSportsData(response.data, null, null, 'team-matches');
        matchesCache.set(cacheKey, matches.response);
        res.json({ success: true, matches: matches.response, fromCache: false });
    } catch (error) {
        console.error('Error fetching team matches:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch team matches' });
    }
});

// Cache stats
router.get('/cache/stats', async (req, res) => {
    const stats = matchesCache.getStats();
    res.json({ success: true, stats });
});

// Clear cache
router.post('/cache/clear', async (req, res) => {
    matchesCache.clear();
    res.json({ success: true, message: 'Matches cache cleared' });
});

// Popular matches
router.get('/popular', async (req, res) => {
    const timeout = setTimeout(() => {
        if (!res.headersSent) {
            res.status(408).json({ success: false, message: 'Request timeout - popular matches endpoint took too long to respond' });
        }
    }, 25000);
    
    try {
        const { leagueIds } = req.query;
        let popularLeagueIds, popularLeagueNames;
        if (leagueIds) {
            const ids = leagueIds.split(',').map(id => parseInt(id.trim()));
            popularLeagueIds = ids;
            popularLeagueNames = ids.map(id => `League ${id}`);
        } else {
            const leagueMappings = { 
                39: 'Premier League', 
                140: 'La Liga', 
                135: 'Serie A', 
                78: 'Bundesliga', 
                61: 'Ligue 1',
                94: 'Primeira Liga',
                97: 'Taca da Liga',
                88: 'Eredivisie'
            };
            popularLeagueIds = [39, 140, 135, 78, 61, 94, 97, 88];
            popularLeagueNames = popularLeagueIds.map(id => leagueMappings[id] || `League ${id}`);
        }
        const today = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(today.getDate() + 30);
        const dateFrom = today.toISOString().split('T')[0];
        const dateTo = thirtyDaysFromNow.toISOString().split('T')[0];

        // Check cache first for popular matches
        const cacheKey = `popular_matches_${dateFrom}_${dateTo}_${popularLeagueIds.join('_')}`;
        const cachedData = popularMatchesCache.get(cacheKey);
        
        if (cachedData) {
            console.log('🔍 Popular matches cache hit - returning cached data');
            clearTimeout(timeout);
            return res.json({ 
                success: true, 
                matches: cachedData, 
                fromCache: true,
                cachedAt: new Date().toISOString()
            });
        }

        console.log('🔄 Popular matches cache miss - fetching from API for leagues:', popularLeagueNames.join(', '));

        const allMatches = [];
        const apiPromises = popularLeagueIds.map(async (leagueId, index) => {
            const leagueName = popularLeagueNames[index];
            try {
                const apiResponse = await axios.get(`${API_SPORTS_BASE_URL}/fixtures`, {
                    params: { league: leagueId, season: '2025', from: dateFrom, to: dateTo },
                    headers: { 'x-apisports-key': API_SPORTS_KEY },
                    httpsAgent,
                    timeout: 10000
                });
                if (apiResponse.data && apiResponse.data.response && apiResponse.data.response.length > 0) {
                    console.log(`✅ ${leagueName}: Found ${apiResponse.data.response.length} matches`);
                    return apiResponse.data.response;
                } else {
                    console.log(`⚠️ ${leagueName}: No matches found`);
                    return [];
                }
            } catch (error) {
                console.log(`❌ ${leagueName}: Error - ${error.message}`);
                return [];
            }
        });

        const results = await Promise.allSettled(apiPromises);
        results.forEach((result) => {
            if (result.status === 'fulfilled' && result.value.length > 0) {
                allMatches.push(...result.value);
            }
        });
        if (allMatches.length === 0) {
            console.log('⚠️ No matches found from any league, returning empty response');
            clearTimeout(timeout);
            return res.json({ success: true, matches: [], message: 'No popular matches found in the next 30 days' });
        }
        const shuffledMatches = allMatches.sort(() => Math.random() - 0.5);
        const selectedMatches = shuffledMatches.slice(0, 10);

        const transformedMatches = [];
        for (const match of selectedMatches) {
            const venue = match.fixture?.venue;
            let venueData = null;
            let apiFootballVenue = null;
            let finalVenueData = null;
            
            if (venue?.id) {
                // Always fetch venue data from API-Football to get image (MongoDB doesn't store images)
                // This is cached, so subsequent calls are fast
                let apiVenueData = null;
                try {
                    apiVenueData = await getVenueFromApiFootball(venue.id);
                } catch (error) {
                    console.log(`⚠️ Failed to fetch venue data for ID ${venue.id}: ${error.message}`);
                }
                
                const localVenue = await venueService.getVenueByApiId(venue.id);
                if (localVenue) {
                    // Use MongoDB data but get image from API-Football
                    apiFootballVenue = {
                        name: localVenue.name,
                        city: localVenue.city,
                        country: localVenue.country,
                        capacity: localVenue.capacity,
                        surface: localVenue.surface,
                        address: localVenue.address,
                        image: apiVenueData?.image || null, // Use image from API-Football (MongoDB doesn't store images)
                        coordinates: localVenue.coordinates || localVenue.location?.coordinates
                    };
                } else if (apiVenueData) {
                    // No MongoDB data, use API-Football data
                    apiFootballVenue = apiVenueData;
                }
            }
            if (!apiFootballVenue && venue?.name) {
                venueData = await venueService.getVenueByName(venue.name, venue.city);
            }
            
            // Determine the final venue data to use
            finalVenueData = apiFootballVenue || venueData || {
                name: venue?.name || 'Unknown Venue',
                city: venue?.city || 'Unknown City',
                country: match.league?.country || 'Unknown Country'
            };
            
            // Check if we need to geocode this venue
            if (!finalVenueData.coordinates && finalVenueData.name && finalVenueData.city && finalVenueData.country) {

                
                try {
                    const coordinates = await geocodingService.geocodeVenueCoordinates(
                        finalVenueData.name,
                        finalVenueData.city,
                        finalVenueData.country
                    );
                    
                    if (coordinates) {
                        console.log(`✅ Successfully geocoded ${finalVenueData.name}: [${coordinates[0]}, ${coordinates[1]}]`);
                        
                        // Save the venue with coordinates to the database
                        const savedVenue = await venueService.saveVenueWithCoordinates({
                            venueId: venue?.id || null,
                            name: finalVenueData.name,
                            city: finalVenueData.city,
                            country: finalVenueData.country,
                            coordinates: coordinates,
                            capacity: finalVenueData.capacity || null,
                            surface: finalVenueData.surface || null,
                            image: finalVenueData.image || null,
                            address: finalVenueData.address || null
                        });
                        
                        if (savedVenue) {
                            // Update the final venue data with the saved venue info
                            finalVenueData = {
                                ...finalVenueData,
                                coordinates: coordinates,
                                id: savedVenue._id
                            };

                        }
                    } else {
                        console.log(`⚠️ Could not geocode venue: ${finalVenueData.name}`);
                    }
                } catch (geocodeError) {
                    console.error(`❌ Geocoding error for ${finalVenueData.name}:`, geocodeError.message);
                }
            }
            
            transformedMatches.push({
                id: match.fixture.id,
                fixture: {
                    id: match.fixture.id,
                    date: match.fixture.date,
                    venue: {
                        id: venue?.id || finalVenueData.id || null,
                        name: finalVenueData.name || 'Unknown Venue',
                        city: finalVenueData.city || 'Unknown City',
                        country: finalVenueData.country || 'Unknown Country',
                        coordinates: finalVenueData.coordinates || null,
                        image: finalVenueData.image || null,
                        capacity: finalVenueData.capacity || null,
                        surface: finalVenueData.surface || null,
                        address: finalVenueData.address || null
                    },
                    status: {
                        long: match.fixture.status?.long || 'Not Started',
                        short: match.fixture.status?.short || 'NS',
                        elapsed: match.fixture.status?.elapsed || null
                    }
                },
                teams: {
                    home: { id: match.teams.home.id, name: match.teams.home.name, logo: match.teams.home.logo },
                    away: { id: match.teams.away.id, name: match.teams.away.name, logo: match.teams.away.logo }
                },
                league: {
                    id: match.league.id,
                    name: match.league.name,
                    country: match.league.country,
                    logo: match.league.logo,
                    season: match.league.season
                },
                goals: match.goals || { home: null, away: null },
                score: match.score || {}
            });
        }
        
        // Cache the popular matches for future requests
        popularMatchesCache.set(cacheKey, transformedMatches);
        console.log('💾 Popular matches cached for future requests');
        
        clearTimeout(timeout);
        res.json({ 
            success: true, 
            matches: transformedMatches, 
            totalFound: allMatches.length, 
            dateRange: { from: dateFrom, to: dateTo }, 
            leagues: popularLeagueNames,
            fromCache: false,
            cachedAt: new Date().toISOString()
        });
    } catch (error) {
        clearTimeout(timeout);
        res.status(500).json({ success: false, message: 'Failed to fetch popular matches', error: error.message });
    }
});

// Recommended matches - personalized based on user data
router.get('/recommended', authenticateToken, async (req, res) => {
    const timeout = setTimeout(() => {
        if (!res.headersSent) {
            res.status(408).json({ success: false, message: 'Request timeout - recommended matches endpoint took too long to respond' });
        }
    }, 30000);
    
    try {
        const { limit = 10, days = 30 } = req.query;
        const userId = req.user.id;
        
        // Get user with all their data
        const user = await User.findById(userId);
        if (!user) {
            clearTimeout(timeout);
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        // Check cache first for recommended matches
        const cacheKey = `recommended_matches_${userId}_${days}_${limit}`;
        const cachedData = popularMatchesCache.get(cacheKey);
        
        if (cachedData) {
            console.log('🔍 Recommended matches cache hit - returning cached data');
            clearTimeout(timeout);
            return res.json({ 
                success: true, 
                matches: cachedData, 
                fromCache: true,
                cachedAt: new Date().toISOString()
            });
        }

        console.log(`🎯 Generating personalized recommendations for user: ${userId}`);

        // Get user's preferences and behavior data
        const userPreferences = {
            favoriteLeagues: user.preferences?.favoriteLeagues || [],
            favoriteTeams: user.preferences?.favoriteTeams || [],
            favoriteVenues: user.preferences?.favoriteVenues || [],
            defaultLocation: user.preferences?.defaultLocation,
            recommendationRadius: user.preferences?.recommendationRadius || 400,
            defaultSearchRadius: user.preferences?.defaultSearchRadius || 100
        };

        // Get user's recent search patterns and trip context
        const recentSearches = user.recommendationHistory?.slice(-20) || [];
        const savedMatches = user.savedMatches || [];
        const visitedStadiums = user.visitedStadiums || [];
        const activeTrips = user.trips?.filter(trip => {
            const tripEnd = new Date(trip.matches[trip.matches.length - 1]?.date || trip.createdAt);
            return tripEnd > new Date();
        }) || [];

        // Determine date range based on user behavior
        const today = new Date();
        const dateFrom = today.toISOString().split('T')[0];
        const dateTo = new Date(today.getTime() + (parseInt(days) * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];

        // Get leagues to search based on user preferences
        let targetLeagues = [];
        
        if (userPreferences.favoriteLeagues.length > 0) {
            // Use user's favorite leagues (these are stored as API ID strings, not MongoDB ObjectIds)
            // Look up in League collection to verify they're valid API IDs and get their names
            const favoriteLeagueIds = userPreferences.favoriteLeagues.map(id => String(id));
            
            // Only query by apiId since favoriteLeagues are stored as API IDs (strings), not ObjectIds
            const leaguesFromDb = await League.find({ 
                apiId: { $in: favoriteLeagueIds }
            }).select('apiId name').lean();
            
            const foundApiIds = leaguesFromDb.map(l => String(l.apiId));
            if (foundApiIds.length > 0) {
                targetLeagues = foundApiIds;
                console.log(`✅ Found ${foundApiIds.length} favorite leagues: ${targetLeagues.join(', ')}`);
            } else {
                // If lookup failed, try using the IDs directly (they might already be valid API IDs)
                targetLeagues = favoriteLeagueIds;
                console.log(`⚠️ League lookup failed, using IDs directly: ${targetLeagues.join(', ')}`);
            }
            
            // Always include popular leagues as well to ensure diverse results
            const popularLeagues = ['39', '140', '135', '78', '61', '94', '97', '88'];
            targetLeagues = [...new Set([...targetLeagues, ...popularLeagues])]; // Combine and deduplicate
            console.log(`🔍 Expanded to include popular leagues: ${targetLeagues.join(', ')}`);
        } else if (activeTrips.length > 0) {
            // Extract leagues from active trips - need to convert names to IDs
            const tripLeagueNames = new Set();
            activeTrips.forEach(trip => {
                trip.matches.forEach(match => {
                    if (match.league) {
                        // match.league can be either a name (string) or an ID (string/number)
                        tripLeagueNames.add(String(match.league));
                    }
                });
            });
            
            // Map league names to IDs by querying the League model
            const leagueNamesArray = Array.from(tripLeagueNames);
            const leaguesFromDb = await League.find({ 
                $or: [
                    { name: { $in: leagueNamesArray } },
                    { apiId: { $in: leagueNamesArray } }
                ]
            }).select('apiId name').lean();
            
            // Create a map of name -> apiId and apiId -> apiId
            const leagueNameToIdMap = new Map();
            leaguesFromDb.forEach(league => {
                leagueNameToIdMap.set(league.name.toLowerCase(), String(league.apiId));
                leagueNameToIdMap.set(String(league.apiId), String(league.apiId));
            });
            
            // Convert league names/IDs to API IDs
            const extractedLeagueIds = leagueNamesArray
                .map(leagueNameOrId => {
                    // Try exact match first
                    if (leagueNameToIdMap.has(String(leagueNameOrId))) {
                        return leagueNameToIdMap.get(String(leagueNameOrId));
                    }
                    // Try case-insensitive name match
                    const lowerName = String(leagueNameOrId).toLowerCase();
                    if (leagueNameToIdMap.has(lowerName)) {
                        return leagueNameToIdMap.get(lowerName);
                    }
                    return null;
                })
                .filter(Boolean);
            
            targetLeagues = extractedLeagueIds.length > 0 ? extractedLeagueIds : ['39', '140', '135', '78', '61', '62', '94', '97', '88', '262'];
        } else {
            // Fallback to popular leagues
            targetLeagues = ['39', '140', '135', '78', '61', '62', '94', '97', '88', '262'];
        }

        console.log(`🔍 Searching leagues: ${targetLeagues.join(', ')}`);

        // Fetch matches from API
        const allMatches = [];
        const apiPromises = targetLeagues.map(async (leagueId) => {
            try {
                const apiResponse = await axios.get(`${API_SPORTS_BASE_URL}/fixtures`, {
                    params: { 
                        league: leagueId, 
                        season: '2025', 
                        from: dateFrom, 
                        to: dateTo 
                    },
                    headers: { 'x-apisports-key': API_SPORTS_KEY },
                    httpsAgent,
                    timeout: 10000
                });
                
                if (apiResponse.data && apiResponse.data.response && apiResponse.data.response.length > 0) {
                    console.log(`✅ League ${leagueId}: Found ${apiResponse.data.response.length} matches`);
                    return apiResponse.data.response;
                } else {
                    console.log(`⚠️ League ${leagueId}: No matches found`);
                    return [];
                }
            } catch (error) {
                console.log(`❌ League ${leagueId}: Error - ${error.message}`);
                return [];
            }
        });

        const results = await Promise.allSettled(apiPromises);
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                if (Array.isArray(result.value) && result.value.length > 0) {
                    allMatches.push(...result.value);
                    console.log(`✅ Aggregated ${result.value.length} matches from league ${targetLeagues[index]}`);
                } else {
                    console.log(`⚠️ League ${targetLeagues[index]} returned no matches or invalid data:`, typeof result.value, Array.isArray(result.value) ? `length: ${result.value.length}` : 'not an array');
                }
            } else {
                console.log(`❌ League ${targetLeagues[index]} promise rejected:`, result.reason?.message || result.reason);
            }
        });
        
        console.log(`📊 Total matches aggregated: ${allMatches.length}`);

        if (allMatches.length === 0) {
            console.log('⚠️ No matches found from any league, returning empty response');
            clearTimeout(timeout);
            return res.json({ 
                success: true, 
                matches: [], 
                message: 'No recommended matches found' 
            });
        }

        // Filter out matches that are in progress or completed
        const upcomingMatches = allMatches.filter(match => !shouldFilterMatch(match));
        console.log(`🔍 Filtered ${allMatches.length - upcomingMatches.length} matches (in progress or completed), ${upcomingMatches.length} upcoming matches remaining`);
        
        if (upcomingMatches.length === 0) {
            console.log('⚠️ No upcoming matches found after filtering, returning empty response');
            clearTimeout(timeout);
            return res.json({ 
                success: true, 
                matches: [], 
                message: 'No upcoming matches found' 
            });
        }

        // Score and rank matches based on user preferences
        const scoredMatches = await Promise.all(upcomingMatches.map(async (match) => {
            let score = 0;
            const reasons = [];

            // Base score
            score += 10;

            // Favorite teams bonus
            if (userPreferences.favoriteTeams.length > 0) {
                const homeTeam = match.teams?.home?.name?.toLowerCase();
                const awayTeam = match.teams?.away?.name?.toLowerCase();
                
                userPreferences.favoriteTeams.forEach(favTeam => {
                    const teamName = favTeam.name?.toLowerCase();
                    if (teamName && (homeTeam?.includes(teamName) || awayTeam?.includes(teamName))) {
                        score += 50;
                        reasons.push(`Your favorite team ${favTeam.name} is playing`);
                    }
                });
            }

            // Favorite leagues bonus
            if (userPreferences.favoriteLeagues.includes(match.league?.id?.toString())) {
                score += 30;
                reasons.push(`From your favorite league: ${match.league?.name}`);
            }

            // Favorite venues bonus
            if (userPreferences.favoriteVenues.length > 0 && match.venue?.id) {
                const matchVenueId = match.venue.id.toString();
                const isFavoriteVenue = userPreferences.favoriteVenues.some(favVenue => 
                    String(favVenue.venueId) === matchVenueId
                );
                if (isFavoriteVenue) {
                    score += 40;
                    reasons.push(`At your favorite venue: ${match.venue?.name}`);
                }
            }

            // Location-based scoring (default location)
            if (userPreferences.defaultLocation?.coordinates && match.venue?.id) {
                try {
                    const venueData = await venueService.getVenueByApiId(match.venue.id);
                    // Venue data can have coordinates in different formats
                    const venueCoords = venueData?.coordinates || 
                                       venueData?.location?.coordinates ||
                                       (venueData?.location?.type === 'Point' ? venueData.location.coordinates : null);
                    if (venueCoords && Array.isArray(venueCoords) && venueCoords.length === 2) {
                        const distance = recommendationService.calculateDistance(
                            userPreferences.defaultLocation.coordinates[1], // lat
                            userPreferences.defaultLocation.coordinates[0], // lng
                            venueCoords[1], // lat
                            venueCoords[0] // lng
                        );
                        
                        if (distance <= userPreferences.recommendationRadius) {
                            const locationScore = Math.max(0, 40 - (distance / 10));
                            score += locationScore;
                            reasons.push(`Close to your location (${Math.round(distance)} miles away)`);
                        }
                    }
                } catch (error) {
                    console.log(`⚠️ Error getting venue data for ${match.venue.id}: ${error.message}`);
                }
            }

            // Trip-based scoring (proximity to trip venues, temporal alignment, time conflicts)
            if (activeTrips.length > 0 && match.venue?.id && match.fixture?.date) {
                try {
                    const matchDate = new Date(match.fixture.date);
                    const matchVenueData = await venueService.getVenueByApiId(match.venue.id);
                    const matchVenueCoords = matchVenueData?.coordinates || 
                                           matchVenueData?.location?.coordinates ||
                                           (matchVenueData?.location?.type === 'Point' ? matchVenueData.location.coordinates : null);
                    
                    if (matchVenueCoords && Array.isArray(matchVenueCoords) && matchVenueCoords.length === 2) {
                        let bestTripProximity = Infinity;
                        let bestTripMatch = null;
                        let bestTemporalScore = 0;
                        let bestTemporalTrip = null;
                        let hasTimeConflict = false;
                        const matchTime = matchDate.getTime();
                        
                        // Check each active trip
                        for (const trip of activeTrips) {
                            // Extract trip date range
                            const tripMatches = trip.matches || [];
                            if (tripMatches.length === 0) continue;
                            
                            const tripDates = tripMatches.map(m => new Date(m.date)).filter(d => !isNaN(d.getTime()));
                            if (tripDates.length === 0) continue;
                            
                            const tripStart = new Date(Math.min(...tripDates));
                            const tripEnd = new Date(Math.max(...tripDates));
                            const tripStartTime = tripStart.getTime();
                            const tripEndTime = tripEnd.getTime();
                            
                            // Temporal alignment (0-30 points) - calculate best score
                            let temporalScore = 0;
                            if (matchTime >= tripStartTime && matchTime <= tripEndTime) {
                                // Match is within trip date range - highest bonus!
                                temporalScore = 30;
                            } else {
                                // Calculate days difference from trip boundaries
                                const daysFromStart = Math.abs((matchTime - tripStartTime) / (1000 * 60 * 60 * 24));
                                const daysFromEnd = Math.abs((matchTime - tripEndTime) / (1000 * 60 * 60 * 24));
                                const minDaysDiff = Math.min(daysFromStart, daysFromEnd);
                                
                                if (minDaysDiff === 0) {
                                    temporalScore = 30;
                                } else if (minDaysDiff <= 1) {
                                    temporalScore = 25;
                                } else if (minDaysDiff <= 2) {
                                    temporalScore = 20;
                                } else if (minDaysDiff <= 3) {
                                    temporalScore = 15;
                                }
                            }
                            
                            // Keep track of best temporal score
                            if (temporalScore > bestTemporalScore) {
                                bestTemporalScore = temporalScore;
                                bestTemporalTrip = trip;
                            }
                            
                            // Check for time conflicts with trip matches
                            for (const tripMatch of tripMatches) {
                                if (!tripMatch.date) continue;
                                const tripMatchDate = new Date(tripMatch.date);
                                const timeDiff = Math.abs(matchDate.getTime() - tripMatchDate.getTime());
                                
                                // If matches are on same day and within 3 hours, it's a conflict
                                if (timeDiff < (3 * 60 * 60 * 1000) && Math.abs((matchTime - tripMatchDate.getTime()) / (1000 * 60 * 60 * 24)) < 1) {
                                    hasTimeConflict = true;
                                    score -= 50;
                                    reasons.push(`Time conflict with match in trip "${trip.name}"`);
                                    break;
                                }
                            }
                            
                            // Proximity to trip venues (0-40 points)
                            for (const tripMatch of tripMatches) {
                                let tripVenueCoords = null;
                                
                                // Try to get coordinates from venueData
                                if (tripMatch.venueData && tripMatch.venueData.coordinates) {
                                    tripVenueCoords = tripMatch.venueData.coordinates;
                                } else if (tripMatch.venueData && tripMatch.venueData.location?.coordinates) {
                                    tripVenueCoords = tripMatch.venueData.location.coordinates;
                                } else if (tripMatch.venue) {
                                    // Lookup venue by name/ID
                                    try {
                                        const tripVenue = await venueService.getVenueByApiId(tripMatch.venue);
                                        if (tripVenue) {
                                            tripVenueCoords = tripVenue.coordinates || 
                                                            tripVenue.location?.coordinates ||
                                                            (tripVenue.location?.type === 'Point' ? tripVenue.location.coordinates : null);
                                        }
                                    } catch (err) {
                                        // Try finding by venue name (fallback)
                                        try {
                                            const Venue = require('../models/Venue');
                                            const venueByName = await Venue.findOne({ 
                                                name: { $regex: String(tripMatch.venue), $options: 'i' } 
                                            }).lean();
                                            if (venueByName) {
                                                tripVenueCoords = venueByName.coordinates || 
                                                                venueByName.location?.coordinates;
                                            }
                                        } catch (lookupErr) {
                                            // Venue lookup failed, skip this trip match
                                        }
                                    }
                                }
                                
                                if (tripVenueCoords && Array.isArray(tripVenueCoords) && tripVenueCoords.length === 2) {
                                    const distance = recommendationService.calculateDistance(
                                        matchVenueCoords[1], // lat
                                        matchVenueCoords[0], // lng
                                        tripVenueCoords[1], // lat
                                        tripVenueCoords[0] // lng
                                    );
                                    
                                    if (distance < bestTripProximity) {
                                        bestTripProximity = distance;
                                        bestTripMatch = trip;
                                    }
                                }
                            }
                        }
                        
                        // Apply best temporal score (from closest trip in time)
                        if (bestTemporalScore > 0 && bestTemporalTrip) {
                            score += bestTemporalScore;
                            if (matchTime >= new Date(Math.min(...bestTemporalTrip.matches.map(m => new Date(m.date)).filter(d => !isNaN(d.getTime())))).getTime() &&
                                matchTime <= new Date(Math.max(...bestTemporalTrip.matches.map(m => new Date(m.date)).filter(d => !isNaN(d.getTime())))).getTime()) {
                                reasons.push(`Perfect for your trip "${bestTemporalTrip.name}" (within date range)`);
                            } else {
                                const tripDates = bestTemporalTrip.matches.map(m => new Date(m.date)).filter(d => !isNaN(d.getTime()));
                                const tripStart = new Date(Math.min(...tripDates));
                                const tripEnd = new Date(Math.max(...tripDates));
                                const daysFromStart = Math.abs((matchTime - tripStart.getTime()) / (1000 * 60 * 60 * 24));
                                const daysFromEnd = Math.abs((matchTime - tripEnd.getTime()) / (1000 * 60 * 60 * 24));
                                const minDaysDiff = Math.min(daysFromStart, daysFromEnd);
                                
                                if (minDaysDiff === 0) {
                                    reasons.push(`Matches your trip "${bestTemporalTrip.name}" date`);
                                } else if (minDaysDiff <= 1) {
                                    reasons.push(`Within 1 day of your trip "${bestTemporalTrip.name}"`);
                                } else if (minDaysDiff <= 2) {
                                    reasons.push(`Within 2 days of your trip "${bestTemporalTrip.name}"`);
                                } else if (minDaysDiff <= 3) {
                                    reasons.push(`Within 3 days of your trip "${bestTemporalTrip.name}"`);
                                }
                            }
                        }
                        
                        // Apply proximity score based on closest trip venue
                        if (bestTripProximity !== Infinity && bestTripMatch) {
                            let proximityScore = 0;
                            if (bestTripProximity <= 10) {
                                proximityScore = 40;
                            } else if (bestTripProximity <= 25) {
                                proximityScore = 35;
                            } else if (bestTripProximity <= 50) {
                                proximityScore = 30;
                            } else if (bestTripProximity <= 100) {
                                proximityScore = 25;
                            } else if (bestTripProximity <= 200) {
                                proximityScore = 20;
                            } else {
                                proximityScore = 15;
                            }
                            
                            score += proximityScore;
                            reasons.push(`Within ${Math.round(bestTripProximity)} miles of your trip "${bestTripMatch.name}" venue`);
                        }
                    }
                } catch (error) {
                    console.log(`⚠️ Error processing trip-based scoring for match ${match.fixture?.id}: ${error.message}`);
                }
            }

            // Avoid recently visited stadiums
            const venueName = match.venue?.name?.toLowerCase();
            const recentlyVisited = visitedStadiums.some(visited => {
                const visitedName = visited.venueName?.toLowerCase();
                return visitedName && venueName && visitedName.includes(venueName);
            });
            
            if (recentlyVisited) {
                score -= 20;
                reasons.push('You recently visited this stadium');
            }

            // Avoid already saved matches
            const alreadySaved = savedMatches.some(saved => saved.matchId === match.fixture?.id?.toString());
            if (alreadySaved) {
                score -= 100; // Heavily penalize already saved matches
                reasons.push('You already saved this match');
            }

            // Avoid recently dismissed recommendations
            const recentlyDismissed = recentSearches.some(rec => 
                rec.matchId === match.fixture?.id?.toString() && 
                rec.action === 'dismissed' &&
                (new Date() - new Date(rec.dismissedAt)) < (7 * 24 * 60 * 60 * 1000) // 7 days
            );
            if (recentlyDismissed) {
                score -= 30;
                reasons.push('You recently dismissed this match');
            }

            // Weekend bonus (if user tends to search weekends)
            const matchDate = new Date(match.fixture?.date);
            const dayOfWeek = matchDate.getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday or Saturday
                score += 15;
                reasons.push('Weekend match');
            }

            // High-profile match bonus (derbies, big teams)
            const homeTeam = match.teams?.home?.name?.toLowerCase();
            const awayTeam = match.teams?.away?.name?.toLowerCase();
            const bigTeams = ['manchester united', 'manchester city', 'liverpool', 'arsenal', 'chelsea', 'tottenham', 
                            'real madrid', 'barcelona', 'atletico madrid', 'bayern munich', 'borussia dortmund',
                            'juventus', 'ac milan', 'inter milan', 'psg', 'ajax', 'psv'];
            
            const isBigMatch = bigTeams.some(team => 
                homeTeam?.includes(team) || awayTeam?.includes(team)
            );
            if (isBigMatch) {
                score += 25;
                reasons.push('High-profile match');
            }

            return {
                ...match,
                recommendationScore: score,
                recommendationReasons: reasons
            };
        }));

        // Sort by score and ensure league diversity
        const positiveMatches = scoredMatches.filter(match => match.recommendationScore > 0);
        
        // Group matches by league for diversity
        const matchesByLeague = new Map();
        positiveMatches.forEach(match => {
            const leagueId = match.league?.id?.toString() || 'unknown';
            if (!matchesByLeague.has(leagueId)) {
                matchesByLeague.set(leagueId, []);
            }
            matchesByLeague.get(leagueId).push(match);
        });
        
        // Sort matches within each league by score
        matchesByLeague.forEach((matches, leagueId) => {
            matches.sort((a, b) => b.recommendationScore - a.recommendationScore);
        });
        
        // Distribute matches across leagues to ensure diversity
        // Try to get at least 1-2 matches per league, then fill remaining slots with top scores
        const sortedMatches = [];
        const maxPerLeague = Math.max(2, Math.floor(parseInt(limit) / matchesByLeague.size));
        const leagues = Array.from(matchesByLeague.keys());
        
        // First pass: take top matches from each league
        for (let i = 0; i < maxPerLeague && sortedMatches.length < parseInt(limit); i++) {
            for (const leagueId of leagues) {
                if (sortedMatches.length >= parseInt(limit)) break;
                const leagueMatches = matchesByLeague.get(leagueId);
                if (leagueMatches.length > i) {
                    sortedMatches.push(leagueMatches[i]);
                }
            }
        }
        
        // Second pass: fill remaining slots with highest scoring matches regardless of league
        if (sortedMatches.length < parseInt(limit)) {
            const remaining = positiveMatches
                .filter(match => !sortedMatches.includes(match))
                .sort((a, b) => b.recommendationScore - a.recommendationScore)
                .slice(0, parseInt(limit) - sortedMatches.length);
            sortedMatches.push(...remaining);
        }
        
        // Final sort by score to maintain ranking
        sortedMatches.sort((a, b) => b.recommendationScore - a.recommendationScore);
        
        console.log(`📊 League distribution: ${Array.from(matchesByLeague.keys()).map(leagueId => {
            const count = sortedMatches.filter(m => (m.league?.id?.toString() || 'unknown') === leagueId).length;
            return `${leagueId}:${count}`;
        }).join(', ')}`);

        // Transform matches to match the expected format
        const transformedMatches = [];
        for (const match of sortedMatches) {
            try {
                // Venue can be in match.venue OR match.fixture.venue (check both)
                const venueId = match.venue?.id || match.fixture?.venue?.id;
                const venueData = venueId ? await venueService.getVenueByApiId(venueId) : null;
                
                // Extract venue data - getVenueByApiId returns Venue model or null
                // Use multiple fallbacks to ensure we always have venue info
                // Check fixture.venue first (API-Sports format), then match.venue (transformed format)
                const apiVenueName = match.fixture?.venue?.name || match.venue?.name;
                const apiVenueCity = match.fixture?.venue?.city || match.venue?.city;
                const apiVenueCountry = match.fixture?.venue?.country || match.venue?.country;
                
                const venueName = apiVenueName || venueData?.name || 'Unknown Venue';
                const venueCity = venueData?.city || apiVenueCity || venueData?.name || apiVenueName || null;
                const venueCountry = venueData?.country || apiVenueCountry || 'Unknown';
                const venueCoordinates = venueData?.coordinates || 
                                        venueData?.location?.coordinates || 
                                        (venueData?.location?.type === 'Point' ? venueData.location.coordinates : null) ||
                                        match.fixture?.venue?.coordinates ||
                                        match.venue?.coordinates;
                
                // Debug logging for venue data
                if (!venueData && venueId) {
                    console.log(`⚠️ No venue data found for venue ID: ${venueId}, using API data: ${apiVenueName || 'N/A'}`);
                } else if (!apiVenueName && !venueData) {
                    console.log(`⚠️ No venue name available for match ${match.fixture?.id}, setting to 'Unknown Venue'`);
                }
                
                // Transform to API-Sports format that MatchCard component expects
                transformedMatches.push({
                    id: match.fixture?.id,
                    fixture: {
                        id: match.fixture?.id,
                        date: match.fixture?.date,
                        status: match.fixture?.status || {},
                        venue: {
                            id: venueId || match.venue?.id || match.fixture?.venue?.id || null,
                            name: venueName,
                            city: venueCity,
                            country: venueCountry,
                            coordinates: venueCoordinates
                        }
                    },
                    teams: {
                        home: {
                            id: match.teams?.home?.id,
                            name: match.teams?.home?.name,
                            logo: match.teams?.home?.logo
                        },
                        away: {
                            id: match.teams?.away?.id,
                            name: match.teams?.away?.name,
                            logo: match.teams?.away?.logo
                        }
                    },
                    league: {
                        id: match.league?.id,
                        name: match.league?.name,
                        logo: match.league?.logo
                    },
                    score: match.score || {},
                    recommendationScore: match.recommendationScore,
                    recommendationReasons: match.recommendationReasons
                });
            } catch (error) {
                console.log(`⚠️ Error processing match ${match.fixture?.id}: ${error.message}`);
                // Still include the match but with basic venue info - transform to API-Sports format
                // Check both fixture.venue and match.venue
                const fallbackVenueId = match.venue?.id || match.fixture?.venue?.id;
                const fallbackVenueName = match.fixture?.venue?.name || match.venue?.name || 'Unknown Venue';
                const fallbackVenueCity = match.fixture?.venue?.city || match.venue?.city || match.venue?.name || null;
                const fallbackVenueCountry = match.fixture?.venue?.country || match.venue?.country || 'Unknown';
                const fallbackVenueCoords = match.fixture?.venue?.coordinates || match.venue?.coordinates || null;
                
                transformedMatches.push({
                    id: match.fixture?.id,
                    fixture: {
                        id: match.fixture?.id,
                        date: match.fixture?.date,
                        status: match.fixture?.status || {},
                        venue: {
                            id: fallbackVenueId,
                            name: fallbackVenueName,
                            city: fallbackVenueCity,
                            country: fallbackVenueCountry,
                            coordinates: fallbackVenueCoords
                        }
                    },
                    teams: {
                        home: {
                            id: match.teams?.home?.id,
                            name: match.teams?.home?.name,
                            logo: match.teams?.home?.logo
                        },
                        away: {
                            id: match.teams?.away?.id,
                            name: match.teams?.away?.name,
                            logo: match.teams?.away?.logo
                        }
                    },
                    league: {
                        id: match.league?.id,
                        name: match.league?.name,
                        logo: match.league?.logo
                    },
                    score: match.score || {},
                    recommendationScore: match.recommendationScore,
                    recommendationReasons: match.recommendationReasons
                });
            }
        }
        
        // Cache the recommended matches for future requests (shorter cache for personalized data)
        popularMatchesCache.set(cacheKey, transformedMatches, 3600000); // 1 hour cache
        console.log('💾 Recommended matches cached for future requests');
        
        clearTimeout(timeout);
        res.json({ 
            success: true, 
            matches: transformedMatches, 
            totalFound: upcomingMatches.length,
            totalBeforeFilter: allMatches.length,
            personalized: true,
            dateRange: { from: dateFrom, to: dateTo }, 
            leagues: targetLeagues,
            fromCache: false,
            cachedAt: new Date().toISOString()
        });
    } catch (error) {
        clearTimeout(timeout);
        console.error('❌ Error getting recommended matches:', error);
        console.error('❌ Error stack:', error.stack);
        console.error('❌ Error details:', {
            name: error.name,
            message: error.message,
            code: error.code,
            userId: req.user?.id
        });
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch recommended matches', 
            error: error.message,
            errorType: error.name
        });
    }
});

module.exports = router; 
/**
 * GET /api/matches/cache/stats
 * Get cache statistics (for monitoring)
 */
router.get('/cache/stats', async (req, res) => {
    const stats = matchesCache.getStats();
    const popularStats = popularMatchesCache.getStats();
    res.json({
        success: true,
        matchesCache: stats,
        popularMatchesCache: popularStats
    });
});

/**
 * POST /api/matches/cache/clear
 * Clear the matches cache
 */
router.post('/cache/clear', async (req, res) => {
    matchesCache.clear();
    popularMatchesCache.clear();
    res.json({
        success: true,
        message: 'All matches caches cleared'
    });
});

/**
 * POST /api/matches/cache/clear/popular
 * Clear only the popular matches cache
 */
router.post('/cache/clear/popular', async (req, res) => {
    popularMatchesCache.clear();
    res.json({
        success: true,
        message: 'Popular matches cache cleared'
    });
});

/**
 * GET /api/matches/by-team/:id
 * Get matches for a specific team
 */
router.get('/by-team/:id', async (req, res) => {
    try {
        const teamId = req.params.id;
        const cacheKey = `team_matches_${teamId}`;
        
        // Check cache first
        const cachedMatches = matchesCache.get(cacheKey);
        if (cachedMatches) {
            return res.json({
                success: true,
                matches: cachedMatches,
                fromCache: true
            });
        }

        console.log(`Fetching matches for team ${teamId} for season 2025-2026`);

        // Fetch both upcoming and past matches from API-Sports
        const [upcomingResponse, pastResponse] = await Promise.all([
            axios.get(`${API_SPORTS_BASE_URL}/fixtures`, {
                params: {
                    team: teamId,
                    season: 2025,
                    from: '2025-07-01', // Start of 2025-2026 season
                    to: '2026-06-30'    // End of 2025-2026 season
                },
                headers: {
                    'x-apisports-key': API_SPORTS_KEY
                }
            }),
            axios.get(`${API_SPORTS_BASE_URL}/fixtures`, {
                params: {
                    team: teamId,
                    season: 2025,
                    from: '2025-07-01', // Start of 2025-2026 season
                    to: '2026-06-30',   // End of 2025-2026 season
                    status: 'FT-AET-PEN' // Finished matches
                },
                headers: {
                    'x-apisports-key': API_SPORTS_KEY
                }
            })
        ]);

        console.log('API Responses:', {
            upcoming: {
                results: upcomingResponse.data.results,
                matches: upcomingResponse.data.response?.length
            },
            past: {
                results: pastResponse.data.results,
                matches: pastResponse.data.response?.length
            }
        });

        // Check for valid responses
        if (!upcomingResponse.data.response && !pastResponse.data.response) {
            console.log('No matches found in API response');
            return res.json({
                success: true,
                matches: [],
                message: 'No matches found for this team'
            });
        }

        // Combine and sort all matches
        const allMatches = [
            ...(upcomingResponse.data.response || []),
            ...(pastResponse.data.response || [])
        ];
        
        // Sort by date
        allMatches.sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));

        console.log(`Found ${allMatches.length} total matches`);

        // Transform the matches data
        const matches = await Promise.all(allMatches.map(async match => {
            // Get team data from our database first
            const [homeTeam, awayTeam] = await Promise.all([
                Team.findOne({ apiId: match.teams.home.id }),
                Team.findOne({ apiId: match.teams.away.id })
            ]);

            return {
                id: match.fixture.id,
                fixture: {
                    id: match.fixture.id,
                    date: match.fixture.date,
                    venue: {
                        id: match.fixture.venue?.id,
                        name: match.fixture.venue?.name || (homeTeam?.venue?.stadium || 'Unknown Venue'),
                        city: match.fixture.venue?.city || (homeTeam?.venue?.city || 'Unknown City'),
                        country: match.league?.country || (homeTeam?.venue?.country || 'Unknown Country')
                    },
                    status: {
                        long: match.fixture.status?.long || 'Not Started',
                        short: match.fixture.status?.short || 'NS',
                        elapsed: match.fixture.status?.elapsed || null
                    }
                },
                teams: {
                    home: {
                        id: match.teams.home.id,
                        name: homeTeam?.name || match.teams.home.name,
                        logo: homeTeam?.logo || match.teams.home.logo
                    },
                    away: {
                        id: match.teams.away.id,
                        name: awayTeam?.name || match.teams.away.name,
                        logo: awayTeam?.logo || match.teams.away.logo
                    }
                },
                league: {
                    id: match.league.id,
                    name: match.league.name,
                    country: match.league.country,
                    logo: match.league.logo,
                    season: match.league.season
                },
                goals: match.goals || { home: null, away: null },
                score: match.score || {}
            };
        }));

        // Cache the results
        matchesCache.set(cacheKey, matches);

        res.json({
            success: true,
            matches,
            fromCache: false
        });

    } catch (error) {
        console.error('Error fetching team matches:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch matches',
            error: error.message
        });
    }
});

module.exports = router; 