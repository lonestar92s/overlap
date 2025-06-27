const express = require('express');
const axios = require('axios');
const https = require('https');
const { getVenueForTeam, getCacheStats, clearVenuesCache, refreshVenuesCache } = require('../data/venues');
const router = express.Router();

// Create HTTPS agent with SSL certificate check disabled (for development only)
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

// API-Sports configuration
const API_SPORTS_KEY = process.env.API_SPORTS_KEY || '0ab95ca9f7baeb6fd551af7ca41ed8d2';
const API_SPORTS_BASE_URL = 'https://v3.football.api-sports.io';

// League ID to name mapping
const LEAGUE_NAMES = {
    '39': 'Premier League',
    '40': 'Championship',
    '61': 'Ligue 1',
    '140': 'La Liga',
    '78': 'Bundesliga',
    '207': 'Swiss Super League',
    '88': 'Eredivisie',
    '94': 'Primeira Liga',
    '135': 'Serie A',
    '71': 'Série A',
    '253': 'Major League Soccer',
    '2': 'UEFA Champions League',
    '4': 'European Championship',
    '13': 'Copa Libertadores',
    '1': 'FIFA World Cup'
};

// Team name mapping from API-Sports names to venues.js keys
const TEAM_NAME_MAPPING = {
    // Premier League
    'Liverpool': 'Liverpool FC',
    'Arsenal': 'Arsenal FC',
    'Chelsea': 'Chelsea FC',
    'Manchester United': 'Manchester United FC',
    'Manchester City': 'Manchester City FC',
    'Tottenham': 'Tottenham Hotspur FC',
    'Newcastle': 'Newcastle United FC',
    'Aston Villa': 'Aston Villa FC',
    'West Ham': 'West Ham United FC',
    'Brighton': 'Brighton & Hove Albion FC',
    'Crystal Palace': 'Crystal Palace FC',
    'Fulham': 'Fulham FC',
    'Brentford': 'Brentford FC',
    'Nottingham Forest': 'Nottingham Forest FC',
    'Everton': 'Everton FC',
    'Wolverhampton Wanderers': 'Wolverhampton Wanderers FC',
    'Bournemouth': 'AFC Bournemouth',
    'Leicester': 'Leicester City FC',
    'Southampton': 'Southampton FC',
    'Ipswich': 'Ipswich Town FC',
    
    // Championship
    'West Bromwich Albion': 'West Bromwich Albion FC',
    'Norwich': 'Norwich City FC',
    'Hull City': 'Hull City AFC',
    'Coventry': 'Coventry City FC',
    'Sunderland': 'Sunderland AFC',
    'Preston': 'Preston North End FC',
    'Middlesbrough': 'Middlesbrough FC',
    'Stoke City': 'Stoke City FC',
    'Bristol City': 'Bristol City FC',
    'Cardiff': 'Cardiff City FC',
    'Birmingham': 'Birmingham City FC',
    'Watford': 'Watford FC',
    'Plymouth': 'Plymouth Argyle FC',
    
    // La Liga
    'Real Madrid': 'Real Madrid CF',
    'Barcelona': 'FC Barcelona',
    'Atletico Madrid': 'Atlético de Madrid',
    'Sevilla': 'Sevilla FC',
    'Real Betis': 'Real Betis',
    'Valencia': 'Valencia CF',
    'Villarreal': 'Villarreal CF',
    'Athletic Club': 'Athletic Bilbao',
    'Real Sociedad': 'Real Sociedad',
    'Celta Vigo': 'RC Celta de Vigo',
    'Espanyol': 'RCD Espanyol',
    'Getafe': 'Getafe CF',
    'Osasuna': 'CA Osasuna',
    'Rayo Vallecano': 'Rayo Vallecano',
    'Alaves': 'Deportivo Alavés',
    'Las Palmas': 'UD Las Palmas',
    'Girona': 'Girona FC',
    'Mallorca': 'RCD Mallorca',
    'Leganes': 'CD Leganés',
    'Valladolid': 'Real Valladolid CF',
    
    // Bundesliga
    'Bayern Munich': 'FC Bayern München',
    'Borussia Dortmund': 'Borussia Dortmund',
    'RB Leipzig': 'RB Leipzig',
    'Bayer Leverkusen': 'Bayer 04 Leverkusen',
    'Eintracht Frankfurt': 'Eintracht Frankfurt',
    'Wolfsburg': 'VfL Wolfsburg',
    'Borussia Monchengladbach': 'Borussia Mönchengladbach',
    'Union Berlin': '1. FC Union Berlin',
    'Freiburg': 'SC Freiburg',
    'Stuttgart': 'VfB Stuttgart',
    'Hoffenheim': 'TSG 1899 Hoffenheim',
    'Mainz': '1. FSV Mainz 05',
    'Augsburg': 'FC Augsburg',
    'Werder Bremen': 'SV Werder Bremen',
    'Heidenheim': '1. FC Heidenheim 1846',
    'Darmstadt': 'SV Darmstadt 98',
    'Bochum': 'VfL Bochum 1848',
    'Koln': '1. FC Köln',
    
    // Serie A
    'Juventus': 'Juventus FC',
    'AC Milan': 'AC Milan',
    'Inter': 'Inter Milan',
    'Napoli': 'SSC Napoli',
    'AS Roma': 'AS Roma',
    'Lazio': 'SS Lazio',
    'Atalanta': 'Atalanta BC',
    'Fiorentina': 'ACF Fiorentina',
    'Bologna': 'Bologna FC 1909',
    'Torino': 'Torino FC',
    
    // Ligue 1
    'Paris Saint Germain': 'Paris Saint-Germain FC',
    'Marseille': 'Olympique de Marseille',
    'Lyon': 'Olympique Lyonnais',
    'Monaco': 'AS Monaco FC',
    'Lille': 'LOSC Lille',
    'Nice': 'OGC Nice',
    'Rennes': 'Stade Rennais FC',
    'Strasbourg': 'RC Strasbourg Alsace',
    'Nantes': 'FC Nantes',
    'Montpellier': 'Montpellier HSC',
    'Lens': 'RC Lens',
    'Brest': 'Stade Brestois 29',
    'Reims': 'Stade de Reims',
    'Toulouse': 'Toulouse FC',
    'Le Havre': 'Le Havre AC',
    'Metz': 'FC Metz',
    'Clermont Foot': 'Clermont Foot 63',
    'Angers': 'Angers SCO',
    
    // Brazilian Serie A (fixed based on console logs)
    'Bahia': 'EC Bahia',
    'Fluminense': 'Fluminense FC',
    'Flamengo': 'CR Flamengo',
    'Palmeiras': 'SE Palmeiras',
    'Sao Paulo': 'São Paulo FC',
    'Internacional': 'SC Internacional',
    'Atletico-MG': 'CA Mineiro',
    'Vasco DA Gama': 'CR Vasco da Gama',  // Fixed: API uses "DA" not "da"
    'Gremio': 'Grêmio FBPA',
    'Corinthians': 'SC Corinthians Paulista',
    'Fortaleza EC': 'Fortaleza EC',  // Fixed: API includes "EC"
    'Santos': 'Santos FC',
    'Cruzeiro': 'Cruzeiro EC',
    'Vitoria': 'EC Vitória',
    'RB Bragantino': 'RB Bragantino',
    'Ceara': 'Ceará SC',
    'Botafogo': 'Botafogo FR',
    'Mirassol': 'Mirassol FC',
    'Juventude': 'EC Juventude',
    'Sport Recife': 'Sport Recife',
    
    // Premier League missing teams
    'Burnley': 'Burnley FC',
    'Wolves': 'Wolverhampton Wanderers FC',
    'Leeds': 'Leeds United FC',
    
    // Serie A teams (2024-25 season - removed relegated teams Sassuolo, Salernitana, Frosinone)
    'Lazio': 'SS Lazio',
    'Cagliari': 'Cagliari Calcio',
    'Parma': 'Parma Calcio 1913',  // Promoted
    'Inter': 'Inter Milan',
    'Verona': 'Hellas Verona FC',
    'Como': 'Como 1907',  // Promoted
    'Udinese': 'Udinese Calcio',
    'Lecce': 'US Lecce',
    'Genoa': 'Genoa CFC',
    'Empoli': 'Empoli FC',
    'Monza': 'AC Monza',
    'Venezia': 'Venezia FC',  // Promoted
    
    // Eredivisie (Dutch League)
    'Ajax': 'AFC Ajax',
    'PSV': 'PSV',
    'Feyenoord': 'Feyenoord Rotterdam',
    'AZ Alkmaar': 'AZ',
    'FC Twente': 'FC Twente \'65',
    'Vitesse': 'Vitesse Arnhem',
    'FC Utrecht': 'FC Utrecht',
    'SC Heerenveen': 'SC Heerenveen',
    'Sparta Rotterdam': 'Sparta Rotterdam',
    'NEC Nijmegen': 'NEC',
    'PEC Zwolle': 'PEC Zwolle',
    'Go Ahead Eagles': 'Go Ahead Eagles',
    'Almere City': 'Almere City FC',
    'Excelsior': 'Excelsior Rotterdam',
    'Heracles': 'Heracles Almelo',
    'RKC Waalwijk': 'RKC Waalwijk',
    'Fortuna Sittard': 'Fortuna Sittard',
    'FC Volendam': 'FC Volendam',
    'FC Groningen': 'FC Groningen',
    'Willem II': 'Willem II Tilburg',
    'NAC Breda': 'NAC Breda',

    // Primeira Liga (Portuguese League)
    'Benfica': 'SL Benfica',
    'Porto': 'FC Porto',
    'Sporting CP': 'Sporting CP',
    'Braga': 'SC Braga',
    'Vitoria Guimaraes': 'Vitória SC',

    // MLS teams
    'Real Salt Lake': 'Real Salt Lake',
    'Sporting Kansas City': 'Sporting Kansas City',
    'Chicago Fire': 'Chicago Fire FC',
    'St. Louis City': 'St. Louis City SC',
    'Atlanta United FC': 'Atlanta United FC',
    'Charlotte': 'Charlotte FC',
    'FC Cincinnati': 'FC Cincinnati',
    'DC United': 'D.C. United',
    'CF Montreal': 'CF Montréal',
    'New England Revolution': 'New England Revolution',
    'San Jose Earthquakes': 'San Jose Earthquakes',
    'FC Dallas': 'FC Dallas',
    'Seattle Sounders': 'Seattle Sounders FC',
    'Colorado Rapids': 'Colorado Rapids',
    'Vancouver Whitecaps': 'Vancouver Whitecaps FC',
    'Portland Timbers': 'Portland Timbers',
    'Inter Miami': 'Inter Miami CF',
    'New York City FC': 'New York City FC',
    'Philadelphia Union': 'Philadelphia Union',
    'Columbus Crew': 'Columbus Crew',
    'Orlando City SC': 'Orlando City SC',
    'Austin': 'Austin FC',
    'Houston Dynamo': 'Houston Dynamo FC',
    'Minnesota United FC': 'Minnesota United FC',
    'Los Angeles Galaxy': 'LA Galaxy',
    'Los Angeles FC': 'Los Angeles FC',
    'San Diego': 'San Diego FC',
    'New York Red Bulls': 'New York Red Bulls',
    'Toronto FC': 'Toronto FC',
    'Nashville SC': 'Nashville SC'
};

