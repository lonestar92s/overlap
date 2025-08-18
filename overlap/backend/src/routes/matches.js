const express = require('express');
const axios = require('axios');
const https = require('https');
const venueService = require('../services/venueService');
const leagueService = require('../services/leagueService');
const teamService = require('../services/teamService');
const coordinateService = require('../services/coordinateService');
const subscriptionService = require('../services/subscriptionService');
const geocodingService = require('../services/geocodingService');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();
const Team = require('../models/Team');
const { matchesCache } = require('../utils/cache');

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
async function transformApiSportsData(apiResponse, competitionId, bounds = null) {
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
                const fixture = fixtures[i];
                try {
                    const transformedFixture = await (async () => {
                        // Get venue data
                    const venue = await (async () => {
                        const apiVenue = fixture.fixture.venue;
                        console.log(`🔍 Processing venue for fixture ${fixture.fixture.id}:`, apiVenue);
                        
                        const isPremierLeague = parseInt(competitionId) === 39;
                        if (isPremierLeague && apiVenue?.id) {

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
                            const apiFootballVenue = await getVenueFromApiFootball(apiVenue.id);
                            if (apiFootballVenue) {
                                return {
                                    id: apiVenue.id,
                                    name: apiFootballVenue.name,
                                    city: apiFootballVenue.city,
                                    country: apiFootballVenue.country,
                                    coordinates: null,
                                    capacity: apiFootballVenue.capacity,
                                    surface: apiFootballVenue.surface,
                                    address: apiFootballVenue.address,
                                    image: apiFootballVenue.image
                                };
                            }
                        }
                        if (apiVenue?.name) {
                            const venueByName = await venueService.getVenueByName(apiVenue.name, apiVenue.city);
                            if (venueByName?.coordinates) {
                                return {
                                    id: apiVenue.id || `venue-${apiVenue.name.replace(/\s+/g, '-').toLowerCase()}`,
                                    name: venueByName.name,
                                    city: venueByName.city,
                                    country: venueByName.country,
                                    coordinates: venueByName.coordinates
                                };
                            }
                        }
                        const mappedTeamName = await teamService.mapApiNameToTeam(fixture.teams.home.name);
                        const team = await Team.findOne({ 
                            $or: [
                                { name: mappedTeamName },
                                { name: { $regex: new RegExp(`^${mappedTeamName}$`, 'i') } },
                                { apiName: mappedTeamName },
                                { aliases: mappedTeamName }
                            ]
                        });
                        if (team?.venue?.coordinates) {
                            return {
                                id: `venue-${mappedTeamName.replace(/\s+/g, '-').toLowerCase()}`,
                                name: team.venue.name,
                                city: team.city || team.venue.city,
                                country: team.country,
                                coordinates: team.venue.coordinates
                            };
                        }
                        if (team) {
                            const venueData = await venueService.getVenueForTeam(mappedTeamName);
                            if (venueData?.coordinates) {
                                return {
                                    id: `venue-${mappedTeamName.replace(/\s+/g, '-').toLowerCase()}`,
                                    name: venueData.stadium || venueData.name,
                                    city: venueData.city,
                                    country: venueData.country,
                                    coordinates: venueData.coordinates
                                };
                            }
                        }
                        let finalVenue = {
                            id: apiVenue?.id || null,
                            name: apiVenue?.name || null,
                            city: apiVenue?.city || null,
                            country: fixture.league.country || null,
                            distance: null,
                            coordinates: null
                        };

                        // Try to geocode venue if coordinates are missing
                        if (!finalVenue.coordinates && finalVenue.name && finalVenue.city && finalVenue.country) {
                            try {
                                console.log(`🗺️ Attempting to geocode venue: ${finalVenue.name} in ${finalVenue.city}, ${finalVenue.country}`);
                                
                                const coordinates = await geocodingService.geocodeVenueCoordinates(
                                    finalVenue.name,
                                    finalVenue.city,
                                    finalVenue.country
                                );
                                
                                if (coordinates) {
                                    console.log(`✅ Successfully geocoded ${finalVenue.name}: [${coordinates[0]}, ${coordinates[1]}]`);
                                    
                                    // Save the venue with coordinates to the database
                                    const savedVenue = await venueService.saveVenueWithCoordinates({
                                        venueId: apiVenue?.id || null,
                                        name: finalVenue.name,
                                        city: finalVenue.city,
                                        country: finalVenue.country,
                                        coordinates: coordinates,
                                        capacity: null,
                                        surface: null,
                                        image: null,
                                        address: null
                                    });
                                    
                                    if (savedVenue) {
                                        finalVenue = {
                                            ...finalVenue,
                                            coordinates: coordinates,
                                            id: savedVenue._id
                                        };
                                    } else {
                                        finalVenue.coordinates = coordinates;
                                    }
                                } else {
                                    console.log(`⚠️ Could not geocode venue: ${finalVenue.name}`);
                                }
                            } catch (geocodeError) {
                                console.error(`❌ Geocoding error for ${finalVenue.name}:`, geocodeError.message);
                            }
                        }

                        console.log(`🔍 Final venue object for fixture ${fixture.fixture.id}:`, finalVenue);
                        return finalVenue;
                    })();

                    return {
                        area: {
                            id: 2072,
                            name: fixture.league.country || 'Unknown',
                            code: fixture.league.country?.substring(0, 3).toUpperCase() || 'UNK',
                            flag: fixture.league.flag || null
                        },
                        competition: {
                            id: competitionId.toString(),
                            name: leagueName,
                            code: leagueName.replace(/\s+/g, '').substring(0, 3).toUpperCase(),
                            type: 'LEAGUE',
                            emblem: fixture.league.logo
                        },
                        season: {
                            id: fixture.league.season || new Date().getFullYear(),
                            startDate: `${fixture.league.season || new Date().getFullYear()}-08-01`,
                            endDate: `${(fixture.league.season || new Date().getFullYear()) + 1}-05-31`,
                            currentMatchday: fixture.league.round?.match(/\d+/)?.[0] || 1,
                            winner: null
                        },
                        id: fixture.fixture.id,
                        utcDate: fixture.fixture.date,
                        status: fixture.fixture.status.long === 'Match Finished' ? 'FINISHED' : 
                               fixture.fixture.status.long === 'Not Started' ? 'SCHEDULED' : 'LIVE',
                        matchday: fixture.league.round?.match(/\d+/)?.[0] || 1,
                        stage: 'REGULAR_SEASON',
                        group: null,
                        lastUpdated: new Date().toISOString(),
                        fixture: {
                            id: fixture.fixture.id,
                            date: fixture.fixture.date,
                            venue: venue,
                            status: fixture.fixture.status
                        },
                        league: {
                            id: competitionId.toString(),
                            name: leagueName
                        },
                        teams: {
                            home: {
                                id: fixture.teams.home.id,
                                name: await teamService.mapApiNameToTeam(fixture.teams.home.name),
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
                        score: {
                            winner: fixture.goals.home > fixture.goals.away ? 'HOME' : 
                                   fixture.goals.away > fixture.goals.home ? 'AWAY' : 
                                   fixture.goals.home === fixture.goals.away && fixture.goals.home !== null ? 'DRAW' : null,
                            duration: 'REGULAR',
                            fullTime: {
                                home: fixture.goals.home,
                                away: fixture.goals.away
                            },
                            halfTime: {
                                home: fixture.score?.halftime?.home || null,
                                away: fixture.score?.halftime?.away || null
                            }
                        }
                    };
                } catch (error) {
                    console.error(`❌ Error processing fixture ${fixture.fixture.id}:`, error);
                    // Continue with next fixture instead of failing completely
                }
            }

                    return {
                        area: {
                            id: 2072,
                            name: fixture.league.country || 'Unknown',
                            code: fixture.league.country?.substring(0, 3).toUpperCase() || 'UNK',
                            flag: fixture.league.flag || null
                        },
                        competition: {
                            id: competitionId.toString(),
                            name: leagueName,
                            code: leagueName.replace(/\s+/g, '').substring(0, 3).toUpperCase(),
                            type: 'LEAGUE',
                            emblem: fixture.league.logo
                        },
                        season: {
                            id: fixture.league.season || new Date().getFullYear(),
                            startDate: `${fixture.league.season || new Date().getFullYear()}-08-01`,
                            endDate: `${(fixture.league.season || new Date().getFullYear()) + 1}-05-31`,
                            currentMatchday: fixture.league.round?.match(/\d+/)?.[0] || 1,
                            winner: null
                        },
                        id: fixture.fixture.id,
                        utcDate: fixture.fixture.date,
                        status: fixture.fixture.status.long === 'Match Finished' ? 'FINISHED' : 
                               fixture.fixture.status.long === 'Not Started' ? 'SCHEDULED' : 'LIVE',
                        matchday: fixture.league.round?.match(/\d+/)?.[0] || 1,
                        stage: 'REGULAR_SEASON',
                        group: null,
                        lastUpdated: new Date().toISOString(),
                        fixture: {
                            id: fixture.fixture.id,
                            date: fixture.fixture.date,
                            venue: venue,
                            status: fixture.fixture.status
                        },
                        league: {
                            id: competitionId.toString(),
                            name: leagueName
                        },
                        teams: {
                            home: {
                                id: fixture.teams.home.id,
                                name: await teamService.mapApiNameToTeam(fixture.teams.home.name),
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
                        score: {
                            winner: fixture.goals.home > fixture.goals.away ? 'HOME' : 
                                   fixture.goals.away > fixture.goals.home ? 'AWAY' : 
                                   fixture.goals.home === fixture.goals.away && fixture.goals.home !== null ? 'DRAW' : null,
                            duration: 'REGULAR',
                            fullTime: {
                                home: fixture.goals.home,
                                away: fixture.goals.away
                            },
                            halfTime: {
                                home: fixture.score?.halftime?.home || null,
                                away: fixture.score?.halftime?.away || null
                            }
                        }
                    };
                })();

                console.log(`🔍 Fixture ${transformedFixture.id}: Venue has coordinates:`, !!transformedFixture.fixture.venue.coordinates);
                
                if (bounds && transformedFixture.fixture.venue.coordinates) {
                    if (isWithinBounds(transformedFixture.fixture.venue.coordinates, bounds)) {
                        transformedFixtures.push(transformedFixture);
                        console.log(`✅ Added fixture ${transformedFixture.id} (within bounds)`);
                    } else {
                        console.log(`❌ Fixture ${transformedFixture.id} outside bounds`);
                    }
                } else if (!bounds) {
                    // Include all matches when no bounds filter, even without coordinates
                    transformedFixtures.push(transformedFixture);
                    console.log(`✅ Added fixture ${transformedFixture.id} (no bounds filter)`);
                }
            console.log(`🔍 transformApiSportsData: Final result - ${transformedFixtures.length} transformed fixtures`);
            return transformedFixtures;
        })()
    };
}

