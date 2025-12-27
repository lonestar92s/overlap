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
        
                return null;
            }


            
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
            

            
            // Try multiple search strategies
            let venue = null;
            
            // Strategy 1: Exact match with name and city if provided
            const exactMatchQuery = city 
                ? { name: venueName, city: city }
                : { name: venueName };
            
            venue = await Venue.findOne(exactMatchQuery);
            
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
                
                venue = await Venue.findOne(caseInsensitiveQuery);
            }

            // Strategy 3: Search by aliases
            if (!venue) {
                const escapeRegex = (string) => {
                    return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                };
                
                const aliasQuery = {
                    aliases: { $regex: new RegExp(`^${escapeRegex(venueName)}$`, 'i') }
                };
                if (city) {
                    aliasQuery.city = { $regex: new RegExp(`^${escapeRegex(city)}$`, 'i') };
                }
                
                venue = await Venue.findOne(aliasQuery);
            }
            
            // Strategy 4: Normalized search (fallback)
            if (!venue) {
                const allVenues = await Venue.find({});
                venue = allVenues.find(v => {
                    const venueNameMatch = normalizeString(v.name) === normalizedVenueName;
                    if (!normalizedCity) return venueNameMatch;
                    return venueNameMatch && normalizeString(v.city) === normalizedCity;
                });
            }
            
            // Strategy 5: If we found a venue but it has invalid coordinates, try to find another with valid coordinates
            if (venue) {
                const venueCoords = venue.location?.coordinates || venue.coordinates;
                if (venueCoords && !this.isWithinCountryBounds(venueCoords, venue.country)) {
                    // Found venue but coordinates are wrong - try to find another with same name
                    console.warn(`⚠️ Found venue ${venue.name} but coordinates [${venueCoords[0]}, ${venueCoords[1]}] are outside ${venue.country} bounds`);
                    
                    // Try to find another venue with same name and valid coordinates
                    const allVenues = await Venue.find({});
                    const validVenue = allVenues.find(v => {
                        const venueNameMatch = normalizeString(v.name) === normalizedVenueName;
                        if (!venueNameMatch) return false;
                        
                        const coords = v.location?.coordinates || v.coordinates;
                        if (!coords) return false;
                        
                        // Prefer venue with valid coordinates for its country
                        return this.isWithinCountryBounds(coords, v.country);
                    });
                    
                    if (validVenue) {
                        console.log(`✅ Found alternative venue ${validVenue.name} with valid coordinates`);
                        venue = validVenue;
                    }
                }
            }
            
            if (!venue) {
                return null;
            }
            
            // Get coordinates from either location.coordinates (preferred) or coordinates field
            let coordinates = venue.location?.coordinates || venue.coordinates;
            
            // Validate coordinates are in reasonable format [lon, lat]
            if (coordinates && Array.isArray(coordinates) && coordinates.length === 2) {
                const [lon, lat] = coordinates;
                // Basic validation: coordinates should be within valid ranges
                if (typeof lon === 'number' && typeof lat === 'number' &&
                    lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90) {
                    // Additional validation: coordinates should be within country bounds
                    if (this.isWithinCountryBounds(coordinates, venue.country)) {
                        return {
                            stadium: venue.name,
                            name: venue.name,
                            city: venue.city,
                            country: venue.country,
                            coordinates: coordinates,
                            capacity: venue.capacity
                        };
                    } else {
                        console.warn(`⚠️ Coordinates for venue ${venue.name} are outside ${venue.country} bounds: [${lon}, ${lat}]`);
                    }
                } else {
                    console.warn(`⚠️ Invalid coordinates for venue ${venue.name}: [${lon}, ${lat}]`);
                }
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

        
        // Check cache first
        if (this.cache.has(teamName)) {
            this.cacheStats.hits++;

            return this.cache.get(teamName);
        }

        this.cacheStats.misses++;
        this.cacheStats.dbQueries++;

        try {
            // Try to find team in database

            
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

                this.cache.set(teamName, null);
                return null;
            }



            // Use venue data directly from the team
            if (team.venue?.coordinates) {

                const venue = {
                    stadium: team.venue.name,
                    name: team.venue.name,
                    city: team.venue.city,
                    country: team.country,
                    coordinates: team.venue.coordinates,
                    capacity: team.venue.capacity
                };

                this.cache.set(teamName, venue);
                return venue;
            }


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

    }

    /**
     * Warm up cache with popular teams
     */
    async warmUpCache(teamNames = []) {

        
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


        return warmed;
    }

    /**
     * Get venue by API-Football venue ID
     */
    async getVenueByApiId(venueId) {
        try {

            const venue = await Venue.findOne({ venueId: venueId, isActive: true });

            return venue;
        } catch (error) {
            console.error('Error getting venue by API ID:', error);
            return null;
        }
    }

    /**
     * Batch get venues by API IDs (optimized for processing multiple matches)
     * @param {number[]} venueIds - Array of venue IDs to fetch
     * @returns {Promise<Map<number, Venue>>} - Map of venueId -> Venue object
     */
    async batchGetVenuesById(venueIds) {
        try {
            if (!venueIds || venueIds.length === 0) {
                return new Map();
            }

            // Remove duplicates
            const uniqueIds = [...new Set(venueIds.filter(id => id != null))];
            
            if (uniqueIds.length === 0) {
                return new Map();
            }

            this.cacheStats.dbQueries++;
            
            // Single batch query
            const venues = await Venue.find({ 
                venueId: { $in: uniqueIds },
                isActive: true 
            });

            // Create Map for O(1) lookups
            const venueMap = new Map();
            venues.forEach(venue => {
                if (venue.venueId != null) {
                    venueMap.set(venue.venueId, venue);
                }
            });

            if (process.env.NODE_ENV !== 'production') {
                console.log(`📦 Batch fetched ${venues.length} venues from ${uniqueIds.length} unique IDs`);
            }

            return venueMap;
        } catch (error) {
            console.error('Error batch getting venues by API ID:', error);
            // Return empty Map on error (graceful degradation)
            return new Map();
        }
    }

    /**
     * Batch get venues by name and city (optimized for processing multiple matches)
     * @param {Array<{name: string, city: string}>} venueNames - Array of {name, city} objects
     * @returns {Promise<Map<string, Venue>>} - Map of "name|city" -> Venue object
     */
    async batchGetVenuesByName(venueNames) {
        try {
            if (!venueNames || venueNames.length === 0) {
                return new Map();
            }

            // Remove duplicates and filter out invalid entries
            const uniqueNames = [...new Map(
                venueNames
                    .filter(v => v && v.name)
                    .map(v => [`${v.name}|${v.city || ''}`, v])
            ).values()];

            if (uniqueNames.length === 0) {
                return new Map();
            }

            this.cacheStats.dbQueries++;

            // Build $or query for all name/city combinations
            const escapeRegex = (string) => {
                if (!string) return '';
                return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            };

            const orQueries = uniqueNames.map(({ name, city }) => {
                const query = {
                    name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') }
                };
                if (city) {
                    query.city = { $regex: new RegExp(`^${escapeRegex(city)}$`, 'i') };
                }
                return query;
            });

            // Single batch query
            const venues = await Venue.find({ $or: orQueries });

            // Create Map keyed by "name|city" for O(1) lookups
            const venueMap = new Map();
            venues.forEach(venue => {
                const key = `${venue.name}|${venue.city || ''}`;
                venueMap.set(key, venue);
            });

            if (process.env.NODE_ENV !== 'production') {
                console.log(`📦 Batch fetched ${venues.length} venues from ${uniqueNames.length} unique name/city combinations`);
            }

            return venueMap;
        } catch (error) {
            console.error('Error batch getting venues by name:', error);
            // Return empty Map on error (graceful degradation)
            return new Map();
        }
    }

    /**
     * Validate coordinates are within country bounds
     * @param {Array} coordinates - [longitude, latitude] array
     * @param {string} country - Country name
     * @returns {boolean} - True if coordinates are valid for the country
     */
    isWithinCountryBounds(coordinates, country) {
        if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
            return false;
        }
        
        const [lon, lat] = coordinates;
        if (typeof lon !== 'number' || typeof lat !== 'number' ||
            lon < -180 || lon > 180 || lat < -90 || lat > 90) {
            return false;
        }
        
        // Country bounds for validation
        const COUNTRY_BOUNDS = {
            'England': { minLat: 50.0, maxLat: 55.8, minLng: -6.0, maxLng: 2.0 },
            'Germany': { minLat: 47.0, maxLat: 55.0, minLng: 5.0, maxLng: 15.0 },
            'France': { minLat: 41.0, maxLat: 51.0, minLng: -5.0, maxLng: 10.0 },
            'Spain': { minLat: 36.0, maxLat: 44.0, minLng: -10.0, maxLng: 4.0 },
            'Italy': { minLat: 36.0, maxLat: 47.0, minLng: 6.0, maxLng: 19.0 },
            'Netherlands': { minLat: 50.7, maxLat: 53.7, minLng: 3.0, maxLng: 7.3 },
            'Portugal': { minLat: 36.9, maxLat: 42.2, minLng: -9.5, maxLng: -6.2 },
            'Belgium': { minLat: 49.5, maxLat: 51.5, minLng: 2.5, maxLng: 6.4 },
            'Scotland': { minLat: 54.6, maxLat: 60.9, minLng: -8.6, maxLng: -0.7 },
            'Mexico': { minLat: 14.5, maxLat: 32.7, minLng: -118.4, maxLng: -86.7 },
            'USA': { minLat: 24.5, maxLat: 49.4, minLng: -125.0, maxLng: -66.9 }
        };
        
        const bounds = COUNTRY_BOUNDS[country];
        if (!bounds) {
            // Country not in our bounds list - allow it (could be a new country)
            return true;
        }
        
        return lat >= bounds.minLat && lat <= bounds.maxLat &&
               lon >= bounds.minLng && lon <= bounds.maxLng;
    }

    /**
     * Save or update venue with coordinates
     * @param {Object} venueData - Venue data including coordinates
     * @returns {Object|null} - Saved venue object or null if failed
     */
    async saveVenueWithCoordinates(venueData) {
        try {
            const { venueId, name, city, country, coordinates, capacity, surface, image, address } = venueData;
            
            if (!name || !city || !country) {
                console.warn(`⚠️ Missing required venue data: name=${name}, city=${city}, country=${country}`);
                return null;
            }
            
            // Validate coordinates are within country bounds before saving
            if (coordinates && !this.isWithinCountryBounds(coordinates, country)) {
                const [lon, lat] = coordinates;
                console.error(`❌ Rejecting coordinates for ${name}, ${city}, ${country}: [${lon}, ${lat}] are outside country bounds`);
                return null;
            }

            // Check if venue already exists
            let existingVenue = null;
            if (venueId) {
                existingVenue = await Venue.findOne({ venueId: venueId });
            }
            
            if (!existingVenue) {
                // Try to find by name and city
                existingVenue = await Venue.findOne({ 
                    name: name,
                    city: city 
                });
            }

            let venue;
            if (existingVenue) {
                // Update existing venue with new coordinates if they don't exist OR if existing coordinates are wrong
                const existingCoords = existingVenue.coordinates || existingVenue.location?.coordinates;
                const hasValidExistingCoords = existingCoords && this.isWithinCountryBounds(existingCoords, country);
                
                if (coordinates && (!existingCoords || !hasValidExistingCoords)) {
                    // Only update if no coordinates exist, or existing coordinates are invalid
                    existingVenue.coordinates = coordinates;
                    existingVenue.location = {
                        type: 'Point',
                        coordinates: coordinates
                    };
                    existingVenue.lastUpdated = new Date();
                    
                    if (capacity) existingVenue.capacity = capacity;
                    if (surface) existingVenue.surface = surface;
                    if (image) existingVenue.image = image;
                    if (address) existingVenue.address = address;
                    
                    await existingVenue.save();
                    console.log(`✅ Updated existing venue with coordinates: ${name} → [${coordinates[0]}, ${coordinates[1]}]`);
                } else if (coordinates && hasValidExistingCoords) {
                    // Existing coordinates are valid, keep them
                    console.log(`ℹ️ Keeping existing valid coordinates for ${name}: [${existingCoords[0]}, ${existingCoords[1]}]`);
                }
                venue = existingVenue;
            } else {
                // Create new venue
                const newVenue = new Venue({
                    venueId: venueId || null,
                    name,
                    city,
                    country,
                    countryCode: this.getCountryCode(country),
                    coordinates: coordinates || null,
                    location: coordinates ? {
                        type: 'Point',
                        coordinates: coordinates
                    } : null,
                    capacity: capacity || null,
                    surface: surface || null,
                    image: image || null,
                    address: address || null,
                    isActive: true
                });
                
                venue = await newVenue.save();
                console.log(`✅ Created new venue with coordinates: ${name} → [${coordinates ? coordinates.join(', ') : 'none'}]`);
            }

            return venue;
        } catch (error) {

            return null;
        }
    }

    /**
     * Get country code from country name (simple mapping)
     * @param {string} countryName - Full country name
     * @returns {string} - 2-letter country code
     */
    getCountryCode(countryName) {
        const countryMap = {
            'England': 'GB',
            'Spain': 'ES',
            'Italy': 'IT',
            'Germany': 'DE',
            'France': 'FR',
            'Portugal': 'PT',
            'Netherlands': 'NL',
            'Belgium': 'BE',
            'Turkey': 'TR',
            'Saudi Arabia': 'SA',
            'USA': 'US',
            'Brazil': 'BR',
            'Mexico': 'MX',
            'Scotland': 'GB'
        };
        
        return countryMap[countryName] || 'XX';
    }
}

module.exports = new VenueService();