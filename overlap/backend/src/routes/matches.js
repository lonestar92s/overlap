const express = require('express');
const { performance } = require('perf_hooks');
const venueService = require('../services/venueService');
const leagueService = require('../services/leagueService');
const teamService = require('../services/teamService');
const subscriptionService = require('../services/subscriptionService');
const geocodingService = require('../services/geocodingService');
const recommendationService = require('../services/recommendationService');
const apiSportsService = require('../services/apiSportsService');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();
const Team = require('../models/Team');
const League = require('../models/League');
const { matchesCache, popularMatchesCache, recommendedMatchesCache } = require('../utils/cache');
const { shouldFilterMatch } = require('../utils/matchStatus');
const weights = require('../config/recommendationWeights');
const {
    getIntersectingRegions,
    getVisibleSearchContext,
    getDomesticCountriesFromContext,
    normalizeCountryName
} = require('../utils/searchGeography');
const DEBUG_MATCHES_SEARCH = process.env.DEBUG_MATCHES_SEARCH === 'true';
const MATCHES_API_VENUE_IMAGE_LIMIT = Number(process.env.MATCHES_API_VENUE_IMAGE_LIMIT) || 0;
// Cache for venue data to avoid repeated API calls
const venueCache = new Map();
function logMatchesDebug(message, details = {}) {
    if (DEBUG_MATCHES_SEARCH) {
        console.log(`[matches] ${message}`, details);
    }
}

function roundDuration(durationMs) {
    return Math.round(durationMs * 100) / 100;
}

function logSearchMetrics(mode, details = {}) {
    console.log(`[matches/search] ${mode}`, {
        ...details,
        limiter: apiSportsService.getLimiterState()
    });
}

function enqueueBackgroundVenueGeocoding(lookups, options = {}) {
    if (!Array.isArray(lookups) || lookups.length === 0) {
        return;
    }
    const {
        concurrency = 2,
        minIntervalMs = 0,
        searchSessionId = null
    } = options;
    setImmediate(async () => {
        try {
            const geocodeInputs = lookups.map(({ venueInfo }) => ({
                name: venueInfo.name,
                city: venueInfo.city,
                country: venueInfo.country
            }));
            const { results, metadata } = await geocodingService.batchGeocodeVenues(geocodeInputs, {
                concurrency,
                minIntervalMs,
                maxRetries: 1,
                failFastOnRateLimit: true,
                logFailures: false,
                includeMetadata: true
            });
            let savedCount = 0;
            for (const lookup of lookups) {
                const coords = results.get(lookup.key);
                if (!coords) {
                    continue;
                }
                savedCount += 1;
                venueService.saveVenueWithCoordinates({
                    venueId: lookup.venueId,
                    name: lookup.venueInfo.name,
                    city: lookup.venueInfo.city,
                    country: lookup.venueInfo.country,
                    coordinates: coords
                }).catch(error => {
                    console.error(`❌ Error saving background geocoded venue ${lookup.venueInfo.name}:`, error.message);
                });
            }
            logMatchesDebug('background venue geocoding finished', {
                searchSessionId,
                queued: lookups.length,
                savedCount,
                metadata
            });
        } catch (error) {
            console.error('❌ Background venue geocoding failed:', error.message);
        }
    });
}

