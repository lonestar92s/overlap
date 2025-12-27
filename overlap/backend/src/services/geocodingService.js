const axios = require('axios');

class GeocodingService {
    constructor() {
        this.apiKey = process.env.LOCATIONIQ_API_KEY;
        this.baseURL = 'https://us1.locationiq.com/v1';
        this.cache = new Map();
        this.cacheStats = {
            hits: 0,
            misses: 0,
            totalRequests: 0
        };
        
        console.log(`🔑 GeocodingService initialized with API key: ${this.apiKey ? 'SET' : 'MISSING'}`);
        if (!this.apiKey) {
            console.error('❌ LOCATIONIQ_API_KEY environment variable is not loaded');
            console.error('Available env vars:', Object.keys(process.env).filter(key => key.includes('LOCATION')));
        }
    }

    /**
     * Geocode a venue using LocationIQ API
     * @param {string} venueName - Name of the venue
     * @param {string} city - City where venue is located
     * @param {string} country - Country where venue is located
     * @returns {Object|null} - Coordinates object with lat/lng or null if failed
     */
    async geocodeVenue(venueName, city = null, country = null) {
        if (!this.apiKey) {
            console.error('❌ LocationIQ API key not configured - set LOCATIONIQ_API_KEY environment variable');
            return null;
        }

        // Create cache key
        const cacheKey = `${venueName}|${city}|${country}`;
        
        // Check cache first
        if (this.cache.has(cacheKey)) {
            this.cacheStats.hits++;
            console.log(`🎯 Geocoding cache hit for: ${venueName}`);
            return this.cache.get(cacheKey);
        }

        this.cacheStats.misses++;
        this.cacheStats.totalRequests++;

        try {
            // Build search query
            let query = venueName;
            if (city) query += `, ${city}`;
            if (country) query += `, ${country}`;

       

            const response = await axios.get(`${this.baseURL}/search.php`, {
                params: {
                    key: this.apiKey,
                    q: query,
                    format: 'json',
                    limit: 1,
                    addressdetails: 1
                },
                timeout: 10000
            });

            if (response.data && response.data.length > 0) {
                const result = response.data[0];
                const coordinates = {
                    lat: parseFloat(result.lat),
                    lng: parseFloat(result.lon),
                    display_name: result.display_name,
                    confidence: result.importance || 0
                };


                
                // Cache the result
                this.cache.set(cacheKey, coordinates);
                
                return coordinates;
            } else {
                console.log(`⚠️ No geocoding results for: ${query}`);
                return null;
            }

        } catch (error) {
            console.error(`❌ Geocoding failed for "${query}":`, error.message);
            
            // Cache null result to avoid repeated failed attempts
            this.cache.set(cacheKey, null);
            
            return null;
        }
    }

    /**
     * Geocode a venue and return coordinates in the format expected by the database
     * @param {string} venueName - Name of the venue
     * @param {string} city - City where venue is located
     * @param {string} country - Country where venue is located
     * @returns {Array|null} - [longitude, latitude] array or null if failed
     */
    async geocodeVenueCoordinates(venueName, city = null, country = null) {
        const result = await this.geocodeVenue(venueName, city, country);
        
        if (result && result.lat && result.lng) {
            // Return in [longitude, latitude] format as expected by the database
            return [result.lng, result.lat];
        }
        
        return null;
    }

    /**
     * Batch geocode multiple venues in parallel
     * @param {Array<{name: string, city: string, country: string}>} venues - Array of venue objects
     * @returns {Promise<Map<string, number[]>>} - Map of "name|city|country" -> [longitude, latitude]
     */
    async batchGeocodeVenues(venues) {
        if (!venues || venues.length === 0) {
            return new Map();
        }

        if (!this.apiKey) {
            console.error('❌ LocationIQ API key not configured - cannot batch geocode');
            return new Map();
        }

        // Remove duplicates
        const uniqueVenues = [...new Map(
            venues
                .filter(v => v && v.name)
                .map(v => [`${v.name}|${v.city || ''}|${v.country || ''}`, v])
        ).values()];

        if (uniqueVenues.length === 0) {
            return new Map();
        }

        // Check cache first and separate cached vs uncached
        const cachedResults = new Map();
        const uncachedVenues = [];

        for (const venue of uniqueVenues) {
            const cacheKey = `${venue.name}|${venue.city || ''}|${venue.country || ''}`;
            if (this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                if (cached && cached.lat && cached.lng) {
                    cachedResults.set(cacheKey, [cached.lng, cached.lat]);
                    this.cacheStats.hits++;
                }
            } else {
                uncachedVenues.push({ venue, cacheKey });
            }
        }

        if (uncachedVenues.length === 0) {
            if (__DEV__) {
                console.log(`🎯 Batch geocoding: All ${uniqueVenues.length} venues found in cache`);
            }
            return cachedResults;
        }

        // Process uncached venues in parallel
        if (__DEV__) {
            console.log(`🔍 Batch geocoding: ${uncachedVenues.length} venues need API calls (${cachedResults.size} from cache)`);
        }

        const geocodePromises = uncachedVenues.map(async ({ venue, cacheKey }) => {
            try {
                const result = await this.geocodeVenue(venue.name, venue.city, venue.country);
                if (result && result.lat && result.lng) {
                    return { cacheKey, coords: [result.lng, result.lat] };
                }
                return { cacheKey, coords: null };
            } catch (error) {
                console.error(`❌ Batch geocoding failed for ${venue.name}:`, error.message);
                return { cacheKey, coords: null };
            }
        });

        // Wait for all geocoding requests to complete
        const results = await Promise.allSettled(geocodePromises);

        // Process results
        const geocodeMap = new Map(cachedResults);
        results.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value) {
                const { cacheKey, coords } = result.value;
                if (coords) {
                    geocodeMap.set(cacheKey, coords);
                }
            } else {
                const { cacheKey } = uncachedVenues[index];
                console.warn(`⚠️ Geocoding failed for cache key: ${cacheKey}`);
            }
        });

        if (__DEV__) {
            const successCount = Array.from(geocodeMap.values()).filter(v => v != null).length;
            console.log(`✅ Batch geocoding complete: ${successCount}/${uniqueVenues.length} venues geocoded successfully`);
        }

        return geocodeMap;
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            ...this.cacheStats,
            hitRate: this.cacheStats.totalRequests > 0 
                ? ((this.cacheStats.hits / this.cacheStats.totalRequests) * 100).toFixed(2) + '%'
                : '0%',
            cacheSize: this.cache.size
        };
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
        this.cacheStats.hits = 0;
        this.cacheStats.misses = 0;
        this.cacheStats.totalRequests = 0;
    }
}

module.exports = new GeocodingService();

