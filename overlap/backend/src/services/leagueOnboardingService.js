const mongoose = require('mongoose');
const axios = require('axios');
const https = require('https');
const Team = require('../models/Team');
const League = require('../models/League');
const Venue = require('../models/Venue');

// LocationIQ configuration for geocoding
const LOCATIONIQ_API_KEY = process.env.LOCATIONIQ_API_KEY;
const LOCATIONIQ_BASE_URL = 'https://us1.locationiq.com/v1';

// API-Sports configuration
const API_SPORTS_KEY = process.env.API_SPORTS_KEY || '0ab95ca9f7baeb6fd551af7ca41ed8d2';
const API_SPORTS_BASE_URL = 'https://v3.football.api-sports.io';

const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

// Current season year
const CURRENT_SEASON = new Date().getFullYear();
const SEASON = new Date().getMonth() >= 6 ? CURRENT_SEASON : CURRENT_SEASON - 1;

// Helper function to get country code from country name
function getCountryCode(countryName) {
    const mapping = {
        'England': 'GB',
        'Spain': 'ES',
        'Germany': 'DE',
        'France': 'FR',
        'Italy': 'IT',
        'Portugal': 'PT',
        'Netherlands': 'NL',
        'Belgium': 'BE',
        'Turkey': 'TR',
        'Scotland': 'GB',
        'Switzerland': 'CH',
        'USA': 'US',
        'United States': 'US',
        'Brazil': 'BR',
        'Mexico': 'MX',
        'Saudi Arabia': 'SA',
        'Japan': 'JP',
        'Europe': 'INT',
        'International': 'INT'
    };
    return mapping[countryName] || 'INT';
}

// Rate limiting helper
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Get short name for league
function getShortName(leagueName) {
    const mapping = {
        'Premier League': 'EPL',
        'La Liga': 'LL',
        'Bundesliga': 'BL1',
        'Serie A': 'SA',
        'Ligue 1': 'FL1',
        'Ligue 2': 'FL2',
        'Primeira Liga': 'PPL',
        'Eredivisie': 'DED',
        'Jupiler Pro League': 'JPL',
        'Süper Lig': 'TSL',
        'Scottish Premiership': 'SPL',
        'Swiss Super League': 'SSL',
        'Champions League': 'UCL',
        'Europa League': 'UEL',
        'Europa Conference League': 'UECL',
        'Major League Soccer': 'MLS',
        'Série A': 'BSA',
        'Liga MX': 'LMX',
        'Saudi Pro League': 'SPL',
        'J1 League': 'J1'
    };
    return mapping[leagueName] || leagueName.substring(0, 3).toUpperCase();
}

// Geocode address using LocationIQ
async function geocodeAddress(address, venueName, city, country) {
    if (!LOCATIONIQ_API_KEY) {
        return null;
    }

    try {
        let query = address || `${venueName}, ${city}, ${country}`;
        
        const response = await axios.get(`${LOCATIONIQ_BASE_URL}/search.php`, {
            params: {
                key: LOCATIONIQ_API_KEY,
                q: query,
                format: 'json',
                limit: 1
            },
            timeout: 5000
        });

        if (response.data && response.data[0]) {
            const result = response.data[0];
            return [parseFloat(result.lon), parseFloat(result.lat)];
        }
        
        return null;
    } catch (error) {
        return null;
    }
}

// Import/Update League
async function importLeague(leagueData) {
    try {
        const existingLeague = await League.findOne({ apiId: leagueData.id.toString() });
        
        const leagueDataToSave = {
            apiId: leagueData.id.toString(),
            name: leagueData.name,
            shortName: getShortName(leagueData.name),
            country: leagueData.country,
            countryCode: leagueData.countryCode || getCountryCode(leagueData.country),
            tier: leagueData.tier || 1,
            emblem: `https://media.api-sports.io/football/leagues/${leagueData.id}.png`,
            season: {
                start: SEASON >= 6 ? `${SEASON}-08-01` : `${SEASON - 1}-08-01`,
                end: SEASON >= 6 ? `${SEASON + 1}-05-31` : `${SEASON}-05-31`,
                current: true
            },
            isActive: true,
            lastUpdated: new Date()
        };

        if (existingLeague) {
            await League.updateOne({ apiId: leagueData.id.toString() }, leagueDataToSave);
            return { action: 'updated', league: existingLeague };
        } else {
            const newLeague = await League.create(leagueDataToSave);
            return { action: 'created', league: newLeague };
        }
    } catch (error) {
        return { action: 'error', error: error.message };
    }
}

// Import/Update Venue
async function importVenue(venueData, teamCountry, teamCountryCode) {
    try {
        if (!venueData || !venueData.id) {
            return null;
        }

        const existingVenue = await Venue.findOne({ venueId: venueData.id });
        
        let coordinates = null;
        let location = null;
        
        if (venueData.lat && venueData.lng) {
            coordinates = [parseFloat(venueData.lng), parseFloat(venueData.lat)];
            location = {
                type: 'Point',
                coordinates: coordinates
            };
        } else if (venueData.address || (venueData.name && venueData.city)) {
            coordinates = await geocodeAddress(
                venueData.address || null,
                venueData.name,
                venueData.city || '',
                venueData.country || teamCountry || ''
            );
            
            if (coordinates) {
                location = {
                    type: 'Point',
                    coordinates: coordinates
                };
                await delay(200);
            }
        }

        const venueToSave = {
            venueId: venueData.id,
            name: venueData.name,
            city: venueData.city || '',
            country: venueData.country || teamCountry || '',
            countryCode: venueData.countryCode || teamCountryCode || getCountryCode(venueData.country || teamCountry),
            address: venueData.address || '',
            capacity: venueData.capacity || null,
            surface: venueData.surface || null,
            image: venueData.image || null,
            coordinates: coordinates || undefined,
            location: location || undefined,
            isActive: true,
            lastUpdated: new Date()
        };

        if (existingVenue) {
            await Venue.updateOne({ venueId: venueData.id }, venueToSave);
            return { action: 'updated', venue: existingVenue, venueId: venueData.id };
        } else {
            const newVenue = await Venue.create(venueToSave);
            return { action: 'created', venue: newVenue, venueId: venueData.id };
        }
    } catch (error) {
        return null;
    }
}