// Function to map API-Sports team name to venues.js key
function mapTeamName(apiSportsName) {
    return TEAM_NAME_MAPPING[apiSportsName] || apiSportsName;
}

// Function to transform API-Sports data to match frontend expectations
function transformApiSportsData(apiResponse, competitionId, userLocation = null) {
    const fixtures = apiResponse.response || [];
    const leagueName = LEAGUE_NAMES[competitionId.toString()] || 'Unknown League';
    
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
        response: fixtures.map(fixture => ({
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
                venue: (() => {
                    // Map API-Sports team name to our venues.js key
                    const mappedTeamName = mapTeamName(fixture.teams.home.name);
                    const venueData = getVenueForTeam(mappedTeamName);
                    
                    if (venueData) {
                        // Calculate distance if user location is provided
                        let distance = null;
                        if (userLocation && venueData.coordinates) {
                            const [venueLon, venueLat] = venueData.coordinates;
                            distance = calculateDistance(userLocation.lat, userLocation.lon, venueLat, venueLon);
                        }
                        
                        console.log(`🏟️  MARKER DATA: ${fixture.teams.home.name} → ${mappedTeamName} → ${venueData.stadium} at [${venueData.coordinates}] ${distance ? `(${distance.toFixed(1)}mi)` : '(no distance)'}`);
                        
                        return {
                            id: fixture.fixture.venue?.id || `venue-${mappedTeamName.replace(/\s+/g, '-').toLowerCase()}`,
                            name: venueData.stadium,
                            city: venueData.city,
                            country: venueData.country,
                            distance: distance,
                            coordinates: venueData.coordinates
                        };
                    } else {
                        console.log(`❌ NO MARKER: ${fixture.teams.home.name} (mapped to ${mappedTeamName}) - venue not found in database`);
                        
                        // Get proper country information from our league data
                        const leagueCountryMap = {
                            '39': 'England',     // Premier League
                            '40': 'England',     // Championship
                            '61': 'France',      // Ligue 1
                            '140': 'Spain',      // La Liga
                            '78': 'Germany',     // Bundesliga
                            '88': 'Netherlands', // Eredivisie
                            '94': 'Portugal',    // Primeira Liga
                            '135': 'Italy',      // Serie A
                            '71': 'Brazil',      // Série A
                            '253': 'United States', // MLS
                            '2': 'Europe',       // Champions League
                            '4': 'Europe',       // European Championship
                            '13': 'South America', // Copa Libertadores
                            '1': 'International' // World Cup
                        };
                        
                        const properCountry = leagueCountryMap[competitionId.toString()] || fixture.league.country || 'Unknown Country';
                        
                        // Fallback to API-Sports data if we don't have venue data
                        return {
                            id: fixture.fixture.venue?.id || null,
                            name: fixture.fixture.venue?.name || 'Unknown Venue',
                            city: fixture.fixture.venue?.city || 'Unknown City',
                            country: properCountry,
                            distance: null,
                            coordinates: null
                        };
                    }
                })()
            },
            league: {
                id: competitionId.toString(),
                name: leagueName
            },
            teams: {
                home: {
                    id: fixture.teams.home.id,
                    name: mapTeamName(fixture.teams.home.name),
                    logo: fixture.teams.home.logo
                },
                away: {
                    id: fixture.teams.away.id,
                    name: mapTeamName(fixture.teams.away.name),
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
        }))
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
router.get('/competitions/:competitionId/matches', async (req, res) => {
    try {
        const { competitionId } = req.params;
        const { dateFrom, dateTo, userLat, userLon } = req.query;
        
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
        const transformedData = transformApiSportsData(response.data, competitionId, userLocation);
        
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

// Cache management endpoints
router.get('/cache/venues/stats', (req, res) => {
    try {
        const stats = getCacheStats();
        res.json({
            success: true,
            cacheStats: stats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting cache stats:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to get cache statistics',
            message: error.message 
        });
    }
});

router.post('/cache/venues/clear', (req, res) => {
    try {
        clearVenuesCache();
        res.json({
            success: true,
            message: 'Venues cache cleared successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error clearing cache:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to clear cache',
            message: error.message 
        });
    }
});

router.post('/cache/venues/refresh', (req, res) => {
    try {
        const refreshedCache = refreshVenuesCache();
        const stats = getCacheStats();
        res.json({
            success: true,
            message: 'Venues cache refreshed successfully',
            venueCount: Object.keys(refreshedCache).length,
            cacheStats: stats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error refreshing cache:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to refresh cache',
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
        const matches = response.data.response.map(fixture => {
            const homeTeamName = mapTeamName(fixture.teams.home.name);
            const venueData = getVenueForTeam(homeTeamName);

            return {
                fixture: {
                    id: fixture.fixture.id,
                    date: fixture.fixture.date,
                    status: fixture.fixture.status,
                    venue: venueData ? {
                        id: venueData.stadium || fixture.fixture.venue?.name,
                        name: venueData.stadium || fixture.fixture.venue?.name || 'Unknown Venue',
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
                        name: mapTeamName(fixture.teams.away.name),
                        logo: fixture.teams.away.logo
                    }
                },
                goals: {
                    home: fixture.goals.home,
                    away: fixture.goals.away
                },
                score: fixture.score
            };
        });

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