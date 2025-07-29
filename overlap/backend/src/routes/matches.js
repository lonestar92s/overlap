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
async function transformApiSportsData(apiResponse, competitionId, bounds = null) {
    const fixtures = apiResponse.response || [];
    const leagueName = await leagueService.getLeagueNameById(competitionId);
    


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

                
                const transformedFixture = await (async () => {
                    // Get venue data
                    const venue = await (async () => {
                        const apiVenue = fixture.fixture.venue;


                        // ✅ METHOD 1: Check MongoDB by venue name (fast, no rate limits)
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

                        // ✅ METHOD 2: Try team mapping (fallback)
                        const mappedTeamName = await teamService.mapApiNameToTeam(fixture.teams.home.name);
                        
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
                            
                            
                            return {
                                id: `venue-${mappedTeamName.replace(/\s+/g, '-').toLowerCase()}`,
                                name: team.venue.name,
                                city: team.city || team.venue.city,
                                country: team.country,
                                coordinates: team.venue.coordinates
                            };
                        }
                        
                        // If team found but no venue coordinates, try venue service
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
                        
                        
                        // Final fallback: Basic venue info without coordinates
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
                
                // Filter matches based on bounds or include all if no bounds specified
                if (bounds && transformedFixture.fixture.venue.coordinates) {
                    // Check if venue coordinates are within the specified bounds
                    if (isWithinBounds(transformedFixture.fixture.venue.coordinates, bounds)) {
                        transformedFixtures.push(transformedFixture);
                    }
                } else if (!bounds) {
                    // No bounds filtering - include all matches with coordinates
                    if (transformedFixture.fixture.venue.coordinates) {
                        transformedFixtures.push(transformedFixture);
                    }
                }
            }
            

            
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
    
    // Check if the point is within the rectangular bounds
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
        
        // Create bounds object if bounds parameters are provided
        const bounds = (neLat && neLng && swLat && swLng) ? {
            northeast: { lat: parseFloat(neLat), lng: parseFloat(neLng) },
            southwest: { lat: parseFloat(swLat), lng: parseFloat(swLng) }
        } : null;
        


        // Get user from token (optional - if no token, default to freemium)
        let user = null;
        if (req.user) {
    
            user = await User.findById(req.user.id);
            
            if (!user) {

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

            } else {

            }
        }
        
        // Check if user has access to this league
        const hasAccess = subscriptionService.hasLeagueAccess(user, competitionId);

        
        if (!hasAccess) {

            return res.status(403).json({
                error: 'Subscription Required',
                message: 'Access to this league requires a higher subscription tier',
                currentTier: user?.subscription?.tier || 'freemium'
            });
        }

        // Create cache key that includes bounds
        const boundsKey = bounds ? `${bounds.northeast.lat}-${bounds.northeast.lng}-${bounds.southwest.lat}-${bounds.southwest.lng}` : 'no-bounds';
        const cacheKey = `matches:${competitionId}:${dateFrom}:${dateTo}:${boundsKey}`;
        const cachedData = matchesCache.get(cacheKey);
        if (cachedData) {

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


        
        // Transform data with bounds filtering
        const transformedData = await transformApiSportsData(apiResponse.data, competitionId, bounds);
        


        // Cache the transformed data
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
        res.status(500).json({
            success: false,
            message: 'Failed to fetch matches',
            error: error.message
        });
    }
});

/**
 * GET /api/matches/popular
 * Get popular matches from top 5 leagues for next 30 days
 */
router.get('/popular', async (req, res) => {
    try {
        // Get league IDs from query parameters or use defaults
        const { leagueIds } = req.query;
        let popularLeagueIds, popularLeagueNames;
        
        if (leagueIds) {
            // Parse comma-separated league IDs
            const ids = leagueIds.split(',').map(id => parseInt(id.trim()));
            popularLeagueIds = ids;
            popularLeagueNames = ids.map(id => `League ${id}`); // Generic names for custom IDs
        } else {
            // Default top 5 leagues: Premier League, La Liga, Serie A, Bundesliga, Ligue 1
            // Use hardcoded mappings to bypass database restrictions
            const leagueMappings = {
                39: 'Premier League',
                140: 'La Liga', 
                135: 'Serie A',
                78: 'Bundesliga',
                61: 'Ligue 1'
            };
            popularLeagueIds = [39, 140, 135, 78, 61]; // API-Sports league IDs
            popularLeagueNames = popularLeagueIds.map(id => leagueMappings[id] || `League ${id}`);
        }
        
        // Calculate date range (next 30 days)
        const today = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(today.getDate() + 30);
        
        const dateFrom = today.toISOString().split('T')[0];
        const dateTo = thirtyDaysFromNow.toISOString().split('T')[0];
        
        // Fetch matches from all popular leagues
        const allMatches = [];
        
        for (let i = 0; i < popularLeagueIds.length; i++) {
            const leagueId = popularLeagueIds[i];
            const leagueName = popularLeagueNames[i];
            
            try {
                // Use the same API call structure as the working endpoint
                const apiResponse = await axios.get(`${API_SPORTS_BASE_URL}/fixtures`, {
                    params: {
                        league: leagueId,
                        season: '2025', // Use 2025 season like the working endpoint
                        from: dateFrom,
                        to: dateTo
                    },
                    headers: {
                        'x-apisports-key': API_SPORTS_KEY
                    },
                    httpsAgent
                });
                
                if (apiResponse.data && apiResponse.data.response && apiResponse.data.response.length > 0) {
                    allMatches.push(...apiResponse.data.response);
                }
                
                // Rate limiting - small delay between requests
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                // Continue with other leagues
            }
        }
        
        if (allMatches.length === 0) {
            return res.json({
                success: true,
                matches: [],
                message: 'No popular matches found'
            });
        }
        
        // Randomize and limit to 10 matches
        const shuffledMatches = allMatches.sort(() => Math.random() - 0.5);
        const selectedMatches = shuffledMatches.slice(0, 10);
        
        console.log(`🎯 Popular Matches - Selected ${selectedMatches.length} matches from ${allMatches.length} total:`);
        selectedMatches.forEach((match, index) => {
            console.log(`${index + 1}. ${match.teams.home.name} vs ${match.teams.away.name} - ${match.league.name} - ${new Date(match.fixture.date).toLocaleDateString()}`);
        });
        
        // Transform matches to include venue data
        const transformedMatches = await Promise.all(selectedMatches.map(async (match) => {
            const venue = match.fixture?.venue;
            
            // Get venue data from our database if available
            let venueData = null;
            if (venue?.name) {
                venueData = await venueService.getVenueByName(venue.name, venue.city);
            }
            
            return {
                id: match.fixture.id,
                fixture: {
                    id: match.fixture.id,
                    date: match.fixture.date,
                    venue: {
                        id: venue?.id || null,
                        name: venueData?.name || venue?.name || 'Unknown Venue',
                        city: venueData?.city || venue?.city || 'Unknown City',
                        country: venueData?.country || match.league?.country || 'Unknown Country',
                        coordinates: venueData?.coordinates || null,
                        image: venueData?.image || null // Venue image if available
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
                        name: match.teams.home.name,
                        logo: match.teams.home.logo
                    },
                    away: {
                        id: match.teams.away.id,
                        name: match.teams.away.name,
                        logo: match.teams.away.logo
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
        
        res.json({
            success: true,
            matches: transformedMatches,
            totalFound: allMatches.length,
            dateRange: {
                from: dateFrom,
                to: dateTo
            },
            leagues: popularLeagueNames
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch popular matches',
            error: error.message
        });
    }
});

module.exports = router; 