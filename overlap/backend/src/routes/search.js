const express = require('express');
// const OpenAI = require('openai');
const https = require('https');
const teamService = require('../services/teamService');
const leagueService = require('../services/leagueService');
const router = express.Router();

// Create custom HTTPS agent that ignores SSL certificate issues (for development only)
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

// const openai = new OpenAI({
//     apiKey: process.env.OPENAI_API_KEY,
//     httpAgent: httpsAgent
// });

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
                    The current date is ${formatDate(now)}. For dates, if a month is mentioned and it's earlier than the current month (${currentMonth}), assume it's for next year (${currentYear + 1}). Otherwise, use the current year (${currentYear}).
                    
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

// Enhanced natural language parser
const parseNaturalLanguage = async (query) => {
    
    
    const result = {
        location: null,
        date: null,
        dateRange: null,
        teams: { home: null, away: null, any: [] },
        leagues: [],
        distance: null,
        matchType: null,
        confidence: 0
    };

    try {
        // Extract all entities in parallel for efficiency
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

        // Calculate confidence score based on extracted entities
        let confidence = 0;
        if (result.teams.any.length > 0) confidence += 30;
        if (result.leagues.length > 0) confidence += 25;
        if (result.location) confidence += 25;
        if (result.dateRange) confidence += 15;
        if (result.distance) confidence += 10;
        
        // If no date specified, add default future date range and some confidence
        if (!result.dateRange && (result.teams.any.length > 0 || result.leagues.length > 0 || result.location)) {
            const now = new Date();
            const futureDate = new Date();
            futureDate.setMonth(futureDate.getMonth() + 3); // Next 3 months
            
            result.dateRange = {
                start: formatDate(now),
                end: formatDate(futureDate)
            };
            confidence += 10; // Add some confidence for default date filtering
        }
        
        result.confidence = Math.min(confidence, 100);



        return result;

    } catch (error) {
        console.error('Enhanced NL Parser error:', error);
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
        const { query } = req.body;
        
        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }


        
        const parsed = await parseNaturalLanguage(query);
        const searchParams = buildSearchParameters(parsed);
        

        
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

        // Build MongoDB query for matches
        const matchQuery = {};
        const pipeline = [];

        // Team filtering
        if (searchParams.homeTeam && searchParams.awayTeam) {
            matchQuery.$and = [
                { 'teams.home.id': searchParams.homeTeam.toString() },
                { 'teams.away.id': searchParams.awayTeam.toString() }
            ];
        } else if (searchParams.teams && searchParams.teams.length > 0) {
            const teamIds = searchParams.teams.map(id => id.toString());
            matchQuery.$or = [
                { 'teams.home.id': { $in: teamIds } },
                { 'teams.away.id': { $in: teamIds } }
            ];
        }

        // League filtering
        if (searchParams.leagues && searchParams.leagues.length > 0) {
            matchQuery.league = { $in: searchParams.leagues };
        }

        // Date filtering
        if (searchParams.startDate || searchParams.endDate) {
            matchQuery.date = {};
            if (searchParams.startDate) {
                matchQuery.date.$gte = searchParams.startDate;
            }
            if (searchParams.endDate) {
                matchQuery.date.$lte = searchParams.endDate;
            }
        }

        // Location + distance filtering
        if (searchParams.location && searchParams.location.coordinates) {
            const [longitude, latitude] = searchParams.location.coordinates;
            const maxDistance = searchParams.maxDistance || 50; // Default 50 miles
            
            // First find venues within the distance
            const Venue = require('../models/Venue');
            const nearbyVenues = await Venue.findNear(longitude, latitude, maxDistance * 1609.34);

            if (nearbyVenues.length > 0) {
                const venueIds = nearbyVenues.map(venue => venue._id);
                matchQuery.venueId = { $in: venueIds };
                
                // Store venue distances for later use
                const venueDistances = {};
                nearbyVenues.forEach(venue => {
                    // Simple distance calculation (approximate)
                    const lat1 = latitude * Math.PI / 180;
                    const lat2 = venue.location.coordinates[1] * Math.PI / 180;
                    const deltaLat = (venue.location.coordinates[1] - latitude) * Math.PI / 180;
                    const deltaLon = (venue.location.coordinates[0] - longitude) * Math.PI / 180;
                    
                    const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
                            Math.cos(lat1) * Math.cos(lat2) *
                            Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                    const distance = 6371 * c * 0.621371; // Convert km to miles
                    
                    venueDistances[venue._id.toString()] = Math.round(distance * 100) / 100;
                });
                
                pipeline.push({ $match: matchQuery });
                
                // Add venue lookup
                pipeline.push({
                    $lookup: {
                        from: 'venues',
                        localField: 'venueId',
                        foreignField: '_id',
                        as: 'venue'
                    }
                });
                pipeline.push({ $unwind: '$venue' });
                
                // Add distance field based on pre-calculated distances
                pipeline.push({
                    $addFields: {
                        distance: {
                            $switch: {
                                branches: Object.entries(venueDistances).map(([venueId, distance]) => ({
                                    case: { $eq: [{ $toString: '$venueId' }, venueId] },
                                    then: distance
                                })),
                                default: null
                            }
                        }
                    }
                });
            } else {
                // No venues found within distance
                matchQuery._id = null; // This will return no results
                pipeline.push({ $match: matchQuery });
            }
        } else {
            pipeline.push({ $match: matchQuery });
        }

        // Add sorting
        if (!searchParams.location) {
            pipeline.push({ $sort: { date: 1 } });
        }

        // Limit results
        pipeline.push({ $limit: 50 });

        // Execute search
        const Match = require('../models/Match');
        const matches = await Match.aggregate(pipeline);

        // Format response
        const response = {
            success: true,
            query: query,
            confidence: parsed.confidence,
            parsed: {
                teams: parsed.teams.any.map(t => ({ name: t.name, id: t._id })),
                leagues: parsed.leagues.map(l => ({ name: l.name, id: l.apiId })),
                location: parsed.location,
                dateRange: parsed.dateRange,
                distance: parsed.distance
            },
            matches: matches.map(match => ({
                ...match,
                distance: match.distance ? Math.round(match.distance * 0.000621371 * 100) / 100 : undefined // Convert meters to miles
            })),
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