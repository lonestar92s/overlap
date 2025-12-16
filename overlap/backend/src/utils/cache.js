class Cache {
    constructor(ttl = 30 * 60 * 1000) { // Default TTL: 30 minutes
        this.cache = new Map();
        this.ttl = ttl;
    }

    set(key, value, customTtl = null) {
        this.cache.set(key, {
            data: value,
            timestamp: Date.now(),
            ttl: customTtl || this.ttl
        });
    }

    get(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;

        // Use custom TTL if set, otherwise use instance TTL
        const ttl = cached.ttl !== undefined ? cached.ttl : this.ttl;

        // Check if cache entry is expired
        if (Date.now() - cached.timestamp > ttl) {
            this.cache.delete(key);
            return null;
        }

        return cached.data;
    }

    clear() {
        this.cache.clear();
    }

    // Delete a specific key from the cache
    delete(key) {
        return this.cache.delete(key);
    }

    // Remove expired entries
    cleanup() {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            const ttl = value.ttl !== undefined ? value.ttl : this.ttl;
            if (now - value.timestamp > ttl) {
                this.cache.delete(key);
            }
        }
    }

    // Delete entries matching a pattern (supports wildcard * at end)
    deleteByPattern(pattern) {
        let deletedCount = 0;
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        
        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.cache.delete(key);
                deletedCount++;
            }
        }
        
        return deletedCount;
    }

    // Get cache statistics
    getStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}

// Create cache instances with different TTLs
const teamSearchCache = new Cache(30 * 60 * 1000);  // 30 minutes for team searches
const matchesCache = new Cache(60 * 60 * 1000);     // 1 hour for matches
const popularMatchesCache = new Cache(4 * 60 * 60 * 1000); // 4 hours for popular matches
const recommendedMatchesCache = new Cache(24 * 60 * 60 * 1000); // 24 hours (daily) for recommended matches

// Helper function to invalidate recommended matches cache for a user
function invalidateRecommendedMatchesCache(userId) {
    const pattern = `recommended_matches_${userId}_*`;
    return recommendedMatchesCache.deleteByPattern(pattern);
}

module.exports = {
    teamSearchCache,
    matchesCache,
    popularMatchesCache,
    recommendedMatchesCache,
    invalidateRecommendedMatchesCache
}; 