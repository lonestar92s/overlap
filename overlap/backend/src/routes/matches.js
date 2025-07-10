const express = require('express');
const axios = require('axios');
const https = require('https');
const venueService = require('../services/venueService');
const leagueService = require('../services/leagueService');
const teamService = require('../services/teamService');
const coordinateService = require('../services/coordinateService');
const subscriptionService = require('../services/subscriptionService');
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

// Hardcoded constants removed - now using database services

// Function to transform API-Sports data to match frontend expectations
async function transformApiSportsData(apiResponse, competitionId, userLocation = null, maxDistance = null) {
    const fixtures = apiResponse.response || [];
    const leagueName = await leagueService.getLeagueNameById(competitionId);
    
    console.log(`\n🔄 Transforming ${fixtures.length} matches for league ${leagueName} (ID: ${competitionId})`);
    if (userLocation) {
        console.log(`📍 User location: [${userLocation.lat}, ${userLocation.lon}]`);
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
            
            // Process fixtures sequentially to avoid rate limiting
            for (let i = 0; i < fixtures.length; i++) {
                const fixture = fixtures[i];
                console.log(`\n📅 Processing match ${i + 1}/${fixtures.length}: ${fixture.teams.home.name} vs ${fixture.teams.away.name}`);
                
                const transformedFixture = await (async () => {
                    // Get venue data
                    const venue = await (async () => {
                        const apiVenue = fixture.fixture.venue;
                        console.log(`🔍 Looking up venue:`, {
                            venueName: apiVenue?.name,
                            venueCity: apiVenue?.city,
                            homeTeam: fixture.teams.home.name,
                            competitionId,
                            homeTeamId: fixture.teams.home.id
                        });

                        // ✅ METHOD 1: Check MongoDB by venue name (fast, no rate limits)
                        if (apiVenue?.name) {
                            console.log(`🗄️ Checking MongoDB for venue: "${apiVenue.name}"`);
                            const venueByName = await venueService.getVenueByName(apiVenue.name, apiVenue.city);
                            if (venueByName?.coordinates) {
                                console.log(`✅ Found venue in MongoDB with coordinates:`, venueByName.coordinates);
                                
                                // Calculate distance if user location provided
                                let distance = null;
                                if (userLocation && venueByName.coordinates.length === 2) {
                                    const [venueLon, venueLat] = venueByName.coordinates;
                                    distance = calculateDistance(userLocation.lat, userLocation.lon, venueLat, venueLon);
                                    console.log(`📏 Calculated distance: ${distance} miles`);
                                }

                                return {
                                    id: apiVenue.id || `venue-${apiVenue.name.replace(/\s+/g, '-').toLowerCase()}`,
                                    name: venueByName.name,
                                    city: venueByName.city,
                                    country: venueByName.country,
                                    distance: distance,
                                    coordinates: venueByName.coordinates
                                };
                            } else {
                                console.log(`❌ Venue not found in MongoDB by name: ${apiVenue.name}`);
                            }
                        }

                        // ✅ METHOD 2: Try team mapping (fallback)
                        console.log('🔄 Trying team mapping fallback...');
                        const mappedTeamName = await teamService.mapApiNameToTeam(fixture.teams.home.name);
                        console.log(`🔄 Team mapping: ${fixture.teams.home.name} → ${mappedTeamName}`);
                        
                        // Get team data first
                        const team = await Team.findOne({ 
                            $or: [
                                { name: mappedTeamName },
                                { name: { $regex: new RegExp(`^${mappedTeamName}$`, 'i') } },
                                { apiName: mappedTeamName },
                                { aliases: mappedTeamName }
                            ]
                        });
                        
                        if (team?.venue?.coordinates) {
                            console.log(`✅ Found venue through team with coordinates:`, team.venue.coordinates);
                            
                            let distance = null;
                            if (userLocation) {
                                const [venueLon, venueLat] = team.venue.coordinates;
                                distance = calculateDistance(userLocation.lat, userLocation.lon, venueLat, venueLon);
                                console.log(`📏 Calculated distance: ${distance} miles`);
                            }
                            
                            return {
                                id: `venue-${mappedTeamName.replace(/\s+/g, '-').toLowerCase()}`,
                                name: team.venue.name,
                                city: team.city || team.venue.city,
                                country: team.country,
                                distance: distance,
                                coordinates: team.venue.coordinates
                            };
                        }
                        
                        // If team found but no venue coordinates, try venue service
                        if (team) {
                            const venueData = await venueService.getVenueForTeam(mappedTeamName);
                            if (venueData?.coordinates) {
                                console.log(`✅ Found venue through venue service with coordinates:`, venueData.coordinates);
                                
                                let distance = null;
                                if (userLocation) {
                                    const [venueLon, venueLat] = venueData.coordinates;
                                    distance = calculateDistance(userLocation.lat, userLocation.lon, venueLat, venueLon);
                                    console.log(`📏 Calculated distance: ${distance} miles`);
                                }
                                
                                return {
                                    id: `venue-${mappedTeamName.replace(/\s+/g, '-').toLowerCase()}`,
                                    name: venueData.stadium || venueData.name,
                                    city: venueData.city,
                                    country: venueData.country,
                                    distance: distance,
                                    coordinates: venueData.coordinates
                                };
                            }
                        }
                        
                        console.log(`❌ No venue found through team mapping`);
                        
                        // Final fallback: Basic venue info without coordinates
                        console.log(`⚠️ Using fallback venue data without coordinates`);
                        return {
                            id: apiVenue?.id || null,
                            name: apiVenue?.name || null,
                            city: apiVenue?.city || null,
                            country: fixture.league.country || null,
                            distance: null,
                            coordinates: null
                        };
                    })();

                    return {
                        area: {
                            id: 2072,
                            name: fixture.league.country || 'Unknown',
                            code: fixture.league.country?.substring(0, 3).toUpperCase() || 'UNK',
                            flag: fixture.league.flag || null
                        },
                        // Add logging for final venue data
                        ...((() => {
                            console.log(`\n📍 Final venue data for match ${fixture.fixture.id}:`, {
                                venueName: venue.name,
                                venueCity: venue.city,
                                venueCountry: venue.country,
                                coordinates: venue.coordinates,
                                homeTeam: fixture.teams.home.name,
                                awayTeam: fixture.teams.away.name,
                                league: leagueName
                            });
                            return {};
                        })()),
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
                
                // Only include matches that have coordinates and distance calculations
                if (userLocation && transformedFixture.fixture.venue.distance !== null) {
                    // We have distance data - now check if it's within the specified range
                    if (maxDistance) {
                        if (transformedFixture.fixture.venue.distance <= maxDistance) {
                            transformedFixtures.push(transformedFixture);
                            console.log(`✅ Match included (${transformedFixture.fixture.venue.distance.toFixed(1)} mi ≤ ${maxDistance} mi)`);
                        } else {
                            console.log(`❌ Match excluded by distance (${transformedFixture.fixture.venue.distance.toFixed(1)} mi > ${maxDistance} mi)`);
                        }
                    } else {
                        // No distance limit specified, but we have coordinates - include it
                        transformedFixtures.push(transformedFixture);
                        console.log(`✅ Match included (${transformedFixture.fixture.venue.distance.toFixed(1)} mi, no distance limit)`);
                    }
                } else {
                    // No coordinates or no user location - exclude this match
                    console.log(`❌ Match excluded (missing coordinates or user location)`);
                }
            }
            
            console.log(`\n📏 Distance filtering results:`);
            console.log(`📊 Total matches after filtering: ${transformedFixtures.length}`);
            if (maxDistance && userLocation) {
                const withDistance = transformedFixtures.filter(m => m.fixture.venue.distance !== null);
                console.log(`📍 Matches with distance data: ${withDistance.length}`);
                console.log(`📏 Max distance filter: ${maxDistance} miles`);
            }
            
            return transformedFixtures;
        })()
    };
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
        const { dateFrom, dateTo, userLat, userLon, maxDistance } = req.query;
        
        console.log('\n🔍 MATCH REQUEST:', {
            competitionId,
            dateFrom,
            dateTo,
            userLocation: { userLat, userLon },
            maxDistance: maxDistance ? `${maxDistance} miles` : 'no limit'
        });

        // Get user from token (optional - if no token, default to freemium)
        let user = null;
        if (req.user) {
            console.log('🔑 Token user:', req.user);
            user = await User.findById(req.user.id);
            
            if (!user) {
                console.log('⚠️ User from token not found in database:', req.user.id);
                // Create a temporary user object with pro subscription
                // This is safe because the token was valid, user just needs to be recreated
                user = {
                    _id: req.user.id,
                    subscription: {
                        tier: 'pro',
                        isActive: true,
                        startDate: new Date(),
                        endDate: null
                    }
                };
                console.log('🔄 Created temporary user:', user);
            } else {
                console.log('👤 Found database user:', {
                    id: user._id,
                    subscription: user.subscription
                });
            }
        }
        
        // Check if user has access to this league
        const hasAccess = subscriptionService.hasLeagueAccess(user, competitionId);
        console.log('🔒 Access check:', {
            competitionId,
            userTier: user?.subscription?.tier || 'freemium',
            hasAccess
        });
        
        if (!hasAccess) {
            console.log('🚫 Access denied:', {
                competitionId,
                currentTier: user?.subscription?.tier || 'freemium'
            });
            return res.status(403).json({
                error: 'Subscription Required',
                message: 'Access to this league requires a higher subscription tier',
                currentTier: user?.subscription?.tier || 'freemium'
            });
        }

        // Parse distance parameter first
        const maxDistanceNum = maxDistance ? parseFloat(maxDistance) : null;
        
        // Check if we have cached data (include maxDistance in cache key)
        const cacheKey = `matches:${competitionId}:${dateFrom}:${dateTo}:${maxDistanceNum || 'unlimited'}`;
        const cachedData = matchesCache.get(cacheKey);
        if (cachedData) {
            console.log(`📦 Using cached data for ${cacheKey}`);
            return res.json(cachedData);
        }
        
        // Get matches from API-Sports
        const apiResponse = await axios.get(`${API_SPORTS_BASE_URL}/fixtures`, {
            params: {
                league: competitionId,
                season: '2025', // Fixed to 2025 season
                from: dateFrom,
                to: dateTo
            },
            headers: {
                'x-apisports-key': API_SPORTS_KEY
            },
            httpsAgent
        });

        console.log(`📊 API returned ${apiResponse.data.response?.length || 0} matches`);
        
        // Transform data
        const userLocation = userLat && userLon ? { lat: parseFloat(userLat), lon: parseFloat(userLon) } : null;
        const transformedData = await transformApiSportsData(apiResponse.data, competitionId, userLocation, maxDistanceNum);
        
        console.log(`✨ Transformed ${transformedData.response?.length || 0} matches`);

        // Cache the transformed data
        matchesCache.set(cacheKey, transformedData);

        res.json(transformedData);
    } catch (error) {
        console.error('Error fetching matches by competition:', error);
        res.status(500).json({ error: 'Failed to fetch matches' });
    }
});

