const express = require('express');
const OpenAI = require('openai');
const https = require('https');
const axios = require('axios');
const teamService = require('../services/teamService');
const leagueService = require('../services/leagueService');
const router = express.Router();

// API-Sports configuration
const API_SPORTS_KEY = process.env.API_SPORTS_KEY || '0ab95ca9f7baeb6fd551af7ca41ed8d2';
const API_SPORTS_BASE_URL = 'https://v3.football.api-sports.io';

// Create HTTPS agent for search
const searchHttpsAgent = new https.Agent({
    rejectUnauthorized: false
});

// Function to perform search directly (extracted from matches route)
async function performSearch({ competitions, dateFrom, dateTo, season, bounds }) {
    const requests = [];
    
    // League requests
    for (const leagueId of competitions) {
        requests.push(
            axios.get(`${API_SPORTS_BASE_URL}/fixtures`, {
                params: { league: leagueId, season: season, from: dateFrom, to: dateTo },
                headers: { 'x-apisports-key': API_SPORTS_KEY },
                httpsAgent: searchHttpsAgent,
                timeout: 10000
            }).then(r => ({ type: 'league', id: leagueId, data: r.data }))
              .catch(() => ({ type: 'league', id: leagueId, data: { response: [] } }))
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

    // Transform and filter matches
    const transformedMatches = [];
    for (const match of fixtures) {
        const venue = match.fixture?.venue;
        let venueInfo = null;
        
        if (venue?.id) {
            // Use API venue data directly - no database lookup needed
            venueInfo = {
                id: venue.id,
                name: venue.name,
                city: venue.city,
                country: venue.country,
                coordinates: null, // No coordinates needed for messages screen
                image: null
            };
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

        // For messages screen, we don't need coordinate-based filtering
        // Just include all matches regardless of coordinates
        transformedMatches.push(transformed);
    }

    // Sort by date
    transformedMatches.sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));
    return transformedMatches;
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

// Helper function to calculate distance between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c * 0.621371; // Convert km to miles
}

// Create custom HTTPS agent that ignores SSL certificate issues (for development only)
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

// Initialize OpenAI only if API key is available
let openai = null;
if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        httpAgent: httpsAgent
    });
}

// Helper function to format date as YYYY-MM-DD
const formatDate = (date) => {
    return date.toISOString().split('T')[0];
};

// Helper function to get date range for a month, with year adjustment
const getMonthDateRange = (date, targetMonth = null) => {
    let year = date.getFullYear();
    let month = targetMonth !== null ? targetMonth - 1 : date.getMonth();
    
    // If target month is specified and it's earlier than current month, assume next year
    if (targetMonth !== null && month < date.getMonth()) {
        year++;
    }
    
    const firstOfMonth = new Date(year, month, 1);
    const lastOfMonth = new Date(year, month + 1, 0);
    return {
        start: formatDate(firstOfMonth),
        end: formatDate(lastOfMonth)
    };
};

// Helper function to get date range for a weekend
const getWeekendDateRange = (baseDate) => {
    const friday = new Date(baseDate);
    
    // Explicitly set year to 2025
    friday.setFullYear(2025);
    
    // Calculate next Friday if needed
    const dayOfWeek = friday.getDay();
    if (dayOfWeek !== 5) { // If not Friday
        const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
        friday.setDate(friday.getDate() + daysUntilFriday);
    }
    
    const sunday = new Date(friday);
    sunday.setDate(friday.getDate() + 2); // Add 2 days to get to Sunday
    
    return {
        start: formatDate(friday),
        end: formatDate(sunday)
    };
};

// Helper function to get location with country
const getLocationWithCountry = (city) => {
    const cityMapping = {
        'london': { city: 'London', country: 'United Kingdom', coordinates: [-0.118092, 51.509865] },
        'manchester': { city: 'Manchester', country: 'United Kingdom', coordinates: [-2.244644, 53.483959] },
        'liverpool': { city: 'Liverpool', country: 'United Kingdom', coordinates: [-2.991573, 53.408371] },
        'birmingham': { city: 'Birmingham', country: 'United Kingdom', coordinates: [-1.898575, 52.489471] },
        'leeds': { city: 'Leeds', country: 'United Kingdom', coordinates: [-1.549077, 53.801277] },
        'barcelona': { city: 'Barcelona', country: 'Spain', coordinates: [2.170006, 41.387097] },
        'madrid': { city: 'Madrid', country: 'Spain', coordinates: [-3.703790, 40.416775] },
        'munich': { city: 'Munich', country: 'Germany', coordinates: [11.581981, 48.135125] },
        'paris': { city: 'Paris', country: 'France', coordinates: [2.352222, 48.856614] },
        'lisbon': { city: 'Lisbon', country: 'Portugal', coordinates: [-9.139337, 38.722252] },
        'porto': { city: 'Porto', country: 'Portugal', coordinates: [-8.611837, 41.149968] }
    };
    return cityMapping[city.toLowerCase()] || null;
};

