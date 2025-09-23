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
        
        // Manual overrides for venues with known geocoding issues
        this.manualOverrides = new Map([
            ['The Cherry Red Records Stadium', {
                lat: 51.43139,
                lng: -0.18667,
                display_name: 'The Cherry Red Records Stadium, London, England',
                confidence: 1.0
            }]
        ]);
        
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
        // Create cache key
        const cacheKey = `${venueName}|${city}|${country}`;
        
        // Check cache first
        if (this.cache.has(cacheKey)) {
            this.cacheStats.hits++;
            console.log(`🎯 Geocoding cache hit for: ${venueName}`);
            return this.cache.get(cacheKey);
        }

        // Check for manual overrides first (before API key check)
        if (this.manualOverrides.has(venueName)) {
            console.log(`🎯 Using manual override for: ${venueName}`);
            const override = this.manualOverrides.get(venueName);
            this.cache.set(cacheKey, override);
            return override;
        }

        if (!this.apiKey) {
            console.error('❌ LocationIQ API key not configured - set LOCATIONIQ_API_KEY environment variable');
            return null;
        }

        this.cacheStats.misses++;
        this.cacheStats.totalRequests++;

        // Build search query
        let query = venueName;
        if (city) query += `, ${city}`;
        if (country) query += `, ${country}`;

        try {
            console.log(`🔍 Geocoding query: "${query}"`);

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

                console.log(`✅ Geocoding success for "${query}":`, coordinates);
                
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

