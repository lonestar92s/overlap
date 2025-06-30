const League = require('../models/League');
const Team = require('../models/Team');
const Venue = require('../models/Venue');

class VenueService {
    constructor() {
        this.cache = new Map();
        this.cacheStats = {
            hits: 0,
            misses: 0,
            dbQueries: 0
        };
        
        // API team name to venue mapping for League One
        this.apiTeamToVenueMapping = {
            'Birmingham': 'St. Andrew\'s Stadium',
            'Blackpool': 'Bloomfield Road',
            'Bolton': 'Toughsheet Community Stadium',
            'Bristol Rovers': 'Memorial Stadium',
            'Burton Albion': 'Pirelli Stadium',
            'Cambridge United': 'Cledara Abbey Stadium',
            'Charlton': 'The Valley',
            'Crawley Town': 'The Recreation Ground',
            'Exeter City': 'St James Park',
            'Huddersfield': 'John Smith\'s Stadium',
            'Lincoln': 'LNER Stadium',
            'Mansfield Town': 'One Call Stadium',
            'Northampton': 'Sixfields Stadium',
            'Peterborough': 'London Road',
            'Plymouth Argyle': 'Home Park',
            'Portsmouth': 'Fratton Park',
            'Rotherham': 'AESSEAL New York Stadium',
            'Shrewsbury': 'The Croud Meadow',
            'Stockport County': 'Edgeley Park',
            'Stevenage': 'Broadhall Way',
            'Wycombe': 'Adams Park',
            'Leyton Orient': 'Brisbane Road',
            'Reading': 'Select Car Leasing Stadium',
            'Barnsley': 'Oakwell',
            'Wigan': 'The Brick Community Stadium',
            'Wrexham': 'Racecourse Ground'
        };
    }

    /**
     * Get venue by direct venue name lookup (new method for API-first approach)
     */
    async getVenueByName(venueName, city = null) {
        try {
            let query = { name: venueName };
            if (city) {
                query.city = city;
            }
            
            const venue = await Venue.findOne(query);
            
            if (venue && venue.location?.coordinates) {
                return {
                    stadium: venue.name,
                    name: venue.name,
                    city: venue.city,
                    country: venue.country,
                    coordinates: venue.location.coordinates,
                    capacity: venue.capacity,
                    surface: venue.surface
                };
            }
            
            return null;
        } catch (error) {
            console.error(`Error getting venue by name ${venueName}:`, error);
            return null;
        }
    }

    /**
     * Get venue information for a team by name (enhanced with API mapping)
     * @param {string} teamName - Name of the team (could be API name or full name)
     * @returns {Object|null} Venue information
     */
    async getVenueForTeam(teamName) {
        // Check cache first
        if (this.cache.has(teamName)) {
            this.cacheStats.hits++;
            return this.cache.get(teamName);
        }

        this.cacheStats.misses++;
        this.cacheStats.dbQueries++;

        try {
            // Method 1: Check if we have a direct API team to venue mapping
            const mappedVenueName = this.apiTeamToVenueMapping[teamName];
            if (mappedVenueName) {
                console.log(`🎯 API MAPPING: ${teamName} → ${mappedVenueName}`);
                const venue = await this.getVenueByName(mappedVenueName);
                if (venue) {
                    this.cache.set(teamName, venue);
                    return venue;
                }
            }

            // Method 2: Try to find team in database
            const team = await Team.findOne({ name: teamName })
                .populate('venueId')
                .populate('leagueId');

            if (!team || !team.venueId) {
                // Fallback to legacy venue data if exists
                const legacyVenue = team?.venue ? {
                    stadium: team.venue.name,
                    city: team.city,
                    country: team.country,
                    coordinates: team.venue.coordinates,
                    ticketUrl: null
                } : null;

                this.cache.set(teamName, legacyVenue);
                return legacyVenue;
            }

            // Get coordinates from venue data - handle both formats
            let coordinates = null;
            if (team.venueId.location?.coordinates && team.venueId.location.coordinates.length === 2) {
                coordinates = team.venueId.location.coordinates;
            } else if (team.venueId.coordinates && team.venueId.coordinates.length === 2) {
                coordinates = team.venueId.coordinates;
            } else if (team.venue?.coordinates && team.venue.coordinates.length === 2) {
                coordinates = team.venue.coordinates;
            }

            // Debug logging
            console.log(`🏟️ Venue data for ${teamName}:`, {
                name: team.venueId.name,
                coordinates: coordinates,
                source: coordinates ? (team.venueId.location ? 'GeoJSON' : 'Legacy') : 'None'
            });

            // Transform to expected format for backwards compatibility
            const venueInfo = {
                stadium: team.venueId.name,
                name: team.venueId.name,
                city: team.venueId.city,
                country: team.venueId.country,
                coordinates: coordinates,
                ticketUrl: team.venueId.ticketUrl,
                capacity: team.venueId.capacity,
                surface: team.venueId.surface,
                // Additional venue data
                venue: {
                    _id: team.venueId._id,
                    name: team.venueId.name,
                    address: team.venueId.address,
                    website: team.venueId.website,
                    publicTransport: team.venueId.publicTransport
                },
                team: {
                    _id: team._id,
                    name: team.name,
                    shortName: team.shortName,
                    logo: team.logo,
                    colors: team.colors
                },
                league: team.leagueId ? {
                    _id: team.leagueId._id,
                    name: team.leagueId.name,
                    shortName: team.leagueId.shortName,
                    country: team.leagueId.country
                } : null
            };

            // Cache the result
            this.cache.set(teamName, venueInfo);
            return venueInfo;

        } catch (error) {
            console.error(`Error getting venue for team ${teamName}:`, error);
            return null;
        }
    }

    /**
     * Find venues near a location
     * @param {number} longitude 
     * @param {number} latitude 
     * @param {number} maxDistance - in meters
     * @returns {Array} Array of venues
     */
    async findVenuesNear(longitude, latitude, maxDistance = 50000) {
        this.cacheStats.dbQueries++;

        try {
            const venues = await Venue.findNear(longitude, latitude, maxDistance)
                .populate('homeTeamId');

            return venues.map(venue => ({
                _id: venue._id,
                name: venue.name,
                city: venue.city,
                country: venue.country,
                coordinates: venue.location.coordinates,
                capacity: venue.capacity,
                homeTeam: venue.homeTeamId ? {
                    name: venue.homeTeamId.name,
                    logo: venue.homeTeamId.logo
                } : null,
                distance: this.calculateDistance(
                    latitude, longitude,
                    venue.location.coordinates[1], venue.location.coordinates[0]
                )
            }));

        } catch (error) {
            console.error('Error finding venues near location:', error);
            return [];
        }
    }

    /**
     * Get all venues in a specific country
     * @param {string} country - Country name
     * @returns {Array} Array of venues
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
     * @param {string} leagueApiId - API ID of the league
     * @returns {Array} Array of venues
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

// Create singleton instance
const venueService = new VenueService();

module.exports = venueService; 