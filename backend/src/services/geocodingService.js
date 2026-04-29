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
    async geocodeVenue(venueName, city = null, country = null, options = {}) {
        if (!this.apiKey) {
            console.error('❌ LocationIQ API key not configured - set LOCATIONIQ_API_KEY environment variable');
            return null;
        }
        const maxRetries = Number.isFinite(Number(options.maxRetries)) ? Number(options.maxRetries) : 3;
        const failFastOnRateLimit = options.failFastOnRateLimit === true;
        const logFailures = options.logFailures !== false;
        // Create cache key
        const cacheKey = `${venueName}|${city}|${country}`;
        // Check cache first
        if (this.cache.has(cacheKey)) {
            this.cacheStats.hits++;
            return this.cache.get(cacheKey);
        }
        this.cacheStats.misses++;
        this.cacheStats.totalRequests++;
        let query = venueName;
        if (city) query += `, ${city}`;
        if (country) query += `, ${country}`;
        let lastError;
        let rateLimited = false;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const response = await axios.get(`${this.baseURL}/search.php`, {
                    params: {
                        key: this.apiKey,
                        q: query,
                        format: 'json',
                        limit: 1,
                        addressdetails: 1
                    },
                    timeout: 10000,
                    validateStatus: (status) => status < 500
                });
                if (response.status === 429) {
                    rateLimited = true;
                    const retryAfter = parseInt(response.headers['retry-after'], 10) || 60;
                    if (!failFastOnRateLimit && attempt < maxRetries - 1) {
                        console.warn(`⚠️ Rate limited (429), waiting ${retryAfter}s before retry ${attempt + 2}/${maxRetries}...`);
                        await new Promise((r) => setTimeout(r, retryAfter * 1000));
                        continue;
                    }
                    lastError = new Error(`Rate limited (429) after ${maxRetries} retries`);
                    lastError.code = 'RATE_LIMITED';
                    break;
                }
                if (response.data && response.data.length > 0) {
                    const result = response.data[0];
                    const coordinates = {
                        lat: parseFloat(result.lat),
                        lng: parseFloat(result.lon),
                        display_name: result.display_name,
                        confidence: result.importance || 0
                    };
                    this.cache.set(cacheKey, coordinates);
                    return coordinates;
                }
                return null;
            } catch (error) {
                lastError = error;
                const status = error.response?.status;
                if (status === 429) {
                    rateLimited = true;
                    if (failFastOnRateLimit) {
                        lastError.code = 'RATE_LIMITED';
                        break;
                    }
                }
                if (status === 429 && attempt < maxRetries - 1) {
                    const retryAfter = parseInt(error.response?.headers?.['retry-after'], 10) || 60;
                    console.warn(`⚠️ Rate limited (429), waiting ${retryAfter}s before retry ${attempt + 2}/${maxRetries}...`);
                    await new Promise((r) => setTimeout(r, retryAfter * 1000));
                } else {
                    break;
                }
            }
        }
        if (logFailures) {
            console.error(`❌ Geocoding failed for "${query}":`, lastError?.message || lastError);
        }
        if (!rateLimited) {
            this.cache.set(cacheKey, null);
        }
        return null;
    }
    /**
     * Geocode a venue and return coordinates in the format expected by the database
     * @param {string} venueName - Name of the venue
     * @param {string} city - City where venue is located
     * @param {string} country - Country where venue is located
     * @returns {Array|null} - [longitude, latitude] array or null if failed
     */
    async geocodeVenueCoordinates(venueName, city = null, country = null, options = {}) {
        const result = await this.geocodeVenue(venueName, city, country, options);
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
    async batchGeocodeVenues(venues, options = {}) {
        if (!venues || venues.length === 0) {
            return options.includeMetadata ? {
                results: new Map(),
                metadata: {
                    totalCandidates: 0,
                    cachedCount: 0,
                    uncachedCount: 0,
                    attemptedCount: 0,
                    executionMode: 'none',
                    concurrency: 0,
                    minIntervalMs: 0
                }
            } : new Map();
        }
        if (!this.apiKey) {
            console.error('❌ LocationIQ API key not configured - cannot batch geocode');
            return options.includeMetadata ? {
                results: new Map(),
                metadata: {
                    totalCandidates: venues.length,
                    cachedCount: 0,
                    uncachedCount: 0,
                    attemptedCount: 0,
                    executionMode: 'disabled',
                    concurrency: 0,
                    minIntervalMs: 0
                }
            } : new Map();
        }
        // Remove duplicates
        const uniqueVenues = [...new Map(
            venues
                .filter(v => v && v.name)
                .map(v => [`${v.name}|${v.city || ''}|${v.country || ''}`, v])
        ).values()];
        if (uniqueVenues.length === 0) {
            return options.includeMetadata ? {
                results: new Map(),
                metadata: {
                    totalCandidates: 0,
                    cachedCount: 0,
                    uncachedCount: 0,
                    attemptedCount: 0,
                    executionMode: 'none',
                    concurrency: 0,
                    minIntervalMs: 0
                }
            } : new Map();
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
            if (process.env.NODE_ENV !== 'production') {
            }
            return options.includeMetadata ? {
                results: cachedResults,
                metadata: {
                    totalCandidates: uniqueVenues.length,
                    cachedCount: cachedResults.size,
                    uncachedCount: 0,
                    attemptedCount: 0,
                    executionMode: 'cache-only',
                    concurrency: 0,
                    minIntervalMs: 0
                }
            } : cachedResults;
        }
        const minIntervalMs = Math.max(0, Number(options.minIntervalMs) || 0);
        const requestedConcurrency = Math.max(1, Number(options.concurrency) || uncachedVenues.length);
        const workerCount = Math.min(requestedConcurrency, uncachedVenues.length);
        const runSequentially = workerCount === 1 || minIntervalMs > 0;
        const buildResult = (results, metadata) => options.includeMetadata
            ? { results, metadata }
            : results;
        // Process uncached venues in parallel
        if (process.env.NODE_ENV !== 'production') {
        }
        if (runSequentially) {
            const geocodeMap = new Map(cachedResults);
            for (let index = 0; index < uncachedVenues.length; index++) {
                const { venue, cacheKey } = uncachedVenues[index];
                try {
                    const result = await this.geocodeVenue(venue.name, venue.city, venue.country, options);
                    if (result && result.lat && result.lng) {
                        geocodeMap.set(cacheKey, [result.lng, result.lat]);
                    }
                } catch (error) {
                    console.error(`❌ Batch geocoding failed for ${venue.name}:`, error.message);
                }
                if (minIntervalMs > 0 && index < uncachedVenues.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, minIntervalMs));
                }
            }
            return buildResult(geocodeMap, {
                totalCandidates: uniqueVenues.length,
                cachedCount: cachedResults.size,
                uncachedCount: uncachedVenues.length,
                attemptedCount: uncachedVenues.length,
                executionMode: 'sequential',
                concurrency: 1,
                minIntervalMs
            });
        }
        const results = new Array(uncachedVenues.length);
        let nextIndex = 0;
        const worker = async () => {
            while (nextIndex < uncachedVenues.length) {
                const currentIndex = nextIndex++;
                const { venue, cacheKey } = uncachedVenues[currentIndex];
                try {
                    const result = await this.geocodeVenue(venue.name, venue.city, venue.country, options);
                    if (result && result.lat && result.lng) {
                        results[currentIndex] = { status: 'fulfilled', value: { cacheKey, coords: [result.lng, result.lat] } };
                    } else {
                        results[currentIndex] = { status: 'fulfilled', value: { cacheKey, coords: null } };
                    }
                } catch (error) {
                    console.error(`❌ Batch geocoding failed for ${venue.name}:`, error.message);
                    results[currentIndex] = { status: 'rejected', reason: error };
                }
            }
        };
        await Promise.all(Array.from({ length: workerCount }, () => worker()));
        // Process results
        const geocodeMap = new Map(cachedResults);
        results.forEach((result, index) => {
            if (result && result.status === 'fulfilled' && result.value) {
                const { cacheKey, coords } = result.value;
                if (coords) {
                    geocodeMap.set(cacheKey, coords);
                }
            } else {
                const { cacheKey } = uncachedVenues[index];
                console.warn(`⚠️ Geocoding failed for cache key: ${cacheKey}`);
            }
        });
        if (process.env.NODE_ENV !== 'production') {
            const successCount = Array.from(geocodeMap.values()).filter(v => v != null).length;
        }
        return buildResult(geocodeMap, {
            totalCandidates: uniqueVenues.length,
            cachedCount: cachedResults.size,
            uncachedCount: uncachedVenues.length,
            attemptedCount: uncachedVenues.length,
            executionMode: 'parallel',
            concurrency: workerCount,
            minIntervalMs
        });
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