// Enhanced date parsing for complex queries
const parseComplexDates = (query) => {
    const queryLower = query.toLowerCase();
    const now = new Date();
    const currentYear = now.getFullYear();
    
    // Helper function to get next occurrence of a day
    const getNextDay = (dayOfWeek, fromDate = now) => {
        const date = new Date(fromDate);
        const days = (dayOfWeek - date.getDay() + 7) % 7;
        date.setDate(date.getDate() + (days === 0 ? 7 : days));
        return date;
    };
    
    // Helper function to get weekend dates (Friday-Sunday)
    const getWeekendDates = (startDate) => {
        const friday = new Date(startDate);
        friday.setDate(startDate.getDate() - startDate.getDay() + 5); // Friday
        const sunday = new Date(friday);
        sunday.setDate(friday.getDate() + 2); // Sunday
        return { start: friday, end: sunday };
    };

    // Specific date range patterns
    const dateRangePatterns = [
        // "January 2026" or "january 2026" (single month with year)
        {
            pattern: /(\w+)\s+(\d{4})/,
            handler: (match) => {
                const [, monthName, year] = match;
                const month = getMonthNumber(monthName);
                const yearToUse = parseInt(year);
                
                if (month !== -1) {
                    const startOfMonth = new Date(yearToUse, month - 1, 1);
                    const endOfMonth = new Date(yearToUse, month, 0); // Last day of month
                    return {
                        start: formatDate(startOfMonth),
                        end: formatDate(endOfMonth)
                    };
                }
                return null;
            }
        },
        
        
        // "between March 15-30" or "March 15-30"
        {
            pattern: /(?:between\s+)?(\w+)\s+(\d{1,2})\s*[-–]\s*(\d{1,2})(?:\s*,?\s*(\d{4}))?/,
            handler: (match) => {
                const [, monthName, startDay, endDay, year] = match;
                const month = getMonthNumber(monthName);
                const yearToUse = year ? parseInt(year) : (month < now.getMonth() + 1 ? currentYear + 1 : currentYear);
                
                if (month !== -1) {
                    return {
                        start: formatDate(new Date(yearToUse, month - 1, parseInt(startDay))),
                        end: formatDate(new Date(yearToUse, month - 1, parseInt(endDay)))
                    };
                }
                return null;
            }
        },
        
        // "first weekend of March"
        {
            pattern: /first\s+weekend\s+of\s+(\w+)(?:\s+(\d{4}))?/,
            handler: (match) => {
                const [, monthName, year] = match;
                const month = getMonthNumber(monthName);
                const yearToUse = year ? parseInt(year) : (month < now.getMonth() + 1 ? currentYear + 1 : currentYear);
                
                if (month !== -1) {
                    const firstOfMonth = new Date(yearToUse, month - 1, 1);
                    const firstFriday = getNextDay(5, firstOfMonth);
                    const weekend = getWeekendDates(firstFriday);
                    return {
                        start: formatDate(weekend.start),
                        end: formatDate(weekend.end)
                    };
                }
                return null;
            }
        },
        
        // "last weekend of March"
        {
            pattern: /last\s+weekend\s+of\s+(\w+)(?:\s+(\d{4}))?/,
            handler: (match) => {
                const [, monthName, year] = match;
                const month = getMonthNumber(monthName);
                const yearToUse = year ? parseInt(year) : (month < now.getMonth() + 1 ? currentYear + 1 : currentYear);
                
                if (month !== -1) {
                    const lastOfMonth = new Date(yearToUse, month, 0); // Last day of month
                    const lastFriday = new Date(lastOfMonth);
                    lastFriday.setDate(lastOfMonth.getDate() - (lastOfMonth.getDay() + 2) % 7);
                    const weekend = getWeekendDates(lastFriday);
                    return {
                        start: formatDate(weekend.start),
                        end: formatDate(weekend.end)
                    };
                }
                return null;
            }
        },
        
        // "November" or "november" (single month without year) - must be last to avoid conflicts
        {
            pattern: /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b/i,
            handler: (match) => {
                const [, monthName] = match;
                const month = getMonthNumber(monthName);
                
                if (month !== -1) {
                    // Determine year: if month is in the past, use next year
                    const yearToUse = month < now.getMonth() + 1 ? currentYear + 1 : currentYear;
                    
                    const startOfMonth = new Date(yearToUse, month - 1, 1);
                    const endOfMonth = new Date(yearToUse, month, 0); // Last day of month
                    return {
                        start: formatDate(startOfMonth),
                        end: formatDate(endOfMonth)
                    };
                }
                return null;
            }
        }
    ];

    // Try specific patterns first
    for (const { pattern, handler } of dateRangePatterns) {
        const match = queryLower.match(pattern);
        if (match) {
            const result = handler(match);
            if (result) return result;
        }
    }

    // Fallback to existing simple patterns
    if (queryLower.includes('next weekend')) {
        const nextFriday = getNextDay(5);
        const weekend = getWeekendDates(nextFriday);
        return {
            start: formatDate(weekend.start),
            end: formatDate(weekend.end)
        };
    }
    
    if (queryLower.includes('this weekend')) {
        const thisFriday = new Date(now);
        thisFriday.setDate(now.getDate() + ((5 - now.getDay() + 7) % 7));
        const weekend = getWeekendDates(thisFriday);
        return {
            start: formatDate(weekend.start),
            end: formatDate(weekend.end)
        };
    }
    
    if (queryLower.includes('next month')) {
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);
        return {
            start: formatDate(nextMonth),
            end: formatDate(endOfNextMonth)
        };
    }
    
    if (queryLower.includes('this month')) {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return {
            start: formatDate(startOfMonth),
            end: formatDate(endOfMonth)
        };
    }

    return null;
};

// Helper function to convert month names to numbers
const getMonthNumber = (monthName) => {
    const months = {
        january: 1, jan: 1,
        february: 2, feb: 2,
        march: 3, mar: 3,
        april: 4, apr: 4,
        may: 5,
        june: 6, jun: 6,
        july: 7, jul: 7,
        august: 8, aug: 8,
        september: 9, sep: 9, sept: 9,
        october: 10, oct: 10,
        november: 11, nov: 11,
        december: 12, dec: 12
    };
    return months[monthName.toLowerCase()] || -1;
};

// Simple natural language parser as fallback
const simpleParseQuery = (query) => {
    const queryLower = query.toLowerCase();
    const result = {
        location: null,
        dateRange: {
            start: null,
            end: null
        },
        leagues: [],
        maxDistance: null,
        teams: [],
        matchTypes: []
    };

    // Extract location with country information
    const cities = Object.keys(getLocationWithCountry('london')); // Use first city to get all keys
    for (const city of cities) {
        if (queryLower.includes(city.toLowerCase())) {
            result.location = getLocationWithCountry(city);
            break;
        }
    }

    // Extract leagues
    const leagueMapping = {
        'premier league': 'PL',
        'championship': 'ELC',
        'la liga': 'PD',
        'bundesliga': 'BL1',
        'ligue 1': 'FL1',
        'eredivisie': 'DED',
        'primeira liga': 'PPL',
        'portuguese league': 'PPL'
    };
    
    Object.entries(leagueMapping).forEach(([name, id]) => {
        if (queryLower.includes(name)) {
            result.leagues.push(id);
        }
    });

    // Handle date ranges
    if (queryLower.includes('next weekend')) {
        const nextFriday = new Date();
        nextFriday.setFullYear(2025);
        nextFriday.setDate(nextFriday.getDate() + ((5 + 7 - nextFriday.getDay()) % 7));
        result.dateRange = getWeekendDateRange(nextFriday);
    } else if (queryLower.includes('this weekend')) {
        const thisFriday = new Date();
        thisFriday.setFullYear(2025);
        const daysTillFriday = (5 - thisFriday.getDay() + 7) % 7;
        thisFriday.setDate(thisFriday.getDate() + (daysTillFriday === 0 ? 7 : daysTillFriday));
        result.dateRange = getWeekendDateRange(thisFriday);
    } else if (queryLower.includes('next month')) {
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        result.dateRange = getMonthDateRange(nextMonth);
    } else if (queryLower.includes('this month')) {
        result.dateRange = getMonthDateRange(now);
    } else if (queryLower.includes('tomorrow')) {
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        result.dateRange = {
            start: formatDate(tomorrow),
            end: formatDate(tomorrow)
        };
    } else if (queryLower.includes('next week')) {
        const nextWeekStart = new Date(now);
        nextWeekStart.setDate(now.getDate() + (7 - now.getDay() + 1) % 7);
        const nextWeekEnd = new Date(nextWeekStart);
        nextWeekEnd.setDate(nextWeekStart.getDate() + 6);
        result.dateRange = {
            start: formatDate(nextWeekStart),
            end: formatDate(nextWeekEnd)
        };
    }

    // Extract distance
    const distanceMatch = queryLower.match(/within (\d+) miles/);
    if (distanceMatch) {
        result.maxDistance = parseInt(distanceMatch[1]);
    }

    // Extract match types
    if (queryLower.includes('derby')) {
        result.matchTypes.push('derby');
    }
    if (queryLower.includes('rivalry')) {
        result.matchTypes.push('rivalry');
    }

    // Extract team names
    const teams = [
        'Arsenal', 'Chelsea', 'Tottenham', 'West Ham',
        'Manchester United', 'Manchester City', 'Liverpool',
        'Barcelona', 'Real Madrid', 'Bayern Munich',
        'Paris Saint-Germain', 'Benfica', 'Porto', 'Sporting CP'
    ];
    
    teams.forEach(team => {
        if (queryLower.includes(team.toLowerCase())) {
            result.teams.push(team);
        }
    });

    return result;
};

