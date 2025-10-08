const express = require('express');
const OpenAI = require('openai');
const https = require('https');
const axios = require('axios');
const teamService = require('../services/teamService');
const leagueService = require('../services/leagueService');
const venueService = require('../services/venueService');
const geocodingService = require('../services/geocodingService');
const Team = require('../models/Team');
const router = express.Router();

// API-Sports configuration
const API_SPORTS_KEY = process.env.API_SPORTS_KEY || '0ab95ca9f7baeb6fd551af7ca41ed8d2';
const API_SPORTS_BASE_URL = 'https://v3.football.api-sports.io';

// Create HTTPS agent for search
const searchHttpsAgent = new https.Agent({
    rejectUnauthorized: false
});

// Function to generate ALL responses using OpenAI
async function generateResponse(context) {
    if (!openai) {
        // Fallback messages if OpenAI is not available
        if (context.type === 'error') {
            return `I found no ${context.requestedLeague} matches in ${context.requestedLocation}. Did you mean ${context.suggestedAlternatives[0].league} matches in ${context.suggestedAlternatives[0].location}, or ${context.suggestedAlternatives[1].league} matches in ${context.suggestedAlternatives[1].location}?`;
        } else if (context.type === 'success') {
            return `Found ${context.matchCount} matches in ${context.location} from ${context.dateRange}. Is there a certain league or team you'd like to see?`;
        }
        return "I found some matches for you!";
    }

    try {
        let prompt = '';
        
        if (context.type === 'error') {
            prompt = `
A user searched for "${context.requestedLeague} matches in ${context.requestedLocation}" but this combination doesn't make sense because ${context.requestedLeague} is not played in ${context.requestedLocation}.

Generate a helpful, conversational message suggesting alternatives:
- ${context.suggestedAlternatives[0].league} matches in ${context.suggestedAlternatives[0].location}
- ${context.suggestedAlternatives[1].league} matches in ${context.suggestedAlternatives[1].location}

Be friendly and helpful, not technical. Keep it under 100 characters.
            `;
        } else if (context.type === 'success') {
            prompt = `
A user searched for matches and found ${context.matchCount} results in ${context.location} from ${context.dateRange}.

Generate a friendly, conversational response that:
- Acknowledges the successful search
- Mentions the number of matches found
- Suggests ways to refine the search (specific teams, leagues, etc.)
- Keeps it under 150 characters
- Be encouraging and helpful

Examples of good responses:
- "Great! Found ${context.matchCount} matches in ${context.location}. Want to see a specific team or league?"
- "Perfect! ${context.matchCount} matches found in ${context.location}. Any particular teams you're interested in?"
            `;
        }
        
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: context.type === 'error' ? 100 : 150
        });
        
        return response.choices[0].message.content.trim();
    } catch (error) {
        console.log('OpenAI response generation failed:', error.message);
        // Fallback messages
        if (context.type === 'error') {
            return `I found no ${context.requestedLeague} matches in ${context.requestedLocation}. Did you mean ${context.suggestedAlternatives[0].league} matches in ${context.suggestedAlternatives[0].location}, or ${context.suggestedAlternatives[1].league} matches in ${context.suggestedAlternatives[1].location}?`;
        } else if (context.type === 'success') {
            return `Found ${context.matchCount} matches in ${context.location} from ${context.dateRange}. Is there a certain league or team you'd like to see?`;
        }
        return "I found some matches for you!";
    }
}

