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

// Create HTTPS agent with SSL certificate check disabled (for development only)
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

// API-Sports configuration
const API_SPORTS_KEY = process.env.API_SPORTS_KEY || '0ab95ca9f7baeb6fd551af7ca41ed8d2';
const API_SPORTS_BASE_URL = 'https://v3.football.api-sports.io';

// Hardcoded constants removed - now using database services

// Function to transform API-Sports data to match frontend expectations
async function transformApiSportsData(apiResponse, competitionId, userLocation = null) {
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
        response: await Promise.all(fixtures.map(async fixture => ({
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
                venue: await (async () => {
                    // API-FIRST APPROACH: Use API venue data directly
                    const apiVenue = fixture.fixture.venue;
                    
                    // Get proper country information from league service
                    const properCountry = await leagueService.getCountryByLeagueId(competitionId) || fixture.league.country || 'Unknown Country';
                    
                    // Check if API provides venue data
                    if (apiVenue && apiVenue.name && apiVenue.city) {
                        // Calculate distance if user location is provided and we have coordinates
                        let distance = null;
                        let coordinates = null;
                        
                        // Check for coordinates in different possible formats from API
                        if (apiVenue.coordinates && apiVenue.coordinates.length === 2) {
                            coordinates = apiVenue.coordinates;
                        } else if (apiVenue.latitude && apiVenue.longitude) {
                            coordinates = [parseFloat(apiVenue.longitude), parseFloat(apiVenue.latitude)];
                        } else if (apiVenue.lat && apiVenue.lng) {
                            coordinates = [parseFloat(apiVenue.lng), parseFloat(apiVenue.lat)];
                        }
                        
                        // If no coordinates from API, try to enrich with our coordinate service
                        if (!coordinates) {
                            coordinates = coordinateService.getCoordinatesByStadium(apiVenue.name);
                        }
                        
                        if (userLocation && coordinates && coordinates.length === 2) {
                            const [venueLon, venueLat] = coordinates;
                            distance = calculateDistance(userLocation.lat, userLocation.lon, venueLat, venueLon);
                        }
                        
                        const coordsDisplay = coordinates ? coordinates.join(', ') : 'no coords';
                        const sourceLabel = coordinates ? (apiVenue.coordinates ? 'API' : 'ENRICHED') : 'API';
                        console.log(`🏟️  ${sourceLabel} VENUE: ${fixture.teams.home.name} → ${apiVenue.name} at [${coordsDisplay}] ${distance ? `(${distance.toFixed(1)}mi)` : '(no distance)'}`);
                        
                        return {
                            id: apiVenue.id || `venue-${apiVenue.name.replace(/\s+/g, '-').toLowerCase()}`,
                            name: apiVenue.name,
                            city: apiVenue.city,
                            country: properCountry,
                            distance: distance,
                            coordinates: coordinates
                        };
                    }
                    
                    // Fallback: Try database lookup for legacy support (mainly Chicago Fire)
                    const mappedTeamName = await teamService.mapApiNameToTeam(fixture.teams.home.name);
                    const venueData = await venueService.getVenueForTeam(mappedTeamName);
                    
                    if (venueData && venueData.coordinates && venueData.coordinates.length === 2) {
                        // Calculate distance if user location is provided
                        let distance = null;
                        if (userLocation) {
                            const [venueLon, venueLat] = venueData.coordinates;
                            distance = calculateDistance(userLocation.lat, userLocation.lon, venueLat, venueLon);
                        }
                        
                        console.log(`🏟️  DB FALLBACK: ${fixture.teams.home.name} → ${mappedTeamName} → ${venueData.stadium || venueData.name} at [${venueData.coordinates}] ${distance ? `(${distance.toFixed(1)}mi)` : '(no distance)'}`);
                        
                        return {
                            id: `venue-${mappedTeamName.replace(/\s+/g, '-').toLowerCase()}`,
                            name: venueData.stadium || venueData.name,
                            city: venueData.city,
                            country: venueData.country,
                            distance: distance,
                            coordinates: venueData.coordinates
                        };
                    }
                    
                    // Final fallback: Basic venue info without coordinates
                    console.log(`⚠️  NO VENUE DATA: ${fixture.teams.home.name} - using basic fallback`);
                    
                    return {
                        id: apiVenue?.id || null,
                        name: apiVenue?.name || `${fixture.teams.home.name} Stadium`,
                        city: apiVenue?.city || fixture.teams.home.name,
                        country: properCountry,
                        distance: null,
                        coordinates: null
                    };
                })()
            },
            league: {
                id: competitionId.toString(),
                name: leagueName
            },
            teams: {
                home: {
                    id: fixture.teams.home.id,
                    name: await teamService.mapApiNameToTeam(fixture.teams.home.name),
                    logo: fixture.teams.home.logo
                },
                away: {
                    id: fixture.teams.away.id,
                    name: await teamService.mapApiNameToTeam(fixture.teams.away.name),
                    logo: fixture.teams.away.logo
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
        })))
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
router.get('/competitions/:competitionId/matches', authenticateToken, async (req, res) => {
    try {
        const { competitionId } = req.params;
        const { dateFrom, dateTo, userLat, userLon } = req.query;
        
        // Get user from token (optional - if no token, default to freemium)
        let user = null;
        if (req.user) {
            user = await User.findById(req.user.id);
        }
        
        // Check if user has access to this league
        if (!subscriptionService.hasLeagueAccess(user, competitionId)) {
            return res.status(403).json({
                error: 'Subscription Required',
                message: `Access to this league requires a ${competitionId === '40' ? 'Pro' : 'higher'} subscription`,
                requiredTier: competitionId === '40' ? 'pro' : 'planner',
                currentTier: user?.subscription?.tier || 'freemium'
            });
        }
        
        // Removed verbose API logs - keeping only marker debugging logs

        // Build API-Sports request parameters
        const params = {
            league: competitionId,
            season: 2025  // 2025-26 season for most leagues
        };

        // Add date filters if provided
        if (dateFrom) {
            params.from = dateFrom;
        }
        if (dateTo) {
            params.to = dateTo;
        }

        // API request details removed - focusing on marker debugging

        const response = await axios.get(`${API_SPORTS_BASE_URL}/fixtures`, {
            headers: {
                'x-apisports-key': API_SPORTS_KEY
            },
            params,
            httpsAgent
        });
        
        // Removed verbose API response logging

        // Transform the API-Sports response to match frontend expectations
        const userLocation = (userLat && userLon) ? { lat: parseFloat(userLat), lon: parseFloat(userLon) } : null;
        const transformedData = await transformApiSportsData(response.data, competitionId, userLocation);
        
        // Keep only essential marker debugging logs

        res.json(transformedData);
    } catch (error) {
        console.error('Error fetching matches:', {
            competitionId: req.params.competitionId,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            message: error.message
        });

        // If the error is from the API-Sports API
        if (error.response?.data) {
            return res.status(error.response.status || 500).json({
                error: 'API-Sports Error',
                message: error.response.data.message || 'Unknown API error',
                details: error.response.data
            });
        }

        // For all other errors
        res.status(500).json({ 
            error: 'Failed to fetch matches',
            message: error.message
        });
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
                        logo: fixture.teams.home.logo
                    },
                    away: {
                        id: fixture.teams.away.id,
                        name: await teamService.mapApiNameToTeam(fixture.teams.away.name),
                        logo: fixture.teams.away.logo
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

module.exports = router; 