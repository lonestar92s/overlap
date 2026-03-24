const express = require('express');
const OpenAI = require('openai');
const { DateTime } = require('luxon');
const { find: geoTzFind } = require('geo-tz');
const https = require('https');
const axios = require('axios');
const teamService = require('../services/teamService');
const leagueService = require('../services/leagueService');
const venueService = require('../services/venueService');
const geocodingService = require('../services/geocodingService');
const Team = require('../models/Team');
const League = require('../models/League');
const Venue = require('../models/Venue');
const { matchesLeagueFilterToken, shouldSkipLeagueFilter } = require('../utils/searchLeagueFilter');
const { buildPrioritizedCompetitionIds } = require('../utils/competitionPriorityResolver');
const { weekendRangeFromAnchor, findFeasibleItineraries } = require('../utils/matchItineraryPlanner');
const router = express.Router();
// API-Sports configuration
const API_SPORTS_KEY = process.env.API_SPORTS_KEY || '0ab95ca9f7baeb6fd551af7ca41ed8d2';
const API_SPORTS_BASE_URL = 'https://v3.football.api-sports.io';
// LocationIQ configuration for autocomplete
const LOCATIONIQ_API_KEY = process.env.LOCATIONIQ_API_KEY;
const LOCATIONIQ_AUTOCOMPLETE_URL = 'https://api.locationiq.com/v1/autocomplete';
// Create HTTPS agent for search
const searchHttpsAgent = new https.Agent({
    rejectUnauthorized: false
});
// Function to generate ALL responses using OpenAI
async function generateResponse(context) {
    const client = createOpenAIClient();
    if (!client) {
        // Fallback messages if OpenAI is not available
        if (context.type === 'error') {
            return `I found no ${context.requestedLeague} matches in ${context.requestedLocation}. Did you mean ${context.suggestedAlternatives[0].league} matches in ${context.suggestedAlternatives[0].location}, or ${context.suggestedAlternatives[1].league} matches in ${context.suggestedAlternatives[1].location}?`;
        } else if (context.type === 'success') {
            return `Found ${context.matchCount} matches in ${context.location} from ${context.dateRange}. Is there a certain league or team you'd like to see?`;
        } else if (context.type === 'empty') {
            return `No matches found for ${context.location} from ${context.dateRange}. Try a wider date range, different location, or other leagues.`;
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
        } else if (context.type === 'empty') {
            prompt = `
No matches were found for the user's search (${context.location} from ${context.dateRange}).
Generate a friendly, conversational message that:
- Acknowledges no matches were found
- Suggests trying a wider date range, different city, or other leagues
- Keeps it under 120 characters
- Is helpful, not technical
            `;
        }
        const response = await client.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: context.type === 'error' ? 100 : 150
        });
        return response.choices[0].message.content.trim();
    } catch (error) {
        // Fallback messages
        if (context.type === 'error') {
            return `I found no ${context.requestedLeague} matches in ${context.requestedLocation}. Did you mean ${context.suggestedAlternatives[0].league} matches in ${context.suggestedAlternatives[0].location}, or ${context.suggestedAlternatives[1].league} matches in ${context.suggestedAlternatives[1].location}?`;
        } else if (context.type === 'success') {
            return `Found ${context.matchCount} matches in ${context.location} from ${context.dateRange}. Is there a certain league or team you'd like to see?`;
        } else if (context.type === 'empty') {
            return `No matches found for ${context.location} from ${context.dateRange}. Try a wider date range, different location, or other leagues.`;
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
                            const geocodedCoords = await geocodingService.geocodeVenueCoordinates(
                                venue.name,
                                venue.city,
                                venue.country
                            );
                            if (geocodedCoords) {
                                coordinates = geocodedCoords;
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
                home: await (async () => {
                    const mappedName = await teamService.mapApiNameToTeam(match.teams.home.name);
                    const team = await Team.findOne({ name: mappedName });
                    return {
                        id: match.teams.home.id,
                        name: mappedName,
                        logo: match.teams.home.logo,
                        ticketingUrl: team?.ticketingUrl || undefined
                    };
                })(),
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
        // Apply league filtering if provided (additional to competitions).
        // Skip when filters are numeric ids matching competitions exactly (already scoped by API fetch).
        // Otherwise match by api id for numeric tokens or substring on name for text tokens (OpenAI may pass "39" as name).
        if (leagues && leagues.length > 0 && !shouldSkipLeagueFilter(leagues, competitions)) {
            const leagueName = transformed.league.name.toLowerCase();
            const leagueId = transformed.league.id;
            const leagueMatches = leagues.some(league =>
                matchesLeagueFilterToken(leagueId, leagueName, league)
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
/** New client each call so tests can swap OpenAI mock implementation per test. */
function createOpenAIClient() {
    if (!process.env.OPENAI_API_KEY) {
        return null;
    }
    return new OpenAI({
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
        // "March 21st", "on March 21", "March 21, 2026" (single day)
        {
            pattern: /(?:on\s+)?(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?\b/i,
            handler: (match) => {
                const [, monthName, day, year] = match;
                const month = getMonthNumber(monthName);
                const dayNum = parseInt(day, 10);
                const yearToUse = year ? parseInt(year, 10) : (month < now.getMonth() + 1 ? currentYear + 1 : currentYear);
                if (month !== -1 && dayNum >= 1 && dayNum <= 31) {
                    const singleDay = new Date(yearToUse, month - 1, dayNum);
                    if (singleDay.getMonth() === month - 1 && singleDay.getDate() === dayNum) {
                        const date = formatDate(singleDay);
                        return { start: date, end: date };
                    }
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
// Deterministic override for explicit single-day queries (e.g. "March 21st")
const extractSingleDayRangeFromQuery = (query) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const queryLower = (query || '').toLowerCase();
    const singleDayPattern = /(?:on\s+)?(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?\b/i;
    const match = queryLower.match(singleDayPattern);
    if (!match) return null;
    const [, monthName, day, year] = match;
    const month = getMonthNumber(monthName);
    const dayNum = parseInt(day, 10);
    if (month === -1 || dayNum < 1 || dayNum > 31) return null;
    const yearToUse = year ? parseInt(year, 10) : (month < now.getMonth() + 1 ? currentYear + 1 : currentYear);
    const singleDay = new Date(yearToUse, month - 1, dayNum);
    if (singleDay.getMonth() !== month - 1 || singleDay.getDate() !== dayNum) return null;
    const date = formatDate(singleDay);
    return { start: date, end: date };
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
        const openai = createOpenAIClient();
        if (!openai) {
            return simpleParseQuery(query);
        }
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
                    - If a specific day is provided (e.g., "March 21st" or "on March 21, 2026"), set dateRange.start and dateRange.end to that exact same day
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
// Stopwords for NL fallback parsing: avoids n-grams like "play" matching random teams.
const NL_STOPWORDS = new Set([
    'i', 'want', 'to', 'see', 'the', 'a', 'an', 'at', 'in', 'on', 'for', 'of', 'and', 'or', 'but', 'with', 'from', 'by',
    'is', 'are', 'was', 'were', 'it', 'we', 'you', 'they', 'this', 'that', 'next', 'last', 'can', 'could', 'would', 'should',
    'please', 'just', 'only', 'also', 'some', 'any', 'all', 'my', 'your', 'me', 'us', 'let', 'there', 'here', 'when', 'where',
    'what', 'how', 'which', 'who', 'home', 'away', 'month', 'week', 'weekend', 'year', 'day', 'today', 'tomorrow',
    'play', 'plays', 'playing', 'game', 'games', 'match', 'matches', 'fixture', 'fixtures', 'vs', 'v', 'against',
    'near', 'around', 'within', 'between', 'through', 'during', 'about', 'like', 'looking', 'trying', 'plan', 'trip', 'trips',
    'show', 'find', 'give', 'get', 'recommend', 'watch', 'going', 'am', 'try', 'make'
]);
// If we already matched a multi-word club, skip a lone city token that often duplicates location ("in Manchester").
const CITY_WORD_SKIP_WHEN_TEAM_FOUND = new Set([
    'manchester', 'london', 'liverpool', 'birmingham', 'leeds', 'newcastle', 'brighton', 'bristol', 'nottingham',
    'barcelona', 'madrid', 'milan', 'rome', 'turin', 'munich', 'dortmund', 'berlin', 'paris', 'lyon', 'marseille',
    'amsterdam', 'rotterdam', 'lisbon', 'porto', 'glasgow', 'edinburgh', 'dublin', 'copenhagen', 'stockholm', 'oslo',
    'vienna', 'prague', 'warsaw', 'istanbul', 'moscow', 'tokyo', 'seoul', 'sydney', 'melbourne'
]);
function normalizeNlWord(word) {
    return word.replace(/[^\w'-]/g, '').toLowerCase();
}
function getMeaningfulWordRuns(query) {
    const words = query.trim().split(/\s+/).map(normalizeNlWord).filter(Boolean);
    const runs = [];
    let current = [];
    for (const w of words) {
        if (NL_STOPWORDS.has(w)) {
            if (current.length) {
                runs.push(current);
                current = [];
            }
        } else {
            current.push(w);
        }
    }
    if (current.length) {
        runs.push(current);
    }
    return runs;
}
function buildTeamSearchQueriesFromRuns(runs) {
    const queries = [];
    for (const run of runs) {
        if (run.length === 0) {
            continue;
        }
        if (run.length === 1) {
            const w = run[0];
            if (w.length >= 4) {
                queries.push({ q: w, weight: 1 });
            }
            continue;
        }
        queries.push({ q: run.join(' '), weight: run.length });
    }
    queries.sort((a, b) => b.weight - a.weight);
    const seen = new Set();
    const ordered = [];
    for (const { q } of queries) {
        if (seen.has(q)) {
            continue;
        }
        seen.add(q);
        ordered.push(q);
    }
    return ordered;
}
// Enhanced team extraction using database
const extractTeams = async (query) => {
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
            const runs = getMeaningfulWordRuns(query);
            const teamQueries = buildTeamSearchQueriesFromRuns(runs);
            let foundMultiWord = false;
            const maxTeams = 5;
            for (const teamQuery of teamQueries) {
                const isMulti = teamQuery.trim().split(/\s+/).length >= 2;
                if (!isMulti && foundMultiWord && CITY_WORD_SKIP_WHEN_TEAM_FOUND.has(teamQuery.toLowerCase())) {
                    continue;
                }
                const limit = isMulti ? 1 : 2;
                const teams = await teamService.searchTeams(teamQuery, { limit });
                if (teams.length > 0 && isMulti) {
                    foundMultiWord = true;
                }
                for (const team of teams) {
                    if (!result.any.find(t => t._id.toString() === team._id.toString())) {
                        result.any.push(team);
                    }
                    if (result.any.length >= maxTeams) {
                        return result;
                    }
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
        // Explicit phrase → league IDs (reliable; avoids regex noise from n-grams)
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
        // Only search DB for multi-word phrases from meaningful runs (single-word leagues covered by mapping keys like "bundesliga")
        const runs = getMeaningfulWordRuns(query);
        for (const run of runs) {
            if (run.length < 2) {
                continue;
            }
            const phrase = run.join(' ');
            const foundLeagues = await leagueService.searchLeagues(phrase, { limit: 2 });
            if (foundLeagues && foundLeagues.length > 0) {
                foundLeagues.forEach(league => {
                    if (!leagues.find(l => l.apiId === league.apiId)) {
                        leagues.push(league);
                    }
                });
            }
            if (leagues.length >= 8) {
                break;
            }
        }
    } catch (error) {
        console.error('Error extracting leagues:', error);
    }
    return leagues;
};
function hasExplicitLocationPhrase(queryLower, token) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const explicitPatterns = [
        new RegExp(`\\b(?:in|near|around|within|from|at|outside|across|throughout)\\s+${escaped}\\b`, 'i'),
        new RegExp(`\\b${escaped}\\s+(?:area|region|city|country)\\b`, 'i')
    ];
    return explicitPatterns.some((pattern) => pattern.test(queryLower));
}
function normalizeLocation(location) {
    if (!location || typeof location !== 'object') {
        return null;
    }
    const city = typeof location.city === 'string' ? location.city.trim() : '';
    const country = typeof location.country === 'string' ? location.country.trim() : '';
    const coords = Array.isArray(location.coordinates) ? location.coordinates : [];
    const hasCoords = coords.length === 2 && Number.isFinite(coords[0]) && Number.isFinite(coords[1]);
    if (!city && !country && !hasCoords) {
        return null;
    }
    return {
        city: city || null,
        country: country || null,
        coordinates: hasCoords ? coords : []
    };
}
function detectPlanItineraryFromQuery(query) {
    const q = String(query || '').toLowerCase();
    const patterns = [
        /\bplan\s+(an?\s+)?itinerary\b/,
        /\bplan\s+(my\s+)?(a\s+)?(football\s+)?(trip|weekend)\b/,
        /\b(weekend|multi)[\s-]?(match|game)(es)?\b/,
        /\bmultiple\s+matches\b/,
        /\bsee\s+(\d+)\s+(different\s+)?(games|matches)\b/,
        /\b(\d+)\s+(games|matches)\s+(in|around|near|over)\b/,
        /\bfootball\s+weekend\b/,
        /\bmatch\s+weekend\b/
    ];
    return patterns.some((p) => p.test(q));
}
function extractMinMatchesFromQuery(query) {
    const q = String(query || '');
    const m =
        q.match(/\b(?:see|watch|catch|hit|do)\s+(\d+)\s+(?:different\s+)?(?:games|matches)\b/i) ||
        q.match(/\b(\d+)\s+(?:games|matches)\s+(?:in|around|over|near)\b/i) ||
        q.match(/\b(?:at least|minimum|min\.?)\s+(\d+)\s+(?:games|matches)\b/i);
    if (m) {
        const n = parseInt(m[1], 10);
        if (n >= 2 && n <= 10) {
            return n;
        }
    }
    return null;
}
/** First calendar date in [start,end] that falls on Fri–Sun in `ianaTimeZone`, else start date. */
function weekendAnchorLocalDateFromRange(startStr, endStr, ianaTimeZone) {
    const start = DateTime.fromISO(String(startStr), { zone: ianaTimeZone });
    const end = DateTime.fromISO(String(endStr), { zone: ianaTimeZone });
    if (!start.isValid) {
        return String(startStr).slice(0, 10);
    }
    if (!end.isValid) {
        return start.toISODate();
    }
    let d = start.startOf('day');
    const endDay = end.startOf('day');
    while (d <= endDay) {
        const wd = d.weekday;
        if (wd >= 5) {
            return d.toISODate();
        }
        d = d.plus({ days: 1 });
    }
    return start.toISODate();
}
/**
 * Maps planner metrics to a stable reason code and user-facing message (English).
 * @param {object} o
 * @param {boolean} o.feasible
 * @param {number} o.minMatches
 * @param {number} o.windowEndMs - weekend window end (Luxon millis)
 * @param {number} o.nowMs
 * @param {number} o.fixturesFetched - after bounds, from performSearch
 * @param {number} o.fixturesUpcoming - kickoff >= nowMs
 * @param {number} o.candidateFixturesInWindow - normalized count inside findFeasibleItineraries
 * @param {{ matchCount: number } | null} o.bestItinerary
 * @param {string} o.city
 * @param {string} o.country
 */
function describePlanItineraryOutcome(o) {
    const {
        feasible,
        minMatches,
        windowEndMs,
        nowMs,
        fixturesFetched,
        fixturesUpcoming,
        candidateFixturesInWindow,
        bestItinerary,
        city,
        country
    } = o;
    const where = [city, country].filter(Boolean).join(', ');
    const around = where ? ` around ${where}` : '';
    if (feasible && bestItinerary && bestItinerary.matchCount >= minMatches) {
        return {
            reasonCode: 'FEASIBLE',
            userMessage: `Found a feasible ${bestItinerary.matchCount}-match weekend plan${around}.`
        };
    }
    if (windowEndMs < nowMs) {
        return {
            reasonCode: 'WEEKEND_WINDOW_PAST',
            userMessage:
                'That weekend has already passed. Pick a future Friday–Sunday window to plan matches you can still attend.'
        };
    }
    if (fixturesFetched === 0) {
        return {
            reasonCode: 'NO_FIXTURES_IN_SEARCH',
            userMessage:
                'No matches showed up for that area and weekend. Try a wider search radius, more leagues, or different dates.'
        };
    }
    if (fixturesUpcoming === 0 && fixturesFetched > 0) {
        return {
            reasonCode: 'ALL_FIXTURES_IN_PAST',
            userMessage:
                'All fixtures in that weekend have already kicked off. Choose a future weekend to build an itinerary.'
        };
    }
    if (fixturesUpcoming > 0 && candidateFixturesInWindow === 0) {
        return {
            reasonCode: 'NO_PLANNABLE_FIXTURES',
            userMessage:
                'Some fixtures were found, but none could be scheduled on the map for this window (often missing venue coordinates). Try widening the search or different competitions.'
        };
    }
    return {
        reasonCode: 'NO_FEASIBLE_CHAIN',
        userMessage: `No ${minMatches}-match weekend chain satisfied your travel and timing limits in that window. Try more leagues, a wider radius, or different dates.`
    };
}
async function resolveIanaTimeZoneForLocation(city, country, coordinates) {
    let lat;
    let lng;
    if (Array.isArray(coordinates) && coordinates.length === 2 && Number.isFinite(coordinates[0]) && Number.isFinite(coordinates[1])) {
        lng = coordinates[0];
        lat = coordinates[1];
    } else {
        const geo = await geocodingService.geocodeVenue(String(city || '').trim(), null, String(country || '').trim());
        if (!geo || !Number.isFinite(geo.lat) || !Number.isFinite(geo.lng)) {
            return null;
        }
        lat = geo.lat;
        lng = geo.lng;
    }
    try {
        const zones = geoTzFind(lat, lng);
        return Array.isArray(zones) && zones.length > 0 ? zones[0] : null;
    } catch {
        return null;
    }
}
/**
 * Core plan-itinerary implementation (shared by POST /plan-itinerary and NL bridge).
 * @returns {Promise<object>} Result payload; includes _httpStatus for non-200 HTTP mapping when needed.
 */
async function runPlanItinerary(body = {}) {
    const {
        city,
        country,
        ianaTimeZone,
        weekendAnchorLocalDate,
        competitions,
        minMatches = 3,
        maxMatches = 6,
        maxTravelMinutesBetweenMatches = 90,
        fixedBufferMinutes = 25,
        minutesPerKm = 3.5,
        maxLegsPerDay = 2,
        radiusMiles = 50
    } = body;
    if (!city || !country || !ianaTimeZone || !weekendAnchorLocalDate) {
        return {
            success: false,
            error: 'city, country, ianaTimeZone, and weekendAnchorLocalDate are required',
            _httpStatus: 400
        };
    }
    if (!Array.isArray(competitions) || competitions.length === 0) {
        return {
            success: false,
            error: 'competitions must be a non-empty array of league API ids (strings or numbers)',
            _httpStatus: 400
        };
    }
    try {
        const { start, end, dateFrom, dateTo } = weekendRangeFromAnchor(ianaTimeZone, weekendAnchorLocalDate);
        const windowStartMs = start.toMillis();
        const windowEndMs = end.toMillis();

        const geo = await geocodingService.geocodeVenue(String(city).trim(), null, String(country).trim());
        if (!geo || !Number.isFinite(geo.lat) || !Number.isFinite(geo.lng)) {
            return {
                success: false,
                code: 'GEOCODE_FAILED',
                message: 'Could not resolve that city. Check spelling or try a nearby major city.',
                window: { dateFrom, dateTo, ianaTimeZone },
                _httpStatus: 200
            };
        }

        const radiusKm = Number(radiusMiles) * 1.60934;
        const lat = geo.lat;
        const lng = geo.lng;
        const latDelta = radiusKm / 111.32;
        const lngDelta = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
        const bounds = {
            northeast: { lat: lat + latDelta, lng: lng + lngDelta },
            southwest: { lat: lat - latDelta, lng: lng - lngDelta }
        };

        const leagueIds = competitions.map((c) => String(c).trim());
        const seasonForApi = determineSeasonForCompetitions(dateFrom, leagueIds);

        const matches = await performSearch({
            competitions: leagueIds,
            dateFrom,
            dateTo,
            season: seasonForApi,
            bounds,
            teams: [],
            leagues: [],
            matchTypes: []
        });

        const nowMs = Date.now();
        const upcomingMatches = matches.filter((m) => {
            const t = new Date(m?.fixture?.date).getTime();
            return Number.isFinite(t) && t >= nowMs;
        });

        const minM = Math.max(1, parseInt(String(minMatches), 10) || 3);
        const { itineraries, candidateFixturesInWindow } = findFeasibleItineraries(upcomingMatches, {
            ianaTimeZone,
            windowStartMs,
            windowEndMs,
            nowMs,
            minMatches: minM,
            maxMatches: Math.max(1, parseInt(String(maxMatches), 10) || 6),
            maxTravelMinutesBetweenMatches: parseInt(String(maxTravelMinutesBetweenMatches), 10) || 90,
            fixedBufferMinutes: parseInt(String(fixedBufferMinutes), 10) || 25,
            minutesPerKm: Number(minutesPerKm) || 3.5,
            maxLegsPerDay: parseInt(String(maxLegsPerDay), 10) || 2,
            maxItineraries: 10
        });

        const best = itineraries[0] || null;
        const feasible = !!(best && best.matchCount >= minM);

        const { reasonCode, userMessage } = describePlanItineraryOutcome({
            feasible,
            minMatches: minM,
            windowEndMs,
            nowMs,
            fixturesFetched: matches.length,
            fixturesUpcoming: upcomingMatches.length,
            candidateFixturesInWindow,
            bestItinerary: best,
            city: String(city).trim(),
            country: String(country).trim()
        });

        return {
            success: true,
            feasible,
            reasonCode,
            userMessage,
            window: {
                dateFrom,
                dateTo,
                ianaTimeZone,
                localStart: start.toISO(),
                localEnd: end.toISO()
            },
            constraints: {
                minMatches: minM,
                maxMatches: Math.max(1, parseInt(String(maxMatches), 10) || 6),
                maxTravelMinutesBetweenMatches: parseInt(String(maxTravelMinutesBetweenMatches), 10) || 90,
                fixedBufferMinutes: parseInt(String(fixedBufferMinutes), 10) || 25,
                minutesPerKm: Number(minutesPerKm) || 3.5,
                maxLegsPerDay: parseInt(String(maxLegsPerDay), 10) || 2,
                radiusMiles: Number(radiusMiles) || 50
            },
            geo: { city: String(city).trim(), country: String(country).trim(), lat, lng },
            seasonUsed: seasonForApi,
            fixturesFetched: matches.length,
            fixturesUpcoming: upcomingMatches.length,
            fixturesDroppedPast: Math.max(0, matches.length - upcomingMatches.length),
            candidateFixturesInWindow,
            itineraries,
            trace: [
                { step: 1, tool: 'weekend_window', detail: { dateFrom, dateTo, ianaTimeZone } },
                {
                    step: 2,
                    tool: 'fetch_fixtures',
                    detail: {
                        inBounds: matches.length,
                        upcomingKickoffs: upcomingMatches.length,
                        droppedPast: Math.max(0, matches.length - upcomingMatches.length),
                        inWeekendWindow: candidateFixturesInWindow
                    }
                },
                {
                    step: 3,
                    tool: 'schedule_feasibility',
                    detail: { itinerariesFound: itineraries.length, feasible, reasonCode }
                }
            ]
        };
    } catch (error) {
        console.error('Plan itinerary error:', error);
        return {
            success: false,
            code: 'INTERNAL',
            message: 'Could not build an itinerary. Please try again in a moment.',
            _httpStatus: 200
        };
    }
}
// Enhanced location extraction with better city coverage
const extractLocation = (query, teams = null) => {
    const queryLower = query.toLowerCase();
    const teamNamesLower = new Set(
        (teams?.any || [])
            .map(t => String(t.name || '').toLowerCase())
            .filter(Boolean)
    );
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
            // Avoid treating city tokens inside team names as explicit location.
            const cityAppearsInTeamName = Array.from(teamNamesLower).some((teamName) => teamName.includes(cityKey));
            const explicitLocationPhrase = hasExplicitLocationPhrase(queryLower, cityKey);
            if (cityAppearsInTeamName && !explicitLocationPhrase) {
                continue;
            }
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
async function resolveLeaguesFromQueryText(query) {
    const queryLower = String(query || '').toLowerCase().trim();
    if (!queryLower) {
        return [];
    }
    const candidates = new Set();
    candidates.add(queryLower);
    const runs = getMeaningfulWordRuns(query);
    for (const run of runs) {
        if (run.length >= 2) {
            candidates.add(run.join(' '));
        }
    }
    const results = [];
    const seen = new Set();
    for (const phrase of candidates) {
        const found = await leagueService.searchLeagues(phrase, { limit: 3 });
        if (!found || found.length === 0) {
            continue;
        }
        for (const league of found) {
            const apiId = String(league.apiId || '').trim();
            if (!apiId || seen.has(apiId)) {
                continue;
            }
            seen.add(apiId);
            results.push({
                apiId,
                name: league.name || apiId
            });
        }
        if (results.length >= 3) {
            break;
        }
    }
    return results;
}
const CALENDAR_SEASON_LEAGUE_IDS = new Set([
    '253', // MLS
    '1' // FIFA World Cup
]);

function inferLeagueIdsFromTeamDocs(teams) {
    if (!teams || !Array.isArray(teams.any) || teams.any.length === 0) {
        return [];
    }
    const detected = new Set();
    for (const team of teams.any) {
        if (!Array.isArray(team?.leagues)) {
            continue;
        }
        for (const entry of team.leagues) {
            const id = String(entry?.leagueId || '').trim();
            if (id) {
                detected.add(id);
            }
        }
    }
    return Array.from(detected);
}

async function resolveLeagueIdsFromTeams(teams) {
    const direct = inferLeagueIdsFromTeamDocs(teams);
    if (direct.length > 0) {
        return direct;
    }
    if (!teams || !Array.isArray(teams.any) || teams.any.length === 0) {
        return [];
    }
    const detected = new Set();
    for (const team of teams.any) {
        if (!team?.name) {
            continue;
        }
        try {
            const candidates = await teamService.searchTeams(team.name, { limit: 1 });
            const best = candidates?.[0];
            if (Array.isArray(best?.leagues)) {
                for (const entry of best.leagues) {
                    const id = String(entry?.leagueId || '').trim();
                    if (id) {
                        detected.add(id);
                    }
                }
            }
        } catch (error) {
            // Best effort only; continue with other teams.
        }
    }
    return Array.from(detected);
}

function determineSeasonForCompetitions(startDate, competitionIds = []) {
    let season = 2025;
    if (!startDate) {
        return season;
    }
    const start = new Date(startDate);
    const startYear = start.getFullYear();
    const startMonth = start.getMonth() + 1;
    const ids = competitionIds.map((id) => String(id));
    const hasIds = ids.length > 0;
    const allCalendar = hasIds && ids.every((id) => CALENDAR_SEASON_LEAGUE_IDS.has(id));
    if (allCalendar) {
        return startYear;
    }
    if (startMonth >= 7) {
        season = startYear;
    } else {
        season = startYear - 1;
    }
    return season;
}
// Country to default city mapping (for leagues not in hardcoded mapping)
const countryToCityMapping = {
    'United Kingdom': { city: 'London', coordinates: [-0.118092, 51.509865] },
    'United States': { city: 'Kansas City', coordinates: [-94.578567, 39.099727] },
    'USA': { city: 'Kansas City', coordinates: [-94.578567, 39.099727] },
    'Spain': { city: 'Madrid', coordinates: [-3.703790, 40.416775] },
    'Germany': { city: 'Berlin', coordinates: [13.404954, 52.520008] },
    'France': { city: 'Paris', coordinates: [2.352222, 48.856614] },
    'Italy': { city: 'Rome', coordinates: [12.496366, 41.902782] },
    'Portugal': { city: 'Lisbon', coordinates: [-9.139337, 38.722252] },
    'Netherlands': { city: 'Amsterdam', coordinates: [4.904139, 52.367573] },
    'Mexico': { city: 'Mexico City', coordinates: [-99.133178, 19.432608] }
};
// Smart location inference based on teams and leagues
const inferLocationFromTeamsAndLeagues = async (teams, leagues) => {
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
    // League-based country mapping (fallback for known leagues)
    const leagueCountryMapping = {
        'premier league': { city: 'London', country: 'United Kingdom', coordinates: [-0.118092, 51.509865] },
        'championship': { city: 'London', country: 'United Kingdom', coordinates: [-0.118092, 51.509865] },
        'la liga': { city: 'Madrid', country: 'Spain', coordinates: [-3.703790, 40.416775] },
        'bundesliga': { city: 'Berlin', country: 'Germany', coordinates: [13.404954, 52.520008] },
        'ligue 1': { city: 'Paris', country: 'France', coordinates: [2.352222, 48.856614] },
        'serie a': { city: 'Rome', country: 'Italy', coordinates: [12.496366, 41.902782] },
        'primeira liga': { city: 'Lisbon', country: 'Portugal', coordinates: [-9.139337, 38.722252] },
        'eredivisie': { city: 'Amsterdam', country: 'Netherlands', coordinates: [4.904139, 52.367573] },
        'major league soccer': { city: 'Kansas City', country: 'United States', coordinates: [-94.578567, 39.099727] },
        'mls': { city: 'Kansas City', country: 'United States', coordinates: [-94.578567, 39.099727] },
        'liga mx': { city: 'Mexico City', country: 'Mexico', coordinates: [-99.133178, 19.432608] }
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
            const leagueName = league.name?.toLowerCase();
            // First check hardcoded mapping
            if (leagueName && leagueCountryMapping[leagueName]) {
                return leagueCountryMapping[leagueName];
            }
            // If not in hardcoded mapping, try to get from database
            // Check if league has an apiId or id field
            const leagueId = league.apiId || league.id;
            if (leagueId) {
                try {
                    const dbLeague = await League.findOne({ apiId: leagueId.toString() });
                    if (dbLeague && dbLeague.country) {
                        const country = dbLeague.country;
                        // Use country-to-city mapping to get default location
                        const defaultLocation = countryToCityMapping[country] || 
                                               countryToCityMapping[country === 'United States' ? 'USA' : country];
                        if (defaultLocation) {
                            return {
                                city: defaultLocation.city,
                                country: country,
                                coordinates: defaultLocation.coordinates
                            };
                        }
                    }
                } catch (error) {
                    console.error(`Error querying league ${leagueId} from database:`, error);
                    // Continue to next league
                }
            }
        }
    }
    // If no match found, return null (no default location)
    return null;
};
// Conversation State Manager - tracks current search context
// Map league IDs to names via backend (no hardcoded league map)
const mapLeagueIdsToNamesAsync = async (leagueIds) => {
    if (!leagueIds || leagueIds.length === 0) return [];
    const names = await Promise.all(leagueIds.map(id => leagueService.getLeagueNameById(id)));
    return leagueIds.map((id, i) => ({ name: names[i] || `League ${id}`, id }));
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
            return result;
        }
        console.log({
            location: context.location,
            dateRange: context.dateRange,
            leagues: context.leagues,
            teams: context.teams
        });
        // Fill missing date range
        if (!result.dateRange && context.dateRange) {
            result.dateRange = context.dateRange;
        }
        // Fill missing location
        if (!result.location && context.location) {
            result.location = context.location;
        }
        // For follow-up queries like "just premier league", inherit leagues from context
        if (result.leagues.length === 0 && context.leagues && context.leagues.length > 0) {
            result.leagues = context.leagues;
        }
        // For follow-up queries like "only Arsenal", inherit teams from context
        if (result.teams.any.length === 0 && context.teams && context.teams.any && context.teams.any.length > 0) {
            result.teams = context.teams;
        }
        // Clear error message if we successfully filled missing information or have a valid broad query
        if (result.errorMessage && (result.dateRange || result.location)) {
            result.errorMessage = null;
            result.confidence = Math.max(result.confidence, 50); // Boost confidence after filling
        }
        // Clear error message for any query that has both location and dates (even if not marked as broad)
        if (result.errorMessage && result.location && result.dateRange) {
            result.errorMessage = null;
            result.confidence = Math.max(result.confidence, 50); // Boost confidence
        }
        return result;
    }
};
// Helper function to detect multi-query patterns
function detectMultiQuery(query) {
    const lowerQuery = query.toLowerCase();
    // Indicators of secondary criteria
    const secondaryIndicators = [
        'but would also like',
        'but also',
        'also want',
        'plus',
        'and also',
        'would also like',
        'other matches',
        'additional matches',
        'more matches'
    ];
    // Indicators of count constraints
    const countIndicators = [
        /\d+\s+other\s+matches?/i,
        /\d+\s+additional\s+matches?/i,
        /\d+\s+more\s+matches?/i,
        /a few\s+matches?/i,
        /several\s+matches?/i,
        /some\s+matches?/i
    ];
    // Indicators of distance from primary
    const distanceFromPrimaryIndicators = [
        /within\s+\d+\s+miles/i,
        /within\s+\d+\s+km/i,
        /\d+\s+miles\s+away/i,
        /\d+\s+km\s+away/i
    ];
    const hasSecondary = secondaryIndicators.some(indicator => 
        lowerQuery.includes(indicator)
    );
    const hasCount = countIndicators.some(pattern => pattern.test(query));
    const hasDistanceFromPrimary = distanceFromPrimaryIndicators.some(pattern => 
        pattern.test(query)
    );
    return hasSecondary || (hasCount && hasDistanceFromPrimary);
}
// Helper function to extract count constraint
function extractCountConstraint(query) {
    const patterns = [
        { pattern: /(\d+)\s+other\s+matches?/i, extract: (match) => parseInt(match[1]) },
        { pattern: /(\d+)\s+additional\s+matches?/i, extract: (match) => parseInt(match[1]) },
        { pattern: /(\d+)\s+more\s+matches?/i, extract: (match) => parseInt(match[1]) },
        { pattern: /a\s+few\s+matches?/i, extract: () => 3 },
        { pattern: /several\s+matches?/i, extract: () => 5 },
        { pattern: /some\s+matches?/i, extract: () => 3 },
        { pattern: /other\s+matches?/i, extract: () => 3 } // Default
    ];
    for (const { pattern, extract } of patterns) {
        const match = query.match(pattern);
        if (match) {
            return extract(match);
        }
    }
    return null;
}
// Helper function to extract distance constraint
function extractDistanceConstraint(query) {
    // Pattern: "within X miles" or "within X km"
    const milePattern = /within\s+(\d+)\s+miles?/i;
    const kmPattern = /within\s+(\d+)\s+km/i;
    const awayPattern = /(\d+)\s+miles?\s+away/i;
    const mileMatch = query.match(milePattern);
    if (mileMatch) {
        return parseInt(mileMatch[1]);
    }
    const kmMatch = query.match(kmPattern);
    if (kmMatch) {
        return Math.round(parseInt(kmMatch[1]) * 0.621371); // Convert km to miles
    }
    const awayMatch = query.match(awayPattern);
    if (awayMatch) {
        return parseInt(awayMatch[1]);
    }
    return null;
}
// Helper function to calculate period date range
function calculatePeriodDateRange(query, referenceDate = new Date()) {
    // Pattern: "over a X day period" or "over X days"
    const periodPattern = /over\s+(?:a\s+)?(\d+)\s+day\s+period/i;
    const daysPattern = /over\s+(\d+)\s+days?/i;
    const periodMatch = query.match(periodPattern) || query.match(daysPattern);
    if (periodMatch) {
        const days = parseInt(periodMatch[1]);
        const start = new Date(referenceDate);
        const end = new Date(referenceDate);
        end.setDate(end.getDate() + days - 1);
        return {
            start: formatDate(start),
            end: formatDate(end)
        };
    }
    return null;
}
// Enhanced natural language parser with OpenAI and smart defaults
const parseNaturalLanguage = async (query, conversationHistory = []) => {
    let result = {
        isMultiQuery: false, // NEW: Multi-query flag
        intent: 'search',
        minMatches: null,
        weekendAnchorLocalDate: null,
        ianaTimeZone: null,
        location: null,
        date: null,
        dateRange: null,
        teams: { home: null, away: null, any: [] },
        leagues: [],
        distance: null,
        matchType: null,
        matchTypes: [],
        confidence: 0,
        errorMessage: null,
        // NEW: Multi-query structures
        primary: null,
        secondary: null,
        relationship: null
    };
    // Detect if this is a multi-query
    const isMultiQuery = detectMultiQuery(query);
    result.isMultiQuery = isMultiQuery;
    try {
        // First try OpenAI for intelligent parsing (if available)
        const openai = createOpenAIClient();
        if (openai) {
            try {
                const now = new Date();
                const currentYear = now.getFullYear();
                const currentMonth = now.getMonth() + 1;
                // Build conversation context
                let conversationContext = "";
                if (conversationHistory && conversationHistory.length > 0) {
                    conversationContext = "\n\nCONVERSATION HISTORY:\n";
                    let clarificationCount = 0;
                    const recent = conversationHistory.slice(-6);
                    recent.forEach((msg) => {
                        if (msg.isBot && (msg.data?.success === false || (!msg.data && msg.text))) {
                            clarificationCount += 1;
                        }
                    });
                    if (clarificationCount >= 2) {
                        conversationContext += "The user has already had 2 or more clarification rounds without a successful search. Provide a friendly fallback in errorMessage: suggest popular leagues or example queries (e.g. 'Premier League matches in London next month'). Set suggestions to 2-3 concrete example queries. Do not ask for more clarification.\n";
                    }
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
                        INTENT (single-query only):
                        - intent: "search" (default) — list/filter fixtures in a date range.
                        - intent: "plan_itinerary" — user wants a multi-match WEEKEND trip with feasible travel (e.g. "plan a football weekend", "itinerary for 3 games in London", "see multiple matches same weekend"). Requires location + timeframe + league(s) like a normal search.
                        When intent is "plan_itinerary", you may set minMatches (2–6, default 3) and optionally weekendAnchorLocalDate (YYYY-MM-DD in that city) or ianaTimeZone (IANA id e.g. Europe/London); otherwise leave them null.
                        MULTI-QUERY DETECTION:
                        - If query contains phrases like "but would also like", "but also", "plus", "other matches", "additional matches", parse as multi-query
                        - Multi-query structure: primary match + secondary matches with different criteria
                        - Set isMultiQuery: true when secondary criteria detected
                        PRIMARY MATCH CRITERIA:
                        - Extract team name(s) for primary match
                        - Extract match type: "at home" → matchType: "home", "away" → matchType: "away"
                        - Primary match leagues are optional (defaults to team's league)
                        SECONDARY MATCH CRITERIA:
                        - Extract count constraint: "2 other matches" → count: 2, "a few matches" → count: 3, "several matches" → count: 5
                        - Extract league filters: "bundesliga 2 or austrian bundesliga" → leagues: [79, 218]
                        - Extract distance constraint: "within 200 miles" → maxDistance: 200
                        - Always set excludePrimary: true for secondary matches
                        RELATIONSHIP CONSTRAINTS:
                        - Extract shared date range: "over a 10 day period" → calculate dateRange
                        - Distance is relative to primary match venue: distanceFrom: "primary"
                        - If no date range specified, infer from primary match date
                        COUNT CONSTRAINT PARSING:
                        - "2 other matches" → count: 2
                        - "a few matches" → count: 3 (default)
                        - "several matches" → count: 5 (default)
                        - "some matches" → count: 3 (default)
                        - "other matches" (no number) → count: 3 (default)
                        DISTANCE PARSING:
                        - "within 200 miles" → maxDistance: 200
                        - "within 200 km" → maxDistance: 124 (convert km to miles)
                        - "200 miles away" → maxDistance: 200
                        - If distance mentioned without "from" or "of", assume relative to primary venue
                        DATE RANGE PARSING:
                        - "over a 10 day period" → Calculate 10-day range from today or specified date
                        - "over 10 days" → Same as above
                        - If primary match date specified, use that as start date
                        - If no date specified, use current date as start
                        IMPORTANT RULES:
                        - LEAGUE EXTRACTION: When the user mentions a league by name (e.g. "Premier league", "Premier League", "La Liga", "Bundesliga", "Serie A", "Ligue 1"), you MUST include the corresponding league ID in the leagues array (e.g. Premier League → 39, La Liga → 140, Bundesliga → 78, Serie A → 135, Ligue 1 → 61). Do not return empty leagues when a league name is clearly stated in the query.
                        - GREETINGS AND SMALL TALK: If the user message is only a greeting (e.g. hello, hi, hey), thanks, or similar with no search intent, return a short friendly conversational message in errorMessage (e.g. greet them back and suggest they ask for matches by team, league, city, or dates). Do not return location, dateRange, teams, or leagues. Set suggestions to example queries if helpful.
                        - ALWAYS require a date/timeframe - if none provided AND no conversation history, return error message
                        - If conversation history exists, inherit missing information (location, dates) from previous searches
                        - For follow-up queries like "just premier league" or "only Arsenal", inherit location and dates from conversation history
                        - Use smart defaults for location based on teams/leagues
                        - Be conversational in error messages
                        - For broad queries (location + dates only, no league mentioned), provide helpful suggestions for refinement and leagues may be empty
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
                        - If a specific day is provided (e.g., "March 21st" or "on March 21, 2026"), set dateRange.start and dateRange.end to that exact same day
                        - For a single month (e.g., "January 2026"), create a date range covering the entire month (e.g., "2026-01-01" to "2026-01-31")
                        When handling weekends, always use Friday through Sunday (3 days).
                        Return only a JSON object. For multi-query, use this structure:
                        {
                            "isMultiQuery": true,
                            "primary": {
                                "teams": ["Bayern Munich"],
                                "matchType": "home",
                                "leagues": []
                            },
                            "secondary": {
                                "count": 2,
                                "leagues": [79, 218],
                                "maxDistance": 200,
                                "excludePrimary": true
                            },
                            "relationship": {
                                "distanceFrom": "primary",
                                "dateRange": {
                                    "start": "2025-03-01",
                                    "end": "2025-03-10"
                                }
                            },
                            "errorMessage": null,
                            "suggestions": []
                        }
                        For single query, use this structure:
                        {
                            "isMultiQuery": false,
                            "intent": "search",
                            "location": { "city": "London", "country": "United Kingdom", "coordinates": [-0.118092, 51.509865] },
                            "dateRange": { "start": "2025-03-01", "end": "2025-03-31" },
                            "leagues": [39],
                            "maxDistance": 50,
                            "teams": ["Arsenal FC"],
                            "matchTypes": [],
                            "minMatches": null,
                            "weekendAnchorLocalDate": null,
                            "ianaTimeZone": null,
                            "errorMessage": null,
                            "suggestions": []
                        }
                        For single-query weekend itinerary planning:
                        {
                            "isMultiQuery": false,
                            "intent": "plan_itinerary",
                            "location": { "city": "London", "country": "United Kingdom", "coordinates": [-0.118092, 51.509865] },
                            "dateRange": { "start": "2026-03-06", "end": "2026-03-08" },
                            "leagues": [39, 40],
                            "maxDistance": 50,
                            "teams": [],
                            "matchTypes": [],
                            "minMatches": 3,
                            "weekendAnchorLocalDate": null,
                            "ianaTimeZone": "Europe/London",
                            "errorMessage": null,
                            "suggestions": []
                        }
                        Fields:
                        - intent: "search" | "plan_itinerary" (single query only; omit or "search" for multi-query)
                        - isMultiQuery (boolean) - REQUIRED: true if multi-query detected, false otherwise
                        - For multi-query: primary, secondary, relationship objects
                        - For single query: location, dateRange, leagues, maxDistance, teams, matchTypes
                        - errorMessage (string if there's an error, null otherwise)
                        - suggestions (array of helpful suggestions for refining the search)
                        Available leagues (use these exact IDs):
                        - 39 (Premier League)
                        - 40 (Championship)
                        - 78 (Bundesliga)
                        - 79 (Bundesliga 2)
                        - 140 (La Liga)
                        - 141 (La Liga 2)
                        - 218 (Austrian Bundesliga)
                        - 61 (Ligue 1)
                        - 62 (Ligue 2)
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
                            "isMultiQuery": false,
                            "location": {
                                "city": "London",
                                "country": "United Kingdom",
                                "coordinates": [-0.118092, 51.509865]
                            },
                            "dateRange": {
                                "start": "2025-11-01",
                                "end": "2025-11-30"
                            },
                            "leagues": [39],
                            "maxDistance": 50,
                            "teams": [],
                            "matchTypes": [],
                            "errorMessage": null,
                            "suggestions": []
                        }
                        Example response format for multi-query:
                        Query: "I want to see Bayern Munich play at home, but would also like to see 2 other matches within 200 miles over a 10 day period. The other matches can be bundesliga 2 or austrian bundesliga"
                        Response:
                        {
                            "isMultiQuery": true,
                            "primary": {
                                "teams": ["Bayern Munich"],
                                "matchType": "home",
                                "leagues": []
                            },
                            "secondary": {
                                "count": 2,
                                "leagues": [79, 218],
                                "maxDistance": 200,
                                "excludePrimary": true
                            },
                            "relationship": {
                                "distanceFrom": "primary",
                                "dateRange": {
                                    "start": "2025-03-01",
                                    "end": "2025-03-10"
                                }
                            },
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
                max_tokens: 800  // Increased for multi-query responses
            });
            const parsedResponse = JSON.parse(completion.choices[0].message.content);
            // Convert OpenAI response to our format
            if (parsedResponse.errorMessage) {
                result.errorMessage = parsedResponse.errorMessage;
                result.confidence = 0;
                // Don't return early - let context inheritance handle it
            }
            if (!parsedResponse.isMultiQuery) {
                if (parsedResponse.intent === 'plan_itinerary') {
                    result.intent = 'plan_itinerary';
                }
                if (typeof parsedResponse.minMatches === 'number' && parsedResponse.minMatches >= 2 && parsedResponse.minMatches <= 10) {
                    result.minMatches = parsedResponse.minMatches;
                }
                if (typeof parsedResponse.weekendAnchorLocalDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsedResponse.weekendAnchorLocalDate.trim())) {
                    result.weekendAnchorLocalDate = parsedResponse.weekendAnchorLocalDate.trim();
                }
                if (typeof parsedResponse.ianaTimeZone === 'string' && parsedResponse.ianaTimeZone.includes('/')) {
                    result.ianaTimeZone = parsedResponse.ianaTimeZone.trim();
                }
            }
            // Check if multi-query
            if (parsedResponse.isMultiQuery) {
                result.isMultiQuery = true;
                result.intent = 'search';
                // Map primary criteria
                result.primary = {
                    teams: parsedResponse.primary?.teams || [],
                    matchType: parsedResponse.primary?.matchType || null,
                    leagues: parsedResponse.primary?.leagues || []
                };
                // Map secondary criteria
                result.secondary = {
                    count: parsedResponse.secondary?.count || null,
                    leagues: parsedResponse.secondary?.leagues || [],
                    maxDistance: parsedResponse.secondary?.maxDistance || null,
                    excludePrimary: parsedResponse.secondary?.excludePrimary !== false
                };
                // Map relationship
                result.relationship = {
                    distanceFrom: parsedResponse.relationship?.distanceFrom || 'primary',
                    dateRange: parsedResponse.relationship?.dateRange || parsedResponse.dateRange
                };
                // Populate legacy fields for backward compatibility
                result.dateRange = result.relationship.dateRange;
                result.teams.any = result.primary.teams.map(name => ({ name }));
                result.matchType = result.primary.matchType;
                result.matchTypes = result.matchType ? [result.matchType] : [];
                result.leagues = result.primary.leagues.map(leagueId => ({ apiId: String(leagueId), name: String(leagueId) }));
                // Calculate confidence for multi-query
                let confidence = 0;
                if (result.primary.teams.length > 0) confidence += 30;
                if (result.secondary.count) confidence += 20;
                if (result.secondary.leagues.length > 0) confidence += 20;
                if (result.secondary.maxDistance) confidence += 15;
                if (result.relationship.dateRange) confidence += 15;
                result.confidence = Math.min(confidence, 100);
            } else {
                // Single query mode (existing logic)
                result.isMultiQuery = false;
                result.location = parsedResponse.location;
                result.dateRange = parsedResponse.dateRange;
                result.distance = parsedResponse.maxDistance;
                result.matchType = parsedResponse.matchTypes?.[0] || null;
                result.matchTypes =
                    Array.isArray(parsedResponse.matchTypes) && parsedResponse.matchTypes.length > 0
                        ? parsedResponse.matchTypes
                        : (result.matchType ? [result.matchType] : []);
                result.suggestions = parsedResponse.suggestions || [];
                // Convert team names to our team objects (simplified for now)
                if (parsedResponse.teams && parsedResponse.teams.length > 0) {
                    result.teams.any = parsedResponse.teams.map(teamName => ({ name: teamName }));
                }
                // Convert league IDs to our league objects (simplified for now)
                if (parsedResponse.leagues && parsedResponse.leagues.length > 0) {
                    result.leagues = parsedResponse.leagues.map(leagueId => ({ apiId: String(leagueId), name: String(leagueId) }));
                }
                // Map to primary structure for consistency
                result.primary = {
                    teams: parsedResponse.teams || [],
                    matchType: result.matchType,
                    leagues: parsedResponse.leagues || []
                };
                // Calculate confidence score
                let confidence = 0;
                if (result.teams.any.length > 0) confidence += 30;
                if (result.leagues.length > 0) confidence += 25;
                if (result.location) confidence += 25;
                if (result.dateRange) confidence += 15;
                if (result.distance) confidence += 10;
                result.confidence = Math.min(confidence, 100);
            }
            // Apply conversation state management after AI parsing
            const updatedResult = ConversationStateManager.fillMissingContext(result, conversationHistory);
            Object.assign(result, updatedResult);
            if (!result.isMultiQuery && detectPlanItineraryFromQuery(query)) {
                result.intent = 'plan_itinerary';
            }
            return result;
            } catch (openaiError) {
                // Fall through to regex parser
            }
        } else {
        }
        // Fallback to regex-based parsing
        const [teams, leagues, dateRange, distance] = await Promise.all([
            extractTeams(query),
            extractLeagues(query),
            parseComplexDates(query),
            extractDistance(query)
        ]);
        const location = extractLocation(query, teams);
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
        result.matchTypes = result.matchType ? [result.matchType] : [];
        // Apply conversation state management after regex parsing
        const updatedResult = ConversationStateManager.fillMissingContext(result, conversationHistory);
        Object.assign(result, updatedResult);
        if (!result.isMultiQuery && detectPlanItineraryFromQuery(query)) {
            result.intent = 'plan_itinerary';
        }
        // DATE VALIDATION - Always require dates
        if (!result.dateRange) {
            result.errorMessage = "Please specify when you want to see these matches";
            result.confidence = 0;
            return result;
        }
        // SMART LOCATION DEFAULTS - If no location specified, infer from teams/leagues
        if (!result.location) {
            result.location = await inferLocationFromTeamsAndLeagues(result.teams, result.leagues);
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
    // If multi-query, return structure for multi-query execution
    if (parsed.isMultiQuery) {
        return {
            isMultiQuery: true,
            primary: {
                teams: parsed.primary?.teams || [],
                matchType: parsed.primary?.matchType,
                leagues: parsed.primary?.leagues || [],
                dateRange: parsed.relationship?.dateRange || parsed.dateRange
            },
            secondary: {
                count: parsed.secondary?.count || null,
                leagues: parsed.secondary?.leagues || [],
                maxDistance: parsed.secondary?.maxDistance || null,
                excludePrimary: parsed.secondary?.excludePrimary !== false
            },
            relationship: parsed.relationship || {
                distanceFrom: 'primary',
                dateRange: parsed.dateRange
            }
        };
    }
    // Existing single-query logic
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
/**
 * GET /api/search/locations
 * Location autocomplete endpoint - proxies LocationIQ autocomplete API
 * Uses backend's LOCATIONIQ_API_KEY to keep API key secure
 */
router.get('/locations', async (req, res) => {
    try {
        const { q, limit = 5 } = req.query;
        if (!q || q.length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Search query must be at least 2 characters'
            });
        }
        if (!LOCATIONIQ_API_KEY) {
            return res.status(503).json({
                success: false,
                message: 'LocationIQ API key not configured on server'
            });
        }
        try {
            const response = await axios.get(LOCATIONIQ_AUTOCOMPLETE_URL, {
                params: {
                    key: LOCATIONIQ_API_KEY,
                    q: q,
                    limit: parseInt(limit),
                    dedupe: 1,
                    'accept-language': 'en'
                },
                httpsAgent: searchHttpsAgent,
                timeout: 10000
            });
            // Helper function to filter postal codes from region
            const filterPostalCodes = (region) => {
                if (!region) return '';
                // Split by comma and filter out parts that are purely numeric (postal codes)
                // Also filter out patterns like "SW1A 1AA" (UK postcodes)
                const parts = region.split(', ').filter(part => {
                    // Remove purely numeric parts (e.g., "75000", "90210")
                    if (/^\d+$/.test(part.trim())) return false;
                    // Remove UK-style postcodes (e.g., "SW1A 1AA", "M1 1AA")
                    if (/^[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}$/i.test(part.trim())) return false;
                    // Remove US ZIP+4 format (e.g., "90210-1234")
                    if (/^\d{5}-\d{4}$/.test(part.trim())) return false;
                    return true;
                });
                return parts.join(', ');
            };
            // Transform LocationIQ response to match mobile app expectations
            const suggestions = response.data.map(item => {
                const nameParts = item.display_name.split(', ');
                const city = nameParts[0];
                const country = nameParts[nameParts.length - 1];
                const region = nameParts.slice(1, -1).join(', ');
                const displayRegion = filterPostalCodes(region);
                const uniqueId = `${item.place_id}-${item.lat}-${item.lon}-${city}-${region}-${country}`;
                return {
                    place_id: uniqueId,
                    lat: parseFloat(item.lat),
                    lon: parseFloat(item.lon),
                    city,
                    region, // Keep full region with postal codes for backend compatibility
                    displayRegion, // Cleaned region without postal codes
                    country
                };
            });
            // Deduplicate suggestions
            const uniqueSuggestions = suggestions.filter((suggestion, index, self) =>
                index === self.findIndex((s) => (
                    s.lat === suggestion.lat && 
                    s.lon === suggestion.lon && 
                    s.city === suggestion.city && 
                    s.region === suggestion.region && 
                    s.country === suggestion.country
                ))
            );
            // Check for duplicate city names to determine if disambiguation is needed
            const cityNameCounts = {};
            uniqueSuggestions.forEach(suggestion => {
                const cityKey = suggestion.city.toLowerCase();
                if (!cityNameCounts[cityKey]) {
                    cityNameCounts[cityKey] = [];
                }
                cityNameCounts[cityKey].push(suggestion);
            });
            // Generate descriptions with disambiguation logic
            uniqueSuggestions.forEach(suggestion => {
                const cityKey = suggestion.city.toLowerCase();
                const citiesWithSameName = cityNameCounts[cityKey];
                // If multiple cities share the same name, include region for disambiguation
                if (citiesWithSameName.length > 1) {
                    // Include displayRegion (without postal codes) for disambiguation
                    suggestion.description = suggestion.displayRegion 
                        ? `${suggestion.city}, ${suggestion.displayRegion}, ${suggestion.country}`
                        : `${suggestion.city}, ${suggestion.country}`;
                } else {
                    // Unique city name, show simple format
                    suggestion.description = `${suggestion.city}, ${suggestion.country}`;
                }
            });
            return res.json({
                success: true,
                suggestions: uniqueSuggestions
            });
        } catch (error) {
            console.error('LocationIQ autocomplete error:', error.message);
            if (error.response?.status === 429) {
                return res.status(429).json({
                    success: false,
                    message: 'Rate limit exceeded. Please try again later.'
                });
            }
            if (error.response?.status === 401) {
                return res.status(500).json({
                    success: false,
                    message: 'Invalid LocationIQ API key on server'
                });
            }
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch location suggestions',
                error: error.message
            });
        }
    } catch (error) {
        console.error('Location autocomplete endpoint error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});
// Debug endpoint to check database connection
/**
 * GET /api/search/unified
 * Unified search across leagues, teams, and venues
 * Returns results from MongoDB only (no API fallback)
 */
router.get('/unified', async (req, res) => {
    try {
        const { query } = req.query;
        // Sanitize and validate query input
        const { sanitizeSearchQuery } = require('../utils/security');
        const validation = sanitizeSearchQuery(query, 100);
        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                message: validation.error || 'Invalid search query'
            });
        }
        const sanitizedQuery = validation.sanitized;
        // Search all three collections in parallel for better performance
        const [leagues, teams, venues] = await Promise.all([
            // Search leagues
            League.find({
                $or: [
                    { name: { $regex: sanitizedQuery, $options: 'i' } },
                    { shortName: { $regex: sanitizedQuery, $options: 'i' } }
                ],
                isActive: true
            })
            .select('apiId name country countryCode tier emblem')
            .limit(10)
            .lean(),
            // Search teams
            Team.find({
                $or: [
                    { name: { $regex: sanitizedQuery, $options: 'i' } },
                    { aliases: { $regex: sanitizedQuery, $options: 'i' } }
                ]
            })
            .select('apiId name country city logo code venue')
            .limit(10)
            .lean(),
            // Search venues
            Venue.find({
                $or: [
                    { name: { $regex: sanitizedQuery, $options: 'i' } },
                    { city: { $regex: sanitizedQuery, $options: 'i' } },
                    { aliases: { $regex: sanitizedQuery, $options: 'i' } }
                ],
                isActive: true
            })
            .select('venueId name city country countryCode image capacity')
            .limit(10)
            .lean()
        ]);
        // Format results with type identifiers and badges
        const formattedLeagues = leagues.map(league => ({
            type: 'league',
            id: league.apiId,
            name: league.name,
            country: league.country,
            countryCode: league.countryCode,
            tier: league.tier || 1,
            badge: league.emblem || `https://media.api-sports.io/football/leagues/${league.apiId}.png`
        }));
        const formattedTeams = teams.map(team => ({
            type: 'team',
            id: team.apiId,
            name: team.name,
            country: team.country,
            city: team.city || '',
            badge: team.logo || `https://media.api-sports.io/football/teams/${team.apiId}.png`,
            code: team.code || null,
            relatedVenue: team.venue && team.venue.name ? {
                name: team.venue.name,
                city: team.city || null,
                country: team.country || null
            } : null
        }));
        const formattedVenues = venues.map(venue => ({
            type: 'venue',
            id: venue.venueId,
            name: venue.name,
            city: venue.city,
            country: venue.country,
            countryCode: venue.countryCode,
            badge: venue.image || null,
            capacity: venue.capacity || null
        }));
        res.json({
            success: true,
            query,
            results: {
                leagues: formattedLeagues,
                teams: formattedTeams,
                venues: formattedVenues
            },
            counts: {
                leagues: formattedLeagues.length,
                teams: formattedTeams.length,
                venues: formattedVenues.length,
                total: formattedLeagues.length + formattedTeams.length + formattedVenues.length
            }
        });
    } catch (error) {
        console.error('Unified search error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to perform search'
        });
    }
});
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
        // Enforce exact single-day date range when user explicitly gives a day (works for both OpenAI and fallback parser)
        const explicitSingleDayRange = extractSingleDayRangeFromQuery(query);
        if (explicitSingleDayRange) {
            parsed.dateRange = explicitSingleDayRange;
        }
        let searchParams = buildSearchParameters(parsed);
        parsed.location = normalizeLocation(parsed.location);
        searchParams = { ...searchParams, location: normalizeLocation(searchParams.location) };
        // For direct team/league queries without an explicit location in this turn,
        // prefer global search (no city bounds) instead of silently pinning to an inferred city.
        const explicitLocationInQuery = extractLocation(query, parsed.teams);
        const hasEntityFilters =
            (parsed.teams?.any && parsed.teams.any.length > 0) ||
            (parsed.leagues && parsed.leagues.length > 0);
        const hasConversationContext = Array.isArray(conversationHistory) && conversationHistory.length > 0;
        if (!explicitLocationInQuery && hasEntityFilters && !hasConversationContext) {
            searchParams = { ...searchParams, location: null };
            parsed.location = null;
        }
        const queryLower = (query || '').toLowerCase();
        // Canonical explicit league phrases: when user names a league, keep intent precise.
        const explicitLeagueMappings = [
            { phrase: 'premier league', apiId: '39', name: 'Premier League' },
            { phrase: 'championship', apiId: '40', name: 'Championship' },
            { phrase: 'la liga', apiId: '140', name: 'La Liga' },
            { phrase: 'bundesliga 2', apiId: '79', name: 'Bundesliga 2' },
            { phrase: 'bundesliga', apiId: '78', name: 'Bundesliga' },
            { phrase: 'serie b', apiId: '136', name: 'Serie B' },
            { phrase: 'serie a', apiId: '135', name: 'Serie A' },
            { phrase: 'ligue 2', apiId: '62', name: 'Ligue 2' },
            { phrase: 'ligue 1', apiId: '61', name: 'Ligue 1' },
            { phrase: 'eredivisie', apiId: '88', name: 'Eredivisie' },
            { phrase: 'primeira liga', apiId: '94', name: 'Primeira Liga' },
            { phrase: 'champions league', apiId: '2', name: 'Champions League' },
            { phrase: 'europa league', apiId: '3', name: 'Europa League' },
            { phrase: 'fifa world cup', apiId: '1', name: 'FIFA World Cup' },
            { phrase: 'world cup', apiId: '1', name: 'FIFA World Cup' },
            { phrase: 'segunda división', apiId: '141', name: 'La Liga 2' }
        ];
        const explicitLeague = explicitLeagueMappings.find(({ phrase }) => queryLower.includes(phrase));
        if (explicitLeague) {
            searchParams = { ...searchParams, leagues: [explicitLeague.apiId] };
            parsed.leagues = [{ apiId: explicitLeague.apiId, name: explicitLeague.name }];
        } else if (!searchParams.leagues || searchParams.leagues.length === 0) {
            // DB/API-backed fallback: resolve competitions from free-text query phrases.
            const resolvedLeagues = await resolveLeaguesFromQueryText(query);
            if (resolvedLeagues.length > 0) {
                searchParams = { ...searchParams, leagues: resolvedLeagues.map((l) => l.apiId) };
                parsed.leagues = resolvedLeagues;
            }
        }
        // Guardrails: date is always required; location required only for broad queries.
        const missingFields = [];
        if (!searchParams.startDate || !searchParams.endDate) missingFields.push('date');
        const requiresLocation =
            !(parsed.teams?.any && parsed.teams.any.length > 0) &&
            !(searchParams.leagues && searchParams.leagues.length > 0);
        if (requiresLocation && (!searchParams.location?.country || !searchParams.location?.city)) {
            missingFields.push('location');
        }
        if (missingFields.length > 0) {
            const likelyGreetingOrSmallTalk =
                !!parsed.errorMessage &&
                !(searchParams.leagues && searchParams.leagues.length > 0) &&
                !(parsed.teams?.any && parsed.teams.any.length > 0) &&
                !searchParams.location &&
                !searchParams.startDate &&
                !searchParams.endDate;
            if (likelyGreetingOrSmallTalk) {
                return res.json({
                    success: false,
                    message: parsed.errorMessage,
                    confidence: parsed.confidence,
                    parsed: parsed,
                    suggestions: parsed.suggestions || [
                        'Premier League matches in London this weekend',
                        'Arsenal matches in London on March 21st'
                    ]
                });
            }
            const missingDate = missingFields.includes('date');
            const missingLocation = missingFields.includes('location');
            const message = missingDate && missingLocation
                ? 'Please tell me when and where you want to see matches.'
                : missingDate
                    ? 'Please tell me when you want to see matches (for example, this weekend or March 21st).'
                    : 'Please tell me where you want to see matches (for example, in London or in Manchester).';
            return res.json({
                success: false,
                missingFields,
                message,
                confidence: parsed.confidence,
                parsed,
                suggestions: [
                    'Premier League matches in London this weekend',
                    'Arsenal matches in London on March 21st',
                    'Matches in Manchester next month'
                ]
            });
        }
        // Handle parser error messages after required-field validation
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
        // Determine season based on date + competition season model (calendar vs split-season)
        let season = determineSeasonForCompetitions(searchParams.startDate, searchParams.leagues || []);
        // Determine which leagues to search based on location and query type
        let leagueIds = [];
        console.log({
            hasLeagues: !!(searchParams.leagues && searchParams.leagues.length > 0),
            leagues: searchParams.leagues,
            hasLocation: !!searchParams.location,
            location: searchParams.location
        });
        if (searchParams.leagues && searchParams.leagues.length > 0) {
            if (searchParams.location) {
                // Resolve location country to code via backend (no hardcoded country→league mapping)
                const countryName = searchParams.location.country;
                const titleCased = countryName && countryName.split(' ').map(w => w.charAt(0).toUpperCase() + (w.slice(1) || '').toLowerCase()).join(' ');
                const locationCountryCode = leagueService.getCountryCodeMapping(countryName) || leagueService.getCountryCodeMapping(titleCased);
                const locationLeagues = locationCountryCode ? await leagueService.getLeaguesForCountry(locationCountryCode) : [];
                const locationLeagueApiIds = new Set((locationLeagues || []).map(l => String(l.apiId)));
                const isLocationMatch = locationLeagueApiIds.size > 0 && searchParams.leagues.some(id => locationLeagueApiIds.has(String(id)));

                if (isLocationMatch) {
                    leagueIds = searchParams.leagues;
                } else {
                    // League/location mismatch: use leagueService for names and country (no hardcoded maps)
                    const requestedLeagueNames = await Promise.all(searchParams.leagues.map(id => leagueService.getLeagueNameById(id)));
                    const requestedLeague = requestedLeagueNames.slice(0, 3).join(', ') + (requestedLeagueNames.length > 3 ? ` and ${requestedLeagueNames.length - 3} more` : '');
                    const requestedLeagueCountry = await leagueService.getCountryByLeagueId(searchParams.leagues[0]);
                    const requestedLocation = [searchParams.location.city, searchParams.location.country].filter(Boolean).join(', ');
                    const localLeagueName = (locationLeagues && locationLeagues[0]?.name) ? locationLeagues[0].name : 'Local leagues';
                    const suggestedAlternatives = [
                        { league: localLeagueName, location: requestedLocation },
                        { league: requestedLeague, location: requestedLeagueCountry }
                    ];
                    const helpfulMessage = await generateResponse({
                        type: 'error',
                        requestedLeague,
                        requestedLocation,
                        suggestedAlternatives
                    });
                    return res.json({
                        success: false,
                        query: query,
                        message: helpfulMessage,
                        parsed: {
                            teams: parsed.teams.any.map(t => ({ name: t.name, id: t._id })),
                            leagues: searchParams.leagues.map((id, i) => ({ name: requestedLeagueNames[i] || `League ${id}`, id })),
                            location: parsed.location,
                            dateRange: parsed.dateRange,
                            distance: parsed.distance
                        },
                        preSelectedFilters: {
                            country: parsed.location?.country || null,
                            leagues: requestedLeagueNames,
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
            }
        }
        if (leagueIds.length === 0) {
            const teamBasedLeagues = await resolveLeagueIdsFromTeams(parsed.teams);
            if (teamBasedLeagues.length > 0) {
                // Team-first guardrail: prefer a compact competition set over broad global fan-out.
                let inferredCountry = searchParams.location?.country || null;
                if (!inferredCountry) {
                    const inferredLocation = await inferLocationFromTeamsAndLeagues(parsed.teams, parsed.leagues || []);
                    inferredCountry = inferredLocation?.country || null;
                }
                leagueIds = buildPrioritizedCompetitionIds({
                    primaryLeagueIds: teamBasedLeagues,
                    country: inferredCountry
                });
                season = determineSeasonForCompetitions(searchParams.startDate, leagueIds);
            } else if (searchParams.location?.country) {
                const countryName = searchParams.location.country;
                const titleCased = countryName.split(' ').map(w => w.charAt(0).toUpperCase() + (w.slice(1) || '').toLowerCase()).join(' ');
                const countryCode = leagueService.getCountryCodeMapping(countryName) || leagueService.getCountryCodeMapping(titleCased);
                const leaguesForCountry = countryCode ? await leagueService.getLeaguesForCountry(countryCode) : [];
                // Cap to top 10 by tier so we don't overwhelm (e.g. 27+ UK leagues)
                const topLeagues = (leaguesForCountry || []).slice(0, 10);
                leagueIds = topLeagues.map(l => String(l.apiId));
                if (leagueIds.length > 0 && !leagueIds.includes('10')) {
                    leagueIds.push('10'); // Friendlies
                }
                if (leagueIds.length === 0) {
                    const allLeagues = await leagueService.getAllLeagues();
                    leagueIds = allLeagues.slice(0, 15).map(l => String(l.apiId));
                }
                season = determineSeasonForCompetitions(searchParams.startDate, leagueIds);
            } else {
                const allLeagues = await leagueService.getAllLeagues();
                leagueIds = allLeagues.slice(0, 15).map(l => String(l.apiId));
                season = determineSeasonForCompetitions(searchParams.startDate, leagueIds);
            }
        }
        const wantsPlanItinerary =
            !parsed.isMultiQuery &&
            parsed.intent === 'plan_itinerary' &&
            searchParams.location &&
            searchParams.location.city &&
            searchParams.location.country &&
            leagueIds.length > 0;
        if (wantsPlanItinerary) {
            const ianaTz =
                (typeof parsed.ianaTimeZone === 'string' && parsed.ianaTimeZone.includes('/')
                    ? parsed.ianaTimeZone.trim()
                    : null) ||
                (await resolveIanaTimeZoneForLocation(
                    searchParams.location.city,
                    searchParams.location.country,
                    searchParams.location.coordinates
                ));
            if (!ianaTz) {
                return res.status(200).json({
                    success: false,
                    intent: 'plan_itinerary',
                    code: 'TIMEZONE_UNAVAILABLE',
                    message: 'Could not resolve timezone for that location. Try a more specific city or region.',
                    parsed: {
                        teams: parsed.teams.any.map(t => ({ name: t.name, id: t._id })),
                        leagues: parsed.leagues,
                        location: parsed.location,
                        dateRange: parsed.dateRange,
                        distance: parsed.distance
                    },
                    suggestions: ['Try: Premier League weekend plan in London next month', 'Include country with the city (e.g. London, UK)']
                });
            }
            const anchorDate =
                (typeof parsed.weekendAnchorLocalDate === 'string' &&
                    /^\d{4}-\d{2}-\d{2}$/.test(parsed.weekendAnchorLocalDate.trim()) &&
                    parsed.weekendAnchorLocalDate.trim()) ||
                weekendAnchorLocalDateFromRange(searchParams.startDate, searchParams.endDate, ianaTz);
            const minM =
                (Number.isFinite(Number(parsed.minMatches)) &&
                Number(parsed.minMatches) >= 2 &&
                Number(parsed.minMatches) <= 10
                    ? Number(parsed.minMatches)
                    : null) ??
                extractMinMatchesFromQuery(query) ??
                3;
            const radiusMiles =
                Number.isFinite(Number(parsed.distance)) && Number(parsed.distance) > 0 ? Number(parsed.distance) : 50;
            const planPayload = await runPlanItinerary({
                city: searchParams.location.city,
                country: searchParams.location.country,
                ianaTimeZone: ianaTz,
                weekendAnchorLocalDate: anchorDate,
                competitions: leagueIds,
                minMatches: minM,
                maxMatches: 6,
                maxTravelMinutesBetweenMatches: 90,
                fixedBufferMinutes: 25,
                minutesPerKm: 3.5,
                maxLegsPerDay: 2,
                radiusMiles
            });
            const { _httpStatus: planHttp, ...planOut } = planPayload;
            if (planHttp === 400) {
                return res.status(400).json({ ...planOut, intent: 'plan_itinerary', query });
            }
            if (!planPayload.success) {
                return res.status(planHttp || 200).json({ ...planOut, intent: 'plan_itinerary', query });
            }
            const leaguesWithNamesPlan = await mapLeagueIdsToNamesAsync(leagueIds);
            const bestItin = planPayload.itineraries && planPayload.itineraries[0];
            const planMatches = planPayload.feasible && bestItin && bestItin.matches ? bestItin.matches : [];
            const planMessage =
                typeof planPayload.userMessage === 'string' && planPayload.userMessage.length > 0
                    ? planPayload.userMessage
                    : planPayload.feasible && bestItin
                      ? `Found a feasible ${bestItin.matchCount}-match weekend plan.`
                      : `Could not build a ${minM}-match weekend plan for that window.`;
            return res.json({
                success: true,
                intent: 'plan_itinerary',
                reasonCode: planPayload.reasonCode,
                query,
                confidence: parsed.confidence,
                message: planMessage,
                parsed: {
                    teams: parsed.teams.any.map(t => ({ name: t.name, id: t._id })),
                    leagues: leaguesWithNamesPlan,
                    location: parsed.location,
                    dateRange: parsed.dateRange,
                    distance: parsed.distance,
                    itineraryConstraints: planPayload.constraints,
                    weekendWindow: planPayload.window
                },
                preSelectedFilters: {
                    country: parsed.location?.country || null,
                    leagues: leaguesWithNamesPlan.map(l => l.name),
                    teams: parsed.teams.any.map(t => t.name)
                },
                plan: planOut,
                matches: planMatches,
                count: planMatches.length
            });
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
        }
        console.log({
            competitions: leagueIds.join(','),
            dateFrom: searchParams.startDate,
            dateTo: searchParams.endDate,
            season: season
        });
        // Extract teams, leagues, and matchTypes from parsed query for filtering
        const teams = parsed.teams?.any?.map(team => team.name) || [];
        const leagues = parsed.leagues?.map(league => league.name) || [];
        const matchTypes =
            parsed.matchTypes && parsed.matchTypes.length > 0
                ? parsed.matchTypes
                : (parsed.matchType ? [parsed.matchType] : []);
        console.log({
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
            console.log({
                matches: matches.length
            });
        } catch (error) {
            console.error('🔍 Search Error:', error.message);
            matches = [];
        }
        // Format response for all successful queries (OpenAI handles the intelligence)
        const locationName = parsed.location ? `${parsed.location.city}, ${parsed.location.country}` : 'the specified location';
        const dateRange = parsed.dateRange ? `${parsed.dateRange.start} to ${parsed.dateRange.end}` : 'the specified dates';
        const leaguesWithNames = await mapLeagueIdsToNamesAsync(leagueIds);
        let response;
        if (parsed.isMultiQuery) {
            response = {
                success: true,
                query: query,
                confidence: parsed.confidence,
                isMultiQuery: true,
                message: "Multi-query detected. Full execution will be implemented in Phase 3. For now, searching with primary criteria only.",
                parsed: {
                    primary: {
                        teams: parsed.primary?.teams || [],
                        matchType: parsed.primary?.matchType || null,
                        leagues: parsed.primary?.leagues || []
                    },
                    secondary: {
                        count: parsed.secondary?.count || null,
                        leagues: parsed.secondary?.leagues || [],
                        maxDistance: parsed.secondary?.maxDistance || null,
                        excludePrimary: parsed.secondary?.excludePrimary !== false
                    },
                    relationship: parsed.relationship || {
                        distanceFrom: 'primary',
                        dateRange: parsed.dateRange
                    }
                },
                preSelectedFilters: {
                    country: parsed.location?.country || null,
                    leagues: leaguesWithNames.map(l => l.name),
                    teams: parsed.primary?.teams || []
                },
                matches: matches,
                count: matches.length
            };
        } else {
            const messageType = matches.length === 0 ? 'empty' : 'success';
            response = {
                success: true,
                query: query,
                confidence: parsed.confidence,
                isMultiQuery: false,
                message: await generateResponse({
                    type: messageType,
                    matchCount: matches.length,
                    location: locationName,
                    dateRange: dateRange
                }),
                parsed: {
                    teams: parsed.teams.any.map(t => ({ name: t.name, id: t._id })),
                    leagues: leaguesWithNames,
                    location: parsed.location,
                    dateRange: parsed.dateRange,
                    distance: parsed.distance
                },
                preSelectedFilters: {
                    country: parsed.location?.country || null,
                    leagues: leaguesWithNames.map(l => l.name),
                    teams: parsed.teams.any.map(t => t.name)
                },
                matches: matches,
                count: matches.length
            };
        }
        res.json(response);
    } catch (error) {
        console.error('Natural language search error:', error);
        // Return 200 with success: false so the client can show a friendly message.
        // Do not expose error.message to clients (may contain DB/API internals).
        res.status(200).json({
            success: false,
            code: 'INTERNAL',
            message: 'Something went wrong while searching. Please try again in a moment.',
            suggestions: [
                'Try a simpler query (e.g. "Premier League matches in London next month")',
                'Check your date range and location',
                'Try again in a few seconds'
            ]
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
/**
 * Match-only itinerary planner: fetch fixtures for a weekend window and return feasible match chains
 * under travel/time constraints (agent-style loop reserved for future widen steps).
 *
 * Body: city, country, ianaTimeZone, weekendAnchorLocalDate (YYYY-MM-DD), competitions[] (league API ids),
 * optional: minMatches, maxMatches, maxTravelMinutesBetweenMatches, fixedBufferMinutes, minutesPerKm,
 * maxLegsPerDay, radiusMiles. Season for API-Sports is derived from date + competitions.
 */
router.post('/plan-itinerary', async (req, res) => {
    try {
        const payload = await runPlanItinerary(req.body || {});
        const { _httpStatus: httpStatus, ...body } = payload;
        return res.status(httpStatus || 200).json(body);
    } catch (error) {
        console.error('Plan itinerary route error:', error);
        return res.status(200).json({
            success: false,
            code: 'INTERNAL',
            message: 'Could not build an itinerary. Please try again in a moment.'
        });
    }
});
module.exports = router;
// Export parser helpers for unit tests.
module.exports.parseNaturalLanguage = parseNaturalLanguage;
module.exports.buildSearchParameters = buildSearchParameters;
module.exports.extractLocation = extractLocation;
module.exports.inferLeagueIdsFromTeamDocs = inferLeagueIdsFromTeamDocs;
module.exports.resolveLeagueIdsFromTeams = resolveLeagueIdsFromTeams;
module.exports.determineSeasonForCompetitions = determineSeasonForCompetitions;
module.exports.resolveLeaguesFromQueryText = resolveLeaguesFromQueryText;
module.exports.runPlanItinerary = runPlanItinerary;
module.exports.detectPlanItineraryFromQuery = detectPlanItineraryFromQuery;
module.exports.weekendAnchorLocalDateFromRange = weekendAnchorLocalDateFromRange;
module.exports.describePlanItineraryOutcome = describePlanItineraryOutcome;