// Function to perform search directly (extracted from matches route)
async function performSearch({ competitions, dateFrom, dateTo, season, bounds, teams, leagues, matchTypes }) {
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
            // Try to get venue coordinates from local database first
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
                // Fall back to venue name lookup
                const byName = await venueService.getVenueByName(venue.name, venue.city);
                if (byName?.coordinates) {
                    venueInfo = {
                        id: venue.id,
                        name: byName.name,
                        city: byName.city,
                        country: byName.country,
                        coordinates: byName.coordinates,
                        image: null
                    };
                } else {
                    // Try geocoding if no coordinates available
                    let coordinates = venue.coordinates; // Usually null from API
                    if (!coordinates && venue.name && venue.city) {
                        try {
                            console.log(`🔍 Attempting geocoding for: ${venue.name}, ${venue.city}, ${venue.country}`);
                            const geocodedCoords = await geocodingService.geocodeVenueCoordinates(
                                venue.name,
                                venue.city,
                                venue.country
                            );
                            if (geocodedCoords) {
                                coordinates = geocodedCoords;
                                console.log(`🎯 Geocoding successful for ${venue.name}:`, coordinates);
                                
                                // Save to database for future use
                                await venueService.saveVenueWithCoordinates({
                                    venueId: venue.id,
                                    name: venue.name,
                                    city: venue.city,
                                    country: venue.country,
                                    coordinates: coordinates
                                });
                            }
                        } catch (geocodeError) {
                            console.log(`❌ Geocoding failed for ${venue.name}:`, geocodeError.message);
                        }
                    }
                    
                    venueInfo = {
                        id: venue.id,
                        name: venue.name,
                        city: venue.city,
                        country: venue.country,
                        coordinates: coordinates,
                        image: null
                    };
                }
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
                    coordinates: team.venue.coordinates
                };
            } else {
                venueInfo = {
                    id: venue?.id || null,
                    name: venue?.name || 'Unknown Venue',
                    city: venue?.city || 'Unknown City',
                    country: match.league?.country || 'Unknown Country',
                    coordinates: venue?.coordinates || null  // Use API coordinates if available
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
                home: { id: match.teams.home.id, name: await teamService.mapApiNameToTeam(match.teams.home.name), logo: match.teams.home.logo },
                away: { id: match.teams.away.id, name: await teamService.mapApiNameToTeam(match.teams.away.name), logo: match.teams.away.logo }
            }
        };

        // Apply team filtering if provided
        if (teams && teams.length > 0) {
            const homeTeamName = transformed.teams.home.name.toLowerCase();
            const awayTeamName = transformed.teams.away.name.toLowerCase();
            const teamMatches = teams.some(team => 
                homeTeamName.includes(team.toLowerCase()) || 
                awayTeamName.includes(team.toLowerCase())
            );
            if (!teamMatches) {
                continue; // Skip this match if it doesn't match any of the specified teams
            }
        }

        // Apply league filtering if provided (additional to competitions)
        if (leagues && leagues.length > 0) {
            const leagueName = transformed.league.name.toLowerCase();
            const leagueMatches = leagues.some(league => 
                leagueName.includes(league.toLowerCase())
            );
            if (!leagueMatches) {
                continue; // Skip this match if it doesn't match any of the specified leagues
            }
        }

        // Apply match type filtering if provided
        if (matchTypes && matchTypes.length > 0) {
            const isHomeMatch = matchTypes.includes('home');
            const isAwayMatch = matchTypes.includes('away');
            
            if (isHomeMatch && isAwayMatch) {
                // Both home and away - include all matches
            } else if (isHomeMatch) {
                // Only home matches - need to check if this is a home match for the specified team
                if (teams && teams.length > 0) {
                    const homeTeamName = transformed.teams.home.name.toLowerCase();
                    const isHomeForSpecifiedTeam = teams.some(team => 
                        homeTeamName.includes(team.toLowerCase())
                    );
                    if (!isHomeForSpecifiedTeam) {
                        continue; // Skip if not a home match for the specified team
                    }
                }
            } else if (isAwayMatch) {
                // Only away matches - need to check if this is an away match for the specified team
                if (teams && teams.length > 0) {
                    const awayTeamName = transformed.teams.away.name.toLowerCase();
                    const isAwayForSpecifiedTeam = teams.some(team => 
                        awayTeamName.includes(team.toLowerCase())
                    );
                    if (!isAwayForSpecifiedTeam) {
                        continue; // Skip if not an away match for the specified team
                    }
                }
            }
        }

        // Apply bounds filtering if provided
        if (bounds) {
            if (transformed.fixture.venue.coordinates && isWithinBounds(transformed.fixture.venue.coordinates, bounds)) {
                transformedMatches.push(transformed);
            }
        } else {
            // No bounds filtering - include all matches
            transformedMatches.push(transformed);
        }
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
            'premier league': { apiId: '39', name: 'Premier League', country: 'England' },
            'championship': { apiId: '40', name: 'Championship', country: 'England' },
            'la liga': { apiId: '140', name: 'La Liga', country: 'Spain' },
            'bundesliga': { apiId: '78', name: 'Bundesliga', country: 'Germany' },
            'ligue 1': { apiId: '61', name: 'Ligue 1', country: 'France' },
            'serie a': { apiId: '135', name: 'Serie A', country: 'Italy' },
            'eredivisie': { apiId: '88', name: 'Eredivisie', country: 'Netherlands' },
            'primeira liga': { apiId: '94', name: 'Primeira Liga', country: 'Portugal' },
            'portuguese league': { apiId: '94', name: 'Primeira Liga', country: 'Portugal' },
            'champions league': { apiId: '2', name: 'Champions League', country: 'Europe' },
            'europa league': { apiId: '3', name: 'Europa League', country: 'Europe' },
            'conference league': { apiId: '848', name: 'Conference League', country: 'Europe' }
        };

        Object.entries(leagueMapping).forEach(([name, leagueData]) => {
            if (queryLower.includes(name) && !leagues.find(l => l.apiId === leagueData.apiId)) {
                leagues.push(leagueData);
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

// Smart league inference based on teams
const inferLeagueFromTeams = (teams) => {
    if (!teams || !teams.any || teams.any.length === 0) {
        return [];
    }

    // Team-to-league mapping
    const teamLeagueMapping = {
        // Premier League teams
        'arsenal': '39',
        'chelsea': '39',
        'liverpool': '39',
        'manchester united': '39',
        'manchester city': '39',
        'tottenham': '39',
        'west ham': '39',
        'leeds': '39',
        'newcastle': '39',
        'brighton': '39',
        'everton': '39',
        'leicester': '39',
        'aston villa': '39',
        'crystal palace': '39',
        'fulham': '39',
        'brentford': '39',
        'wolves': '39',
        'southampton': '39',
        'burnley': '39',
        'watford': '39',
        'norwich': '39',
        
        // Championship teams (some examples)
        'birmingham': '40',
        'blackburn': '40',
        'bristol city': '40',
        'cardiff': '40',
        'coventry': '40',
        'derby': '40',
        'huddersfield': '40',
        'hull': '40',
        'ipswich': '40',
        'middlesbrough': '40',
        'millwall': '40',
        'nottingham forest': '40',
        'peterborough': '40',
        'preston': '40',
        'queens park rangers': '40',
        'reading': '40',
        'sheffield united': '40',
        'stoke': '40',
        'swansea': '40',
        'west bromwich': '40',
        
        // La Liga teams
        'barcelona': '140',
        'real madrid': '140',
        'atletico madrid': '140',
        'sevilla': '140',
        'valencia': '140',
        'athletic bilbao': '140',
        'real sociedad': '140',
        'villarreal': '140',
        'real betis': '140',
        'celta vigo': '140',
        
        // Bundesliga teams
        'bayern munich': '78',
        'borussia dortmund': '78',
        'rb leipzig': '78',
        'bayer leverkusen': '78',
        'eintracht frankfurt': '78',
        'wolfsburg': '78',
        'hoffenheim': '78',
        'union berlin': '78',
        'freiburg': '78',
        'mainz': '78',
        
        // Ligue 1 teams
        'paris saint-germain': '61',
        'olympique marseille': '61',
        'olympique lyon': '61',
        'monaco': '61',
        'lille': '61',
        'rennes': '61',
        'nice': '61',
        'strasbourg': '61',
        'lens': '61',
        'nantes': '61',
        
        // Serie A teams
        'juventus': '135',
        'ac milan': '135',
        'inter milan': '135',
        'napoli': '135',
        'roma': '135',
        'lazio': '135',
        'atalanta': '135',
        'fiorentina': '135',
        'torino': '135',
        'bologna': '135'
    };

    const detectedLeagues = new Set();
    
    for (const team of teams.any) {
        const teamName = team.name.toLowerCase();
        let leagueId = teamLeagueMapping[teamName];
        
        // If exact match not found, try partial matching
        if (!leagueId) {
            for (const [mappedTeam, mappedLeague] of Object.entries(teamLeagueMapping)) {
                if (teamName.includes(mappedTeam) || mappedTeam.includes(teamName)) {
                    leagueId = mappedLeague;
                    break;
                }
            }
        }
        
        if (leagueId) {
            detectedLeagues.add(leagueId);
            console.log(`🏆 Detected team "${team.name}" → League ID ${leagueId}`);
        } else {
            console.log(`❌ No league mapping found for team "${team.name}"`);
        }
    }
    
    return Array.from(detectedLeagues);
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
// Helper function to map league IDs to names
const mapLeagueIdsToNames = (leagueIds) => {
    console.log('🗺️ Mapping league IDs to names:', leagueIds);
    const leagueMap = {
        '39': 'Premier League',
        '40': 'Championship', 
        '61': 'Ligue 1',
        '62': 'Ligue 2',
        '78': 'Bundesliga',
        '79': 'Bundesliga 2',
        '135': 'Serie A',
        '136': 'Serie B',
        '140': 'La Liga',
        '141': 'Segunda División'
    };
    const result = leagueIds.map(id => ({ name: leagueMap[id] || `League ${id}`, id: id }));
    console.log('🗺️ Mapped result:', result);
    return result;
};

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
        
        
        // Clear error message for any query that has both location and dates (even if not marked as broad)
        if (result.errorMessage && result.location && result.dateRange) {
            result.errorMessage = null;
            result.confidence = Math.max(result.confidence, 50); // Boost confidence
            console.log('✅ Cleared error message for query with location and dates');
        }
        
        return result;
    }
};

// Enhanced natural language parser with OpenAI and smart defaults
const parseNaturalLanguage = async (query, conversationHistory = []) => {
    let result = {
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
                        - For broad queries (location + dates only), provide helpful suggestions for refinement
                        - Broad queries with location and dates are VALID
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
            const updatedResult = ConversationStateManager.fillMissingContext(result, conversationHistory);
            Object.assign(result, updatedResult);

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
        const updatedResult = ConversationStateManager.fillMissingContext(result, conversationHistory);
        Object.assign(result, updatedResult);

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
        

        
        // Handle error messages from OpenAI parsing - ALWAYS respect them
        if (parsed.errorMessage) {
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
        console.log('🔍 Search params for league selection:', {
            hasLeagues: !!(searchParams.leagues && searchParams.leagues.length > 0),
            leagues: searchParams.leagues,
            hasLocation: !!searchParams.location,
            location: searchParams.location
        });
        
        if (searchParams.leagues && searchParams.leagues.length > 0) {
            // Check if the specified leagues match the location
            const country = searchParams.location?.country?.toLowerCase();
            const city = searchParams.location?.city?.toLowerCase();
            
            // If we have a location, validate that the leagues match
            if (searchParams.location) {
                const isLocationMatch = (
                    (country === 'france' && searchParams.leagues.includes('61')) ||
                    (country === 'england' && searchParams.leagues.includes('39')) ||
                    (country === 'spain' && searchParams.leagues.includes('140')) ||
                    (country === 'germany' && searchParams.leagues.includes('78')) ||
                    (country === 'italy' && searchParams.leagues.includes('135'))
                );
                
                if (isLocationMatch) {
                    leagueIds = searchParams.leagues;
                    console.log('🏆 Using location-matched leagues:', leagueIds);
                } else {
                    console.log('🚫 Leagues do not match location, will use location-based selection');
                    
                    // Generate helpful error message for league/location mismatch
                    const requestedLeague = searchParams.leagues.map(id => {
                        const leagueMap = {
                            '39': 'Premier League', '40': 'Championship',
                            '61': 'Ligue 1', '62': 'Ligue 2',
                            '78': 'Bundesliga', '79': 'Bundesliga 2',
                            '135': 'Serie A', '136': 'Serie B',
                            '140': 'La Liga', '141': 'Segunda División'
                        };
                        return leagueMap[id] || `League ${id}`;
                    }).join(', ');
                    
                    const requestedLocation = `${searchParams.location.city}, ${searchParams.location.country}`;
                    
                    // Determine suggested alternatives based on location and league
                    let suggestedAlternatives = [];
                    
                    // Map league IDs to their correct countries
                    const leagueCountries = {
                        '39': 'United Kingdom', '40': 'United Kingdom', // Premier League, Championship
                        '61': 'France', '62': 'France', // Ligue 1, Ligue 2
                        '78': 'Germany', '79': 'Germany', // Bundesliga, Bundesliga 2
                        '135': 'Italy', '136': 'Italy', // Serie A, Serie B
                        '140': 'Spain', '141': 'Spain' // La Liga, Segunda División
                    };
                    
                    const requestedLeagueCountry = leagueCountries[searchParams.leagues[0]];
                    
                    if (country === 'france') {
                        // User is in France, suggest French leagues or move to the league's country
                        suggestedAlternatives = [
                            { league: 'Ligue 1', location: requestedLocation },
                            { league: requestedLeague, location: `${requestedLeagueCountry === 'United Kingdom' ? 'London' : requestedLeagueCountry === 'Germany' ? 'Munich' : requestedLeagueCountry === 'Italy' ? 'Milan' : requestedLeagueCountry === 'Spain' ? 'Madrid' : 'London'}, ${requestedLeagueCountry}` }
                        ];
                    } else if (country === 'england' || country === 'united kingdom') {
                        // User is in UK, suggest English leagues or move to the league's country
                        suggestedAlternatives = [
                            { league: 'Premier League', location: requestedLocation },
                            { league: requestedLeague, location: `${requestedLeagueCountry === 'France' ? 'Paris' : requestedLeagueCountry === 'Germany' ? 'Munich' : requestedLeagueCountry === 'Italy' ? 'Milan' : requestedLeagueCountry === 'Spain' ? 'Madrid' : 'Paris'}, ${requestedLeagueCountry}` }
                        ];
                    } else if (country === 'germany') {
                        // User is in Germany, suggest German leagues or move to the league's country
                        suggestedAlternatives = [
                            { league: 'Bundesliga', location: requestedLocation },
                            { league: requestedLeague, location: `${requestedLeagueCountry === 'United Kingdom' ? 'London' : requestedLeagueCountry === 'France' ? 'Paris' : requestedLeagueCountry === 'Italy' ? 'Milan' : requestedLeagueCountry === 'Spain' ? 'Madrid' : 'London'}, ${requestedLeagueCountry}` }
                        ];
                    } else if (country === 'italy') {
                        // User is in Italy, suggest Italian leagues or move to the league's country
                        suggestedAlternatives = [
                            { league: 'Serie A', location: requestedLocation },
                            { league: requestedLeague, location: `${requestedLeagueCountry === 'United Kingdom' ? 'London' : requestedLeagueCountry === 'France' ? 'Paris' : requestedLeagueCountry === 'Germany' ? 'Munich' : requestedLeagueCountry === 'Spain' ? 'Madrid' : 'London'}, ${requestedLeagueCountry}` }
                        ];
                    } else if (country === 'spain') {
                        // User is in Spain, suggest Spanish leagues or move to the league's country
                        suggestedAlternatives = [
                            { league: 'La Liga', location: requestedLocation },
                            { league: requestedLeague, location: `${requestedLeagueCountry === 'United Kingdom' ? 'London' : requestedLeagueCountry === 'France' ? 'Paris' : requestedLeagueCountry === 'Germany' ? 'Munich' : requestedLeagueCountry === 'Italy' ? 'Milan' : 'London'}, ${requestedLeagueCountry}` }
                        ];
                    } else {
                        // Generic fallback
                        suggestedAlternatives = [
                            { league: 'Local leagues', location: requestedLocation },
                            { league: requestedLeague, location: `${requestedLeagueCountry === 'United Kingdom' ? 'London' : requestedLeagueCountry === 'France' ? 'Paris' : requestedLeagueCountry === 'Germany' ? 'Munich' : requestedLeagueCountry === 'Italy' ? 'Milan' : requestedLeagueCountry === 'Spain' ? 'Madrid' : 'London'}, ${requestedLeagueCountry}` }
                        ];
                    }
                    
                    const helpfulMessage = await generateResponse({
                        type: 'error',
                        requestedLeague,
                        requestedLocation,
                        suggestedAlternatives
                    });
                    
                    // Return early with helpful message instead of proceeding with search
                    return res.json({
                        success: false,
                        query: query,
                        message: helpfulMessage,
                        parsed: {
                            teams: parsed.teams.any.map(t => ({ name: t.name, id: t._id })),
                            leagues: searchParams.leagues.map(id => ({ name: requestedLeague, id: id })),
                            location: parsed.location,
                            dateRange: parsed.dateRange,
                            distance: parsed.distance
                        },
                        preSelectedFilters: {
                            country: parsed.location?.country || null,
                            leagues: [requestedLeague],
                            teams: parsed.teams.any.map(t => t.name)
                        },
                        matches: [],
                        count: 0,
                        suggestions: [
                            `Try: ${suggestedAlternatives[0].league} matches in ${suggestedAlternatives[0].location}`,
                            `Try: ${suggestedAlternatives[1].league} matches in ${suggestedAlternatives[1].location}`
                        ]
                    });
                }
            } else {
                leagueIds = searchParams.leagues;
                console.log('🏆 Using explicitly specified leagues (no location):', leagueIds);
            }
        }
        
        if (leagueIds.length === 0) {
            // First, try to infer leagues from teams
            const teamBasedLeagues = inferLeagueFromTeams(parsed.teams);
            if (teamBasedLeagues.length > 0) {
                leagueIds = teamBasedLeagues;
                console.log('🏆 Using team-based league inference:', leagueIds);
            } else if (searchParams.location) {
                // Fall back to location-based selection if no teams detected
                const country = searchParams.location.country?.toLowerCase();
                if (country === 'france' || searchParams.location.city?.toLowerCase().includes('paris')) {
                    leagueIds = ['61', '62', '10']; // Ligue 1, Ligue 2, and Friendlies
                } else if (country === 'england' || country === 'united kingdom') {
                    leagueIds = ['39', '40', '10']; // Premier League, Championship, and Friendlies
                } else if (country === 'spain') {
                    leagueIds = ['140', '141', '10']; // La Liga, Segunda División, and Friendlies
                } else if (country === 'germany') {
                    leagueIds = ['78', '79', '10']; // Bundesliga, 2. Bundesliga, and Friendlies
                } else if (country === 'italy') {
                    leagueIds = ['135', '136', '10']; // Serie A, Serie B, and Friendlies
                } else if (country === 'portugal') {
                    leagueIds = ['94', '96', '97', '10']; // Primeira Liga, Taca de Portugal, Taca da Liga, and Friendlies
                } else if (country === 'united states' || country === 'usa') {
                    leagueIds = ['253', '10', '31']; // MLS, Friendlies, and CONCACAF World Cup Qualifiers
                } else {
                    // Default to major European leagues plus international competitions
                    leagueIds = ['39', '140', '135', '78', '61', '94', '96', '97', '88', '10', '1', '2']; // PL, La Liga, Serie A, Bundesliga, Ligue 1, Primeira Liga, Taca de Portugal, Taca da Liga, Eredivisie, Friendlies, World Cup, Champions League
                }
                console.log('🗺️ Using location-based league selection:', leagueIds);
            } else {
                // Default to major European leagues plus international competitions
                leagueIds = ['39', '140', '135', '78', '61', '94', '96', '97', '88', '10', '1', '2']; // PL, La Liga, Serie A, Bundesliga, Ligue 1, Primeira Liga, Taca de Portugal, Taca da Liga, Eredivisie, Friendlies, World Cup, Champions League
                console.log('🌍 Using default league selection:', leagueIds);
            }
        }
        
        // For broad queries, still respect location-based league selection
        // This ensures Paris searches show French leagues, London shows English leagues, etc.
        
        // Add geographic distance filtering for natural language search
        // Use default 50-mile radius around the specified city
        let bounds = null;
        if (searchParams.location && searchParams.location.coordinates) {
            const [lng, lat] = searchParams.location.coordinates;
            const radiusMiles = 50; // Default radius
            const radiusKm = radiusMiles * 1.60934; // Convert to km
            
            // Calculate bounds for the radius
            const latDelta = radiusKm / 111.32; // Approximate km per degree latitude
            const lngDelta = radiusKm / (111.32 * Math.cos(lat * Math.PI / 180)); // Adjust for longitude
            
            bounds = {
                northeast: { lat: lat + latDelta, lng: lng + lngDelta },
                southwest: { lat: lat - latDelta, lng: lng - lngDelta }
            };
            
            console.log(`🗺️ Created bounds for ${searchParams.location.city}: NE[${bounds.northeast.lat.toFixed(6)}, ${bounds.northeast.lng.toFixed(6)}] SW[${bounds.southwest.lat.toFixed(6)}, ${bounds.southwest.lng.toFixed(6)}]`);
        }
        
        console.log('🔍 Natural language calling existing search with params:', {
            competitions: leagueIds.join(','),
            dateFrom: searchParams.startDate,
            dateTo: searchParams.endDate,
            season: season
        });
        
        // Extract teams, leagues, and matchTypes from parsed query for filtering
        const teams = parsed.teams?.any?.map(team => team.name) || [];
        const leagues = parsed.leagues?.map(league => league.name) || [];
        const matchTypes = parsed.matchTypes || [];
        
        console.log('🔍 Extracted filtering parameters:', {
            teams: teams,
            leagues: leagues,
            matchTypes: matchTypes,
            parsedTeams: parsed.teams
        });

        // Call the search logic directly instead of making HTTP request
        let matches = [];
        try {

            matches = await performSearch({
                competitions: leagueIds,
                dateFrom: searchParams.startDate,
                dateTo: searchParams.endDate,
                season: season,
                bounds: bounds, // Use geographic bounds for distance filtering
                teams: teams, // NEW: Team filtering
                leagues: leagues, // NEW: League filtering
                matchTypes: matchTypes // NEW: Match type filtering
            });
            console.log('🔍 Direct search result:', {
                matches: matches.length
            });
        } catch (error) {
            console.error('🔍 Search Error:', error.message);
            matches = [];
        }

        // Format response for all successful queries (OpenAI handles the intelligence)
        const locationName = parsed.location ? `${parsed.location.city}, ${parsed.location.country}` : 'the specified location';
        const dateRange = parsed.dateRange ? `${parsed.dateRange.start} to ${parsed.dateRange.end}` : 'the specified dates';
        
        const response = {
            success: true,
            query: query,
            confidence: parsed.confidence,
            message: await generateResponse({
                type: 'success',
                matchCount: matches.length,
                location: locationName,
                dateRange: dateRange
            }),
            parsed: {
                teams: parsed.teams.any.map(t => ({ name: t.name, id: t._id })),
                leagues: mapLeagueIdsToNames(leagueIds),
                location: parsed.location,
                dateRange: parsed.dateRange,
                distance: parsed.distance
            },
            preSelectedFilters: {
                country: parsed.location?.country || null, // Country-level filter
                leagues: mapLeagueIdsToNames(leagueIds).map(l => l.name), // League-level filters
                teams: parsed.teams.any.map(t => t.name) // Team-level filters
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