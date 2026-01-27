const express = require('express');
const axios = require('axios');
const https = require('https');
const { performance } = require('perf_hooks');
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
const { matchesCache, popularMatchesCache, recommendedMatchesCache } = require('../utils/cache');
const { shouldFilterMatch } = require('../utils/matchStatus');
const weights = require('../config/recommendationWeights');
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
            return venueData;
        }
        return null;
    } catch (error) {
        return null;
    }
}
// Batch fetch venue data from API-Football (optimized for processing multiple matches)
// Processes venues in batches of 10 to respect rate limits
async function batchGetVenuesFromApiFootball(venueIds) {
    if (!venueIds || venueIds.length === 0) {
        return new Map();
    }
    // Remove duplicates and filter out null/undefined
    const uniqueIds = [...new Set(venueIds.filter(id => id != null))];
    if (uniqueIds.length === 0) {
        return new Map();
    }
    const venueMap = new Map();
    const uncachedIds = [];
    // Check cache first
    for (const venueId of uniqueIds) {
        if (venueCache.has(venueId)) {
            venueMap.set(venueId, venueCache.get(venueId));
        } else {
            uncachedIds.push(venueId);
        }
    }
    if (uncachedIds.length === 0) {
        if (process.env.NODE_ENV !== 'production') {
        }
        return venueMap;
    }
    if (process.env.NODE_ENV !== 'production') {
    }
    // Process in batches of 10 to respect rate limits
    const BATCH_SIZE = 10;
    const batches = [];
    for (let i = 0; i < uncachedIds.length; i += BATCH_SIZE) {
        batches.push(uncachedIds.slice(i, i + BATCH_SIZE));
    }
    // Process batches sequentially with delay between batches
    for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        // Process batch in parallel
        const batchPromises = batch.map(async (venueId) => {
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
                    return { venueId, venueData };
                }
                return { venueId, venueData: null };
            } catch (error) {
                return { venueId, venueData: null };
            }
        });
        const batchResults = await Promise.allSettled(batchPromises);
        // Add successful results to map
        batchResults.forEach((result) => {
            if (result.status === 'fulfilled' && result.value && result.value.venueData) {
                venueMap.set(result.value.venueId, result.value.venueData);
            }
        });
        // Add delay between batches (except for last batch)
        if (i < batches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    if (process.env.NODE_ENV !== 'production') {
        const successCount = Array.from(venueMap.values()).filter(v => v != null).length;
    }
    return venueMap;
}
/**
 * Shared venue resolution logic - works for all leagues (MLS, EPL, etc.)
 * Tries multiple strategies to find venue coordinates.
 * Supports optional batch maps for O(1) lookups in loops.
 * @param {Object} venue - Venue object from API with id, name, city
 * @param {string} leagueName - League name for logging
 * @param {Object} batchMaps - Optional batch maps for O(1) lookups: { venueMapById, venueMapByName, apiVenuesMap }
 */
async function resolveVenueWithCoordinates(venue, leagueName = 'Unknown', batchMaps = {}) {
    if (!venue) return null;
    const { venueMapById, venueMapByName, apiVenuesMap } = batchMaps;
    const useBatchMaps = venueMapById || venueMapByName;
    // Strategy 1: Try local DB lookup by API ID
    if (venue.id) {
        const localVenue = venueMapById ? venueMapById.get(venue.id) : await venueService.getVenueByApiId(venue.id);
        const apiVenueData = apiVenuesMap ? apiVenuesMap.get(venue.id) : null;
        if (localVenue) {
            const foundCoords = localVenue.coordinates || localVenue.location?.coordinates;
            if (foundCoords) {
                if (!useBatchMaps) {
                }
                return {
                    id: venue.id,
                    name: localVenue.name,
                    city: localVenue.city,
                    country: localVenue.country,
                    coordinates: foundCoords,
                    capacity: localVenue.capacity,
                    surface: localVenue.surface,
                    address: localVenue.address,
                    image: apiVenueData?.image || localVenue.image || null
                };
            }
        }
    }
    // Strategy 2: Try name-based lookup (handles "Unknown City" and null city)
    if (venue.name) {
        const cityForLookup = (venue.city === 'Unknown City' || venue.city === 'Unknown' || !venue.city) ? null : venue.city;
        let byName = null;
        if (venueMapByName) {
            // Check multiple key formats to handle database vs API city mismatches
            // The DB stores "Gillette Stadium|Foxborough" but API sends "Gillette Stadium|" (null city)
            const keyWithCity = `${venue.name}|${cityForLookup || ''}`;
            byName = venueMapByName.get(keyWithCity);
            // If not found and we're searching with empty city, iterate to find by name only
            if (!byName && !cityForLookup) {
                for (const [key, value] of venueMapByName.entries()) {
                    if (key.startsWith(`${venue.name}|`)) {
                        byName = value;
                        break;
                    }
                }
            }
        } else {
            if (!useBatchMaps) {
            }
            byName = await venueService.getVenueByName(venue.name, cityForLookup);
        }
        const foundCoords = byName?.coordinates || byName?.location?.coordinates;
        if (byName && foundCoords) {
            if (!useBatchMaps) {
            }
            return {
                id: venue.id || byName.venueId || `venue-${venue.name.replace(/\s+/g, '-').toLowerCase()}`,
                name: byName.name,
                city: byName.city,
                country: byName.country,
                coordinates: foundCoords,
                capacity: byName.capacity,
                surface: byName.surface,
                address: byName.address,
                image: byName.image
            };
        } else if (byName && !useBatchMaps) {
        } else if (!byName && !useBatchMaps) {
        }
    }
    return null;
}
// Function to transform API-Sports data to match frontend expectations
async function transformApiSportsData(apiResponse, competitionId, bounds = null, searchSessionId = 'unknown') {
    const fixtures = apiResponse.response || [];
    const leagueName = await leagueService.getLeagueNameById(competitionId);
    if (fixtures.length > 0) {
        console.log({
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
                        // Try local DB lookup by API ID for all leagues (not just PL)
                        if (apiVenue?.id) {
                            const localVenue = await venueService.getVenueByApiId(apiVenue.id);
                            if (localVenue) {
                                const foundCoords = localVenue.coordinates || localVenue.location?.coordinates;
                                if (foundCoords) {
                                return {
                                    id: apiVenue.id,
                                    name: localVenue.name,
                                    city: localVenue.city,
                                    country: localVenue.country,
                                        coordinates: foundCoords,
                                    capacity: localVenue.capacity,
                                    surface: localVenue.surface,
                                    address: localVenue.address,
                                    image: localVenue.image
                                };
                                }
                            }
                        }
                        // API venue by ID (for additional metadata)
                        if (apiVenue?.id) {
                            apiFootballVenue = await getVenueFromApiFootball(apiVenue.id);
                            if (apiFootballVenue) {
                                // Don't return early - let geocoding handle coordinates
                                // Just store the venue data for later processing
                            }
                        }
                        // Look up by name in our DB
                        // Treat "Unknown City" as null to allow name-only matching
                        if (apiVenue?.name) {
                            const cityForLookup = (apiVenue.city === 'Unknown City' || apiVenue.city === 'Unknown' || !apiVenue.city) ? null : apiVenue.city;
                            const byName = await venueService.getVenueByName(apiVenue.name, cityForLookup);
                            // Check both potential coordinate fields (GeoJSON vs Flat array)
                            const foundCoords = byName?.coordinates || byName?.location?.coordinates;
                            if (byName && foundCoords) {
                                return {
                                    id: apiVenue.id || `venue-${apiVenue.name.replace(/\s+/g, '-').toLowerCase()}`,
                                    name: byName.name,
                                    city: byName.city,
                                    country: byName.country,
                                    coordinates: foundCoords
                                };
                            } else if (byName) {
                            } else {
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
                        }
                        // Geocode as last resort (skip if city is "Unknown")
                        if (!minimal.coordinates && minimal.name) {
                            const hasValidCity = minimal.city && minimal.city !== 'Unknown City' && minimal.city !== 'Unknown';
                            if (hasValidCity) {
                            try {
                                // Try geocoding with venue name + city + country
                                const geocodeQuery = minimal.country ? 
                                    `${minimal.name}, ${minimal.city}, ${minimal.country}` :
                                    `${minimal.name}, ${minimal.city}`;
                                const coords = await geocodingService.geocodeVenueCoordinates(
                                    minimal.name,
                                    minimal.city,
                                    minimal.country
                                );
                                if (coords) {
                                    // Persist for future
                                    const savedVenue = await venueService.saveVenueWithCoordinates({
                                        venueId: apiVenue?.id || null,
                                        name: minimal.name,
                                        city: minimal.city,
                                        country: minimal.country,
                                        coordinates: coords
                                    });
                                    minimal.coordinates = coords;
                                }
                            } catch (e) {
                                console.error(`❌ Geocoding error for ${minimal.name}:`, e.message);
                                }
                            } else {
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
                                name: await (async () => {
                                    const mappedName = await teamService.mapApiNameToTeam(fx.teams.home.name);
                                    return mappedName;
                                })(),
                                logo: fx.teams.home.logo,
                                ticketingUrl: await (async () => {
                                    const mappedName = await teamService.mapApiNameToTeam(fx.teams.home.name);
                                    const team = await Team.findOne({ name: mappedName });
                                    return team?.ticketingUrl || undefined;
                                })()
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
                        if (hasCoords && isWithinBounds(transformed.fixture.venue.coordinates, bounds, searchSessionId)) {
                            transformedFixtures.push(transformed);
                        } else {
                        }
                    } else {
                        // No bounds: include even without coordinates so lists still show
                        transformedFixtures.push(transformed);
                    }
                } catch (err) {
                    console.error(`❌ Error processing fixture ${fx.fixture?.id}:`, err);
                }
            }
            return transformedFixtures;
        })()
    };
}
// Function to check if coordinates are within bounds
function isWithinBounds(coordinates, bounds, searchSessionId = 'unknown') {
    if (!coordinates || !bounds || coordinates.length !== 2) {
        return false;
    }
    const [lon, lat] = coordinates;
    const { northeast, southwest } = bounds;
    const result = lat >= southwest.lat && lat <= northeast.lat &&
           lon >= southwest.lng && lon <= northeast.lng;
    // Removed verbose logging - only log in debug mode if needed
    // console.log(`🔍 [${searchSessionId}] Bounds check: venue coords [${lon}, ${lat}] vs bounds NE[${northeast.lat}, ${northeast.lng}] SW[${southwest.lat}, ${southwest.lng}] = ${result}`);
    return result;
}
// Function to generate a bounds hash for cache key
// Rounds bounds to ~10km grid to allow similar viewports to share cache
function generateBoundsHash(bounds) {
    if (!bounds || !bounds.northeast || !bounds.southwest) {
        return 'unknown';
    }
    // Round to ~10km precision (approximately 0.09 degrees)
    const precision = 0.09;
    const neLat = Math.round(bounds.northeast.lat / precision) * precision;
    const neLng = Math.round(bounds.northeast.lng / precision) * precision;
    const swLat = Math.round(bounds.southwest.lat / precision) * precision;
    const swLng = Math.round(bounds.southwest.lng / precision) * precision;
    // Create a simple hash string
    return `${neLat.toFixed(2)}_${neLng.toFixed(2)}_${swLat.toFixed(2)}_${swLng.toFixed(2)}`;
}
// Function to calculate distance between two points in miles
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    // Clamp a to [0, 1] to avoid NaN from floating point precision issues
    const clampedA = Math.min(1, Math.max(0, a));
    const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));
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
    // Clamp a to [0, 1] to avoid NaN from floating point precision issues
    const clampedA = Math.min(1, Math.max(0, a));
    const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));
    return R * c; // Distance in kilometers
}
// Helper function to create a consistent bounds hash for caching
function createBoundsHash(bounds) {
    // Round to 2 decimal places for cache efficiency (approximately 1km precision)
    const neLat = Math.round(bounds.northeast.lat * 100) / 100;
    const neLng = Math.round(bounds.northeast.lng * 100) / 100;
    const swLat = Math.round(bounds.southwest.lat * 100) / 100;
    const swLng = Math.round(bounds.southwest.lng * 100) / 100;
    return `${neLat}-${neLng}-${swLat}-${swLng}`;
}
// Country coordinate mapping (approximate country centers for geographic filtering)
// Expanded to cover more countries and reduce "unknown" cache key issues
// Regional International Competitions (UEFA, CAF, CONMEBOL, CONCACAF, AFC)
// This is used to filter "International" competitions to only those relevant to the search region
const REGIONAL_INTERNATIONALS = {
    'Europe': [2, 3, 4, 5, 9, 15, 848], // UCL, UEL, Nations League, Euro, etc.
    'Africa': [12, 11, 455], // CAF Champions League, African Nations Cup, etc.
    'SouthAmerica': [13, 11, 12, 14], // Copa Libertadores, Sudamericana, Copa America, etc.
    'NorthAmerica': [16, 253, 254], // CONCACAF Champions League, Leagues Cup, etc.
    'Asia': [281, 17, 18], // AFC Champions League, Asian Cup, etc.
};
// Global/Elite International Competitions that should be checked everywhere
const GLOBAL_INTERNATIONAL_IDS = [1]; // World Cup
/**
 * Detect which geographic regions intersect with the search bounds
 * @param {Object} bounds - Search bounds { northeast, southwest }
 * @returns {Set<string>} - Set of intersecting region names
 */