// Import/Update Team
async function importTeam(teamData, leagueId, leagueName) {
    try {
        if (!teamData || !teamData.id) {
            return null;
        }

        const existingTeam = await Team.findOne({ apiId: teamData.id.toString() });
        
        let venueInfo = null;
        if (teamData.venue) {
            venueInfo = {
                name: teamData.venue.name || '',
                capacity: teamData.venue.capacity || null,
                coordinates: teamData.venue.lat && teamData.venue.lng 
                    ? [parseFloat(teamData.venue.lng), parseFloat(teamData.venue.lat)]
                    : null
            };
        }

        const leagueAssociation = {
            leagueId: leagueId,
            leagueName: leagueName,
            season: SEASON.toString(),
            isActive: true
        };

        const teamToSave = {
            apiId: teamData.id.toString(),
            name: teamData.name,
            code: teamData.code || null,
            founded: teamData.founded || null,
            logo: teamData.logo || null,
            country: teamData.country || '',
            city: teamData.venue?.city || '',
            venue: venueInfo,
            apiSource: 'api-sports',
            lastUpdated: new Date()
        };

        if (existingTeam) {
            const hasLeague = existingTeam.leagues.some(
                l => l.leagueId === leagueId && l.season === SEASON.toString()
            );
            
            if (!hasLeague) {
                existingTeam.leagues.push(leagueAssociation);
            }
            
            Object.assign(existingTeam, teamToSave);
            await existingTeam.save();
            return { action: 'updated', team: existingTeam };
        } else {
            teamToSave.leagues = [leagueAssociation];
            const newTeam = await Team.create(teamToSave);
            return { action: 'created', team: newTeam };
        }
    } catch (error) {
        return null;
    }
}

// Fetch teams for a league
async function fetchTeamsForLeague(leagueId, leagueName, season = SEASON) {
    try {
        const response = await axios.get(`${API_SPORTS_BASE_URL}/teams`, {
            params: {
                league: leagueId,
                season: season
            },
            headers: {
                'x-apisports-key': API_SPORTS_KEY
            },
            httpsAgent,
            timeout: 15000
        });

        if (!response.data || !response.data.response) {
            return [];
        }

        return response.data.response;
    } catch (error) {
        return [];
    }
}

// Main onboarding function
async function onboardLeague(leagueData, progressCallback = null) {
    const stats = {
        league: { created: 0, updated: 0, errors: 0 },
        teams: { created: 0, updated: 0, errors: 0 },
        venues: { created: 0, updated: 0, errors: 0 }
    };

    try {
        if (progressCallback) progressCallback({ step: 'league', message: 'Importing league...' });
        
        // Step 1: Import/Update League
        const leagueResult = await importLeague(leagueData);
        if (leagueResult.action === 'created') {
            stats.league.created++;
        } else if (leagueResult.action === 'updated') {
            stats.league.updated++;
        } else {
            stats.league.errors++;
            return { success: false, error: leagueResult.error, stats };
        }

        if (progressCallback) progressCallback({ step: 'teams', message: 'Fetching teams...' });
        
        // Step 2: Fetch teams
        const teamsData = await fetchTeamsForLeague(leagueData.id, leagueData.name);
        
        if (teamsData.length === 0) {
            return { success: true, stats, warning: 'No teams found for this league' };
        }

        if (progressCallback) progressCallback({ 
            step: 'processing', 
            message: `Processing ${teamsData.length} teams...`,
            total: teamsData.length,
            current: 0
        });

        // Step 3: Process each team
        const venueIds = new Set();
        
        for (let i = 0; i < teamsData.length; i++) {
            const teamResponse = teamsData[i];
            const team = teamResponse.team;
            const venue = teamResponse.venue;

            if (progressCallback) {
                progressCallback({ 
                    step: 'processing', 
                    message: `Processing team ${i + 1} of ${teamsData.length}: ${team.name}`,
                    total: teamsData.length,
                    current: i + 1
                });
            }

            // Import team
            const teamResult = await importTeam(team, leagueData.id.toString(), leagueData.name);
            if (teamResult) {
                if (teamResult.action === 'created') {
                    stats.teams.created++;
                } else if (teamResult.action === 'updated') {
                    stats.teams.updated++;
                }
            } else {
                stats.teams.errors++;
            }

            // Import venue if available and not already processed
            if (venue && venue.id && !venueIds.has(venue.id)) {
                venueIds.add(venue.id);
                
                const venueResult = await importVenue(
                    venue,
                    leagueData.country,
                    leagueData.countryCode || getCountryCode(leagueData.country)
                );
                
                if (venueResult) {
                    if (venueResult.action === 'created') {
                        stats.venues.created++;
                    } else if (venueResult.action === 'updated') {
                        stats.venues.updated++;
                    }
                } else {
                    stats.venues.errors++;
                }
            }

            // Rate limiting
            await delay(100);
        }

        return { success: true, stats };
    } catch (error) {
        return { success: false, error: error.message, stats };
    }
}

module.exports = {
    onboardLeague,
    getShortName
};