// Function to check if coordinates are within bounds
function isWithinBounds(coordinates, bounds) {
    if (!coordinates || !bounds || coordinates.length !== 2) {
        return false;
    }
    const [lon, lat] = coordinates;
    const { northeast, southwest } = bounds;
    return lat >= southwest.lat && lat <= northeast.lat &&
           lon >= southwest.lng && lon <= northeast.lng;
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

// Get matches for a competition
router.get('/competitions/:competitionId', authenticateToken, async (req, res) => {
    try {
        const { competitionId } = req.params;
        const { dateFrom, dateTo, neLat, neLng, swLat, swLng } = req.query;
        const bounds = (neLat && neLng && swLat && swLng) ? {
            northeast: { lat: parseFloat(neLat), lng: parseFloat(neLng) },
            southwest: { lat: parseFloat(swLat), lng: parseFloat(swLng) }
        } : null;

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
        const cachedData = matchesCache.get(cacheKey);
        if (cachedData) {
            return res.json(cachedData);
        }

        const apiResponse = await axios.get(`${API_SPORTS_BASE_URL}/fixtures`, {
            params: { league: competitionId, season: '2025', from: dateFrom, to: dateTo },
            headers: { 'x-apisports-key': API_SPORTS_KEY },
            httpsAgent
        });

        const transformedData = await transformApiSportsData(apiResponse.data, competitionId, bounds);
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
                let venueInfo = null;
                if (venue?.id) {
                    const localVenue = await venueService.getVenueByApiId(venue.id);
                    if (localVenue) {
                        venueInfo = {
                            id: venue.id,
                            name: localVenue.name,
                            city: localVenue.city,
                            country: localVenue.country,
                            coordinates: localVenue.coordinates || localVenue.location?.coordinates,
                            image: localVenue.image || null
                        };
                    } else {
                        const v = await getVenueFromApiFootball(venue.id);
                        if (v) {
                            venueInfo = {
                                id: venue.id,
                                name: v.name,
                                city: v.city,
                                country: v.country,
                                coordinates: null,
                                image: v.image || null
                            };
                        }
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
            return res.status(400).json({ success: false, message: 'At least one team must be specified' });
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

        const matches = await transformApiSportsData(response.data, null);
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
            const leagueMappings = { 39: 'Premier League', 140: 'La Liga', 135: 'Serie A', 78: 'Bundesliga', 61: 'Ligue 1' };
            popularLeagueIds = [39, 140, 135, 78, 61];
            popularLeagueNames = popularLeagueIds.map(id => leagueMappings[id] || `League ${id}`);
        }
        const today = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(today.getDate() + 30);
        const dateFrom = today.toISOString().split('T')[0];
        const dateTo = thirtyDaysFromNow.toISOString().split('T')[0];

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

        selectedMatches.forEach((match, index) => {
;
        });

        const transformedMatches = [];
        for (const match of selectedMatches) {
            const venue = match.fixture?.venue;
            let venueData = null;
            let apiFootballVenue = null;
            let finalVenueData = null;
            
            if (venue?.id) {
                
                const localVenue = await venueService.getVenueByApiId(venue.id);
                if (localVenue) {
                    apiFootballVenue = {
                        name: localVenue.name,
                        city: localVenue.city,
                        country: localVenue.country,
                        capacity: localVenue.capacity,
                        surface: localVenue.surface,
                        address: localVenue.address,
                        image: localVenue.image,
                        coordinates: localVenue.coordinates || localVenue.location?.coordinates
                    };
                    ;
                } else {

                    apiFootballVenue = await getVenueFromApiFootball(venue.id);
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
        clearTimeout(timeout);
        res.json({ success: true, matches: transformedMatches, totalFound: allMatches.length, dateRange: { from: dateFrom, to: dateTo }, leagues: popularLeagueNames });
    } catch (error) {
        clearTimeout(timeout);
        res.status(500).json({ success: false, message: 'Failed to fetch popular matches', error: error.message });
    }
});

module.exports = router; 
/**
 * GET /api/matches/cache/stats
 * Get cache statistics (for monitoring)
 */
router.get('/cache/stats', async (req, res) => {
    const stats = matchesCache.getStats();
    res.json({
        success: true,
        stats
    });
});

/**
 * POST /api/matches/cache/clear
 * Clear the matches cache
 */
router.post('/cache/clear', async (req, res) => {
    matchesCache.clear();
    res.json({
        success: true,
        message: 'Matches cache cleared'
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