// Function to parse natural language query
const parseQuery = async (query) => {
    try {
        // First try OpenAI

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: `You are a football match search assistant. Parse natural language queries into structured search parameters.
                    The current date is ${formatDate(now)}. 
                    
                    For date parsing:
                    - If a specific year is mentioned (e.g., "January 2026"), use that exact year
                    - If only a month is mentioned without a year, and it's earlier than the current month (${currentMonth}), assume it's for next year (${currentYear + 1})
                    - If only a month is mentioned without a year, and it's the current month or later, use the current year (${currentYear})
                    - For a single month (e.g., "January 2026"), create a date range covering the entire month (e.g., "2026-01-01" to "2026-01-31")
                    
                    When handling weekends, always use Friday through Sunday (3 days).
                    
                    Return only a JSON object with the following fields:
                    - location (object with city, country, and coordinates)
                    - dateRange (start and end dates in YYYY-MM-DD format)
                    - leagues (array of league IDs)
                    - maxDistance (in miles)
                    - teams (array of team names)
                    - matchTypes (array of types like 'derby', 'rivalry', etc.)
                    
                    Available leagues:
                    - PL (Premier League)
                    - ELC (Championship)
                    - PD (La Liga)
                    - BL1 (Bundesliga)
                    - FL1 (Ligue 1)
                    - DED (Eredivisie)
                    - PPL (Primeira Liga)
                    
                    Available cities with their countries:
                    - London, United Kingdom
                    - Manchester, United Kingdom
                    - Liverpool, United Kingdom
                    - Birmingham, United Kingdom
                    - Leeds, United Kingdom
                    - Barcelona, Spain
                    - Madrid, Spain
                    - Munich, Germany
                    - Paris, France
                    - Lisbon, Portugal
                    - Porto, Portugal
                    
                    Example response format:
                    {
                        "location": {
                            "city": "London",
                            "country": "United Kingdom",
                            "coordinates": [-0.118092, 51.509865]
                        },
                        "dateRange": {
                            "start": "${currentYear}-${currentMonth.toString().padStart(2, '0')}-15",
                            "end": "${currentYear}-${currentMonth.toString().padStart(2, '0')}-17"
                        },
                        "leagues": ["PL"],
                        "maxDistance": 50,
                        "teams": ["Arsenal FC", "Chelsea FC"],
                        "matchTypes": ["derby"]
                    }`
                },
                {
                    role: "user",
                    content: query
                }
            ],
            temperature: 0.7,
            max_tokens: 500
        });

        const parsedResponse = JSON.parse(completion.choices[0].message.content);

        return parsedResponse;
    } catch (error) {
        // If OpenAI fails, use simple parser

        return simpleParseQuery(query);
    }
};

// Enhanced team extraction using database
const extractTeams = async (query) => {
    const queryLower = query.toLowerCase();
    const result = {
        home: null,
        away: null,
        any: []
    };

    // Look for "vs", "against", "v" patterns to identify home vs away
    const vsPatterns = [
        /(.+?)\s+(?:vs|v|against)\s+(.+?)(?:\s|$)/i,
        /(.+?)\s+(?:versus)\s+(.+?)(?:\s|$)/i
    ];

    let homeTeamQuery = null;
    let awayTeamQuery = null;

    // Try to extract specific matchup
    for (const pattern of vsPatterns) {
        const match = query.match(pattern);
        if (match) {
            homeTeamQuery = match[1].trim();
            awayTeamQuery = match[2].trim();
            break;
        }
    }

    // Search for teams in database
    try {
        if (homeTeamQuery && awayTeamQuery) {
            // Specific matchup
            const homeTeams = await teamService.searchTeams(homeTeamQuery, { limit: 3 });
            const awayTeams = await teamService.searchTeams(awayTeamQuery, { limit: 3 });
            
            if (homeTeams.length > 0) {
                result.home = homeTeams[0];
                result.any.push(homeTeams[0]);
            }
            if (awayTeams.length > 0) {
                result.away = awayTeams[0];
                result.any.push(awayTeams[0]);
            }
        } else {
            // General team search - look for any team mentions
            const words = query.split(/\s+/);
            const teamQueries = [];
            
            // Try different combinations of words as team names
            for (let i = 0; i < words.length; i++) {
                for (let j = i + 1; j <= Math.min(i + 3, words.length); j++) {
                    const teamQuery = words.slice(i, j).join(' ');
                    if (teamQuery.length > 2) {
                        teamQueries.push(teamQuery);
                    }
                }
            }

            // Search for each potential team name
            for (const teamQuery of teamQueries) {
                const teams = await teamService.searchTeams(teamQuery, { limit: 2 });
                if (teams.length > 0) {
                    // Add unique teams
                    teams.forEach(team => {
                        if (!result.any.find(t => t._id.toString() === team._id.toString())) {
                            result.any.push(team);
                        }
                    });
                }
            }
        }
    } catch (error) {
        console.error('Error extracting teams:', error);
    }

    return result;
};

