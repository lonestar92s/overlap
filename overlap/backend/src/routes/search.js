const express = require('express');
const OpenAI = require('openai');
const https = require('https');
const router = express.Router();

// Create custom HTTPS agent that ignores SSL certificate issues (for development only)
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    httpAgent: httpsAgent
});

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
        console.log('Attempting to use OpenAI for parsing...');
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
        console.log('OpenAI parsed response:', parsedResponse);
        return parsedResponse;
    } catch (error) {
        // If OpenAI fails, use simple parser
        console.log('OpenAI parsing failed, using simple parser instead:', error.message);
        return simpleParseQuery(query);
    }
};

// Natural language search endpoint
router.post('/natural-language', async (req, res) => {
    try {
        const { query } = req.body;
        
        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        console.log('Processing natural language query:', query);
        
        const searchParams = await parseQuery(query);
        
        console.log('Parsed search parameters:', searchParams);
        
        res.json(searchParams);
    } catch (error) {
        console.error('Error in natural language search:', error);
        res.status(500).json({ 
            error: 'Failed to process natural language search',
            message: error.message 
        });
    }
});

module.exports = router; 