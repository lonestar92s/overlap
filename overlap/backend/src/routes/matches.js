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
    
    console.log(`🌍 Nearby countries within ${NEARBY_THRESHOLD}km: ${nearbyCountries.map(c => `${c.country} (${c.distance.toFixed(0)}km)`).join(', ') || 'none'}`);
    
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
            // Check if user has access to this league
            if (accessibleLeagueIdsSet.has(league.apiId)) {
                const leagueId = parseInt(league.apiId);
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
        console.log(`🔍 [${searchSessionId}] Starting search for competition ${competitionId} with bounds: ${bounds ? 'YES' : 'NO'}`);
        
        // Determine season based on competition type and date range
        let season = '2025'; // Default for regular leagues
        if (dateFrom) {
            const startYear = new Date(dateFrom).getFullYear();
            const startMonth = new Date(dateFrom).getMonth() + 1;
            
            // World Cup (ID 1) uses the year of the tournament as the season
            if (competitionId === '1' || competitionId === 1) {
                season = startYear.toString();
                console.log(`🌍 [${searchSessionId}] WORLD CUP SEARCH DETECTED! Competition ID: ${competitionId}`);
                console.log(`🌍 [${searchSessionId}] Date range: ${dateFrom} to ${dateTo}`);
                console.log(`🌍 [${searchSessionId}] Using season: ${season} (from year ${startYear})`);
            } else {
                // For regular leagues (Premier League, etc.), determine season based on month
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
            console.log(`🏆 [${searchSessionId}] CHAMPIONS LEAGUE SEARCH DETECTED! Competition ID: ${competitionId}`);
            console.log(`🏆 [${searchSessionId}] Date range: ${dateFrom} to ${dateTo}`);
            console.log(`🏆 [${searchSessionId}] Season: ${season}`);
            console.log(`🏆 [${searchSessionId}] Bounds: ${bounds ? JSON.stringify(bounds) : 'NO BOUNDS'}`);
        }
        
        const cachedData = matchesCache.get(cacheKey);
        if (cachedData) {
            console.log(`🔍 [${searchSessionId}] Returning cached data`);
            return res.json(cachedData);
        }

        const apiResponse = await axios.get(`${API_SPORTS_BASE_URL}/fixtures`, {
            params: { league: competitionId, season: season, from: dateFrom, to: dateTo },
            headers: { 'x-apisports-key': API_SPORTS_KEY },
            httpsAgent
        });

        // Special logging for World Cup API response
        if (competitionId === '1' || competitionId === 1) {
            console.log(`🌍 [${searchSessionId}] World Cup API Response:`, {
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
        
        // Special logging for World Cup after transformation
        if (competitionId === '1' || competitionId === 1) {
            console.log(`🌍 [${searchSessionId}] World Cup After Transformation:`, {
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
            
            console.log(`🌍 Country detection: ${searchCountry} (distance: ${countryDetection.distance ? countryDetection.distance.toFixed(0) + 'km' : 'N/A'})`);
            console.log(`🌍 Nearby countries for domestic league check: ${nearbyCountries.join(', ')}`);
            
            // Use country + date range for cache key (no bounds hash for better cache hit rate)
            // This allows all searches in the same country/date range to share cache
            // Frontend will filter by bounds, backend returns all country matches
            const cacheKey = `location-search:${searchCountry}:${dateFrom}:${dateTo}:${season}`;
            
            console.log(`🔑 Cache key: ${cacheKey}`);
            
            // Check cache first
            const cachedData = matchesCache.get(cacheKey);
            if (cachedData) {
                console.log(`✅ Location-only search: Cache hit for ${searchCountry}, ${dateFrom} to ${dateTo}`);
                
                // CACHE VALIDATION: Check if cache seems incomplete
                // For major countries, we expect more than just 1-2 matches
                const majorCountries = ['England', 'Spain', 'Italy', 'Germany', 'France', 'Netherlands', 'Portugal'];
                const isMajorCountry = majorCountries.includes(searchCountry);
                const cachedMatchCount = cachedData.data?.length || 0;
                
                // If it's a major country and we only have 1-2 matches, cache might be incomplete
                // This can happen if the first search had corrupted coordinates or API issues
                if (isMajorCountry && cachedMatchCount <= 2) {
                    console.log(`⚠️ Cache validation: Only ${cachedMatchCount} matches cached for major country ${searchCountry}. This seems incomplete, invalidating cache and refetching.`);
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
                            venueNameLookups.push({ match, name: venueName, city: venueCity });
                        }
                    }
                    
                    // Batch query all venues by ID at once (single database query)
                    let venueMapById = new Map();
                    if (venueIds.length > 0) {
                        const Venue = require('../models/Venue');
                        const venues = await Venue.find({ 
                            venueId: { $in: venueIds },
                            isActive: true 
                        });
                        
                        venues.forEach(venue => {
                            const coords = venue.coordinates || venue.location?.coordinates;
                            if (coords && Array.isArray(coords) && coords.length === 2) {
                                venueMapById.set(venue.venueId, coords);
                            }
                        });
                        
                        console.log(`🔄 Cache enrichment: Batch queried ${venueIds.length} venue IDs, found ${venueMapById.size} with coordinates`);
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
                        
                        // Fallback to name lookup (still individual queries, but less common)
                        if (!enrichedCoords && venueName) {
                            const byName = await venueService.getVenueByName(venueName, venueCity);
                            if (byName?.coordinates) {
                                enrichedCoords = byName.coordinates;
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
                        console.log(`🔄 Cache enrichment: Updated ${enrichedCount} matches with coordinates (batch query used)`);
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
                    
                    console.log(`✅ Cache hit: Returning ${filteredByOriginalBounds.length} matches filtered by original bounds (from ${matchesWithCoords.length} total in cache)`);
                    
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
            console.log(`🔍 Location-only search: Cache miss for ${searchCountry || 'unknown'}, ${dateFrom} to ${dateTo} - fetching from API`);
            
            // Get relevant league IDs using geographic filtering and subscription tier (similar to /leagues/relevant)
            const majorLeagueIds = await getRelevantLeagueIds(bounds, user);
            
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

            // Transform and filter by bounds and subscription tier
            const transformedMatches = [];
            let matchesWithoutCoords = 0;
            let matchesFilteredOut = 0;
            let matchesByLeague = {}; // Track matches by league for logging
            
            // Get accessible leagues for subscription filtering
            const accessibleLeagueIds = await subscriptionService.getAccessibleLeagues(user);
            const accessibleLeagueIdsSet = new Set(accessibleLeagueIds.map(id => id.toString()));
            
            for (const match of uniqueFixtures) {
                const leagueId = match.league?.id;
                if (!matchesByLeague[leagueId]) {
                    matchesByLeague[leagueId] = { total: 0, transformed: 0, noCoords: 0, filteredOut: 0 };
                }
                matchesByLeague[leagueId].total++;
                
                // Check subscription access first - skip if user doesn't have access
                const leagueIdStr = leagueId?.toString();
                if (leagueIdStr && !accessibleLeagueIdsSet.has(leagueIdStr)) {
                    matchesFilteredOut++;
                    matchesByLeague[leagueId].filteredOut++;
                    continue; // Skip this match - user doesn't have access to this league
                }
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
                            console.log(`✅ Match included (domestic league, city search): ${venueInfo.name}, ${venueInfo.city} - Coords: [${lon}, ${lat}] (League: ${match.league.name}, ID: ${match.fixture.id})`);
                        } else if (isWithinBounds(venueInfo.coordinates, bounds)) {
                            // Include matches within buffered bounds (for caching)
                            shouldInclude = true;
                            console.log(`✅ Match included (within buffered bounds): ${venueInfo.name}, ${venueInfo.city} - Coords: [${lon}, ${lat}] (League: ${match.league.name}, ID: ${match.fixture.id})`);
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
            
            console.log(`🔍 [MATCH FILTER] Matches filtered out by subscription: ${matchesFilteredOut}`);
            const leagueStatsString = Object.entries(matchesByLeague).slice(0, 10).map(([id, stats]) => 
                `League ${id}: ${stats.total} total, ${stats.filteredOut} filtered out, ${stats.transformed} transformed`
            ).join(' | ');
            console.log(`🔍 [MATCH FILTER] Matches by league: ${leagueStatsString}`);
            
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
        // Cache is invalidated when:
        // - Trip recommendations are regenerated (adding/removing matches, date changes)
        // - User preferences change (favorite teams/leagues/venues)
        // - User dismisses/saves recommendations
        const cacheKey = `recommended_matches_${userId}_${days}_${limit}`;
        const forceRefresh = req.query.forceRefresh === 'true' || req.query.forceRefresh === '1';
        
        if (forceRefresh) {
            console.log('🔄 Force refresh requested - clearing cache');
            recommendedMatchesCache.deleteByPattern(`recommended_matches_${userId}_*`);
        }
        
        const cachedData = recommendedMatchesCache.get(cacheKey);
        
        if (cachedData && !forceRefresh) {
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
            console.log(`🎯 Found ${tripsWithRecommendations.length} active trips with recommendations - prioritizing trip recommendations`);
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
            console.log(`✅ Aggregated ${tripRecommendations.length} trip recommendations (from ${tripsWithRecommendations.length} trips)`);
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
                console.log(`✅ Found ${foundApiIds.length} favorite leagues: ${targetLeagues.join(', ')}`);
            } else {
                // If lookup failed, try using the IDs directly (they might already be valid API IDs)
                targetLeagues = favoriteLeagueIds;
                console.log(`⚠️ League lookup failed, using IDs directly: ${targetLeagues.join(', ')}`);
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

            console.log(`🔍 Searching leagues: ${targetLeagues.join(', ')}`);

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
                console.log('⚠️ No matches found from any league');
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
            console.log(`🔍 Filtered ${allMatches.length - upcomingMatches.length} matches (in progress or completed), ${upcomingMatches.length} upcoming matches remaining`);
            
            if (upcomingMatches.length === 0) {
                console.log('⚠️ No upcoming matches found after filtering');
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

        console.log(`📊 Scoring complete: ${validMatches.length} valid matches, ${aboveThreshold.length} above threshold (${weights.baseScore.minThreshold}), ${belowThreshold.length} below threshold`);

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
            
            console.log(`📊 League distribution: ${Array.from(matchesByLeague.keys()).map(leagueId => {
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
            console.log(`🎯 Using ${tripRecommendations.length} trip recommendations`);
            
            // Transform trip recommendations to expected format
            for (const rec of tripRecommendations) {
                try {
                    const match = rec.match || {};
                    const matchId = rec.matchId || match.id || match.fixture?.id;
                    
                    // Get venue data with better fallbacks
                    const venueId = match.fixture?.venue?.id || match.venue?.id || match.venueId;
                    const venueData = venueId ? await venueService.getVenueByApiId(venueId) : null;
                    
                    // Better venue name extraction with more fallbacks
                    const venueName = match.fixture?.venue?.name || 
                                    match.venue?.name || 
                                    (typeof match.venue === 'string' ? match.venue : null) ||
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
                    
                    // Better team name extraction with more fallbacks
                    const homeTeamName = match.teams?.home?.name || 
                                       (typeof match.teams?.home === 'string' ? match.teams.home : null) ||
                                       match.homeTeam ||
                                       'TBD';
                    
                    const awayTeamName = match.teams?.away?.name || 
                                       (typeof match.teams?.away === 'string' ? match.teams.away : null) ||
                                       match.awayTeam ||
                                       'TBD';
                    
                    const homeTeamId = match.teams?.home?.id || match.homeTeamId;
                    const awayTeamId = match.teams?.away?.id || match.awayTeamId;
                    
                    // Get team data from database if we have IDs
                    const homeTeam = homeTeamId 
                        ? await Team.findOne({ apiId: homeTeamId.toString() })
                        : null;
                    
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
                                logo: match.teams?.home?.logo || match.homeTeamLogo || null,
                                ticketingUrl: homeTeam?.ticketingUrl || undefined
                            },
                            away: {
                                id: awayTeamId || null,
                                name: awayTeamName,
                                logo: match.teams?.away?.logo || match.awayTeamLogo || null
                            }
                        },
                        league: {
                            id: match.league?.id || match.leagueId || null,
                            name: match.league?.name || match.leagueName || 'Unknown League',
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
                    console.log(`⚠️ Error transforming trip recommendation ${rec.matchId}: ${error.message}`);
                    console.log(`⚠️ Match data structure:`, JSON.stringify(match, null, 2));
                }
            }
            
            // If we have fewer than limit, supplement with home page recommendations
            if (finalMatches.length < parseInt(limit)) {
                console.log(`📊 Only ${finalMatches.length} trip recommendations, supplementing with ${parseInt(limit) - finalMatches.length} home page recommendations`);
                
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
                        console.log(`⚠️ Error processing match ${match.fixture?.id}: ${error.message}`);
                    }
                }
            }
        } else {
            // No trip recommendations - use home page recommendations (existing logic)
            console.log('📊 No trip recommendations found, using home page recommendations');
            
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
                console.log(`⚠️ Error processing match ${match.fixture?.id}: ${error.message}`);
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
        console.log(`💾 Recommended matches cached (${finalMatches.length} total: ${tripRecommendations.length} from trips, ${finalMatches.length - tripRecommendations.length} from home page)`);
        
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