// Enhanced league extraction using database
const extractLeagues = async (query) => {
    const queryLower = query.toLowerCase();
    const leagues = [];

    try {
        // Direct league name search
        const words = query.split(/\s+/);
        const leagueQueries = [];
        
        // Try different combinations for league names
        for (let i = 0; i < words.length; i++) {
            for (let j = i + 1; j <= Math.min(i + 4, words.length); j++) {
                const leagueQuery = words.slice(i, j).join(' ');
                if (leagueQuery.length > 2) {
                    leagueQueries.push(leagueQuery);
                }
            }
        }

        // Search for leagues
        for (const leagueQuery of leagueQueries) {
            const foundLeagues = await leagueService.searchLeagues(leagueQuery);
            if (foundLeagues && foundLeagues.length > 0) {
                foundLeagues.forEach(league => {
                    if (!leagues.find(l => l.apiId === league.apiId)) {
                        leagues.push(league);
                    }
                });
            }
        }

        // Fallback to common league mappings if database search fails
        const leagueMapping = {
            'premier league': 'PL',
            'championship': 'ELC', 
            'la liga': 'PD',
            'bundesliga': 'BL1',
            'ligue 1': 'FL1',
            'serie a': 'SA',
            'eredivisie': 'DED',
            'primeira liga': 'PPL',
            'portuguese league': 'PPL',
            'champions league': 'CL',
            'europa league': 'EL',
            'conference league': 'ECL'
        };

        Object.entries(leagueMapping).forEach(([name, apiId]) => {
            if (queryLower.includes(name) && !leagues.find(l => l.apiId === apiId)) {
                leagues.push({ apiId, name });
            }
        });

    } catch (error) {
        console.error('Error extracting leagues:', error);
    }

    return leagues;
};

// Enhanced location extraction with better city coverage
const extractLocation = (query) => {
    const queryLower = query.toLowerCase();
    
    // Expanded city mapping
    const cityMapping = {
        // UK Cities
        'london': { city: 'London', country: 'United Kingdom', coordinates: [-0.118092, 51.509865] },
        'manchester': { city: 'Manchester', country: 'United Kingdom', coordinates: [-2.244644, 53.483959] },
        'liverpool': { city: 'Liverpool', country: 'United Kingdom', coordinates: [-2.991573, 53.408371] },
        'birmingham': { city: 'Birmingham', country: 'United Kingdom', coordinates: [-1.898575, 52.489471] },
        'leeds': { city: 'Leeds', country: 'United Kingdom', coordinates: [-1.549077, 53.801277] },
        'newcastle': { city: 'Newcastle', country: 'United Kingdom', coordinates: [-1.612404, 54.978252] },
        'brighton': { city: 'Brighton', country: 'United Kingdom', coordinates: [-0.137163, 50.822530] },
        
        // Spanish Cities
        'barcelona': { city: 'Barcelona', country: 'Spain', coordinates: [2.170006, 41.387097] },
        'madrid': { city: 'Madrid', country: 'Spain', coordinates: [-3.703790, 40.416775] },
        'seville': { city: 'Seville', country: 'Spain', coordinates: [-5.984459, 37.389092] },
        'valencia': { city: 'Valencia', country: 'Spain', coordinates: [-0.375156, 39.469907] },
        'bilbao': { city: 'Bilbao', country: 'Spain', coordinates: [-2.935010, 43.263012] },
        
        // German Cities
        'munich': { city: 'Munich', country: 'Germany', coordinates: [11.581981, 48.135125] },
        'berlin': { city: 'Berlin', country: 'Germany', coordinates: [13.404954, 52.520008] },
        'dortmund': { city: 'Dortmund', country: 'Germany', coordinates: [7.468554, 51.513400] },
        'hamburg': { city: 'Hamburg', country: 'Germany', coordinates: [9.993682, 53.551086] },
        
        // French Cities
        'paris': { city: 'Paris', country: 'France', coordinates: [2.352222, 48.856614] },
        'marseille': { city: 'Marseille', country: 'France', coordinates: [5.369780, 43.296482] },
        'lyon': { city: 'Lyon', country: 'France', coordinates: [4.835659, 45.764043] },
        
        // Italian Cities
        'milan': { city: 'Milan', country: 'Italy', coordinates: [9.185982, 45.465422] },
        'rome': { city: 'Rome', country: 'Italy', coordinates: [12.496366, 41.902782] },
        'turin': { city: 'Turin', country: 'Italy', coordinates: [7.686856, 45.070312] },
        'naples': { city: 'Naples', country: 'Italy', coordinates: [14.268124, 40.851775] },
        
        // Portuguese Cities
        'lisbon': { city: 'Lisbon', country: 'Portugal', coordinates: [-9.139337, 38.722252] },
        'porto': { city: 'Porto', country: 'Portugal', coordinates: [-8.611837, 41.149968] },
        
        // Dutch Cities
        'amsterdam': { city: 'Amsterdam', country: 'Netherlands', coordinates: [4.904139, 52.367573] },
        'rotterdam': { city: 'Rotterdam', country: 'Netherlands', coordinates: [4.477733, 51.924420] }
    };

    // Look for city mentions
    for (const [cityKey, cityData] of Object.entries(cityMapping)) {
        if (queryLower.includes(cityKey)) {
            return cityData;
        }
    }

    // Look for country mentions
    const countryMapping = {
        'england': { city: 'London', country: 'United Kingdom', coordinates: [-0.118092, 51.509865] },
        'spain': { city: 'Madrid', country: 'Spain', coordinates: [-3.703790, 40.416775] },
        'germany': { city: 'Berlin', country: 'Germany', coordinates: [13.404954, 52.520008] },
        'france': { city: 'Paris', country: 'France', coordinates: [2.352222, 48.856614] },
        'italy': { city: 'Rome', country: 'Italy', coordinates: [12.496366, 41.902782] },
        'portugal': { city: 'Lisbon', country: 'Portugal', coordinates: [-9.139337, 38.722252] },
        'netherlands': { city: 'Amsterdam', country: 'Netherlands', coordinates: [4.904139, 52.367573] }
    };

    for (const [countryKey, countryData] of Object.entries(countryMapping)) {
        if (queryLower.includes(countryKey)) {
            return countryData;
        }
    }

    return null;
};

// Enhanced distance extraction
const extractDistance = (query) => {
    const distancePatterns = [
        /within (\d+) (?:miles?|mi)/i,
        /within (\d+) (?:kilometers?|km)/i,
        /(\d+) (?:miles?|mi) (?:of|from)/i,
        /(\d+) (?:kilometers?|km) (?:of|from)/i
    ];

    for (const pattern of distancePatterns) {
        const match = query.match(pattern);
        if (match) {
            const distance = parseInt(match[1]);
            // Convert km to miles if needed
            if (pattern.source.includes('km')) {
                return Math.round(distance * 0.621371);
            }
            return distance;
        }
    }

    return null;
};