function getIntersectingRegions(bounds) {
    const regions = new Set();
    // Define region bounding boxes (approximate)
    const REGION_BOUNDS = {
        'Europe': { ne: { lat: 71, lng: 40 }, sw: { lat: 35, lng: -10 } },
        'Africa': { ne: { lat: 37, lng: 52 }, sw: { lat: -35, lng: -20 } },
        'SouthAmerica': { ne: { lat: 15, lng: -30 }, sw: { lat: -55, lng: -85 } },
        'NorthAmerica': { ne: { lat: 75, lng: -50 }, sw: { lat: 15, lng: -170 } },
        'Asia': { ne: { lat: 75, lng: 180 }, sw: { lat: -10, lng: 60 } },
        'AsiaPacific': { ne: { lat: 75, lng: 180 }, sw: { lat: -50, lng: 60 } }
    };
    for (const [region, regBounds] of Object.entries(REGION_BOUNDS)) {
        // Check for intersection between search bounds and region bounds
        const latIntersects = Math.max(bounds.southwest.lat, regBounds.sw.lat) <= Math.min(bounds.northeast.lat, regBounds.ne.lat);
        const lngIntersects = Math.max(bounds.southwest.lng, regBounds.sw.lng) <= Math.min(bounds.northeast.lng, regBounds.ne.lat);
        if (latIntersects && lngIntersects) {
            regions.add(region);
        }
    }
    return regions;
}
const COUNTRY_COORDS = {
    // Western Europe
    'England': { lat: 52.3555, lng: -1.1743 },
    'Scotland': { lat: 56.4907, lng: -4.2026 },
    'Wales': { lat: 52.1307, lng: -3.7837 },
    'Northern-Ireland': { lat: 54.7877, lng: -6.4923 },
    'Ireland': { lat: 53.1424, lng: -7.6921 },
    'France': { lat: 46.6034, lng: 1.8883 },
    'Spain': { lat: 40.4637, lng: -3.7492 },
    'Portugal': { lat: 39.3999, lng: -8.2245 },
    'Italy': { lat: 41.8719, lng: 12.5674 },
    'Germany': { lat: 51.1657, lng: 10.4515 },
    'Netherlands': { lat: 52.1326, lng: 5.2913 },
    'Belgium': { lat: 50.5039, lng: 4.4699 },
    'Switzerland': { lat: 46.8182, lng: 8.2275 },
    'Austria': { lat: 47.5162, lng: 14.5501 },
    // Nordic countries
    'Denmark': { lat: 56.2639, lng: 9.5018 },
    'Sweden': { lat: 60.1282, lng: 18.6435 },
    'Norway': { lat: 60.4720, lng: 8.4689 },
    'Finland': { lat: 61.9241, lng: 25.7482 },
    'Iceland': { lat: 64.9631, lng: -19.0208 },
    // Eastern Europe
    'Poland': { lat: 51.9194, lng: 19.1451 },
    'Czech-Republic': { lat: 49.8175, lng: 15.4730 },
    'Czechia': { lat: 49.8175, lng: 15.4730 },
    'Hungary': { lat: 47.1625, lng: 19.5033 },
    'Romania': { lat: 45.9432, lng: 24.9668 },
    'Bulgaria': { lat: 42.7339, lng: 25.4858 },
    'Ukraine': { lat: 48.3794, lng: 31.1656 },
    'Russia': { lat: 61.5240, lng: 105.3188 },
    'Serbia': { lat: 44.0165, lng: 21.0059 },
    'Croatia': { lat: 45.1000, lng: 15.2000 },
    'Slovenia': { lat: 46.1512, lng: 14.9955 },
    'Slovakia': { lat: 48.6690, lng: 19.6990 },
    'Bosnia-Herzegovina': { lat: 43.9159, lng: 17.6791 },
    'Montenegro': { lat: 42.7087, lng: 19.3744 },
    'North-Macedonia': { lat: 41.5124, lng: 21.7453 },
    'Albania': { lat: 41.1533, lng: 20.1683 },
    'Kosovo': { lat: 42.6026, lng: 20.9030 },
    // Southern Europe / Mediterranean
    'Greece': { lat: 39.0742, lng: 21.8243 },
    'Cyprus': { lat: 35.1264, lng: 33.4299 },
    'Malta': { lat: 35.9375, lng: 14.3754 },
    // Middle East
    'Turkey': { lat: 38.9637, lng: 35.2433 },
    'Saudi Arabia': { lat: 23.8859, lng: 45.0792 },
    'Saudi-Arabia': { lat: 23.8859, lng: 45.0792 },
    'UAE': { lat: 23.4241, lng: 53.8478 },
    'United-Arab-Emirates': { lat: 23.4241, lng: 53.8478 },
    'Qatar': { lat: 25.3548, lng: 51.1839 },
    'Israel': { lat: 31.0461, lng: 34.8516 },
    'Iran': { lat: 32.4279, lng: 53.6880 },
    // Americas
    'USA': { lat: 39.8283, lng: -98.5795 },
    'Canada': { lat: 56.1304, lng: -106.3468 },
    'Mexico': { lat: 23.6345, lng: -102.5528 },
    'Brazil': { lat: -14.2350, lng: -51.9253 },
    'Argentina': { lat: -38.4161, lng: -63.6167 },
    'Colombia': { lat: 4.5709, lng: -74.2973 },
    'Chile': { lat: -35.6751, lng: -71.5430 },
    'Peru': { lat: -9.1900, lng: -75.0152 },
    'Ecuador': { lat: -1.8312, lng: -78.1834 },
    'Uruguay': { lat: -32.5228, lng: -55.7658 },
    'Paraguay': { lat: -23.4425, lng: -58.4438 },
    'Venezuela': { lat: 6.4238, lng: -66.5897 },
    'Bolivia': { lat: -16.2902, lng: -63.5887 },
    // Asia
    'Japan': { lat: 36.2048, lng: 138.2529 },
    'South-Korea': { lat: 35.9078, lng: 127.7669 },
    'China': { lat: 35.8617, lng: 104.1954 },
    'India': { lat: 20.5937, lng: 78.9629 },
    'Australia': { lat: -25.2744, lng: 133.7751 },
    'Indonesia': { lat: -0.7893, lng: 113.9213 },
    'Thailand': { lat: 15.8700, lng: 100.9925 },
    'Vietnam': { lat: 14.0583, lng: 108.2772 },
    'Malaysia': { lat: 4.2105, lng: 101.9758 },
    'Singapore': { lat: 1.3521, lng: 103.8198 },
    // Africa
    'Egypt': { lat: 26.8206, lng: 30.8025 },
    'South-Africa': { lat: -30.5595, lng: 22.9375 },
    'Morocco': { lat: 31.7917, lng: -7.0926 },
    'Algeria': { lat: 28.0339, lng: 1.6596 },
    'Tunisia': { lat: 33.8869, lng: 9.5375 },
    'Nigeria': { lat: 9.0820, lng: 8.6753 },
    'Ghana': { lat: 7.9465, lng: -1.0232 },
    'Senegal': { lat: 14.4974, lng: -14.4524 },
    'Cameroon': { lat: 7.3697, lng: 12.3547 },
    'Ivory-Coast': { lat: 7.5400, lng: -5.5471 },
    'Kenya': { lat: -0.0236, lng: 37.9062 }
};
// Helper function to detect country from bounds with improved fallback
// Now also tracks nearby countries for border region handling (e.g., Munich near Austria/Germany border)
function detectCountryFromBounds(bounds) {
    const centerLat = (bounds.northeast.lat + bounds.southwest.lat) / 2;
    const centerLng = (bounds.northeast.lng + bounds.southwest.lng) / 2;
    // Find the closest country within threshold
    let searchCountry = null;
    let minDistance = Infinity;
    // Increased threshold to 800km to catch more border regions
    const DISTANCE_THRESHOLD = 750;
    // NEW: Track ALL nearby countries within 400km for border region handling
    // This fixes issues where border cities are closer to a neighboring country's center
    // Examples:
    //   - Munich (Germany) → Austria center: 240km, Germany center: 340km → includes both
    //   - Lille (France) → Belgium center: 150km, France center: 200km → includes both
    //   - Strasbourg (France) → Germany center: 200km → includes both
    //   - Milan (Italy) → Switzerland center: 150km → includes both
    //   - Detroit (USA) → Canada center: 300km → includes both
    // 400km (~250 miles) covers most border regions while avoiding over-inclusion
    const NEARBY_THRESHOLD = 400;
    const nearbyCountries = [];
    for (const [countryName, coords] of Object.entries(COUNTRY_COORDS)) {
        const distance = calculateDistanceKm(centerLat, centerLng, coords.lat, coords.lng);
        if (distance < minDistance && distance < DISTANCE_THRESHOLD) {
            minDistance = distance;
            searchCountry = countryName;
        }
        // Track all countries within nearby threshold for "domestic" league consideration
        if (distance < NEARBY_THRESHOLD) {
            nearbyCountries.push({ country: countryName, distance });
        }
    }
    // Sort nearby countries by distance
    nearbyCountries.sort((a, b) => a.distance - b.distance);
    // If no country found, use regional fallback
    if (!searchCountry) {
        // Define broad regional groupings as fallback
        if (centerLat > 35 && centerLat < 71 && centerLng > -25 && centerLng < 60) {
            // Europe/Middle East region - use "Europe" as fallback
            searchCountry = 'Europe-Region';
        } else if (centerLat > -55 && centerLat < 75 && centerLng > -170 && centerLng < -30) {
            // Americas region
            searchCountry = 'Americas-Region';
        } else if (centerLat > -50 && centerLat < 75 && centerLng > 60 && centerLng < 180) {
            // Asia-Pacific region
            searchCountry = 'AsiaPacific-Region';
        } else if (centerLat > -40 && centerLat < 40 && centerLng > -25 && centerLng < 60) {
            // Africa region
            searchCountry = 'Africa-Region';
        } else {
            // Ocean or very remote area - use coordinates as unique identifier
            // Round to nearest degree to still allow some caching
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
        nearbyCountries: nearbyCountries.map(c => c.country) // NEW: List of all nearby countries for domestic league check
    };
}
// Helper function to filter leagues by geographic relevance and subscription tier
async function getRelevantLeagueIds(bounds, user = null) {
    // Calculate center point of search bounds
    const centerLat = (bounds.northeast.lat + bounds.southwest.lat) / 2;
    const centerLng = (bounds.northeast.lng + bounds.southwest.lng) / 2;
    // Get accessible leagues based on subscription tier
    const accessibleLeagueIds = await subscriptionService.getAccessibleLeagues(user);
    const accessibleLeagueIdsSet = new Set(accessibleLeagueIds.map(id => id.toString()));
    // Detect country and nearby countries for domestic league filtering
    const countryDetection = detectCountryFromBounds(bounds);
    // FIX: Empty array is truthy, so check length instead
    let nearbyCountries = countryDetection.nearbyCountries && countryDetection.nearbyCountries.length > 0 
        ? [...countryDetection.nearbyCountries] 
        : [];
    // ALWAYS include the primary detected country, even if it's far from center
    // This fixes the "Chicago is 719km from USA center" problem
    if (countryDetection.country && !nearbyCountries.includes(countryDetection.country)) {
        // Only add real countries, not regional fallbacks
        if (!countryDetection.country.endsWith('-Region') && !countryDetection.country.startsWith('Remote-')) {
            nearbyCountries.push(countryDetection.country);
        }
    }
    // If we got a regional fallback and still have no countries, expand the region
    if (nearbyCountries.length === 0 && countryDetection.country) {
        if (countryDetection.country === 'Americas-Region') {
            nearbyCountries = ['USA', 'Canada', 'Mexico'];
        } else if (countryDetection.country === 'Europe-Region') {
            nearbyCountries = ['England', 'Spain', 'Germany', 'Italy', 'France'];
        } else if (countryDetection.country === 'AsiaPacific-Region') {
            nearbyCountries = ['Japan', 'Australia', 'South-Korea', 'China'];
        } else if (countryDetection.country === 'Africa-Region') {
            nearbyCountries = ['Egypt', 'South-Africa', 'Morocco', 'Nigeria'];
        }
    }
    // Get all active leagues from MongoDB
    const dbLeagues = await League.find({ isActive: true }).select('apiId country name').lean();
    // Get API mappings for leagues not in database
    const apiMappings = leagueService.getApiLeagueMappings();
    // Create a Set of database league API IDs for quick lookup
    const dbLeagueIds = new Set(dbLeagues.map(l => String(l.apiId)));
    // Merge database leagues with API mappings (only include mappings not in database)
    const allLeagues = [...dbLeagues];
    // Add API mappings that aren't in database
    Object.entries(apiMappings).forEach(([apiId, leagueData]) => {
        if (!dbLeagueIds.has(apiId)) {
            allLeagues.push({
                apiId: apiId,
                country: leagueData.country,
                name: leagueData.name
            });
        }
    });
    // Get intersecting regions for international competition filtering
    const activeRegions = getIntersectingRegions(bounds);
    const relevantLeagueIds = [];
    for (const league of allLeagues) {
        let shouldInclude = false;
        const leagueId = parseInt(league.apiId);
        const leagueIdStr = String(league.apiId);
        // A. DOMESTIC: If country is nearby, include ALL its leagues
        if (nearbyCountries.includes(league.country)) {
                    shouldInclude = true;
        }
        // B. INTERNATIONAL: Filter based on detected regions
        else if (league.country === 'International' || league.country === 'Europe') {
            // 1. Always include global elite competitions (World Cup)
            if (GLOBAL_INTERNATIONAL_IDS.includes(leagueId)) {
                shouldInclude = true;
            }
            // 2. Include regional internationals if the search box intersects that region
            else {
                for (const [region, ids] of Object.entries(REGIONAL_INTERNATIONALS)) {
                    if (activeRegions.has(region) && ids.includes(leagueId)) {
                        shouldInclude = true;
                        break;
                    }
                }
            }
            // 3. Special case for generic "Europe" competitions if we are in Europe
            if (!shouldInclude && activeRegions.has('Europe') && 
                (league.name.includes('Champions League') || league.name.includes('Europa') || 
                 league.name.includes('Nations League') || league.name.includes('Euro'))) {
                    shouldInclude = true;
            }
        }
        // C. REGIONAL LEAGUES: Check regional mappings even for non-International leagues
        // Example: MLS (253) is marked as country: 'USA' but should be included for North America searches
        else {
            for (const [region, ids] of Object.entries(REGIONAL_INTERNATIONALS)) {
                if (activeRegions.has(region) && ids.includes(leagueId)) {
                    shouldInclude = true;
                    break;
                }
            }
        }
        // Apply subscription filter if we decided to include it
        if (shouldInclude) {
            if (accessibleLeagueIdsSet.has(leagueIdStr)) {
                if (!isNaN(leagueId)) {
                    relevantLeagueIds.push(leagueId);
                }
            }
        }
    }
    // Fallback: if no relevant leagues found, include top European leagues plus international (filtered by subscription)
    if (relevantLeagueIds.length === 0) {
        const fallbackApiIds = ['39', '140', '78', '135', '61', '62', '2', '3']; // PL, La Liga, Bundesliga, Serie A, Ligue 1, Ligue 2, UCL, UEL
        const fallbackLeagues = await League.find({ 
            apiId: { $in: fallbackApiIds },
            isActive: true 
        }).select('apiId').lean();
        // Filter fallback leagues by subscription access
        const filteredFallback = fallbackLeagues
            .filter(l => accessibleLeagueIdsSet.has(l.apiId))
            .map(l => parseInt(l.apiId))
            .filter(id => !isNaN(id));
        return filteredFallback;
    }
    return relevantLeagueIds;
}
// Helper function to calculate season based on competition type and date
function calculateSeasonForCompetition(competitionId, dateFrom) {
    if (!dateFrom) {
        return '2025'; // Default
    }
    const startYear = new Date(dateFrom).getFullYear();
    const startMonth = new Date(dateFrom).getMonth() + 1;
    // World Cup (ID 1) uses the year of the tournament as the season
    if (competitionId === '1' || competitionId === 1) {
        const season = startYear.toString();
        return season;
    }
    // MLS (ID 253) runs March-November typically, but 2026 season starts February 21st
    if (competitionId === '253' || competitionId === 253) {
        let season;
        const dateFromObj = new Date(dateFrom);
        // Special case for 2026: season starts February 21st
        if (startYear === 2026) {
            const seasonStart2026 = new Date('2026-02-21');
            if (dateFromObj >= seasonStart2026) {
                season = '2026';
            } else {
                // Before Feb 21, 2026: use previous year (2025)
                season = '2025';
            }
        } else if (startMonth >= 3) {
            // For other years, use current year for March+
            season = startYear.toString();
        } else {
            // Jan-Feb: use previous year (off-season, but might have preseason matches)
            season = (startYear - 1).toString();
        }
        return season;
    }
    // Brazilian Serie A (ID 71) now runs on calendar year (starts January)
    if (competitionId === '71' || competitionId === 71) {
        const season = startYear.toString();
        return season;
    }
    // For European leagues, determine season based on month
    // If date is in second half of year (July+), it's the start of that season
    // If date is Jan-June, it's still the previous season
    let season;
    if (startMonth >= 7) {
        season = startYear.toString();
    } else {
        season = (startYear - 1).toString();
    }
    return season;
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
            // Calculate bounds dimensions to check if they're reasonable
            const latSpan = bounds.northeast.lat - bounds.southwest.lat;
            const lngSpan = bounds.northeast.lng - bounds.southwest.lng;
            // Check if bounds seem too large (might indicate a buffer zone or zoom issue)
            if (latSpan > 10 || lngSpan > 10) {
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
        const hasAccess = await subscriptionService.hasLeagueAccess(user, competitionId);
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
        // Determine season based on competition type and date range
        let season = '2025'; // Default for regular leagues
        if (dateFrom) {
            const startYear = new Date(dateFrom).getFullYear();
            const startMonth = new Date(dateFrom).getMonth() + 1;
            // World Cup (ID 1) uses the year of the tournament as the season
            if (competitionId === '1' || competitionId === 1) {
                season = startYear.toString();
            } else if (competitionId === '253' || competitionId === 253) {
                // MLS (ID 253) runs March-November typically, but 2026 season starts February 21st
                // December-February would be off-season, but if queried, use previous year
                const dateFromObj = new Date(dateFrom);
                // Special case for 2026: season starts February 21st
                if (startYear === 2026) {
                    const seasonStart2026 = new Date('2026-02-21');
                    if (dateFromObj >= seasonStart2026) {
                        season = '2026';
                    } else {
                        // Before Feb 21, 2026: use previous year (2025)
                        season = '2025';
                    }
                } else if (startMonth >= 3) {
                    // For other years, use current year for March+
                    season = startYear.toString();
                } else {
                    // Jan-Feb: use previous year (off-season, but might have preseason matches)
                    season = (startYear - 1).toString();
                }
            } else if (competitionId === '71' || competitionId === 71) {
                // Brazilian Serie A (ID 71) now runs on calendar year (starts January)
                // Use current year for all matches in that year
                season = startYear.toString();
            } else {
                // For European leagues (Premier League, etc.), determine season based on month
                // If date is in second half of year (July+), it's the start of that season
                // If date is Jan-June, it's still the previous season
                if (startMonth >= 7) {
                    season = startYear.toString();
                } else {
                    season = (startYear - 1).toString();
                }
            }
        }
        // Special logging for Champions League
        if (competitionId === '2' || competitionId === 2) {
        }
        const cachedData = matchesCache.get(cacheKey);
        if (cachedData) {
            return res.json(cachedData);
        }
        const apiResponse = await axios.get(`${API_SPORTS_BASE_URL}/fixtures`, {
            params: { league: competitionId, season: season, from: dateFrom, to: dateTo },
            headers: { 'x-apisports-key': API_SPORTS_KEY },
            httpsAgent
        });
        // Special logging for World Cup API response
        if (competitionId === '1' || competitionId === 1) {
            console.log({
                season: season,
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
        // Special logging for Champions League API response
        if (competitionId === '2' || competitionId === 2) {
            console.log({
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
        // Special logging for World Cup after transformation
        if (competitionId === '1' || competitionId === 1) {
            console.log({
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
        // Special logging for Champions League after transformation
        if (competitionId === '2' || competitionId === 2) {
            console.log({
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
            // Get user for subscription filtering (optional authentication)
            let user = null;
            if (req.user) {
                user = await User.findById(req.user.id);
            }
            // PHASE 1: Buffer Zones - Expand bounds by 30% to prevent gaps when panning
            const originalBounds = {
                northeast: { lat: parseFloat(neLat), lng: parseFloat(neLng) },
                southwest: { lat: parseFloat(swLat), lng: parseFloat(swLng) }
            };
            // Validate bounds
            if (isNaN(originalBounds.northeast.lat) || isNaN(originalBounds.northeast.lng) ||
                isNaN(originalBounds.southwest.lat) || isNaN(originalBounds.southwest.lng)) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid bounds parameters - all coordinates must be valid numbers' 
                });
            }
            const boundsLatSpan = originalBounds.northeast.lat - originalBounds.southwest.lat;
            const boundsLngSpan = originalBounds.northeast.lng - originalBounds.southwest.lng;
            // Validate bounds span (must be positive)
            if (boundsLatSpan <= 0 || boundsLngSpan <= 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid bounds - northeast must be greater than southwest' 
                });
            }
            // Clamp original bounds to valid coordinate ranges before applying buffer
            // Latitude: -90 to 90, Longitude: -180 to 180
            const clampedOriginalBounds = {
                northeast: {
                    lat: Math.max(-90, Math.min(90, originalBounds.northeast.lat)),
                    lng: Math.max(-180, Math.min(180, originalBounds.northeast.lng))
                },
                southwest: {
                    lat: Math.max(-90, Math.min(90, originalBounds.southwest.lat)),
                    lng: Math.max(-180, Math.min(180, originalBounds.southwest.lng))
                }
            };
            // Recalculate spans after clamping
            const clampedLatSpan = clampedOriginalBounds.northeast.lat - clampedOriginalBounds.southwest.lat;
            const clampedLngSpan = clampedOriginalBounds.northeast.lng - clampedOriginalBounds.southwest.lng;
            const bufferPercent = 0.3; // 30% buffer
            // Calculate buffered bounds and clamp again to ensure valid ranges
            const bounds = {
                northeast: {
                    lat: Math.max(-90, Math.min(90, clampedOriginalBounds.northeast.lat + (clampedLatSpan * bufferPercent))),
                    lng: Math.max(-180, Math.min(180, clampedOriginalBounds.northeast.lng + (clampedLngSpan * bufferPercent)))
                },
                southwest: {
                    lat: Math.max(-90, Math.min(90, clampedOriginalBounds.southwest.lat - (clampedLatSpan * bufferPercent))),
                    lng: Math.max(-180, Math.min(180, clampedOriginalBounds.southwest.lng - (clampedLngSpan * bufferPercent)))
                }
            };
            // PHASE 1: Country-Level Caching - Determine country from bounds center
            // Uses improved detectCountryFromBounds with regional fallbacks AND nearby countries
            const countryDetection = detectCountryFromBounds(bounds);
            const searchCountry = countryDetection.country;
            const searchCenterLat = countryDetection.centerLat;
            const searchCenterLng = countryDetection.centerLng;
            // NEW: Get all nearby countries for more inclusive domestic league matching
            // This fixes the Munich/Bavaria issue where Austria is detected but we need Bundesliga too
            const nearbyCountries = countryDetection.nearbyCountries || [searchCountry];
            // Use country + date range for cache key (no bounds hash for better cache hit rate)
            // This allows all searches in the same country/date range to share cache
            // Frontend will filter by bounds, backend returns all country matches
            const cacheKey = `location-search:${searchCountry}:${dateFrom}:${dateTo}:${season}`;
            // Check cache first
            const cachedData = matchesCache.get(cacheKey);
            if (cachedData) {
                // CACHE VALIDATION: Check if cache seems incomplete
                // For major countries, we expect more than just 1-2 matches
                const majorCountries = ['England', 'Spain', 'Italy', 'Germany', 'France', 'Netherlands', 'Portugal'];
                const isMajorCountry = majorCountries.includes(searchCountry);
                const cachedMatchCount = cachedData.data?.length || 0;
                // If it's a major country and we only have 1-2 matches, cache might be incomplete
                // This can happen if the first search had corrupted coordinates or API issues
                if (isMajorCountry && cachedMatchCount <= 2) {
                    matchesCache.delete(cacheKey);
                    // Fall through to fresh fetch below
                } else {
                    // CACHE CONSISTENCY FIX: Batch enrich matches that are missing coordinates
                    // This handles the case where venues were geocoded after cache was created
                    const matchesWithCoords = [];
                    const matchesMissingCoords = [];
                    const matchesNeedingEnrichment = [];
                    // First pass: separate matches with valid coords from those needing enrichment
                    for (const match of cachedData.data) {
                        const coords = match.fixture?.venue?.coordinates;
                        if (coords && Array.isArray(coords) && coords.length === 2) {
                            const [lon, lat] = coords;
                            if (typeof lon === 'number' && typeof lat === 'number' && 
                                !isNaN(lon) && !isNaN(lat) &&
                                lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90) {
                                matchesWithCoords.push(match);
                                continue;
                            }
                        }
                        // Match needs enrichment
                        matchesNeedingEnrichment.push(match);
                    }
                    // Batch enrichment: collect all venue IDs and names
                    const venueIds = [];
                    const venueNameLookups = [];
                    for (const match of matchesNeedingEnrichment) {
                        const venueId = match.fixture?.venue?.id;
                        const venueName = match.fixture?.venue?.name;
                        const venueCity = match.fixture?.venue?.city;
                        if (venueId) {
                            venueIds.push(venueId);
                        }
                        if (venueName) {
                            venueNameLookups.push({ name: venueName, city: venueCity });
                        }
                    }
                    // Remove duplicates for name lookups
                    const uniqueNameLookups = [...new Map(
                        venueNameLookups.map(v => [`${v.name}|${v.city || ''}`, v])
                    ).values()];
                    // Batch query all venues by ID at once (single database query)
                    let venueMapById = new Map();
                    if (venueIds.length > 0) {
                        const uniqueVenueIds = [...new Set(venueIds)];
                        const Venue = require('../models/Venue');
                        const venues = await Venue.find({ 
                            venueId: { $in: uniqueVenueIds },
                            isActive: true 
                        });
                        venues.forEach(venue => {
                            const coords = venue.coordinates || venue.location?.coordinates;
                            if (coords && Array.isArray(coords) && coords.length === 2) {
                                venueMapById.set(venue.venueId, coords);
                            }
                        });
                    }
                    // Batch query all venues by name (single database query)
                    let venueMapByName = new Map();
                    if (uniqueNameLookups.length > 0) {
                        venueMapByName = await venueService.batchGetVenuesByName(uniqueNameLookups);
                    }
                    // Enrich matches using batch results
                    let enrichedCount = 0;
                    for (const match of matchesNeedingEnrichment) {
                        const venueId = match.fixture?.venue?.id;
                        const venueName = match.fixture?.venue?.name;
                        const venueCity = match.fixture?.venue?.city;
                        let enrichedCoords = null;
                        // Try batch lookup by venue ID first
                        if (venueId && venueMapById.has(venueId)) {
                            enrichedCoords = venueMapById.get(venueId);
                        }
                        // Fallback to batch name lookup (using batch Map)
                        if (!enrichedCoords && venueName) {
                            const key = `${venueName}|${venueCity || ''}`;
                            const byName = venueMapByName.get(key);
                            if (byName) {
                                const coords = byName.coordinates || byName.location?.coordinates;
                                if (coords && Array.isArray(coords) && coords.length === 2) {
                                    enrichedCoords = coords;
                                }
                            }
                        }
                        if (enrichedCoords) {
                            // Update match with coordinates
                            match.fixture.venue.coordinates = enrichedCoords;
                            matchesWithCoords.push(match);
                            enrichedCount++;
                        } else {
                            matchesMissingCoords.push(match);
                        }
                    }
                    // If we enriched any matches, update the cache
                    if (enrichedCount > 0) {
                        matchesCache.set(cacheKey, { data: [...matchesWithCoords, ...matchesMissingCoords] });
                    }
                    // Filter cached matches by original bounds and subscription tier
                    // This ensures we only return matches within the user's requested viewport and accessible leagues
                    const accessibleLeagueIds = await subscriptionService.getAccessibleLeagues(user);
                    const accessibleLeagueIdsSet = new Set(accessibleLeagueIds.map(id => id.toString()));
                    const filteredByOriginalBounds = matchesWithCoords.filter(match => {
                        // First check subscription access
                        const leagueId = match.league?.id?.toString() || match.fixture?.league?.id?.toString();
                        if (leagueId && !accessibleLeagueIdsSet.has(leagueId)) {
                            return false; // User doesn't have access to this league
                        }
                        // Then check bounds
                        const coords = match.fixture?.venue?.coordinates;
                        if (!coords || !Array.isArray(coords) || coords.length !== 2) {
                            return false;
                        }
                        const [lon, lat] = coords;
                        if (typeof lon !== 'number' || typeof lat !== 'number' || 
                            isNaN(lon) || isNaN(lat) ||
                            lon < -180 || lon > 180 || lat < -90 || lat > 90) {
                            return false;
                        }
                        // Filter by original bounds (user's requested viewport)
                        return isWithinBounds(coords, originalBounds);
                    });
                    return res.json({ 
                        success: true, 
                        data: filteredByOriginalBounds, 
                        count: filteredByOriginalBounds.length,
                        fromCache: true,
                        bounds: originalBounds,
                        debug: {
                            withCoordinates: matchesWithCoords.length,
                            filteredByBounds: filteredByOriginalBounds.length,
                            withoutCoordinates: matchesMissingCoords.length,
                            enrichedFromMongoDB: enrichedCount,
                            totalInCache: cachedData.data.length
                        }
                    });
                    // Return early if cache was valid (not invalidated)
                    return;
                }
            }
            // Cache miss or invalidated - fetch fresh data
            // Get relevant league IDs using geographic filtering and subscription tier (similar to /leagues/relevant)
            const majorLeagueIds = await getRelevantLeagueIds(bounds, user);
            if (majorLeagueIds.length === 0) {
                // Fallback to essential leagues
                majorLeagueIds.push(39, 140, 78, 135, 61, 62, 2, 3);
            }
            // Get league names for detailed logging
            const leagueDocs = await League.find({ apiId: { $in: majorLeagueIds.map(id => id.toString()) } }).select('apiId name country').lean();
            const leagueInfo = leagueDocs.map(l => `${l.name} (${l.apiId}, ${l.country})`).join(', ');
            // PHASE 1: Retry Logic with Exponential Backoff
            async function fetchWithRetry(leagueId, maxRetries = 3) {
                for (let attempt = 0; attempt < maxRetries; attempt++) {
                    try {
                        const isFACup = leagueId === 45;
                        // Calculate season for this specific league based on its calendar
                        const leagueSeason = calculateSeasonForCompetition(leagueId.toString(), dateFrom);
                        const params = { league: leagueId, season: leagueSeason, from: dateFrom, to: dateTo };
                        // Log season calculation for all leagues, especially MLS
                        if (leagueId === 253 || isFACup) {
                        }
                        if (isFACup) {
                        }
                        const response = await axios.get(`${API_SPORTS_BASE_URL}/fixtures`, {
                            params: params,
                            headers: { 'x-apisports-key': API_SPORTS_KEY },
                            httpsAgent,
                            timeout: 10000
                        });
                        const fixtureCount = response.data?.response?.length || 0;
                        // Extra logging for FA Cup to compare with Premier League
                        if (isFACup) {
                            console.log({
                                results: response.data?.results || 0,
                                responseLength: fixtureCount,
                                params: params,
                                hasResponse: !!response.data?.response,
                                responseType: Array.isArray(response.data?.response) ? 'array' : typeof response.data?.response,
                                firstFixture: response.data?.response?.[0] ? {
                                    id: response.data.response[0].fixture?.id,
                                    leagueId: response.data.response[0].league?.id,
                                    teams: `${response.data.response[0].teams?.home?.name} vs ${response.data.response[0].teams?.away?.name}`,
                                    date: response.data.response[0].fixture?.date,
                                    venue: response.data.response[0].fixture?.venue?.name,
                                    city: response.data.response[0].fixture?.venue?.city
                                } : null,
                                rawResponseKeys: Object.keys(response.data || {})
                            });
                        }
                        // Also log Premier League for comparison
                        if (leagueId === 39) {
                            console.log({
                                results: response.data?.results || 0,
                                responseLength: fixtureCount,
                                params: params
                            });
                        }
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
                    }
                } else {
                    console.error(`❌ League request failed:`, s.reason);
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
            // PHASE 2: Early Subscription Filtering - Filter BEFORE venue enrichment to avoid wasted lookups
            const accessibleLeagueIds = await subscriptionService.getAccessibleLeagues(user);
            const accessibleLeagueIdsSet = new Set(accessibleLeagueIds.map(id => id.toString()));
            const accessibleFixtures = uniqueFixtures.filter(match => {
                const leagueIdStr = match.league?.id?.toString();
                return !leagueIdStr || accessibleLeagueIdsSet.has(leagueIdStr);
            });
            // Track matches filtered out (starts with subscription filtering, then adds bounds filtering)
            let matchesFilteredOut = uniqueFixtures.length - accessibleFixtures.length;
            if (process.env.NODE_ENV !== 'production' && matchesFilteredOut > 0) {
            }
            // PHASE 3: Collect All Venue Data Upfront
            const venueIds = [];
            const venueNameLookups = [];
            for (const match of accessibleFixtures) {
                const venue = match.fixture?.venue;
                if (venue?.id) {
                    venueIds.push(venue.id);
                }
                // Include venues with name, even if city is null/Unknown (for MLS 2026 fixtures)
                if (venue?.name) {
                    const cityForLookup = (venue.city === 'Unknown City' || venue.city === 'Unknown' || !venue.city) ? null : venue.city;
                    venueNameLookups.push({ name: venue.name, city: cityForLookup });
                }
            }
            // Remove duplicates
            const uniqueVenueIds = [...new Set(venueIds)];
            const uniqueVenueNames = [...new Map(
                venueNameLookups.map(v => [`${v.name}|${v.city}`, v])
            ).values()];
            if (process.env.NODE_ENV !== 'production') {
            }
            // PHASE 4: Batch Fetch All Venue Data
            const batchStartTime = performance.now();
            // Batch fetch from MongoDB by ID
            const venueMapById = await venueService.batchGetVenuesById(uniqueVenueIds);
            // Batch fetch from MongoDB by name (for fallbacks)
            const venueMapByName = await venueService.batchGetVenuesByName(uniqueVenueNames);
            // Batch fetch from API-Sports for images
            const apiVenuesMap = await batchGetVenuesFromApiFootball(uniqueVenueIds);
            const batchEndTime = performance.now();
            if (process.env.NODE_ENV !== 'production') {
            }
            // Transform and filter by bounds
            const transformedMatches = [];
            let matchesWithoutCoords = 0;
            let matchesByLeague = {}; // Track matches by league for logging
            const venuesNeedingGeocode = []; // Collect venues needing geocoding for batch processing
            for (const match of accessibleFixtures) {
                const leagueId = match.league?.id;
                if (!matchesByLeague[leagueId]) {
                    matchesByLeague[leagueId] = { total: 0, transformed: 0, noCoords: 0, filteredOut: 0 };
                }
                matchesByLeague[leagueId].total++;
                const venue = match.fixture?.venue;
                let venueInfo = null;
                // Use the shared helper with batch maps for O(1) lookups
                venueInfo = await resolveVenueWithCoordinates(venue, match.league?.name || 'Unknown', {
                    venueMapById,
                    venueMapByName,
                    apiVenuesMap
                });
                // Collect venues needing geocoding (don't geocode yet - batch process after loop)
                if (venueInfo && !venueInfo.coordinates && venueInfo.name && venueInfo.city) {
                    venuesNeedingGeocode.push({
                        match,
                        venueInfo,
                        country: venueInfo.country || match.league?.country,
                        venueId: venue?.id || venueInfo.id || null
                    });
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
                                const geocodedCoords = await geocodingService.geocodeVenueCoordinates(
                                    venueName,
                                    venueCity,
                                    venueCountry
                                );
                                if (geocodedCoords) {
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
                        home: { 
                            id: match.teams.home.id, 
                            name: await (async () => {
                                const mappedName = await teamService.mapApiNameToTeam(match.teams.home.name);
                                return mappedName;
                            })(), 
                            logo: match.teams.home.logo,
                            ticketingUrl: await (async () => {
                                const mappedName = await teamService.mapApiNameToTeam(match.teams.home.name);
                                const team = await Team.findOne({ name: mappedName });
                                return team?.ticketingUrl || undefined;
                            })()
                        },
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
                // Use the country detection that was done at the start of this search
                // searchCountry and nearbyCountries are defined from detectCountryFromBounds call above
                // For city-level searches: include all matches from domestic leagues in the same country
                // This ensures Ligue 1 and Ligue 2 matches appear when searching in France
                // NEW: Also check nearbyCountries for ALL border regions (not just Austria/Germany)
                // This fixes issues where border cities are closer to a neighboring country's center:
                //   - Munich (Germany) near Austria border
                //   - Lille (France) near Belgium border  
                //   - Strasbourg (France) near Germany border
                //   - Milan (Italy) near Switzerland border
                //   - Any other border region within 400km
                const matchLeagueCountry = match.league?.country?.toLowerCase();
                const isDomesticLeague = matchLeagueCountry && (
                    // Check if match is from the closest detected country
                    (searchCountry && searchCountry.toLowerCase() === matchLeagueCountry) ||
                    // OR check if match is from any nearby country (within 400km)
                    nearbyCountries.some(c => c.toLowerCase() === matchLeagueCountry)
                );
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
                        } else if (isWithinBounds(venueInfo.coordinates, bounds)) {
                            // Include matches within buffered bounds (for caching)
                            shouldInclude = true;
                        } else {
                            // Still include matches outside buffered bounds if they're in the country
                            // We'll filter by original bounds when returning to client
                            // This ensures cache has all country matches
                            if (isDomesticLeague) {
                                shouldInclude = true;
                            } else {
                                matchesFilteredOut++;
                                matchesByLeague[leagueId].filteredOut++;
                            }
                        }
                    } else {
                        matchesWithoutCoords++;
                        matchesByLeague[leagueId].noCoords++;
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
                    } else {
                        // Exclude non-relevant league matches without coordinates
                    }
                }
                if (shouldInclude) {
                    transformedMatches.push(transformed);
                    matchesByLeague[leagueId].transformed++;
                }
            }
            // PHASE 5: Batch Geocode Venues Needing Coordinates
            if (venuesNeedingGeocode.length > 0) {
                const geocodeStartTime = performance.now();
                if (process.env.NODE_ENV !== 'production') {
                }
                const geocodeInputs = venuesNeedingGeocode.map(v => ({
                    name: v.venueInfo.name,
                    city: v.venueInfo.city,
                    country: v.country
                }));
                const geocodeResults = await geocodingService.batchGeocodeVenues(geocodeInputs);
                // Apply geocoded coordinates back to matches
                let geocodedCount = 0;
                for (const { match, venueInfo, country, venueId } of venuesNeedingGeocode) {
                    const key = `${venueInfo.name}|${venueInfo.city}|${country}`;
                    const coords = geocodeResults.get(key);
                    if (coords) {
                        venueInfo.coordinates = coords;
                        geocodedCount++;
                        // Save to MongoDB (async, non-blocking)
                        venueService.saveVenueWithCoordinates({
                            venueId: venueId,
                            name: venueInfo.name,
                            city: venueInfo.city,
                            country: country,
                            coordinates: coords
                        }).then(savedVenue => {
                            if (savedVenue && process.env.NODE_ENV !== 'production') {
                            }
                        }).catch(error => {
                            console.error(`❌ Error saving geocoded venue ${venueInfo.name}:`, error.message);
                        });
                        // Update the transformed match if it was already added
                        const transformedMatch = transformedMatches.find(m => m.id === match.fixture.id);
                        if (transformedMatch && transformedMatch.fixture.venue) {
                            transformedMatch.fixture.venue.coordinates = coords;
                        }
                    }
                }
                const geocodeEndTime = performance.now();
                if (process.env.NODE_ENV !== 'production') {
                }
            }
            const leagueStatsString = Object.entries(matchesByLeague).slice(0, 10).map(([id, stats]) => 
                `League ${id}: ${stats.total} total, ${stats.filteredOut} filtered out, ${stats.transformed} transformed`
            ).join(' | ');
            // Sort by date
            transformedMatches.sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));
            // PHASE 1: Cache the results (all country matches, not filtered by bounds)
            const cacheData = {
                success: true,
                data: transformedMatches, // Store all matches, not filtered by bounds
                count: transformedMatches.length
            };
            matchesCache.set(cacheKey, cacheData);
            // PHASE 1: Return ALL matches with valid coordinates (buffer zone included)
            // Client-side will filter by viewport for smooth panning (Google Maps/Airbnb pattern)
            // This allows markers to appear smoothly as user pans without gaps
            // Also filter by subscription tier to ensure only accessible leagues are returned
            const filteredMatches = transformedMatches.filter(match => {
                // Check subscription access
                const matchLeagueId = match.league?.id?.toString() || match.fixture?.league?.id?.toString();
                if (matchLeagueId && !accessibleLeagueIdsSet.has(matchLeagueId)) {
                    return false; // User doesn't have access to this league
                }
                const coords = match.fixture?.venue?.coordinates;
                // Only filter out matches WITHOUT valid coordinates
                if (coords && Array.isArray(coords) && coords.length === 2) {
                    const [lon, lat] = coords;
                    // Validate coordinates are numbers and within world bounds
                    if (typeof lon === 'number' && typeof lat === 'number' && 
                        !isNaN(lon) && !isNaN(lat) &&
                        lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90) {
                        return true; // Include all matches with valid coordinates (buffer zone working!)
                    }
                }
                // Exclude matches without valid coordinates
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
                bounds: originalBounds, // NEW: Tell client the requested viewport bounds
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
                // Calculate season for this specific league based on its calendar
                const leagueSeason = calculateSeasonForCompetition(leagueId, dateFrom);
                requests.push(
                    axios.get(`${API_SPORTS_BASE_URL}/fixtures`, {
                        params: { league: leagueId, season: leagueSeason, from: dateFrom, to: dateTo },
                        headers: { 'x-apisports-key': API_SPORTS_KEY },
                        httpsAgent,
                        timeout: 10000
                    }).then(r => {
                        const matchCount = r.data?.response?.length || 0;
                        return { type: 'league', id: leagueId, data: r.data };
                    })
                      .catch((error) => {
                        console.error(`❌ [AGGREGATED SEARCH] League ${leagueId} (season ${leagueSeason}) API error:`, error.message);
                        return { type: 'league', id: leagueId, data: { response: [] } };
                      })
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
            let totalMatches = 0;
            for (const s of settled) {
                if (s.status === 'fulfilled') {
                    const payload = s.value;
                    if (payload?.data?.response?.length) {
                        const matchCount = payload.data.response.length;
                        totalMatches += matchCount;
                        fixtures.push(...payload.data.response);
                    } else {
                    }
                } else {
                    console.error(`❌ [AGGREGATED SEARCH] Request failed:`, s.reason);
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
                    console.log({
                        hasVenue: !!venue,
                        venueId: venue?.id,
                        venueName: venue?.name,
                        venueCity: venue?.city,
                        venueCountry: venue?.country,
                        venueImage: venue?.image,
                        venueKeys: venue ? Object.keys(venue) : [],
                        fullVenue: venue
                    });
                }
                let venueInfo = null;
                if (venue?.id) {
                    // Always fetch venue data from API-Football to get image (MongoDB doesn't store images)
                    // This is cached, so subsequent calls are fast
                    let apiVenueData = null;
                    try {
                        apiVenueData = await getVenueFromApiFootball(venue.id);
                    } catch (error) {
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
                        home: { 
                            id: match.teams.home.id, 
                            name: await (async () => {
                                const mappedName = await teamService.mapApiNameToTeam(match.teams.home.name);
                                return mappedName;
                            })(), 
                            logo: match.teams.home.logo,
                            ticketingUrl: await (async () => {
                                const mappedName = await teamService.mapApiNameToTeam(match.teams.home.name);
                                const team = await Team.findOne({ name: mappedName });
                                return team?.ticketingUrl || undefined;
                            })()
                        },
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
            if (transformedMatches.length === 0 && totalMatches > 0) {
            }
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
                        })(),
                        ticketingUrl: await (async () => {
                            const mappedTeamName = await teamService.mapApiNameToTeam(fixture.teams.home.name);
                            const team = await Team.findOne({ name: mappedTeamName });
                            return team?.ticketingUrl || undefined;
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
        console.error('❌ Error in /matches/search:', {
            error: error.message,
            stack: error.stack?.split('\n').slice(0, 5).join('\n'),
            query: req.query
        });
        res.status(500).json({ 
            success: false, 
            message: 'Failed to search matches', 
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
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
            clearTimeout(timeout);
            return res.json({ 
                success: true, 
                matches: cachedData, 
                fromCache: true,
                cachedAt: new Date().toISOString()
            });
        }
        const allMatches = [];
        const apiPromises = popularLeagueIds.map(async (leagueId, index) => {
            const leagueName = popularLeagueNames[index];
            try {
                // Calculate season for this specific league based on its calendar
                const leagueSeason = calculateSeasonForCompetition(leagueId.toString(), dateFrom);
                const apiResponse = await axios.get(`${API_SPORTS_BASE_URL}/fixtures`, {
                    params: { league: leagueId, season: leagueSeason, from: dateFrom, to: dateTo },
                    headers: { 'x-apisports-key': API_SPORTS_KEY },
                    httpsAgent,
                    timeout: 10000
                });
                if (apiResponse.data && apiResponse.data.response && apiResponse.data.response.length > 0) {
                    return apiResponse.data.response;
                } else {
                    return [];
                }
            } catch (error) {
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
                    home: await (async () => {
                        const homeTeam = await Team.findOne({ apiId: match.teams.home.id.toString() });
                        return {
                            id: match.teams.home.id,
                            name: match.teams.home.name,
                            logo: match.teams.home.logo,
                            ticketingUrl: homeTeam?.ticketingUrl || undefined
                        };
                    })(),
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
        // Cache is invalidated when:
        // - Trip recommendations are regenerated (adding/removing matches, date changes)
        // - User preferences change (favorite teams/leagues/venues)
        // - User dismisses/saves recommendations
        const cacheKey = `recommended_matches_${userId}_${days}_${limit}`;
        const forceRefresh = req.query.forceRefresh === 'true' || req.query.forceRefresh === '1';
        if (forceRefresh) {
            recommendedMatchesCache.deleteByPattern(`recommended_matches_${userId}_*`);
        }
        const cachedData = recommendedMatchesCache.get(cacheKey);
        if (cachedData && !forceRefresh) {
            clearTimeout(timeout);
            return res.json({ 
                success: true, 
                matches: cachedData, 
                fromCache: true,
                cachedAt: new Date().toISOString()
            });
        }
        // Get user's preferences and behavior data
        const userPreferences = {
            favoriteLeagues: user.preferences?.favoriteLeagues || [],
            favoriteTeams: user.preferences?.favoriteTeams || [],
            favoriteVenues: user.preferences?.favoriteVenues || [],
            defaultLocation: user.preferences?.defaultLocation,
            recommendationRadius: user.preferences?.recommendationRadius || 400,
            defaultSearchRadius: user.preferences?.defaultSearchRadius || 100,
            preferenceStrength: user.preferences?.preferenceStrength || 'standard'
        };
        // Get user's recent search patterns and trip context
        const recentSearches = user.recommendationHistory?.slice(-20) || [];
        const savedMatches = user.savedMatches || [];
        const visitedStadiums = user.visitedStadiums || [];
        const activeTrips = user.trips?.filter(trip => {
            const tripEnd = new Date(trip.matches[trip.matches.length - 1]?.date || trip.createdAt);
            return tripEnd > new Date();
        }) || [];
        // Check if user has active trips with recommendations
        const tripsWithRecommendations = activeTrips.filter(trip => 
            trip.recommendationsVersion === 'v2' && 
            trip.recommendations && 
            Array.isArray(trip.recommendations) &&
            trip.recommendations.length > 0
        );
        let tripRecommendations = [];
        let useTripRecommendations = false;
        if (tripsWithRecommendations.length > 0) {
            useTripRecommendations = true;
            // Aggregate all recommendations from all active trips
            const allTripRecs = [];
            const today = new Date();
            for (const trip of tripsWithRecommendations) {
                // Calculate trip date proximity (days until trip start)
                const tripDates = trip.matches?.map(m => new Date(m.date)).filter(d => !isNaN(d.getTime())) || [];
                const tripStart = tripDates.length > 0 ? new Date(Math.min(...tripDates)) : new Date(trip.createdAt);
                const daysUntilTrip = Math.max(0, Math.floor((tripStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
                // Add trip metadata to each recommendation
                trip.recommendations.forEach(rec => {
                    allTripRecs.push({
                        ...rec,
                        _tripId: trip._id.toString(),
                        _tripName: trip.name,
                        _daysUntilTrip: daysUntilTrip,
                        _tripStartDate: tripStart
                    });
                });
            }
            // Filter out already saved and recently dismissed matches
            const savedMatchIds = new Set(savedMatches.map(s => s.matchId?.toString()));
            const dismissedMatchIds = new Set(
                recentSearches
                    .filter(rec => rec.action === 'dismissed' && rec.tripId)
                    .map(rec => rec.matchId?.toString())
            );
            tripRecommendations = allTripRecs.filter(rec => {
                const matchId = rec.matchId?.toString() || rec.match?.id?.toString() || rec.match?.fixture?.id?.toString();
                return !savedMatchIds.has(matchId) && !dismissedMatchIds.has(matchId);
            });
            // Sort by: trip date proximity (soonest first), then by score (highest first)
            tripRecommendations.sort((a, b) => {
                // First sort by days until trip (soonest trips first)
                if (a._daysUntilTrip !== b._daysUntilTrip) {
                    return a._daysUntilTrip - b._daysUntilTrip;
                }
                // Then by score (highest first)
                return (b.score || 0) - (a.score || 0);
            });
            // Take top N (limit)
            tripRecommendations = tripRecommendations.slice(0, parseInt(limit));
        }
        // Only generate home page recommendations if:
        // 1. We don't have trip recommendations, OR
        // 2. We have trip recommendations but need to supplement (fewer than limit)
        const needHomePageRecommendations = !useTripRecommendations || (useTripRecommendations && tripRecommendations.length < parseInt(limit));
        let dateFrom, dateTo, targetLeagues, allMatches, upcomingMatches, sortedMatches;
        if (needHomePageRecommendations) {
            // Determine date range based on user behavior
            const today = new Date();
            dateFrom = today.toISOString().split('T')[0];
            dateTo = new Date(today.getTime() + (parseInt(days) * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
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
            } else {
                // If lookup failed, try using the IDs directly (they might already be valid API IDs)
                targetLeagues = favoriteLeagueIds;
            }
            // Always include popular leagues as well to ensure diverse results
            const popularLeaguesFromDb = await League.find({ 
                isActive: true,
                tier: 1
            })
            .sort({ country: 1, name: 1 })
            .limit(8)
            .select('apiId')
            .lean();
            const popularLeagueIds = popularLeaguesFromDb.map(l => l.apiId.toString());
            targetLeagues = [...new Set([...targetLeagues, ...popularLeagueIds])]; // Combine and deduplicate
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
            // Fallback to popular leagues from database if no extracted IDs
            if (extractedLeagueIds.length === 0) {
                const popularLeagues = await League.find({ 
                    isActive: true,
                    tier: 1
                })
                .sort({ country: 1, name: 1 })
                .limit(10)
                .select('apiId')
                .lean();
                targetLeagues = popularLeagues.map(l => l.apiId.toString());
            } else {
                targetLeagues = extractedLeagueIds;
            }
        } else {
            // Fallback to popular leagues from database
            const popularLeagues = await League.find({ 
                isActive: true,
                tier: 1
            })
            .sort({ country: 1, name: 1 })
            .limit(10)
            .select('apiId')
            .lean();
            targetLeagues = popularLeagues.map(l => l.apiId.toString());
        }
            // Fetch matches from API
            allMatches = [];
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
                    return apiResponse.data.response;
                } else {
                    return [];
                }
            } catch (error) {
                return [];
            }
        });
        const results = await Promise.allSettled(apiPromises);
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                if (Array.isArray(result.value) && result.value.length > 0) {
                    allMatches.push(...result.value);
                } else {
                }
            } else {
            }
        });
            if (allMatches.length === 0) {
                // If we have trip recommendations, use those. Otherwise return empty.
                if (useTripRecommendations && tripRecommendations.length > 0) {
                    // Continue with trip recommendations only
                } else {
                    clearTimeout(timeout);
                    return res.json({ 
                        success: true, 
                        matches: [], 
                        message: 'No recommended matches found' 
                    });
                }
            }
            // Filter out matches that are in progress or completed
            upcomingMatches = allMatches.filter(match => !shouldFilterMatch(match));
            if (upcomingMatches.length === 0) {
                // If we have trip recommendations, use those. Otherwise return empty.
                if (useTripRecommendations && tripRecommendations.length > 0) {
                    // Continue with trip recommendations only
                } else {
                    clearTimeout(timeout);
                    return res.json({ 
                        success: true, 
                        matches: [], 
                        message: 'No upcoming matches found' 
                    });
                }
            }
        // Filter out already saved and recently dismissed matches (hard filter, not penalty)
        const savedMatchIds = new Set(savedMatches.map(s => s.matchId?.toString()));
        const dismissedMatchIds = new Set(
            recentSearches
                .filter(rec => rec.action === 'dismissed' && (new Date() - new Date(rec.dismissedAt || rec.recommendedAt)) < (7 * 24 * 60 * 60 * 1000))
                .map(rec => rec.matchId?.toString())
        );
        // Score and rank matches based on user preferences
        const scoredMatches = await Promise.all(upcomingMatches.map(async (match) => {
            const matchId = match.fixture?.id?.toString();
            // Hard filter: skip already saved or recently dismissed matches
            if (savedMatchIds.has(matchId) || dismissedMatchIds.has(matchId)) {
                return null;
            }
            let score = weights.baseScore.default;
            const reasons = [];
            // Get preference strength multiplier
            const strengthMult = weights.preferenceStrength[userPreferences.preferenceStrength || 'standard'];
            // League quality score (0-20 points) - prioritize better leagues
            const leagueId = String(match.league?.id || '');
            if (weights.topLeagues.tier1.includes(leagueId)) {
                score += weights.context.leagueQuality.topTier;
            } else if (weights.topLeagues.tier2.includes(leagueId)) {
                score += weights.context.leagueQuality.secondTier;
            } else {
                score += weights.context.leagueQuality.other;
            }
            // Favorite teams bonus (with preference strength multiplier)
            if (userPreferences.favoriteTeams.length > 0) {
                const homeTeamId = String(match.teams?.home?.id || '');
                const awayTeamId = String(match.teams?.away?.id || '');
                for (const favTeam of userPreferences.favoriteTeams) {
                    const favTeamId = favTeam.teamId?.apiId || favTeam.apiId || String(favTeam.teamId || '');
                    if (homeTeamId === favTeamId || awayTeamId === favTeamId) {
                        score += weights.preferences.favoriteTeam.playing * strengthMult.favoriteTeam;
                        reasons.push(`Your favorite team ${favTeam.name || 'is playing'}`);
                        break; // Only count once per match
                    }
                }
            }
            // Favorite leagues bonus (with preference strength multiplier and tier bonus)
            const matchLeagueId = String(match.league?.id || '');
            if (userPreferences.favoriteLeagues.includes(matchLeagueId)) {
                let leagueBoost = weights.preferences.favoriteLeague.directMatch * strengthMult.favoriteLeague;
                // Add tier bonus if applicable
                if (weights.topLeagues.tier1.includes(matchLeagueId)) {
                    leagueBoost += weights.preferences.favoriteLeague.tier.tier1 * strengthMult.favoriteLeague;
                } else if (weights.topLeagues.tier2.includes(matchLeagueId)) {
                    leagueBoost += weights.preferences.favoriteLeague.tier.tier2 * strengthMult.favoriteLeague;
                }
                score += leagueBoost;
                reasons.push(`From your favorite league: ${match.league?.name}`);
            }
            // Favorite venues bonus (with preference strength multiplier)
            if (userPreferences.favoriteVenues.length > 0 && match.venue?.id) {
                const matchVenueId = String(match.venue.id);
                for (const favVenue of userPreferences.favoriteVenues) {
                    const favVenueId = String(favVenue.venueId || '');
                    if (matchVenueId === favVenueId) {
                        score += weights.preferences.favoriteVenue.directMatch * strengthMult.favoriteVenue;
                        reasons.push(`At your favorite venue: ${match.venue?.name}`);
                        break;
                    }
                }
            }
            // Location-based scoring (default location) - only if within reasonable distance
            // Use stricter radius for default location (use defaultSearchRadius instead of recommendationRadius)
            if (userPreferences.defaultLocation?.coordinates && match.venue?.id) {
                try {
                    const venueData = await venueService.getVenueByApiId(match.venue.id);
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
                        // Use defaultSearchRadius (typically 100 miles) instead of recommendationRadius (400 miles)
                        const locationRadius = userPreferences.defaultSearchRadius || 100;
                        if (distance <= locationRadius) {
                            const locationScore = Math.max(0, 40 - (distance / 10));
                            score += locationScore;
                            reasons.push(`Close to your location (${Math.round(distance)} miles away)`);
                        }
                    }
                } catch (error) {
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
                }
            }
            // Recently visited stadium penalty
            const venueName = match.venue?.name?.toLowerCase();
            const recentlyVisited = visitedStadiums.some(visited => {
                const visitedName = visited.venueName?.toLowerCase();
                return visitedName && venueName && visitedName.includes(venueName);
            });
            if (recentlyVisited) {
                score += weights.penalties.recentlyVisitedVenue;
                reasons.push('You recently visited this stadium');
            }
            // Weekend bonus - only apply if match already has some relevance (score > base + league quality)
            const matchDate = new Date(match.fixture?.date);
            const dayOfWeek = matchDate.getDay();
            const baseRelevanceScore = weights.baseScore.default + weights.context.leagueQuality.other;
            if ((dayOfWeek === 0 || dayOfWeek === 6) && score > baseRelevanceScore) {
                score += weights.bonuses.weekendMatch;
                reasons.push('Weekend match');
            }
            // High-profile match bonus - only apply if match already has some relevance
            const homeTeam = match.teams?.home?.name?.toLowerCase();
            const awayTeam = match.teams?.away?.name?.toLowerCase();
            const bigTeams = ['manchester united', 'manchester city', 'liverpool', 'arsenal', 'chelsea', 'tottenham', 
                            'real madrid', 'barcelona', 'atletico madrid', 'bayern munich', 'borussia dortmund',
                            'juventus', 'ac milan', 'inter milan', 'psg', 'ajax', 'psv'];
            const isBigMatch = bigTeams.some(team => 
                homeTeam?.includes(team) || awayTeam?.includes(team)
            );
            if (isBigMatch && score > baseRelevanceScore) {
                score += weights.bonuses.highProfileMatch;
                reasons.push('High-profile match');
            }
            return {
                ...match,
                recommendationScore: score,
                recommendationReasons: reasons
            };
        }));
        // Filter out null matches (filtered out) and enforce minimum threshold
        const validMatches = scoredMatches.filter(match => match !== null);
        const aboveThreshold = validMatches.filter(match => match.recommendationScore >= weights.baseScore.minThreshold);
        const belowThreshold = validMatches.filter(match => 
            match.recommendationScore > 0 && match.recommendationScore < weights.baseScore.minThreshold
        );
        // Sort by score and ensure league diversity (only for matches above threshold)
        const positiveMatches = aboveThreshold.length > 0 ? aboveThreshold : belowThreshold;
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
            // Only apply diversity algorithm if we have enough matches above threshold
            // Otherwise, just return top-scoring matches
            sortedMatches = [];
            if (positiveMatches.length > 0 && matchesByLeague.size > 1) {
            // Only do diversity if we have multiple leagues and enough matches
            const maxPerLeague = Math.max(1, Math.floor(parseInt(limit) / matchesByLeague.size));
            const leagues = Array.from(matchesByLeague.keys());
            // First pass: take top matches from each league (prioritize favorite leagues)
            const favoriteLeagueIds = new Set(userPreferences.favoriteLeagues.map(id => String(id)));
            const sortedLeagues = leagues.sort((a, b) => {
                const aIsFavorite = favoriteLeagueIds.has(a);
                const bIsFavorite = favoriteLeagueIds.has(b);
                if (aIsFavorite && !bIsFavorite) return -1;
                if (!aIsFavorite && bIsFavorite) return 1;
                return 0;
            });
            for (let i = 0; i < maxPerLeague && sortedMatches.length < parseInt(limit); i++) {
                for (const leagueId of sortedLeagues) {
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
            } else {
                // Not enough matches or only one league - just take top scores
                sortedMatches = positiveMatches
                    .sort((a, b) => b.recommendationScore - a.recommendationScore)
                    .slice(0, parseInt(limit));
            }
            // Final sort by score to maintain ranking
            sortedMatches.sort((a, b) => b.recommendationScore - a.recommendationScore);
            console.log(`League distribution: ${targetLeagues.map(leagueId => {
                const count = sortedMatches.filter(m => (m.league?.id?.toString() || 'unknown') === leagueId).length;
                return `${leagueId}:${count}`;
            }).join(', ')}`);
        } else {
            // No home page recommendations needed - sortedMatches will be empty array
            sortedMatches = [];
        }
        // If we have trip recommendations, transform them first
        let finalMatches = [];
        if (useTripRecommendations && tripRecommendations.length > 0) {
            // Transform trip recommendations to expected format
            for (const rec of tripRecommendations) {
                try {
                    const match = rec.match || {};
                    const matchId = rec.matchId || match.id || match.fixture?.id;
                    // Log the match structure for debugging if we're missing critical data
                    const hasTeamNames = match.teams?.home?.name && match.teams?.away?.name;
                    const hasLeagueName = match.league?.name;
                    const hasVenueName = match.fixture?.venue?.name || match.venue?.name;
                    if (!hasTeamNames || !hasLeagueName || !hasVenueName) {
                        console.log({
                            hasTeamNames,
                            hasLeagueName,
                            hasVenueName,
                            matchStructure: {
                                hasTeams: !!match.teams,
                                hasHomeTeam: !!match.teams?.home,
                                hasAwayTeam: !!match.teams?.away,
                                hasLeague: !!match.league,
                                hasFixture: !!match.fixture,
                                hasVenue: !!match.venue,
                                homeTeamId: match.teams?.home?.id || match.homeTeamId,
                                awayTeamId: match.teams?.away?.id || match.awayTeamId,
                                leagueId: match.league?.id || match.leagueId,
                                venueId: match.fixture?.venue?.id || match.venue?.id || match.venueId
                            },
                            rawMatch: JSON.stringify(match, null, 2).substring(0, 500) // First 500 chars for debugging
                        });
                    }
                    // Get venue data with better fallbacks
                    const venueId = match.fixture?.venue?.id || match.venue?.id || match.venueId;
                    const venueData = venueId ? await venueService.getVenueByApiId(venueId) : null;
                    // Better venue name extraction with more fallbacks
                    const venueName = match.fixture?.venue?.name || 
                                    match.venue?.name || 
                                    (typeof match.venue === 'string' ? match.venue : null) ||
                                    (match.venue?.name ? match.venue.name : null) ||
                                    venueData?.name || 
                                    'Unknown Venue';
                    const venueCity = venueData?.city || 
                                    match.fixture?.venue?.city || 
                                    match.venue?.city || 
                                    null;
                    const venueCountry = venueData?.country || 
                                       match.fixture?.venue?.country || 
                                       match.venue?.country || 
                                       'Unknown';
                    const venueCoordinates = venueData?.coordinates || 
                                            venueData?.location?.coordinates || 
                                            (venueData?.location?.type === 'Point' ? venueData.location.coordinates : null) ||
                                            match.fixture?.venue?.coordinates ||
                                            match.venue?.coordinates;
                    // Better date extraction with more fallbacks
                    const matchDate = match.fixture?.date || 
                                    match.date || 
                                    match.fixtureDate ||
                                    null;
                    // Get team IDs first
                    const homeTeamId = match.teams?.home?.id || match.homeTeamId;
                    const awayTeamId = match.teams?.away?.id || match.awayTeamId;
                    // Get team data from database if we have IDs (even if we have names, to get logos/ticketing)
                    let homeTeam = null;
                    let awayTeam = null;
                    if (homeTeamId) {
                        try {
                            homeTeam = await Team.findOne({ apiId: homeTeamId.toString() });
                            if (!homeTeam && process.env.NODE_ENV !== 'production') {
                            }
                        } catch (teamError) {
                        }
                    }
                    if (awayTeamId) {
                        try {
                            awayTeam = await Team.findOne({ apiId: awayTeamId.toString() });
                            if (!awayTeam && process.env.NODE_ENV !== 'production') {
                            }
                        } catch (teamError) {
                        }
                    }
                    // Better team name extraction with database lookup fallback
                    let homeTeamName = match.teams?.home?.name || 
                                      (typeof match.teams?.home === 'string' ? match.teams.home : null) ||
                                      match.homeTeam ||
                                      null;
                    // If we don't have a name but have a team in database, use that
                    if (!homeTeamName && homeTeam) {
                        homeTeamName = homeTeam.name;
                    } else if (!homeTeamName && homeTeamId) {
                    }
                    // Final fallback
                    if (!homeTeamName) {
                        homeTeamName = 'TBD';
                        if (homeTeamId) {
                        }
                    }
                    let awayTeamName = match.teams?.away?.name || 
                                      (typeof match.teams?.away === 'string' ? match.teams.away : null) ||
                                      match.awayTeam ||
                                      null;
                    // If we don't have a name but have a team in database, use that
                    if (!awayTeamName && awayTeam) {
                        awayTeamName = awayTeam.name;
                    } else if (!awayTeamName && awayTeamId) {
                    }
                    // Final fallback
                    if (!awayTeamName) {
                        awayTeamName = 'TBD';
                        if (awayTeamId) {
                        }
                    }
                    // Get league ID and lookup from database if name is missing
                    const leagueId = match.league?.id || match.leagueId;
                    let leagueName = match.league?.name || match.leagueName || null;
                    // If we don't have a league name but have an ID, look it up
                    if (!leagueName && leagueId) {
                        try {
                            const leagueFromDb = await League.findOne({ apiId: leagueId.toString() });
                            if (leagueFromDb) {
                                leagueName = leagueFromDb.name;
                            } else {
                            }
                        } catch (leagueLookupError) {
                        }
                    }
                    // Final fallback for league name
                    if (!leagueName) {
                        leagueName = 'Unknown League';
                        if (leagueId) {
                        }
                    }
                    finalMatches.push({
                        id: matchId,
                        fixture: {
                            id: matchId,
                            date: matchDate,
                            status: match.fixture?.status || match.status || {},
                            venue: {
                                id: venueId || null,
                                name: venueName,
                                city: venueCity,
                                country: venueCountry,
                                coordinates: venueCoordinates
                            }
                        },
                        teams: {
                            home: {
                                id: homeTeamId || null,
                                name: homeTeamName,
                                logo: match.teams?.home?.logo || match.homeTeamLogo || homeTeam?.logo || null,
                                ticketingUrl: homeTeam?.ticketingUrl || undefined
                            },
                            away: {
                                id: awayTeamId || null,
                                name: awayTeamName,
                                logo: match.teams?.away?.logo || match.awayTeamLogo || awayTeam?.logo || null
                            }
                        },
                        league: {
                            id: leagueId || null,
                            name: leagueName,
                            logo: match.league?.logo || match.leagueLogo || null
                        },
                        score: match.score || {},
                        recommendationScore: rec.score || 0,
                        recommendationReasons: rec.reason ? [rec.reason] : [],
                        _tripId: rec._tripId,
                        _tripName: rec._tripName,
                        _isTripRecommendation: true
                    });
                } catch (error) {
                }
            }
            // If we have fewer than limit, supplement with home page recommendations
            if (finalMatches.length < parseInt(limit)) {
                // Filter out trip recommendation match IDs to avoid duplicates
                const tripMatchIds = new Set(finalMatches.map(m => m.id?.toString()));
                // Transform home page recommendations and add them
                for (const match of sortedMatches) {
                    if (finalMatches.length >= parseInt(limit)) break;
                    const matchId = match.fixture?.id?.toString();
                    if (tripMatchIds.has(matchId)) {
                        continue; // Skip if already in trip recommendations
                    }
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
                        // Transform to API-Sports format that MatchCard component expects
                        const homeTeam = match.teams?.home?.id 
                            ? await Team.findOne({ apiId: match.teams.home.id.toString() })
                            : null;
                        finalMatches.push({
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
                                    logo: match.teams?.home?.logo,
                                    ticketingUrl: homeTeam?.ticketingUrl || undefined
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
                            recommendationReasons: match.recommendationReasons,
                            _isTripRecommendation: false
                        });
                    } catch (error) {
                    }
                }
            }
        } else {
            // No trip recommendations - use home page recommendations (existing logic)
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
                } else if (!apiVenueName && !venueData) {
                }
                // Transform to API-Sports format that MatchCard component expects
                const homeTeam = match.teams?.home?.id 
                    ? await Team.findOne({ apiId: match.teams.home.id.toString() })
                    : null;
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
                            logo: match.teams?.home?.logo,
                            ticketingUrl: homeTeam?.ticketingUrl || undefined
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
                // Still include the match but with basic venue info - transform to API-Sports format
                // Check both fixture.venue and match.venue
                const fallbackVenueId = match.venue?.id || match.fixture?.venue?.id;
                const fallbackVenueName = match.fixture?.venue?.name || match.venue?.name || 'Unknown Venue';
                const fallbackVenueCity = match.fixture?.venue?.city || match.venue?.city || match.venue?.name || null;
                const fallbackVenueCountry = match.fixture?.venue?.country || match.venue?.country || 'Unknown';
                const fallbackVenueCoords = match.fixture?.venue?.coordinates || match.venue?.coordinates || null;
                const homeTeam = match.teams?.home?.id 
                    ? await Team.findOne({ apiId: match.teams.home.id.toString() })
                    : null;
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
                            logo: match.teams?.home?.logo,
                            ticketingUrl: homeTeam?.ticketingUrl || undefined
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
            finalMatches = transformedMatches;
        }
        }
        // Cache the recommended matches for future requests (daily cache)
        recommendedMatchesCache.set(cacheKey, finalMatches);
        clearTimeout(timeout);
        res.json({ 
            success: true, 
            matches: finalMatches, 
            totalFound: useTripRecommendations ? tripRecommendations.length : upcomingMatches.length,
            totalBeforeFilter: useTripRecommendations ? tripRecommendations.length : allMatches.length,
            personalized: true,
            fromTripRecommendations: useTripRecommendations,
            tripRecommendationsCount: tripRecommendations.length,
            dateRange: useTripRecommendations ? null : { from: dateFrom, to: dateTo }, 
            leagues: useTripRecommendations ? null : targetLeagues,
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
        console.log({
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
                        logo: homeTeam?.logo || match.teams.home.logo,
                        ticketingUrl: homeTeam?.ticketingUrl || undefined
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