function getAxiosErrorSummary(error) {
    const response = error?.response;
    const headers = response?.headers || {};
    const retryAfterHeader = headers['retry-after'];
    const retryAfterSeconds = retryAfterHeader != null && !Number.isNaN(Number(retryAfterHeader))
        ? Number(retryAfterHeader)
        : null;
    return {
        status: response?.status || null,
        code: error?.code || null,
        message: error?.message || 'Unknown error',
        retryAfterSeconds,
        rateLimitRemaining: headers['x-ratelimit-remaining'] || headers['x-rate-limit-remaining'] || null,
        rateLimitReset: headers['x-ratelimit-reset'] || headers['x-rate-limit-reset'] || null,
        upstreamErrors: response?.data?.errors || null
    };
}
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
        const response = await apiSportsService.get('/venues', {
            params: { id: venueId },
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
// Batch fetch venue data from API-Football. The shared limiter controls pacing.
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
    const venueResults = await Promise.allSettled(uncachedIds.map(async (venueId) => {
        try {
            const response = await apiSportsService.get('/venues', {
                params: { id: venueId },
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
    }));
    venueResults.forEach((result) => {
        if (result.status === 'fulfilled' && result.value && result.value.venueData) {
            venueMap.set(result.value.venueId, result.value.venueData);
        }
    });
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
// Helper function to create a consistent bounds hash for caching
function createBoundsHash(bounds) {
    // Round to 2 decimal places for cache efficiency (approximately 1km precision)
    const neLat = Math.round(bounds.northeast.lat * 100) / 100;
    const neLng = Math.round(bounds.northeast.lng * 100) / 100;
    const swLat = Math.round(bounds.southwest.lat * 100) / 100;
    const swLng = Math.round(bounds.southwest.lng * 100) / 100;
    return `${neLat}-${neLng}-${swLat}-${swLng}`;
}

// Shared helper: filter matches by subscription access and valid coordinates only.
// Bounds/viewport filtering is handled on the client (MapResultsScreen).
function filterMatchesByAccessAndCoords(matches, accessibleLeagueIdsSet) {
    if (!Array.isArray(matches)) {
        return [];
    }

    return matches.filter(match => {
        // Subscription access check
        const leagueIdStr = match.league?.id?.toString() || match.fixture?.league?.id?.toString();
        if (leagueIdStr && !accessibleLeagueIdsSet.has(leagueIdStr)) {
            return false;
        }

        // Coordinates validation
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

        return true;
    });
}
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
// Helper function to filter leagues by geographic relevance and subscription tier
async function getRelevantLeagueIds(searchContext, user = null, options = {}) {
    // Get accessible leagues based on subscription tier
    const accessibleLeagueIds = await subscriptionService.getAccessibleLeagues(user);
    const accessibleLeagueIdsSet = new Set(accessibleLeagueIds.map(id => id.toString()));
    const domesticCountries = getDomesticCountriesFromContext(searchContext);
    const domesticCountrySet = new Set(domesticCountries.map(normalizeCountryName));
    const isCityLevelSearch = options.isCityLevelSearch === true;
    const localLeagueBounds = options.localLeagueBounds || searchContext?.bounds || null;

    let cityScopedDomesticLeagueIds = null;
    if (isCityLevelSearch && localLeagueBounds) {
        const nearbyTeams = await Team.find({
            'venue.coordinates.0': {
                $gte: localLeagueBounds.southwest.lng,
                $lte: localLeagueBounds.northeast.lng
            },
            'venue.coordinates.1': {
                $gte: localLeagueBounds.southwest.lat,
                $lte: localLeagueBounds.northeast.lat
            }
        }).select('leagues').lean();

        cityScopedDomesticLeagueIds = new Set();
        nearbyTeams.forEach((team) => {
            (team.leagues || []).forEach((leagueEntry) => {
                const leagueIdStr = String(leagueEntry?.leagueId || '');
                const leagueId = parseInt(leagueIdStr, 10);
                if (
                    leagueEntry?.isActive !== false &&
                    leagueIdStr &&
                    !isNaN(leagueId) &&
                    accessibleLeagueIdsSet.has(leagueIdStr)
                ) {
                    cityScopedDomesticLeagueIds.add(leagueId);
                }
            });
        });
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
    const activeRegions = searchContext.activeRegions || getIntersectingRegions(searchContext.bounds);
    const relevantLeagueIds = [];
    for (const league of allLeagues) {
        let shouldInclude = false;
        const leagueId = parseInt(league.apiId);
        const leagueIdStr = String(league.apiId);
        // A. DOMESTIC: If country is nearby, include ALL its leagues
        if (domesticCountrySet.has(normalizeCountryName(league.country))) {
            if (cityScopedDomesticLeagueIds && cityScopedDomesticLeagueIds.size > 0) {
                shouldInclude = cityScopedDomesticLeagueIds.has(leagueId);
            } else {
                shouldInclude = true;
            }
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
        if (cityScopedDomesticLeagueIds && cityScopedDomesticLeagueIds.size > 0) {
            return Array.from(cityScopedDomesticLeagueIds);
        }
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
        logMatchesDebug('single competition search starting', {
            competitionId,
            season,
            dateFrom,
            dateTo,
            hasBounds: !!bounds,
            searchSessionId
        });
        const cachedData = matchesCache.get(cacheKey);
        if (cachedData) {
            return res.json(cachedData);
        }
        const apiResponse = await apiSportsService.get('/fixtures', {
            params: { league: competitionId, season: season, from: dateFrom, to: dateTo }
        });
        logMatchesDebug('single competition upstream response', {
            competitionId,
            season,
            totalResults: apiResponse.data.results || 0,
            responseLength: apiResponse.data.response?.length || 0,
            firstMatch: apiResponse.data.response?.[0] ? {
                id: apiResponse.data.response[0].id,
                teams: `${apiResponse.data.response[0].teams?.home?.name} vs ${apiResponse.data.response[0].teams?.away?.name}`,
                date: apiResponse.data.response[0].fixture?.date,
                venue: apiResponse.data.response[0].fixture?.venue?.name,
                city: apiResponse.data.response[0].fixture?.venue?.city
            } : null
        });
        const transformedData = await transformApiSportsData(apiResponse.data, competitionId, bounds, searchSessionId);
        logMatchesDebug('single competition transformed response', {
            competitionId,
            totalMatches: transformedData.response?.length || 0,
            firstMatch: transformedData.response?.[0] ? {
                id: transformedData.response[0].id,
                teams: `${transformedData.response[0].teams?.home?.name} vs ${transformedData.response[0].teams?.away?.name}`,
                venue: transformedData.response[0].fixture?.venue?.name,
                city: transformedData.response[0].fixture?.venue?.city,
                coordinates: transformedData.response[0].fixture?.venue?.coordinates
            } : null
        });
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
        const searchRequestStartTime = performance.now();
        const { homeTeam, awayTeam, dateFrom, dateTo, season = 2025, competitions, teams, neLat, neLng, swLat, swLng, dateFlexibility: dateFlexibilityParam } = req.query;
        // Location-only search: if bounds and date range are provided without competitions/teams/teams
        const hasBounds = neLat && neLng && swLat && swLng;
        const hasCompetitionsOrTeams = (competitions && competitions.trim() !== '') || (teams && teams.trim() !== '');
        const hasTeamMatchup = homeTeam || awayTeam;
        const dateFlexibility = Math.min(3, Math.max(0, parseInt(dateFlexibilityParam, 10) || 0));
        if (hasBounds && dateFrom && dateTo && !hasCompetitionsOrTeams && !hasTeamMatchup) {
            // Location-only search: use geographic filtering to find relevant leagues
            // Get user for subscription filtering (optional authentication)
            let user = null;
            if (req.user) {
                user = await User.findById(req.user.id);
            }
            const searchSessionId = `location_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const phaseTimings = {};
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
            const searchContext = getVisibleSearchContext(clampedOriginalBounds);
            const searchCountry = searchContext.primaryCountry;
            const domesticCountries = getDomesticCountriesFromContext(searchContext);
            const domesticCountrySet = new Set(domesticCountries.map(normalizeCountryName));
            const isCityLevelSearch = boundsLatSpan < 1.0 && boundsLngSpan < 1.0;
            const visibleCountryKey = domesticCountries.length > 0
                ? domesticCountries.slice().sort().join('|')
                : searchCountry;
            const activeRegionKey = Array.from(searchContext.activeRegions || []).sort().join('|') || 'none';
            // Expand date range by dateFlexibility (0 = exact, 1 = ±1 day) for fetching; cache key includes it
            const todayStr = new Date().toISOString().slice(0, 10);
            const addDays = (dateStr, days) => {
                const d = new Date(dateStr + 'T00:00:00Z');
                d.setUTCDate(d.getUTCDate() + days);
                return d.toISOString().slice(0, 10);
            };
            const effectiveFrom = addDays(dateFrom, -dateFlexibility);
            const effectiveTo = addDays(dateTo, dateFlexibility);
            const clampedFrom = effectiveFrom < todayStr ? todayStr : effectiveFrom;
            // Cache by visible countries/regions rather than a single inferred center country.
            const searchBehaviorVersion = 'v2';
            const cacheKey = `location-search:${searchBehaviorVersion}:${visibleCountryKey}:${activeRegionKey}:${dateFrom}:${dateTo}:${dateFlexibility}:${season}`;
            // Check cache first
            const cachedData = matchesCache.get(cacheKey);
            if (cachedData) {
                // CACHE VALIDATION: Check if cache seems incomplete
                // For major countries, we expect more than just 1-2 matches
                const majorCountries = ['England', 'Spain', 'Italy', 'Germany', 'France', 'Netherlands', 'Portugal'];
                const isMajorCountry = domesticCountries.some(country => majorCountries.includes(country));
                const cachedMatchCount = cachedData.data?.length || 0;
                // If it's a major country and we only have 1-2 matches, cache might be incomplete
                // This can happen if the first search had corrupted coordinates or API issues
                if (!isCityLevelSearch && isMajorCountry && cachedMatchCount <= 2) {
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
                    // Filter cached matches by subscription tier and coordinates only.
                    // Bounds/viewport filtering is handled on the client.
                    const accessibleLeagueIds = await subscriptionService.getAccessibleLeagues(user);
                    const accessibleLeagueIdsSet = new Set(accessibleLeagueIds.map(id => id.toString()));
                    const filteredMatches = filterMatchesByAccessAndCoords(matchesWithCoords, accessibleLeagueIdsSet);
                    const responsePayload = {
                        success: true, 
                        data: filteredMatches, 
                        count: filteredMatches.length,
                        fromCache: true,
                        bounds: originalBounds,
                        debug: {
                            withCoordinates: matchesWithCoords.length,
                            filteredByAccessAndCoords: filteredMatches.length,
                            withoutCoordinates: matchesMissingCoords.length,
                            enrichedFromMongoDB: enrichedCount,
                            totalInCache: cachedData.data.length
                        }
                    };
                    logSearchMetrics('location-cache-hit', {
                        durationMs: roundDuration(performance.now() - searchRequestStartTime),
                        cacheKey,
                        cacheHit: true,
                        matchesReturned: filteredMatches.length,
                        matchesWithCoords: matchesWithCoords.length,
                        matchesMissingCoords: matchesMissingCoords.length,
                        enrichedFromMongoDb: enrichedCount
                    });
                    return res.json(responsePayload);
                    // Return early if cache was valid (not invalidated)
                }
            }
            // Cache miss or invalidated - fetch fresh data
            // Get relevant league IDs using geographic filtering and subscription tier (similar to /leagues/relevant)
            const leagueSelectionStartTime = performance.now();
            const majorLeagueIds = await getRelevantLeagueIds(searchContext, user, {
                isCityLevelSearch,
                localLeagueBounds: bounds
            });
            phaseTimings.leagueSelection = {
                durationMs: roundDuration(performance.now() - leagueSelectionStartTime),
                relevantLeagueCount: majorLeagueIds.length
            };
            if (majorLeagueIds.length === 0) {
                // Fallback to essential leagues
                majorLeagueIds.push(39, 140, 78, 135, 61, 62, 2, 3);
            }
            // Get league names for detailed logging
            const leagueDocs = await League.find({ apiId: { $in: majorLeagueIds.map(id => id.toString()) } }).select('apiId name country').lean();
            const leagueInfo = leagueDocs.map(l => `${l.name} (${l.apiId}, ${l.country})`).join(', ');
            const leagueNameById = new Map(leagueDocs.map(l => [String(l.apiId), `${l.name} (${l.country})`]));
            const relevantLeagueIdSet = new Set(majorLeagueIds.map(id => String(id)));
            const rateLimitEvents = [];
            const loggedRateLimitedDates = new Set();
            const requestDates = [];
            const currentDate = new Date(`${clampedFrom}T00:00:00Z`);
            const endDate = new Date(`${effectiveTo}T00:00:00Z`);
            while (currentDate <= endDate) {
                requestDates.push(currentDate.toISOString().slice(0, 10));
                currentDate.setUTCDate(currentDate.getUTCDate() + 1);
            }
            // PHASE 1: Fetch fixtures from API-Sports.
            async function fetchFixturesForDate(searchDate, maxRetries = 3) {
                for (let attempt = 0; attempt < maxRetries; attempt++) {
                    try {
                        logMatchesDebug('location search upstream request', {
                            searchDate,
                            attempt: attempt + 1,
                            maxRetries,
                            params: { date: searchDate },
                            searchSessionId
                        });
                        const response = await apiSportsService.get('/fixtures', {
                            params: { date: searchDate },
                            timeout: 10000
                        });
                        const fixtureCount = response.data?.response?.length || 0;
                        logMatchesDebug('location search upstream response', {
                            searchDate,
                            results: response.data?.results || 0,
                            responseLength: fixtureCount,
                            firstFixture: response.data?.response?.[0] ? {
                                id: response.data.response[0].fixture?.id,
                                leagueId: response.data.response[0].league?.id,
                                league: response.data.response[0].league?.name,
                                teams: `${response.data.response[0].teams?.home?.name} vs ${response.data.response[0].teams?.away?.name}`,
                                date: response.data.response[0].fixture?.date,
                                venue: response.data.response[0].fixture?.venue?.name,
                                city: response.data.response[0].fixture?.venue?.city
                            } : null
                        });
                        return { type: 'date', id: searchDate, data: response.data, success: true };
                    } catch (error) {
                        const isLastAttempt = attempt === maxRetries - 1;
                        const errorSummary = getAxiosErrorSummary(error);
                        const isRateLimited = errorSummary.status === 429;
                        if (isLastAttempt) {
                            console.error('[matches/search] Upstream fixtures request failed', {
                                searchDate,
                                attempt: attempt + 1,
                                maxRetries,
                                params: { date: searchDate },
                                status: errorSummary.status,
                                code: errorSummary.code,
                                message: errorSummary.message,
                                retryAfterSeconds: errorSummary.retryAfterSeconds,
                                upstreamErrors: errorSummary.upstreamErrors,
                                searchSessionId
                            });
                            return { type: 'date', id: searchDate, data: { response: [] }, success: false };
                        } else {
                            const isTransientUpstreamError = !isRateLimited && (
                                errorSummary.status == null ||
                                errorSummary.status >= 500 ||
                                errorSummary.code === 'ECONNABORTED'
                            );
                            const delayMs = isRateLimited
                                ? 0
                                : (isTransientUpstreamError ? Math.pow(2, attempt) * 500 : 0);
                            if (isRateLimited) {
                                rateLimitEvents.push({
                                    searchDate,
                                    attempt: attempt + 1,
                                    delayMs,
                                    retryAfterSeconds: errorSummary.retryAfterSeconds
                                });
                                if (!loggedRateLimitedDates.has(searchDate)) {
                                    loggedRateLimitedDates.add(searchDate);
                                    console.warn('[matches/search] API-Sports rate limit encountered', {
                                        searchDate,
                                        attempt: attempt + 1,
                                        maxRetries,
                                        delayMs,
                                        params: { date: searchDate },
                                        retryAfterSeconds: errorSummary.retryAfterSeconds,
                                        rateLimitRemaining: errorSummary.rateLimitRemaining,
                                        rateLimitReset: errorSummary.rateLimitReset,
                                        upstreamErrors: errorSummary.upstreamErrors,
                                        searchSessionId
                                    });
                                }
                            } else if (attempt === 0 || DEBUG_MATCHES_SEARCH) {
                                console.warn('[matches/search] Upstream fixtures retry scheduled', {
                                    searchDate,
                                    attempt: attempt + 1,
                                    maxRetries,
                                    delayMs,
                                    status: errorSummary.status,
                                    code: errorSummary.code,
                                    message: errorSummary.message,
                                    searchSessionId
                                });
                            }
                            if (delayMs > 0) {
                                await new Promise(resolve => setTimeout(resolve, delayMs));
                            }
                        }
                    }
                }
            }
            async function fetchFixturesForLeague(leagueId, maxRetries = 3) {
                const leagueSeason = calculateSeasonForCompetition(leagueId, dateFrom);
                for (let attempt = 0; attempt < maxRetries; attempt++) {
                    try {
                        logMatchesDebug('location search upstream request', {
                            leagueId,
                            season: leagueSeason,
                            attempt: attempt + 1,
                            maxRetries,
                            params: { league: leagueId, season: leagueSeason, from: clampedFrom, to: effectiveTo },
                            searchSessionId
                        });
                        const response = await apiSportsService.get('/fixtures', {
                            params: { league: leagueId, season: leagueSeason, from: clampedFrom, to: effectiveTo },
                            timeout: 10000
                        });
                        return { type: 'league', id: leagueId, data: response.data, success: true };
                    } catch (error) {
                        const isLastAttempt = attempt === maxRetries - 1;
                        const errorSummary = getAxiosErrorSummary(error);
                        const isRateLimited = errorSummary.status === 429;
                        if (isLastAttempt) {
                            console.error('[matches/search] Upstream league fixtures request failed', {
                                leagueId,
                                season: leagueSeason,
                                attempt: attempt + 1,
                                maxRetries,
                                status: errorSummary.status,
                                code: errorSummary.code,
                                message: errorSummary.message,
                                retryAfterSeconds: errorSummary.retryAfterSeconds,
                                upstreamErrors: errorSummary.upstreamErrors,
                                searchSessionId
                            });
                            return { type: 'league', id: leagueId, data: { response: [] }, success: false };
                        }
                        const isTransientUpstreamError = !isRateLimited && (
                            errorSummary.status == null ||
                            errorSummary.status >= 500 ||
                            errorSummary.code === 'ECONNABORTED'
                        );
                        const delayMs = isRateLimited
                            ? 0
                            : (isTransientUpstreamError ? Math.pow(2, attempt) * 500 : 0);
                        if (isRateLimited) {
                            rateLimitEvents.push({
                                searchDate: `league:${leagueId}`,
                                attempt: attempt + 1,
                                delayMs,
                                retryAfterSeconds: errorSummary.retryAfterSeconds
                            });
                        }
                        if (delayMs > 0) {
                            await new Promise(resolve => setTimeout(resolve, delayMs));
                        }
                    }
                }
            }
            const fixtureFetchStartTime = performance.now();
            const fixtureRequests = isCityLevelSearch
                ? majorLeagueIds.map(leagueId => fetchFixturesForLeague(leagueId))
                : requestDates.map(searchDate => fetchFixturesForDate(searchDate));
            const settled = await Promise.allSettled(fixtureRequests);
            const fixtures = [];
            for (const s of settled) {
                if (s.status === 'fulfilled') {
                    const payload = s.value;
                    if (payload?.data?.response?.length) {
                        fixtures.push(...payload.data.response);
                    }
                } else {
                    console.error('❌ Date request failed:', s.reason);
                }
            }
            phaseTimings.fixtureFetch = {
                durationMs: roundDuration(performance.now() - fixtureFetchStartTime),
                strategy: isCityLevelSearch ? 'league-range' : 'date-slate',
                requestDateCount: requestDates.length,
                requestCount: fixtureRequests.length,
                fetchedFixtureCount: fixtures.length
            };
            if (rateLimitEvents.length > 0) {
                const uniqueRateLimitedDates = Array.from(new Set(rateLimitEvents.map(event => event.searchDate)));
                const totalRetryDelayMs = rateLimitEvents.reduce((sum, event) => sum + event.delayMs, 0);
                console.warn('[matches/search] API-Sports rate limit summary', {
                    searchSessionId,
                    uniqueDates: uniqueRateLimitedDates.length,
                    retryEvents: rateLimitEvents.length,
                    totalRetryDelayMs,
                    dates: uniqueRateLimitedDates
                });
            }
            const dedupeAndFilterStartTime = performance.now();
            // Dedupe by fixture id
            const seen = new Set();
            const uniqueFixtures = fixtures.filter(fx => {
                const id = fx.fixture?.id;
                if (!id || seen.has(id)) return false;
                seen.add(id);
                return true;
            });
            const relevantFixtures = uniqueFixtures.filter(match => {
                const leagueIdStr = match.league?.id?.toString();
                return !!leagueIdStr && relevantLeagueIdSet.has(leagueIdStr);
            });
            // PHASE 2: Early Subscription Filtering - Filter BEFORE venue enrichment to avoid wasted lookups
            const accessibleLeagueIds = await subscriptionService.getAccessibleLeagues(user);
            const accessibleLeagueIdsSet = new Set(accessibleLeagueIds.map(id => id.toString()));
            const accessibleFixtures = relevantFixtures.filter(match => {
                const leagueIdStr = match.league?.id?.toString();
                return !leagueIdStr || accessibleLeagueIdsSet.has(leagueIdStr);
            });
            phaseTimings.dedupeAndLeagueFilter = {
                durationMs: roundDuration(performance.now() - dedupeAndFilterStartTime),
                uniqueFixtureCount: uniqueFixtures.length,
                relevantFixtureCount: relevantFixtures.length,
                accessibleFixtureCount: accessibleFixtures.length
            };
            // Track matches filtered out (starts with subscription filtering, then adds bounds filtering)
            let matchesFilteredOut = relevantFixtures.length - accessibleFixtures.length;
            if (process.env.NODE_ENV !== 'production' && matchesFilteredOut > 0) {
            }
            // PHASE 3: Collect all venue and team data upfront
            const venueIds = [];
            const venueNameLookups = [];
            const apiTeamNames = [];
            for (const match of accessibleFixtures) {
                const venue = match.fixture?.venue;
                if (venue?.id) {
                    venueIds.push(venue.id);
                }
                if (venue?.name) {
                    const cityForLookup = (venue.city === 'Unknown City' || venue.city === 'Unknown' || !venue.city) ? null : venue.city;
                    venueNameLookups.push({ name: venue.name, city: cityForLookup });
                }
                if (match.teams?.home?.name) {
                    apiTeamNames.push(match.teams.home.name);
                }
                if (match.teams?.away?.name) {
                    apiTeamNames.push(match.teams.away.name);
                }
            }
            const uniqueVenueIds = [...new Set(venueIds)];
            const uniqueVenueNames = [...new Map(
                venueNameLookups.map(v => [`${v.name}|${v.city}`, v])
            ).values()];
            const uniqueApiTeamNames = [...new Set(apiTeamNames)];
            const preloadStartTime = performance.now();
            const mappedTeamEntries = await Promise.all(
                uniqueApiTeamNames.map(async apiTeamName => ([
                    apiTeamName,
                    await teamService.mapApiNameToTeam(apiTeamName)
                ]))
            );
            const mappedTeamNameMap = new Map(mappedTeamEntries);
            const uniqueMappedTeamNames = [...new Set(
                mappedTeamEntries.map(([, mappedName]) => mappedName).filter(Boolean)
            )];
            const teamDocs = uniqueMappedTeamNames.length > 0
                ? await Team.find({ name: { $in: uniqueMappedTeamNames } })
                    .select('name venue city country ticketingUrl')
                    .lean()
                : [];
            const teamDocByName = new Map(teamDocs.map(team => [team.name, team]));
            const linkedVenueIds = [...new Set(
                teamDocs
                    .map(team => team.venue?.venueId)
                    .filter(venueId => venueId != null)
            )];
            if (process.env.NODE_ENV !== 'production') {
            }
            // PHASE 4: Batch fetch venue data in parallel
            const batchStartTime = performance.now();
            const combinedVenueIds = [...new Set([...uniqueVenueIds, ...linkedVenueIds])];
            const apiVenueIdsToFetch = MATCHES_API_VENUE_IMAGE_LIMIT > 0
                ? uniqueVenueIds.slice(0, MATCHES_API_VENUE_IMAGE_LIMIT)
                : [];
            const [venueMapById, venueMapByName, apiVenuesMap] = await Promise.all([
                venueService.batchGetVenuesById(combinedVenueIds),
                venueService.batchGetVenuesByName(uniqueVenueNames),
                apiVenueIdsToFetch.length > 0
                    ? batchGetVenuesFromApiFootball(apiVenueIdsToFetch)
                    : Promise.resolve(new Map())
            ]);
            const batchEndTime = performance.now();
            phaseTimings.preload = {
                durationMs: roundDuration(performance.now() - preloadStartTime),
                uniqueVenueIds: uniqueVenueIds.length,
                uniqueVenueNames: uniqueVenueNames.length,
                uniqueApiTeamNames: uniqueApiTeamNames.length,
                combinedVenueIds: combinedVenueIds.length,
                apiVenuePrefetches: apiVenueIdsToFetch.length,
                batchFetchDurationMs: roundDuration(batchEndTime - batchStartTime)
            };
            if (process.env.NODE_ENV !== 'production') {
            }
            // PHASE 5: Build candidate matches with bulk-loaded data
            const candidateTransformStartTime = performance.now();
            const candidateMatches = await Promise.all(accessibleFixtures.map(async match => {
                const leagueId = match.league?.id;
                const venue = match.fixture?.venue;
                const mappedHome = mappedTeamNameMap.get(match.teams.home.name) || match.teams.home.name;
                const mappedAway = mappedTeamNameMap.get(match.teams.away.name) || match.teams.away.name;
                const homeTeam = teamDocByName.get(mappedHome) || null;
                let venueInfo = await resolveVenueWithCoordinates(venue, match.league?.name || 'Unknown', {
                    venueMapById,
                    venueMapByName,
                    apiVenuesMap
                });
                if (!venueInfo && homeTeam?.venue?.venueId) {
                    const linkedVenue = venueMapById.get(homeTeam.venue.venueId);
                    const coords = linkedVenue?.coordinates || linkedVenue?.location?.coordinates;
                    if (coords && Array.isArray(coords) && coords.length === 2) {
                        venueInfo = {
                            id: venue?.id || linkedVenue.venueId || null,
                            name: linkedVenue.name || homeTeam.venue.name || 'Unknown Venue',
                            city: linkedVenue.city || homeTeam.city || 'Unknown City',
                            country: linkedVenue.country || homeTeam.country || match.league?.country || 'Unknown Country',
                            coordinates: coords
                        };
                    }
                }
                if (!venueInfo && homeTeam?.venue?.coordinates) {
                    venueInfo = {
                        id: venue?.id || homeTeam.venue.venueId || `venue-${mappedHome.replace(/\s+/g, '-').toLowerCase()}`,
                        name: homeTeam.venue.name || venue?.name || 'Unknown Venue',
                        city: homeTeam.city || venue?.city || 'Unknown City',
                        country: homeTeam.country || match.league?.country || 'Unknown Country',
                        coordinates: homeTeam.venue.coordinates
                    };
                }
                if (!venueInfo) {
                    const venueName = venue?.name || homeTeam?.venue?.name || 'Unknown Venue';
                    const venueCity = venue?.city || homeTeam?.city || 'Unknown City';
                    const venueCountry = match.league?.country || homeTeam?.country || 'Unknown Country';
                    venueInfo = {
                        id: venue?.id || homeTeam?.venue?.venueId || null,
                        name: venueName,
                        city: venueCity,
                        country: venueCountry,
                        coordinates: venue?.coordinates || homeTeam?.venue?.coordinates || null
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
                            name: mappedHome,
                            logo: match.teams.home.logo,
                            ticketingUrl: homeTeam?.ticketingUrl || undefined
                        },
                        away: {
                            id: match.teams.away.id,
                            name: mappedAway,
                            logo: match.teams.away.logo
                        }
                    }
                };
                const matchLeagueCountry = normalizeCountryName(match.league?.country);
                const isDomesticLeague = matchLeagueCountry && domesticCountrySet.has(matchLeagueCountry);
                const shouldGeocode = !venueInfo.coordinates &&
                    venueInfo.name &&
                    venueInfo.city &&
                    venueInfo.name !== 'Unknown Venue' &&
                    venueInfo.city !== 'Unknown City';
                return {
                    leagueId,
                    isDomesticLeague,
                    transformed,
                    geocodeLookup: shouldGeocode ? {
                        key: `${venueInfo.name}|${venueInfo.city}|${venueInfo.country || match.league?.country || 'Unknown Country'}`,
                        venueId: venue?.id || venueInfo.id || null,
                        venueInfo,
                        fixtureDate: match.fixture?.date || null
                    } : null
                };
            }));
            phaseTimings.candidateTransform = {
                durationMs: roundDuration(performance.now() - candidateTransformStartTime),
                candidateMatchCount: candidateMatches.length
            };
            const filteredBoundsLatSpan = bounds.northeast.lat - bounds.southwest.lat;
            const filteredBoundsLngSpan = bounds.northeast.lng - bounds.southwest.lng;
            // PHASE 6: Batch geocode unresolved venues once per unique venue
            const uniqueGeocodeLookups = new Map();
            for (const candidate of candidateMatches) {
                if (candidate.geocodeLookup && !uniqueGeocodeLookups.has(candidate.geocodeLookup.key)) {
                    uniqueGeocodeLookups.set(candidate.geocodeLookup.key, candidate.geocodeLookup);
                }
            }
            const isBroadDateRangeSearch = requestDates.length > 7;
            const defaultSyncGeocodeLimit = isBroadDateRangeSearch
                ? (isCityLevelSearch ? 4 : 3)
                : (isCityLevelSearch ? 6 : 5);
            const syncGeocodeLimit = Number(process.env.MATCHES_SYNC_GEOCODE_LIMIT) || defaultSyncGeocodeLimit;
            const syncGeocodeConcurrency = Math.max(1, Number(process.env.MATCHES_SYNC_GEOCODE_CONCURRENCY) || 2);
            const syncGeocodeIntervalMs = Math.max(0, Number(process.env.MATCHES_SYNC_GEOCODE_INTERVAL_MS) || 0);
            const backgroundGeocodeConcurrency = Math.max(1, Number(process.env.MATCHES_BACKGROUND_GEOCODE_CONCURRENCY) || Math.min(syncGeocodeConcurrency, 2));
            const prioritizedGeocodeLookups = Array.from(uniqueGeocodeLookups.values())
                .sort((a, b) => {
                    const aHasVenueId = a.venueId != null ? 1 : 0;
                    const bHasVenueId = b.venueId != null ? 1 : 0;
                    if (aHasVenueId !== bHasVenueId) {
                        return bHasVenueId - aHasVenueId;
                    }
                    return new Date(a.fixtureDate || 0) - new Date(b.fixtureDate || 0);
                });
            const synchronousGeocodeLookups = prioritizedGeocodeLookups.slice(0, syncGeocodeLimit);
            const deferredGeocodeLookups = prioritizedGeocodeLookups.slice(syncGeocodeLimit);
            const skippedGeocodeLookups = deferredGeocodeLookups.length;
            let geocodeDurationMs = 0;
            let geocodeBatchMetadata = {
                totalCandidates: uniqueGeocodeLookups.size,
                cachedCount: 0,
                uncachedCount: uniqueGeocodeLookups.size,
                attemptedCount: 0,
                executionMode: 'none',
                concurrency: 0,
                minIntervalMs: syncGeocodeIntervalMs
            };
            if (uniqueGeocodeLookups.size > 0) {
                const geocodeStartTime = performance.now();
                if (process.env.NODE_ENV !== 'production') {
                }
                const geocodeInputs = synchronousGeocodeLookups.map(({ venueInfo }) => ({
                    name: venueInfo.name,
                    city: venueInfo.city,
                    country: venueInfo.country
                }));
                const {
                    results: geocodeResults,
                    metadata
                } = await geocodingService.batchGeocodeVenues(geocodeInputs, {
                    concurrency: syncGeocodeConcurrency,
                    minIntervalMs: syncGeocodeIntervalMs,
                    maxRetries: 1,
                    failFastOnRateLimit: true,
                    logFailures: false,
                    includeMetadata: true
                });
                geocodeBatchMetadata = metadata;
                for (const lookup of synchronousGeocodeLookups) {
                    const coords = geocodeResults.get(lookup.key);
                    if (coords) {
                        lookup.venueInfo.coordinates = coords;
                        venueService.saveVenueWithCoordinates({
                            venueId: lookup.venueId,
                            name: lookup.venueInfo.name,
                            city: lookup.venueInfo.city,
                            country: lookup.venueInfo.country,
                            coordinates: coords
                        }).catch(error => {
                            console.error(`❌ Error saving geocoded venue ${lookup.venueInfo.name}:`, error.message);
                        });
                    }
                }
                const geocodeEndTime = performance.now();
                geocodeDurationMs = roundDuration(geocodeEndTime - geocodeStartTime);
                if (process.env.NODE_ENV !== 'production') {
                }
                if (skippedGeocodeLookups > 0) {
                    logMatchesDebug('location search geocoding capped', {
                        attempted: synchronousGeocodeLookups.length,
                        skipped: skippedGeocodeLookups,
                        searchSessionId
                    });
                }
            }
            if (deferredGeocodeLookups.length > 0) {
                logMatchesDebug('location search background geocoding queued', {
                    attemptedSynchronously: synchronousGeocodeLookups.length,
                    deferred: deferredGeocodeLookups.length,
                    searchSessionId
                });
                enqueueBackgroundVenueGeocoding(deferredGeocodeLookups, {
                    concurrency: backgroundGeocodeConcurrency,
                    minIntervalMs: 0,
                    searchSessionId
                });
            }
            phaseTimings.geocoding = {
                durationMs: geocodeDurationMs,
                totalCandidates: uniqueGeocodeLookups.size,
                cachedGeocodes: geocodeBatchMetadata.cachedCount,
                uncachedGeocodes: geocodeBatchMetadata.uncachedCount,
                attemptedGeocodes: synchronousGeocodeLookups.length,
                deferredGeocodes: skippedGeocodeLookups,
                skippedGeocodes: skippedGeocodeLookups,
                executionMode: geocodeBatchMetadata.executionMode,
                concurrency: geocodeBatchMetadata.concurrency,
                minIntervalMs: geocodeBatchMetadata.minIntervalMs,
                backgroundQueued: deferredGeocodeLookups.length
            };
            // PHASE 7: Filter by bounds using the final coordinate set
            const finalFilterStartTime = performance.now();
            const transformedMatches = [];
            let matchesWithoutCoords = 0;
            let matchesByLeague = {};
            for (const candidate of candidateMatches) {
                const { leagueId, isDomesticLeague, transformed } = candidate;
                const venueInfo = transformed.fixture.venue;
                if (!matchesByLeague[leagueId]) {
                    matchesByLeague[leagueId] = { total: 0, transformed: 0, noCoords: 0, filteredOut: 0 };
                }
                matchesByLeague[leagueId].total++;
                let shouldInclude = false;
                if (venueInfo?.coordinates && Array.isArray(venueInfo.coordinates) && venueInfo.coordinates.length === 2) {
                    const [lon, lat] = venueInfo.coordinates;
                    if (typeof lon === 'number' && typeof lat === 'number' &&
                        !isNaN(lon) && !isNaN(lat) &&
                        lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90) {
                        if (isWithinBounds(venueInfo.coordinates, bounds)) {
                            shouldInclude = true;
                        } else if (!isCityLevelSearch && isDomesticLeague) {
                            shouldInclude = true;
                        } else {
                            matchesFilteredOut++;
                            matchesByLeague[leagueId].filteredOut++;
                        }
                    } else {
                        matchesWithoutCoords++;
                        matchesByLeague[leagueId].noCoords++;
                    }
                } else {
                    matchesWithoutCoords++;
                    matchesByLeague[leagueId].noCoords++;
                    const isRelevantLeague = majorLeagueIds.includes(leagueId);
                    if (isRelevantLeague) {
                        transformed.fixture.venue = {
                            ...venueInfo,
                            coordinates: null,
                            missingCoordinates: true,
                            debugNote: 'Match included for debugging - missing coordinates'
                        };
                        shouldInclude = true;
                    }
                }
                if (shouldInclude) {
                    transformedMatches.push(transformed);
                    matchesByLeague[leagueId].transformed++;
                }
            }
            phaseTimings.finalFilter = {
                durationMs: roundDuration(performance.now() - finalFilterStartTime),
                transformedMatchCount: transformedMatches.length,
                matchesWithoutCoords,
                matchesFilteredOut
            };
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
            // Return matches that pass subscription and current backend inclusion rules.
            const filteredMatches = filterMatchesByAccessAndCoords(transformedMatches, accessibleLeagueIdsSet);
            // Count matches with/without coordinates for debugging
            const withCoords = filteredMatches.filter(m => m.fixture?.venue?.coordinates).length;
            const withoutCoords = filteredMatches.filter(m => m.fixture?.venue?.missingCoordinates).length;
            const responsePayload = { 
                success: true, 
                data: filteredMatches, 
                count: filteredMatches.length,
                fromCache: false,
                totalMatches: transformedMatches.length, // Total matches in cache
                bounds: originalBounds, // NEW: Tell client the requested viewport bounds
                debug: {
                    withCoordinates: withCoords,
                    withoutCoordinates: withoutCoords,
                    totalInCache: transformedMatches.length,
                    attemptedGeocodes: synchronousGeocodeLookups.length,
                    deferredGeocodes: skippedGeocodeLookups,
                    skippedGeocodes: skippedGeocodeLookups,
                    relevantLeagues: majorLeagueIds.length,
                    fixturesFetched: fixtures.length,
                    isCityLevelSearch,
                    phases: phaseTimings
                }
            };
            logSearchMetrics('location-fresh', {
                durationMs: roundDuration(performance.now() - searchRequestStartTime),
                cacheKey,
                cacheHit: false,
                requestDates: requestDates.length,
                relevantLeagues: majorLeagueIds.length,
                fixturesFetched: fixtures.length,
                matchesReturned: filteredMatches.length,
                totalMatches: transformedMatches.length,
                rateLimitedDates: loggedRateLimitedDates.size,
                geocodeAttempted: synchronousGeocodeLookups.length,
                geocodeDeferred: skippedGeocodeLookups,
                geocodeSkipped: skippedGeocodeLookups,
                geocodeCached: geocodeBatchMetadata.cachedCount,
                geocodeExecutionMode: geocodeBatchMetadata.executionMode,
                geocodeConcurrency: syncGeocodeConcurrency,
                geocodeIntervalMs: syncGeocodeIntervalMs,
                venueApiPrefetches: apiVenueIdsToFetch.length,
                phases: phaseTimings
            });
            return res.json(responsePayload);
        }
        // Aggregated search path when competitions/teams are provided
        if ((competitions && competitions.trim() !== '') || (teams && teams.trim() !== '')) {
            if (!dateFrom || !dateTo) {
                return res.status(400).json({ success: false, message: 'dateFrom and dateTo are required when searching by competitions/teams' });
            }
            const todayStrAgg = new Date().toISOString().slice(0, 10);
            const addDaysAgg = (dateStr, days) => {
                const d = new Date(dateStr + 'T00:00:00Z');
                d.setUTCDate(d.getUTCDate() + days);
                return d.toISOString().slice(0, 10);
            };
            const effectiveFromAgg = addDaysAgg(dateFrom, -dateFlexibility);
            const effectiveToAgg = addDaysAgg(dateTo, dateFlexibility);
            const clampedFromAgg = effectiveFromAgg < todayStrAgg ? todayStrAgg : effectiveFromAgg;
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
                    apiSportsService.get('/fixtures', {
                        params: { league: leagueId, season: leagueSeason, from: clampedFromAgg, to: effectiveToAgg },
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
                    apiSportsService.get('/fixtures', {
                        params: { team: teamId, season: season, from: clampedFromAgg, to: effectiveToAgg },
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
            const venueIds = [];
            const venueNameLookups = [];
            const apiTeamNames = [];
            for (const match of uniqueFixtures) {
                const venue = match.fixture?.venue;
                if (venue?.id) {
                    venueIds.push(venue.id);
                }
                if (venue?.name) {
                    venueNameLookups.push({
                        name: venue.name,
                        city: (venue.city === 'Unknown City' || venue.city === 'Unknown' || !venue.city) ? null : venue.city
                    });
                }
                if (match.teams?.home?.name) {
                    apiTeamNames.push(match.teams.home.name);
                }
                if (match.teams?.away?.name) {
                    apiTeamNames.push(match.teams.away.name);
                }
            }
            const uniqueVenueIds = [...new Set(venueIds)];
            const uniqueVenueNames = [...new Map(
                venueNameLookups.map(v => [`${v.name}|${v.city || ''}`, v])
            ).values()];
            const uniqueApiTeamNames = [...new Set(apiTeamNames)];
            const mappedTeamEntries = await Promise.all(
                uniqueApiTeamNames.map(async apiTeamName => ([
                    apiTeamName,
                    await teamService.mapApiNameToTeam(apiTeamName)
                ]))
            );
            const mappedTeamNameMap = new Map(mappedTeamEntries);
            const uniqueMappedTeamNames = [...new Set(
                mappedTeamEntries.map(([, mappedName]) => mappedName).filter(Boolean)
            )];
            const teamDocs = uniqueMappedTeamNames.length > 0
                ? await Team.find({ name: { $in: uniqueMappedTeamNames } })
                    .select('name venue city country ticketingUrl logo')
                    .lean()
                : [];
            const teamDocByName = new Map(teamDocs.map(team => [team.name, team]));
            const linkedVenueIds = [...new Set(
                teamDocs
                    .map(team => team.venue?.venueId)
                    .filter(venueId => venueId != null)
            )];
            const combinedVenueIds = [...new Set([...uniqueVenueIds, ...linkedVenueIds])];
            const apiVenueIdsToFetch = MATCHES_API_VENUE_IMAGE_LIMIT > 0
                ? uniqueVenueIds.slice(0, MATCHES_API_VENUE_IMAGE_LIMIT)
                : [];
            const [venueMapById, venueMapByName, apiVenuesMap] = await Promise.all([
                venueService.batchGetVenuesById(combinedVenueIds),
                venueService.batchGetVenuesByName(uniqueVenueNames),
                apiVenueIdsToFetch.length > 0
                    ? batchGetVenuesFromApiFootball(apiVenueIdsToFetch)
                    : Promise.resolve(new Map())
            ]);
            const transformedMatches = [];
            for (const match of uniqueFixtures) {
                const venue = match.fixture?.venue;
                const mappedHome = mappedTeamNameMap.get(match.teams.home.name) || match.teams.home.name;
                const mappedAway = mappedTeamNameMap.get(match.teams.away.name) || match.teams.away.name;
                const homeTeam = teamDocByName.get(mappedHome) || null;
                let venueInfo = await resolveVenueWithCoordinates(venue, match.league?.name || 'Unknown', {
                    venueMapById,
                    venueMapByName,
                    apiVenuesMap
                });
                if (!venueInfo && homeTeam?.venue?.venueId) {
                    const linkedVenue = venueMapById.get(homeTeam.venue.venueId);
                    const coords = linkedVenue?.coordinates || linkedVenue?.location?.coordinates;
                    if (coords && Array.isArray(coords) && coords.length === 2) {
                        venueInfo = {
                            id: venue?.id || linkedVenue.venueId || null,
                            name: linkedVenue.name || homeTeam.venue.name || 'Unknown Venue',
                            city: linkedVenue.city || homeTeam.city || 'Unknown City',
                            country: linkedVenue.country || homeTeam.country || match.league?.country || 'Unknown Country',
                            coordinates: coords,
                            image: linkedVenue.image || apiVenuesMap.get(venue?.id)?.image || null
                        };
                    }
                }
                if (!venueInfo && homeTeam?.venue?.coordinates) {
                    venueInfo = {
                        id: venue?.id || homeTeam.venue.venueId || `venue-${mappedHome.replace(/\s+/g, '-').toLowerCase()}`,
                        name: homeTeam.venue.name || venue?.name || 'Unknown Venue',
                        city: homeTeam.city || venue?.city || 'Unknown City',
                        country: homeTeam.country || match.league?.country || 'Unknown Country',
                        coordinates: homeTeam.venue.coordinates,
                        image: apiVenuesMap.get(venue?.id)?.image || venue?.image || null
                    };
                }
                if (!venueInfo) {
                    venueInfo = {
                        id: venue?.id || null,
                        name: venue?.name || 'Unknown Venue',
                        city: venue?.city || 'Unknown City',
                        country: match.league?.country || 'Unknown Country',
                        coordinates: venue?.coordinates || null,
                        image: apiVenuesMap.get(venue?.id)?.image || venue?.image || null
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
                            name: mappedHome,
                            logo: homeTeam?.logo || match.teams.home.logo,
                            ticketingUrl: homeTeam?.ticketingUrl || undefined
                        },
                        away: {
                            id: match.teams.away.id,
                            name: mappedAway,
                            logo: teamDocByName.get(mappedAway)?.logo || match.teams.away.logo
                        }
                    }
                };
                if (bounds) {
                    if (transformed.fixture.venue.coordinates && isWithinBounds(transformed.fixture.venue.coordinates, bounds)) {
                        transformedMatches.push(transformed);
                    }
                } else if (transformed.fixture.venue.coordinates) {
                    transformedMatches.push(transformed);
                }
            }
            // Sort by date
            transformedMatches.sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));
            if (transformedMatches.length === 0 && totalMatches > 0) {
            }
            const responsePayload = { success: true, data: transformedMatches, count: transformedMatches.length };
            logSearchMetrics('aggregated-search', {
                durationMs: roundDuration(performance.now() - searchRequestStartTime),
                requestCount: requests.length,
                fixturesFetched: fixtures.length,
                uniqueFixtures: uniqueFixtures.length,
                matchesReturned: transformedMatches.length,
                uniqueVenueIds: uniqueVenueIds.length,
                uniqueTeamNames: uniqueApiTeamNames.length,
                venueApiPrefetches: apiVenueIdsToFetch.length
            });
            return res.json(responsePayload);
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
        const response = await apiSportsService.get('/fixtures', {
            params,
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
        const response = await apiSportsService.get('/fixtures', {
            params,
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
                const apiResponse = await apiSportsService.get('/fixtures', {
                    params: { league: leagueId, season: leagueSeason, from: dateFrom, to: dateTo },
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
                const apiResponse = await apiSportsService.get('/fixtures', {
                    params: { 
                        league: leagueId, 
                        season: '2025', 
                        from: dateFrom, 
                        to: dateTo 
                    },
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
            apiSportsService.get('/fixtures', {
                params: {
                    team: teamId,
                    season: 2025,
                    from: '2025-07-01', // Start of 2025-2026 season
                    to: '2026-06-30'    // End of 2025-2026 season
                }
            }),
            apiSportsService.get('/fixtures', {
                params: {
                    team: teamId,
                    season: 2025,
                    from: '2025-07-01', // Start of 2025-2026 season
                    to: '2026-06-30',   // End of 2025-2026 season
                    status: 'FT-AET-PEN' // Finished matches
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