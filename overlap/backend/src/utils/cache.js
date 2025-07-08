class Cache {
    constructor(ttl = 30 * 60 * 1000) { // Default TTL: 30 minutes
        this.cache = new Map();
        this.ttl = ttl;
    }

    set(key, value) {
        this.cache.set(key, {
            data: value,
            timestamp: Date.now()
        });
    }

    get(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;

        // Check if cache entry is expired
        if (Date.now() - cached.timestamp > this.ttl) {
            this.cache.delete(key);
            return null;
        }

        return cached.data;
    }

    clear() {
        this.cache.clear();
    }

    // Remove expired entries
    cleanup() {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > this.ttl) {
                this.cache.delete(key);
            }
        }
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

module.exports = {
    teamSearchCache,
    matchesCache
}; 