// Smart location inference based on teams and leagues
const inferLocationFromTeamsAndLeagues = (teams, leagues) => {
    // Team-based country mapping
    const teamCountryMapping = {
        // English teams
        'manchester united': { city: 'Manchester', country: 'United Kingdom', coordinates: [-2.244644, 53.483959] },
        'manchester city': { city: 'Manchester', country: 'United Kingdom', coordinates: [-2.244644, 53.483959] },
        'liverpool': { city: 'Liverpool', country: 'United Kingdom', coordinates: [-2.991573, 53.408371] },
        'arsenal': { city: 'London', country: 'United Kingdom', coordinates: [-0.118092, 51.509865] },
        'chelsea': { city: 'London', country: 'United Kingdom', coordinates: [-0.118092, 51.509865] },
        'tottenham': { city: 'London', country: 'United Kingdom', coordinates: [-0.118092, 51.509865] },
        'west ham': { city: 'London', country: 'United Kingdom', coordinates: [-0.118092, 51.509865] },
        'leeds': { city: 'Leeds', country: 'United Kingdom', coordinates: [-1.549077, 53.801277] },
        'birmingham': { city: 'Birmingham', country: 'United Kingdom', coordinates: [-1.898575, 52.489471] },
        'newcastle': { city: 'Newcastle', country: 'United Kingdom', coordinates: [-1.612404, 54.978252] },
        'brighton': { city: 'Brighton', country: 'United Kingdom', coordinates: [-0.137163, 50.822530] },
        
        // Spanish teams
        'barcelona': { city: 'Barcelona', country: 'Spain', coordinates: [2.170006, 41.387097] },
        'real madrid': { city: 'Madrid', country: 'Spain', coordinates: [-3.703790, 40.416775] },
        'atletico madrid': { city: 'Madrid', country: 'Spain', coordinates: [-3.703790, 40.416775] },
        'sevilla': { city: 'Seville', country: 'Spain', coordinates: [-5.984459, 37.389092] },
        'valencia': { city: 'Valencia', country: 'Spain', coordinates: [-0.375156, 39.469907] },
        'athletic bilbao': { city: 'Bilbao', country: 'Spain', coordinates: [-2.935010, 43.263012] },
        
        // German teams
        'bayern munich': { city: 'Munich', country: 'Germany', coordinates: [11.581981, 48.135125] },
        'borussia dortmund': { city: 'Dortmund', country: 'Germany', coordinates: [7.468554, 51.513400] },
        'rb leipzig': { city: 'Leipzig', country: 'Germany', coordinates: [12.387772, 51.343479] },
        'bayer leverkusen': { city: 'Leverkusen', country: 'Germany', coordinates: [7.0043, 51.0459] },
        
        // French teams
        'paris saint-germain': { city: 'Paris', country: 'France', coordinates: [2.352222, 48.856614] },
        'olympique marseille': { city: 'Marseille', country: 'France', coordinates: [5.369780, 43.296482] },
        'olympique lyon': { city: 'Lyon', country: 'France', coordinates: [4.835659, 45.764043] },
        
        // Italian teams
        'juventus': { city: 'Turin', country: 'Italy', coordinates: [7.686856, 45.070312] },
        'ac milan': { city: 'Milan', country: 'Italy', coordinates: [9.185982, 45.465422] },
        'inter milan': { city: 'Milan', country: 'Italy', coordinates: [9.185982, 45.465422] },
        'napoli': { city: 'Naples', country: 'Italy', coordinates: [14.268124, 40.851775] },
        'roma': { city: 'Rome', country: 'Italy', coordinates: [12.496366, 41.902782] },
        
        // Portuguese teams
        'benfica': { city: 'Lisbon', country: 'Portugal', coordinates: [-9.139337, 38.722252] },
        'porto': { city: 'Porto', country: 'Portugal', coordinates: [-8.611837, 41.149968] },
        'sporting cp': { city: 'Lisbon', country: 'Portugal', coordinates: [-9.139337, 38.722252] },
        
        // Dutch teams
        'ajax': { city: 'Amsterdam', country: 'Netherlands', coordinates: [4.904139, 52.367573] },
        'psv': { city: 'Eindhoven', country: 'Netherlands', coordinates: [5.469722, 51.441642] },
        'feyenoord': { city: 'Rotterdam', country: 'Netherlands', coordinates: [4.477733, 51.924420] }
    };

    // League-based country mapping
    const leagueCountryMapping = {
        'premier league': { city: 'London', country: 'United Kingdom', coordinates: [-0.118092, 51.509865] },
        'championship': { city: 'London', country: 'United Kingdom', coordinates: [-0.118092, 51.509865] },
        'la liga': { city: 'Madrid', country: 'Spain', coordinates: [-3.703790, 40.416775] },
        'bundesliga': { city: 'Berlin', country: 'Germany', coordinates: [13.404954, 52.520008] },
        'ligue 1': { city: 'Paris', country: 'France', coordinates: [2.352222, 48.856614] },
        'serie a': { city: 'Rome', country: 'Italy', coordinates: [12.496366, 41.902782] },
        'primeira liga': { city: 'Lisbon', country: 'Portugal', coordinates: [-9.139337, 38.722252] },
        'eredivisie': { city: 'Amsterdam', country: 'Netherlands', coordinates: [4.904139, 52.367573] }
    };

    // First, try to infer from teams
    if (teams && teams.any && teams.any.length > 0) {
        for (const team of teams.any) {
            const teamName = team.name.toLowerCase();
            if (teamCountryMapping[teamName]) {
                return teamCountryMapping[teamName];
            }
        }
    }

    // If no team match, try to infer from leagues
    if (leagues && leagues.length > 0) {
        for (const league of leagues) {
            const leagueName = league.name.toLowerCase();
            if (leagueCountryMapping[leagueName]) {
                return leagueCountryMapping[leagueName];
            }
        }
    }

    // If no match found, return null (no default location)
    return null;
};

// Conversation State Manager - tracks current search context
const ConversationStateManager = {
    // Extract the current search context from conversation history
    getCurrentContext: (conversationHistory) => {
        if (!conversationHistory || conversationHistory.length === 0) {
            return null;
        }
        
        // Find the most recent successful search
        for (let i = conversationHistory.length - 1; i >= 0; i--) {
            const msg = conversationHistory[i];
            if (msg.isBot && msg.data && msg.data.parsed && !msg.data.parsed.errorMessage) {
                return msg.data.parsed;
            }
        }
        
        return null;
    },
    
    // Fill missing information in the current result using conversation context
    fillMissingContext: (result, conversationHistory) => {
        const context = ConversationStateManager.getCurrentContext(conversationHistory);
        
        if (!context) {
            console.log('🧠 No conversation context available');
            return result;
        }
        
        console.log('🧠 Found conversation context:', {
            location: context.location,
            dateRange: context.dateRange,
            leagues: context.leagues,
            teams: context.teams
        });
        
        // Fill missing date range
        if (!result.dateRange && context.dateRange) {
            result.dateRange = context.dateRange;
            console.log('📅 Filled missing date range from context:', result.dateRange);
        }
        
        // Fill missing location
        if (!result.location && context.location) {
            result.location = context.location;
            console.log('📍 Filled missing location from context:', result.location);
        }
        
        // For follow-up queries like "just premier league", inherit leagues from context
        if (result.leagues.length === 0 && context.leagues && context.leagues.length > 0) {
            result.leagues = context.leagues;
            console.log('🏆 Filled missing leagues from context:', result.leagues);
        }
        
        // For follow-up queries like "only Arsenal", inherit teams from context
        if (result.teams.any.length === 0 && context.teams && context.teams.any && context.teams.any.length > 0) {
            result.teams = context.teams;
            console.log('⚽ Filled missing teams from context:', result.teams);
        }
        
        // Clear error message if we successfully filled missing information or have a valid broad query
        if (result.errorMessage && (result.dateRange || result.location)) {
            result.errorMessage = null;
            result.confidence = Math.max(result.confidence, 50); // Boost confidence after filling
            console.log('✅ Cleared error message after filling missing context');
        }
        
        // Also clear error message for broad queries that have location and dates
        if (result.errorMessage && result.isBroadQuery && result.location && result.dateRange) {
            result.errorMessage = null;
            result.confidence = Math.max(result.confidence, 60); // Boost confidence for valid broad queries
            console.log('✅ Cleared error message for valid broad query');
        }
        
        return result;
    }
};