// Database venue management endpoint
router.get('/venues/stats', async (req, res) => {
    try {
        const stats = await venueService.getCacheStats();
        res.json({
            success: true,
            databaseStats: stats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting venue stats:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to get venue statistics',
            message: error.message 
        });
    }
});

/**
 * GET /v4/matches/search
 * Search for matches between specific teams
 * Query params: homeTeam, awayTeam, dateFrom, dateTo, season
 */
router.get('/matches/search', async (req, res) => {
    try {
        const { homeTeam, awayTeam, dateFrom, dateTo, season = 2025 } = req.query;

        if (!homeTeam && !awayTeam) {
            return res.status(400).json({
                success: false,
                message: 'At least one team must be specified'
            });
        }

        // Build search parameters
        const params = {
            season: season
        };

        // Add team filters if provided
        if (homeTeam && awayTeam) {
            // Search for matches between specific teams
            params.h2h = `${homeTeam}-${awayTeam}`;
        } else if (homeTeam) {
            params.team = homeTeam;
        } else if (awayTeam) {
            params.team = awayTeam;
        }

        // Add date filters
        if (dateFrom) {
            params.from = dateFrom;
        }
        if (dateTo) {
            params.to = dateTo;
        }

        console.log(`🔍 Searching matches with params:`, params);

        const response = await axios.get(`${API_SPORTS_BASE_URL}/fixtures`, {
            headers: {
                'x-apisports-key': API_SPORTS_KEY
            },
            params,
            httpsAgent
        });

        if (!response.data || !response.data.response) {
            return res.json({
                success: true,
                data: {
                    matches: [],
                    count: 0
                }
            });
        }

        // Transform matches to include venue data
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
                goals: {
                    home: fixture.goals.home,
                    away: fixture.goals.away
                },
                score: fixture.score
            };
        }));

        res.json({
            success: true,
            data: {
                matches,
                count: matches.length
            }
        });

    } catch (error) {
        console.error('Error searching matches:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to search matches',
            error: error.message
        });
    }
});

