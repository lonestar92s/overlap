const League = require('../models/League');
const Team = require('../models/Team');
const Venue = require('../models/Venue');
const axios = require('axios');

// API-Sports configuration
const API_SPORTS_KEY = process.env.API_SPORTS_KEY || '0ab95ca9f7baeb6fd551af7ca41ed8d2';
const API_SPORTS_BASE_URL = 'https://v3.football.api-sports.io';

class VenueService {
    constructor() {
        this.cache = new Map();
        this.cacheStats = {
            hits: 0,
            misses: 0,
            dbQueries: 0
        };
    }

    /**
     * Get venue by direct venue name lookup
     */
    async getVenueByName(venueName, city = null) {
        try {
            if (!venueName) {
                console.log('❌ No venue name provided');
                return null;
            }

            console.log(`\n🔍 Looking up venue by name:`, {
                venueName,
                city,
                includeCity: !!city
            });
            
            // Normalize venue name and city
            const normalizeString = (str) => {
                if (!str) return '';
                return str.toLowerCase()
                    .replace(/\s+/g, ' ')  // normalize spaces
                    .replace(/^the\s+/, '') // remove 'the' prefix
                    .replace(/\s*@.*$/, '') // remove anything after @
                    .replace(/[.,'"]/g, '') // remove punctuation
                    .trim();
            };

            const normalizedVenueName = normalizeString(venueName);
            const normalizedCity = city ? normalizeString(city.split(',')[0]) : null;
            
            console.log('🔍 Normalized search:', {
                venueName: normalizedVenueName,
                city: normalizedCity
            });
            
            // Try multiple search strategies
            let venue = null;
            
            // Strategy 1: Exact match with name and city if provided
            const exactMatchQuery = city 
                ? { name: venueName, city: city }
                : { name: venueName };
            
            console.log('🔍 Exact match query:', exactMatchQuery);
            venue = await Venue.findOne(exactMatchQuery);
            
            if (venue) {
                console.log('✅ Found venue by exact match');
            } else {
                console.log('❌ Venue not found by exact match');
            }
            
            // Strategy 2: Case-insensitive match with name and city if provided
            if (!venue) {
                const escapeRegex = (string) => {
                    return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                };

                const caseInsensitiveQuery = {
                    name: { $regex: new RegExp(`^${escapeRegex(venueName)}$`, 'i') }
                };
                if (city) {
                    caseInsensitiveQuery.city = { $regex: new RegExp(`^${escapeRegex(city)}$`, 'i') };
                }
                
                console.log('🔍 Case-insensitive query:', caseInsensitiveQuery);
                venue = await Venue.findOne(caseInsensitiveQuery);
                
                if (venue) {
                    console.log('✅ Found venue by case-insensitive match');
                } else {
                    console.log('❌ Venue not found with case-insensitive match');
                }
            }
            
            // Strategy 3: Normalized search (fallback)
            if (!venue) {
                const allVenues = await Venue.find({});
                venue = allVenues.find(v => {
                    const venueNameMatch = normalizeString(v.name) === normalizedVenueName;
                    if (!normalizedCity) return venueNameMatch;
                    return venueNameMatch && normalizeString(v.city) === normalizedCity;
                });
                
                if (venue) {
                    console.log('✅ Found venue by normalized search');
                } else {
                    console.log('❌ No venue found in database');
                }
            }
            
            if (!venue) {
                return null;
            }
            
            console.log('✅ Found venue:', {
                name: venue.name,
                city: venue.city,
                hasCoordinates: !!venue.location?.coordinates,
                coordinates: venue.location?.coordinates
            });
            
            if (venue && venue.location?.coordinates) {
                return {
                    stadium: venue.name,
                    name: venue.name,
                    city: venue.city,
                    country: venue.country,
                    coordinates: venue.location.coordinates,
                    capacity: venue.capacity
                };
            }
            
            return null;
        } catch (error) {
            console.error(`Error getting venue by name ${venueName}:`, error);
            return null;
        }
    }

    /**
     * Get venue information for a team by name
     */
    async getVenueForTeam(teamName) {
        console.log(`\n🔍 getVenueForTeam called for: "${teamName}"`);
        
        // Check cache first
        if (this.cache.has(teamName)) {
            this.cacheStats.hits++;
            console.log(`✅ Cache hit for "${teamName}"`);
            return this.cache.get(teamName);
        }

        this.cacheStats.misses++;
        this.cacheStats.dbQueries++;

        try {
            // Try to find team in database
            console.log(`🔍 Looking up team in database: "${teamName}"`);
            console.log('🔍 Using query:', { 
                $or: [
                    { name: teamName },
                    { name: { $regex: new RegExp(`^${teamName}$`, 'i') } },
                    { apiName: teamName },
                    { apiName: { $regex: new RegExp(`^${teamName}$`, 'i') } },
                    { aliases: teamName },
                    { aliases: { $regex: new RegExp(`^${teamName}$`, 'i') } }
                ]
            });
            
            const team = await Team.findOne({ 
                $or: [
                    { name: teamName },
                    { name: { $regex: new RegExp(`^${teamName}$`, 'i') } },
                    { apiName: teamName },
                    { apiName: { $regex: new RegExp(`^${teamName}$`, 'i') } },
                    { aliases: teamName },
                    { aliases: { $regex: new RegExp(`^${teamName}$`, 'i') } }
                ]
            });

            if (!team) {
                console.log(`❌ No team found for: "${teamName}" (checked name, apiName, and aliases)`);
                this.cache.set(teamName, null);
                return null;
            }

            console.log(`✅ Found team:`, {
                name: team.name,
                apiName: team.apiName,
                aliases: team.aliases,
                hasVenue: !!team.venue,
                hasVenueCoordinates: !!team.venue?.coordinates,
                venueDetails: team.venue ? {
                    name: team.venue.name,
                    city: team.venue.city,
                    coordinates: team.venue.coordinates
                } : null
            });

            // Use venue data directly from the team
            if (team.venue?.coordinates) {
                console.log(`✅ Found venue with coordinates:`, team.venue.coordinates);
                const venue = {
                    stadium: team.venue.name,
                    name: team.venue.name,
                    city: team.venue.city,
                    country: team.country,
                    coordinates: team.venue.coordinates,
                    capacity: team.venue.capacity
                };
                console.log('✅ Returning venue data:', venue);
                this.cache.set(teamName, venue);
                return venue;
            }

            console.log(`❌ No venue found for team: ${teamName}`);
            this.cache.set(teamName, null);
            return null;

        } catch (error) {
            console.error(`Error getting venue for team ${teamName}:`, error);
            return null;
        }
    }

    /**
     * Find venues near a location
     */
    async findVenuesNear(longitude, latitude, maxDistance = 50000) {
        this.cacheStats.dbQueries++;

        try {
            const venues = await Venue.find({
                location: {
                    $near: {
                        $geometry: {
                            type: "Point",
                            coordinates: [longitude, latitude]
                        },
                        $maxDistance: maxDistance
                    }
                }
            }).populate('homeTeamId');

            return venues.map(venue => ({
                _id: venue._id,
                name: venue.name,
                city: venue.city,
                country: venue.country,
                coordinates: venue.location.coordinates,
                distance: this.calculateDistance(
                    latitude,
                    longitude,
                    venue.location.coordinates[1],
                    venue.location.coordinates[0]
                ),
                capacity: venue.capacity,
                homeTeam: venue.homeTeamId ? {
                    name: venue.homeTeamId.name,
                    logo: venue.homeTeamId.logo
                } : null
            }));

        } catch (error) {
            console.error(`Error finding venues near [${longitude}, ${latitude}]:`, error);
            return [];
        }
    }

    /**
     * Get all venues in a specific country
     */
    async getVenuesByCountry(country) {
        this.cacheStats.dbQueries++;

        try {
            const venues = await Venue.find({ country })
                .populate('homeTeamId')
                .sort({ city: 1, name: 1 });

            return venues.map(venue => ({
                _id: venue._id,
                name: venue.name,
                city: venue.city,
                coordinates: venue.location.coordinates,
                capacity: venue.capacity,
                homeTeam: venue.homeTeamId ? {
                    name: venue.homeTeamId.name,
                    logo: venue.homeTeamId.logo
                } : null
            }));

        } catch (error) {
            console.error(`Error getting venues for country ${country}:`, error);
            return [];
        }
    }

    /**
     * Get venues by league
     */
    async getVenuesByLeague(leagueApiId) {
        this.cacheStats.dbQueries++;

        try {
            const league = await League.findOne({ apiId: leagueApiId });
            if (!league) return [];

            const teams = await Team.find({ leagueId: league._id })
                .populate('venueId');

            return teams
                .filter(team => team.venueId)
                .map(team => ({
                    _id: team.venueId._id,
                    name: team.venueId.name,
                    city: team.venueId.city,
                    country: team.venueId.country,
                    coordinates: team.venueId.location.coordinates,
                    capacity: team.venueId.capacity,
                    homeTeam: {
                        name: team.name,
                        logo: team.logo
                    }
                }));

        } catch (error) {
            console.error(`Error getting venues for league ${leagueApiId}:`, error);
            return [];
        }
    }

    /**
     * Calculate distance between two points
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return Math.round(R * c * 100) / 100; // Round to 2 decimal places
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            ...this.cacheStats,
            totalRequests: this.cacheStats.hits + this.cacheStats.misses,
            hitRate: this.cacheStats.hits + this.cacheStats.misses > 0 
                ? ((this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses)) * 100).toFixed(2) + '%'
                : '0%',
            cacheSize: this.cache.size
        };
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
        console.log('🗑️  Venue service cache cleared');
    }

    /**
     * Warm up cache with popular teams
     */
    async warmUpCache(teamNames = []) {
        console.log('🔥 Warming up venue cache...');
        
        if (teamNames.length === 0) {
            // Get popular teams if no specific teams provided
            const popularTeams = await Team.find({})
                .sort({ searchCount: -1, popularity: -1 })
                .limit(50)
                .select('name');
            teamNames = popularTeams.map(t => t.name);
        }

        let warmed = 0;
        for (const teamName of teamNames) {
            await this.getVenueForTeam(teamName);
            warmed++;
        }

        console.log(`✅ Warmed up cache with ${warmed} teams`);
        return warmed;
    }
}

module.exports = new VenueService();