// Enhanced natural language parser with OpenAI and smart defaults
const parseNaturalLanguage = async (query, conversationHistory = []) => {
    const result = {
        location: null,
        date: null,
        dateRange: null,
        teams: { home: null, away: null, any: [] },
        leagues: [],
        distance: null,
        matchType: null,
        confidence: 0,
        errorMessage: null
    };

    try {
        // First try OpenAI for intelligent parsing (if available)
        if (openai) {
            try {
                const now = new Date();
                const currentYear = now.getFullYear();
                const currentMonth = now.getMonth() + 1;
                
                // Build conversation context
                let conversationContext = "";
                if (conversationHistory && conversationHistory.length > 0) {
                    conversationContext = "\n\nCONVERSATION HISTORY:\n";
                    conversationHistory.forEach((msg, index) => {
                        if (msg.isBot && msg.data && msg.data.parsed) {
                            const parsed = msg.data.parsed;
                            conversationContext += `Previous search ${index + 1}: `;
                            if (parsed.location) conversationContext += `Location: ${parsed.location.city}, ${parsed.location.country}. `;
                            if (parsed.dateRange) conversationContext += `Dates: ${parsed.dateRange.start} to ${parsed.dateRange.end}. `;
                            if (parsed.leagues && parsed.leagues.length > 0) conversationContext += `Leagues: ${parsed.leagues.map(l => l.name).join(', ')}. `;
                            if (parsed.teams && parsed.teams.length > 0) conversationContext += `Teams: ${parsed.teams.map(t => t.name).join(', ')}. `;
                            conversationContext += "\n";
                        }
                    });
                    conversationContext += "\nIMPORTANT: If the current query is a follow-up (like 'just premier league' or 'only Arsenal'), use the context from previous searches to fill in missing information (location, dates, etc.).\n";
                }
                
                const completion = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: `You are a football match search assistant. Parse natural language queries into structured search parameters.
                        The current date is ${formatDate(now)}. 
                        
                        IMPORTANT RULES:
                        - ALWAYS require a date/timeframe - if none provided AND no conversation history, return error message
                        - If conversation history exists, inherit missing information (location, dates) from previous searches
                        - For follow-up queries like "just premier league" or "only Arsenal", inherit location and dates from conversation history
                        - Use smart defaults for location based on teams/leagues
                        - Be conversational in error messages
                        - For broad queries (location + dates only), set isBroadQuery: true and DO NOT return error message
                        - Broad queries with location and dates are VALID - provide helpful suggestions for refinement
                        - Use conversation history to fill in missing context for follow-up queries${conversationContext}
                        
                        CONTEXT INHERITANCE RULES:
                        - If the current query is incomplete (missing location, dates, or both) AND conversation history exists, inherit missing information
                        - For queries like "just premier league", "only Arsenal", "champions league", etc., inherit location and dates from conversation history
                        - For queries like "in Manchester", "next week", etc., inherit other missing information from conversation history
                        - Always include inherited information in your JSON response
                        
                        CONTEXT INHERITANCE EXAMPLES:
                        - Query: "just premier league" + History: "London next month" → Inherit London location and November 2025 dates
                        - Query: "only Arsenal" + History: "London next month premier league" → Inherit London location, November 2025 dates, and Premier League
                        - Query: "in Manchester" + History: "next month premier league" → Inherit November 2025 dates and Premier League
                        
                        For date parsing:
                        - If a specific year is mentioned (e.g., "January 2026"), use that exact year
                        - If only a month is mentioned without a year, and it's earlier than the current month (${currentMonth}), assume it's for next year (${currentYear + 1})
                        - If only a month is mentioned without a year, and it's the current month or later, use the current year (${currentYear})
                        - For a single month (e.g., "January 2026"), create a date range covering the entire month (e.g., "2026-01-01" to "2026-01-31")
                        
                        When handling weekends, always use Friday through Sunday (3 days).
                        
                        Return only a JSON object with the following fields:
                        - location (object with city, country, and coordinates) - infer from teams/leagues if not specified
                        - dateRange (start and end dates in YYYY-MM-DD format) - REQUIRED
                        - leagues (array of league IDs)
                        - maxDistance (in miles)
                        - teams (array of team names)
                        - matchTypes (array of types like 'derby', 'rivalry', etc.)
                        - errorMessage (string if there's an error, null otherwise)
                        - isBroadQuery (boolean - true if only location + dates provided)
                        - suggestions (array of helpful suggestions for refining the search)
                        
                        Available leagues (use these exact IDs):
                        - 39 (Premier League)
                        - 40 (Championship)
                        - 140 (La Liga)
                        - 78 (Bundesliga)
                        - 61 (Ligue 1)
                        - 88 (Eredivisie)
                        - 94 (Primeira Liga)
                        
                        Team/League to Country mapping:
                        - Manchester United, Arsenal, Chelsea, Liverpool, etc. → England
                        - Barcelona, Real Madrid, etc. → Spain
                        - Bayern Munich, Borussia Dortmund, etc. → Germany
                        - Paris Saint-Germain, etc. → France
                        - Juventus, AC Milan, Inter Milan, etc. → Italy
                        - Benfica, Porto, etc. → Portugal
                        - Ajax, PSV, etc. → Netherlands
                        
                        Example response format for specific query:
                        {
                            "location": {
                                "city": "London",
                                "country": "United Kingdom",
                                "coordinates": [-0.118092, 51.509865]
                            },
                            "dateRange": {
                                "start": "${currentYear}-${currentMonth.toString().padStart(2, '0')}-15",
                                "end": "${currentYear}-${currentMonth.toString().padStart(2, '0')}-17"
                            },
                            "leagues": ["39"],
                            "maxDistance": 50,
                            "teams": ["Arsenal FC", "Chelsea FC"],
                            "matchTypes": ["derby"],
                            "errorMessage": null,
                            "isBroadQuery": false,
                            "suggestions": []
                        }
                        
                        Example response format for broad query:
                        {
                            "location": {
                                "city": "London",
                                "country": "United Kingdom",
                                "coordinates": [-0.118092, 51.509865]
                            },
                            "dateRange": {
                                "start": "${currentYear}-${currentMonth.toString().padStart(2, '0')}-01",
                                "end": "${currentYear}-${currentMonth.toString().padStart(2, '0')}-30"
                            },
                            "leagues": [],
                            "maxDistance": 50,
                            "teams": [],
                            "matchTypes": [],
                            "errorMessage": null,
                            "isBroadQuery": true,
                            "suggestions": [
                                "Try: Premier League matches in London next month",
                                "Try: Arsenal matches in London next month",
                                "Try: Manchester United vs Chelsea in London next month"
                            ]
                        }
                        
                        Example response format for follow-up query "just premier league" (with conversation history):
                        {
                            "location": {
                                "city": "London",
                                "country": "United Kingdom",
                                "coordinates": [-0.118092, 51.509865]
                            },
                            "dateRange": {
                                "start": "2025-11-01",
                                "end": "2025-11-30"
                            },
                            "leagues": [{"apiId": "39", "name": "Premier League", "country": "England"}],
                            "maxDistance": 50,
                            "teams": [],
                            "matchTypes": [],
                            "errorMessage": null,
                            "isBroadQuery": false,
                            "suggestions": []
                        }`
                    },
                    {
                        role: "user",
                        content: query
                    }
                ],
                temperature: 0.3,
                max_tokens: 500
            });

            const parsedResponse = JSON.parse(completion.choices[0].message.content);
            
            // Convert OpenAI response to our format
            if (parsedResponse.errorMessage) {
                result.errorMessage = parsedResponse.errorMessage;
                result.confidence = 0;
                // Don't return early - let context inheritance handle it
            }

            // Map OpenAI response to our result format
            result.location = parsedResponse.location;
            result.dateRange = parsedResponse.dateRange;
            result.distance = parsedResponse.maxDistance;
            result.matchType = parsedResponse.matchTypes?.[0] || null;
            result.isBroadQuery = parsedResponse.isBroadQuery || false;
            result.suggestions = parsedResponse.suggestions || [];
            
            // Convert team names to our team objects (simplified for now)
            if (parsedResponse.teams && parsedResponse.teams.length > 0) {
                result.teams.any = parsedResponse.teams.map(teamName => ({ name: teamName }));
            }
            
            // Convert league IDs to our league objects (simplified for now)
            if (parsedResponse.leagues && parsedResponse.leagues.length > 0) {
                result.leagues = parsedResponse.leagues.map(leagueId => ({ apiId: leagueId, name: leagueId }));
            }

            // Calculate confidence score
            let confidence = 0;
            if (result.teams.any.length > 0) confidence += 30;
            if (result.leagues.length > 0) confidence += 25;
            if (result.location) confidence += 25;
            if (result.dateRange) confidence += 15;
            if (result.distance) confidence += 10;
            
            result.confidence = Math.min(confidence, 100);

            // Apply conversation state management after AI parsing
            result = ConversationStateManager.fillMissingContext(result, conversationHistory);

            return result;

            } catch (openaiError) {
                console.log('OpenAI parsing failed, falling back to regex parser:', openaiError.message);
                // Fall through to regex parser
            }
        } else {
            console.log('OpenAI not available, using regex parser');
        }

        // Fallback to regex-based parsing
        const [teams, leagues, location, dateRange, distance] = await Promise.all([
            extractTeams(query),
            extractLeagues(query),
            extractLocation(query),
            parseComplexDates(query),
            extractDistance(query)
        ]);

        // Populate results
        result.teams = teams;
        result.leagues = leagues;
        result.location = location;
        result.dateRange = dateRange;
        result.distance = distance;

        // Determine match type from query context
        const queryLower = query.toLowerCase();
        if (queryLower.includes('home') || queryLower.includes('at home')) {
            result.matchType = 'home';
        } else if (queryLower.includes('away') || queryLower.includes('at away')) {
            result.matchType = 'away';
        }

        // Apply conversation state management after regex parsing
        result = ConversationStateManager.fillMissingContext(result, conversationHistory);

        // DATE VALIDATION - Always require dates
        if (!result.dateRange) {
            result.errorMessage = "Please specify when you want to see these matches";
            result.confidence = 0;
            return result;
        }

        // SMART LOCATION DEFAULTS - If no location specified, infer from teams/leagues
        if (!result.location) {
            result.location = inferLocationFromTeamsAndLeagues(result.teams, result.leagues);
        }

        // Calculate confidence score based on extracted entities
        let confidence = 0;
        if (result.teams.any.length > 0) confidence += 30;
        if (result.leagues.length > 0) confidence += 25;
        if (result.location) confidence += 25;
        if (result.dateRange) confidence += 15;
        if (result.distance) confidence += 10;
        
        result.confidence = Math.min(confidence, 100);

        return result;

    } catch (error) {
        console.error('Enhanced NL Parser error:', error);
        result.errorMessage = "I couldn't understand your query. Please try being more specific!";
        result.confidence = 0;
        return result;
    }
};