/**
 * GET /api/matches/by-team
 * Get matches for a specific team
 */
router.get('/by-team', async (req, res) => {
    try {
        const { teamId, teamName, dateFrom, dateTo } = req.query;
        
        // Validate required parameters
        if (!teamId && !teamName) {
            return res.status(400).json({
                success: false,
                message: 'Either teamId or teamName is required'
            });
        }

        // Create cache key including date range
        const cacheKey = `matches_${teamId || teamName}_${dateFrom || 'all'}_${dateTo || 'all'}`;
        
        // Check cache first
        const cachedMatches = matchesCache.get(cacheKey);
        if (cachedMatches) {
            return res.json({
                success: true,
                matches: cachedMatches,
                fromCache: true
            });
        }

        // Build API request parameters
        const params = {
            team: teamId,
            season: new Date().getFullYear(), // Current year
        };

        // Add optional date range if provided
        if (dateFrom) params.from = dateFrom;
        if (dateTo) params.to = dateTo;

        // Call API-Sports fixtures endpoint
        const response = await axios.get(`${API_SPORTS_BASE_URL}/fixtures`, {
            params,
            headers: {
                'x-apisports-key': API_SPORTS_KEY
            }
        });

        // Transform the response
        const matches = await transformApiSportsData(response.data, null);

        // Cache the results
        matchesCache.set(cacheKey, matches.response);

        res.json({
            success: true,
            matches: matches.response,
            fromCache: false
        });

    } catch (error) {
        console.error('Error fetching team matches:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch team matches'
        });
    }
});

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