// Convert parsed entities to search parameters
const buildSearchParameters = (parsed) => {
    const params = {};

    // Team filtering
    if (parsed.teams.home && parsed.teams.away) {
        // Specific matchup
        params.homeTeam = parsed.teams.home._id;
        params.awayTeam = parsed.teams.away._id;
    } else if (parsed.teams.any.length > 0) {
        // Any team involvement
        params.teams = parsed.teams.any.map(team => team._id);
    }

    // League filtering
    if (parsed.leagues.length > 0) {
        params.leagues = parsed.leagues.map(league => league.apiId);
    }

    // Date filtering
    if (parsed.dateRange) {
        params.startDate = parsed.dateRange.start;
        params.endDate = parsed.dateRange.end;
    }

    // Location + distance filtering
    if (parsed.location) {
        params.location = {
            city: parsed.location.city,
            country: parsed.location.country,
            coordinates: parsed.location.coordinates
        };
        
        if (parsed.distance) {
            params.maxDistance = parsed.distance;
        }
    }

    // Match type (home/away)
    if (parsed.matchType) {
        params.matchType = parsed.matchType;
    }

    return params;
};

// Debug endpoint to check database connection
router.get('/debug-db', async (req, res) => {
    try {
        const mongoose = require('mongoose');
        const dbName = mongoose.connection.db.databaseName;
        const collections = await mongoose.connection.db.listCollections().toArray();
        
        res.json({
            databaseName: dbName,
            collections: collections.map(c => c.name),
            connectionString: process.env.MONGO_URL ? 'SET' : 'MISSING',
            mongoUrl: process.env.MONGO_URL
        });
    } catch (error) {
        res.json({
            error: error.message,
            databaseName: 'UNKNOWN',
            connectionString: process.env.MONGO_URL ? 'SET' : 'MISSING'
        });
    }
});

// Natural language search endpoint
router.post('/natural-language', async (req, res) => {
    try {
        const { query, conversationHistory } = req.body;
        
        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }


        
        const parsed = await parseNaturalLanguage(query, conversationHistory);
        const searchParams = buildSearchParameters(parsed);
        
        console.log('🔍 Parsed query:', parsed);
        console.log('🔍 Search params:', searchParams);
        

        
        // Handle error messages from parsing (but allow broad queries with location and dates)
        if (parsed.errorMessage && !(parsed.isBroadQuery && parsed.location && parsed.dateRange)) {
            return res.json({
                success: false,
                message: parsed.errorMessage,
                confidence: parsed.confidence,
                parsed: parsed,
                suggestions: parsed.suggestions || [
                    "Try mentioning specific team names",
                    "Include a league name (e.g., Premier League, La Liga)",
                    "Add a location or city name",
                    "Specify a date range"
                ]
            });
        }

        // If confidence is too low, return suggested clarifications
        if (parsed.confidence < 25) {
            return res.json({
                success: false,
                message: "I couldn't understand your query well enough. Try being more specific about teams, leagues, or locations.",
                confidence: parsed.confidence,
                parsed: parsed,
                suggestions: [
                    "Try mentioning specific team names",
                    "Include a league name (e.g., Premier League, La Liga)",
                    "Add a location or city name",
                    "Specify a date range"
                ]
            });
        }

        // Use existing search infrastructure instead of raw API calls
        const axios = require('axios');
        
        // Determine season based on the date range
        let season = 2025; // Default season
        if (searchParams.startDate) {
            const startYear = new Date(searchParams.startDate).getFullYear();
            // For football seasons, if the date is in the second half of the year, 
            // it's likely the start of the next season
            const startMonth = new Date(searchParams.startDate).getMonth() + 1;
            if (startMonth >= 7) {
                season = startYear;
            } else {
                season = startYear - 1;
            }
        }
        
        // Determine which leagues to search based on location and query type
        let leagueIds = [];
        if (searchParams.leagues && searchParams.leagues.length > 0) {
            // Use explicitly specified leagues
            leagueIds = searchParams.leagues;
        } else if (searchParams.location) {
            // Auto-select leagues based on location
            const country = searchParams.location.country?.toLowerCase();
            if (country === 'france' || searchParams.location.city?.toLowerCase().includes('paris')) {
                leagueIds = ['61', '62']; // Ligue 1 and Ligue 2
            } else if (country === 'england' || country === 'united kingdom') {
                leagueIds = ['39', '40']; // Premier League and Championship
            } else if (country === 'spain') {
                leagueIds = ['140', '141']; // La Liga and Segunda División
            } else if (country === 'germany') {
                leagueIds = ['78', '79']; // Bundesliga and 2. Bundesliga
            } else if (country === 'italy') {
                leagueIds = ['135', '136']; // Serie A and Serie B
            } else {
                // Default to major European leagues
                leagueIds = ['39', '140', '135', '78', '61']; // PL, La Liga, Serie A, Bundesliga, Ligue 1
            }
        } else {
            // Default to major European leagues
            leagueIds = ['39', '140', '135', '78', '61']; // PL, La Liga, Serie A, Bundesliga, Ligue 1
        }
        
        // For broad queries, use all major European leagues to get comprehensive results
        if (parsed.isBroadQuery) {
            leagueIds = ['39', '40', '140', '141', '135', '136', '78', '79', '61', '62', '88', '94']; // All major leagues
        }
        
        // For messages screen, we don't need bounds-based filtering
        // Location is used for league selection only
        
        console.log('🔍 Natural language calling existing search with params:', {
            competitions: leagueIds.join(','),
            dateFrom: searchParams.startDate,
            dateTo: searchParams.endDate,
            season: season
        });
        
        // Call the search logic directly instead of making HTTP request
        let matches = [];
        try {
            matches = await performSearch({
                competitions: leagueIds,
                dateFrom: searchParams.startDate,
                dateTo: searchParams.endDate,
                season: season,
                bounds: null // No bounds filtering needed for messages screen
            });
            console.log('🔍 Direct search result:', {
                matches: matches.length
            });
        } catch (error) {
            console.error('🔍 Search Error:', error.message);
            matches = [];
        }

        // Handle broad queries with conversational responses
        if (parsed.isBroadQuery && matches.length > 0) {
            const locationName = parsed.location ? `${parsed.location.city}, ${parsed.location.country}` : 'that location';
            const dateRange = parsed.dateRange ? 
                `${new Date(parsed.dateRange.start).toLocaleDateString()} to ${new Date(parsed.dateRange.end).toLocaleDateString()}` : 
                'that time period';
            
            return res.json({
                success: true,
                query: query,
                confidence: parsed.confidence,
                message: `Found ${matches.length} matches in ${locationName} from ${dateRange}. Is there a certain league or team you'd like to see?`,
                parsed: {
                    teams: parsed.teams.any.map(t => ({ name: t.name, id: t._id })),
                    leagues: parsed.leagues.map(l => ({ name: l.name, id: l.apiId })),
                    location: parsed.location,
                    dateRange: parsed.dateRange,
                    distance: parsed.distance,
                    isBroadQuery: true
                },
                matches: matches.slice(0, 5), // Show first 5 matches as examples
                count: matches.length,
                suggestions: parsed.suggestions || [
                    "Try: Premier League matches in " + locationName,
                    "Try: Arsenal matches in " + locationName,
                    "Try: Manchester United vs Chelsea in " + locationName
                ]
            });
        }

        // Format response for specific queries
        const response = {
            success: true,
            query: query,
            confidence: parsed.confidence,
            parsed: {
                teams: parsed.teams.any.map(t => ({ name: t.name, id: t._id })),
                leagues: parsed.leagues.map(l => ({ name: l.name, id: l.apiId })),
                location: parsed.location,
                dateRange: parsed.dateRange,
                distance: parsed.distance,
                isBroadQuery: parsed.isBroadQuery || false
            },
            matches: matches, // No distance calculation needed for messages screen
            count: matches.length
        };


        res.json(response);

    } catch (error) {
        console.error('Natural language search error:', error);
        res.status(500).json({ 
            error: 'Search failed',
            details: error.message 
        });
    }
});

router.post('/parse', async (req, res) => {
    try {
        const { query } = req.body;


        // Use simple parser directly instead of trying OpenAI first

        const parsedResponse = parseQuery(query);


        res.json(parsedResponse);
    } catch (error) {
        console.error('Error parsing query:', error);
        res.status(500).json({ error: 'Error parsing query' });
    }
});

module.exports = router; 