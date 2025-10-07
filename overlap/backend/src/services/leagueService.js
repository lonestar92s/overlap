const League = require('../models/League');

class LeagueService {
    constructor() {
        this.cache = new Map(); // In-memory cache for frequently accessed leagues
        this.cacheExpiry = 60 * 60 * 1000; // 1 hour cache
        
        // API-first fallback mappings for leagues not in database
        this.apiLeagueMappings = {
            '98': { name: 'J1 League', country: 'Japan' },
            '99': { name: 'J2 League', country: 'Japan' },
            '100': { name: 'J3 League', country: 'Japan' },
            '144': { name: 'Belgian Pro League', country: 'Belgium' },
            '253': { name: 'Major League Soccer', country: 'USA' },
            '71': { name: 'Série A', country: 'Brazil' },
            '39': { name: 'Premier League', country: 'England' },
            '40': { name: 'Championship', country: 'England' },
            '41': { name: 'League One', country: 'England' },
            '140': { name: 'La Liga', country: 'Spain' },
            '78': { name: 'Bundesliga', country: 'Germany' },
            '79': { name: 'Bundesliga 2', country: 'Germany' },
            '135': { name: 'Serie A', country: 'Italy' },
            '61': { name: 'Ligue 1', country: 'France' },
            '2': { name: 'Champions League', country: 'Europe' },
            '3': { name: 'Europa League', country: 'Europe' },
            '848': { name: 'Europa Conference League', country: 'Europe' },
            '94': { name: 'Primeira Liga', country: 'Portugal' },
            '88': { name: 'Eredivisie', country: 'Netherlands' },
            '203': { name: 'Süper Lig', country: 'Turkey' },
            '218': { name: 'Austrian Bundesliga', country: 'Austria' },
            '219': { name: 'Austrian 2. Liga', country: 'Austria' },
            '211': { name: 'Prva HNL', country: 'Croatia' },
            '307': { name: 'Saudi Pro League', country: 'Saudi Arabia' },
            '188': { name: 'Scottish Premiership', country: 'Scotland' },
            '1083': { name: 'UEFA Women\'s Euro 2025', country: 'Europe' },
            
            // International Competitions (Real API IDs)
            '1': { name: 'FIFA World Cup', country: 'International' },
            '4': { name: 'European Championship', country: 'Europe' },
            '5': { name: 'UEFA Nations League', country: 'Europe' },
            '6': { name: 'Africa Cup of Nations', country: 'Africa' },
            '7': { name: 'Asian Cup', country: 'Asia' },
            '8': { name: 'World Cup - Women', country: 'International' },
            '9': { name: 'Copa America', country: 'South America' },
            '10': { name: 'Friendlies', country: 'International' },
            '13': { name: 'Copa Libertadores', country: 'South America' },
            '15': { name: 'FIFA Club World Cup', country: 'International' },
            '26': { name: 'International Champions Cup', country: 'International' },
            '29': { name: 'World Cup - Qualification Africa', country: 'Africa' },
            '30': { name: 'World Cup - Qualification Asia', country: 'Asia' },
            '31': { name: 'World Cup - Qualification CONCACAF', country: 'North America' },
            '32': { name: 'World Cup - Qualification Europe', country: 'Europe' },
            '33': { name: 'World Cup - Qualification Oceania', country: 'Oceania' },
            '34': { name: 'World Cup - Qualification South America', country: 'South America' },
            '37': { name: 'World Cup - Qualification Intercontinental Play-offs', country: 'International' },
            '44': { name: 'Women\'s Super League', country: 'England' },
            '699': { name: 'Women\'s Championship', country: 'England' }
        };
    }

    /**
     * Get league name by API ID (API-first approach)
     */
    async getLeagueNameById(apiId) {
        const cacheKey = `name_${apiId}`;
        const cached = this.cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            return cached.data;
        }

        try {
            // First try database lookup
            const league = await League.findOne({ apiId: apiId.toString() });
            if (league && league.name) {
                const name = league.name;
                this.cache.set(cacheKey, { data: name, timestamp: Date.now() });
                return name;
            }
            
            // Fallback to API mapping
            const apiMapping = this.apiLeagueMappings[apiId.toString()];
            if (apiMapping) {
                const name = apiMapping.name;
                this.cache.set(cacheKey, { data: name, timestamp: Date.now() });
                return name;
            }
            
            // Final fallback
            return 'Unknown League';
        } catch (error) {
            console.error(`Error getting league name for ${apiId}:`, error);
            
            // Try API mapping as error fallback
            const apiMapping = this.apiLeagueMappings[apiId.toString()];
            return apiMapping ? apiMapping.name : 'Unknown League';
        }
    }

    /**
     * Get country by league API ID (API-first approach)
     */
    async getCountryByLeagueId(apiId) {
        const cacheKey = `country_${apiId}`;
        const cached = this.cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            return cached.data;
        }

        try {
            // First try database lookup
            const league = await League.findOne({ apiId: apiId.toString() });
            if (league && league.country) {
                const country = league.country;
                this.cache.set(cacheKey, { data: country, timestamp: Date.now() });
                return country;
            }
            
            // Fallback to API mapping
            const apiMapping = this.apiLeagueMappings[apiId.toString()];
            if (apiMapping) {
                const country = apiMapping.country;
                this.cache.set(cacheKey, { data: country, timestamp: Date.now() });
                return country;
            }
            
            // Final fallback
            return 'Unknown Country';
        } catch (error) {
            console.error(`Error getting country for league ${apiId}:`, error);
            
            // Try API mapping as error fallback
            const apiMapping = this.apiLeagueMappings[apiId.toString()];
            return apiMapping ? apiMapping.country : 'Unknown Country';
        }
    }

    /**
     * Get full league information by API ID
     */
    async getLeagueById(apiId) {
        const cacheKey = `league_${apiId}`;
        const cached = this.cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            return cached.data;
        }

        try {
            const league = await League.findOne({ apiId: apiId.toString() });
            
            // Cache the result
            this.cache.set(cacheKey, {
                data: league,
                timestamp: Date.now()
            });
            
            return league;
        } catch (error) {
            console.error(`Error getting league ${apiId}:`, error);
            return null;
        }
    }

    /**
     * Get all leagues for a country
     */
    async getLeaguesForCountry(countryCode) {
        try {
            const leagues = await League.find({ 
                countryCode: countryCode.toUpperCase(),
                isActive: true 
            }).sort({ tier: 1, name: 1 });
            
            return leagues;
        } catch (error) {
            console.error(`Error getting leagues for country ${countryCode}:`, error);
            return [];
        }
    }

    /**
     * Get all active leagues
     */
    async getAllLeagues() {
        try {
            const leagues = await League.find({ isActive: true })
                .sort({ country: 1, tier: 1, name: 1 });
            
            return leagues;
        } catch (error) {
            console.error('Error getting all leagues:', error);
            return [];
        }
    }

    /**
     * Get country code mapping (fallback for unknown countries)
     */
    getCountryCodeMapping(countryName) {
        const countryMapping = {
            'United Kingdom': 'GB',
            'England': 'GB',
            'France': 'FR',
            'Spain': 'ES',
            'Germany': 'DE',
            'Switzerland': 'CH',
            'Netherlands': 'NL',
            'Portugal': 'PT',
            'Italy': 'IT',
            'Belgium': 'BE',
            'Brazil': 'BR',
            'United States': 'US',
            'USA': 'US',
            'Japan': 'JP',
            'International': 'INT',
            'Europe': 'INT'
        };
        return countryMapping[countryName];
    }

    /**
     * Build league country map for API responses (cached)
     */
    async getLeagueCountryMap() {
        const cacheKey = 'league_country_map';
        const cached = this.cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            return cached.data;
        }

        try {
            const leagues = await League.find({ isActive: true });
            const map = {};
            
            leagues.forEach(league => {
                map[league.apiId] = league.country;
            });
            
            // Cache the map
            this.cache.set(cacheKey, {
                data: map,
                timestamp: Date.now()
            });
            
            return map;
        } catch (error) {
            console.error('Error building league country map:', error);
            return {};
        }
    }

    /**
     * Clear cache (useful for testing or admin operations)
     */
    clearCache() {
        this.cache.clear();

    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        const stats = {
            cacheSize: this.cache.size,
            cacheEntries: Array.from(this.cache.keys())
        };
        return stats;
    }

    /**
     * Search leagues by name or aliases
     */
    async searchLeagues(searchTerm, options = {}) {
        const limit = options.limit || 10;
        
        try {
            // Search in database first
            const query = {
                $or: [
                    { name: { $regex: searchTerm, $options: 'i' } },
                    { aliases: { $regex: searchTerm, $options: 'i' } },
                    { apiId: searchTerm }
                ],
                isActive: true
            };

            const leagues = await League.find(query)
                .sort({ tier: 1, name: 1 })
                .limit(limit);

            if (leagues.length > 0) {
                return leagues;
            }

            // If no database results, search in API mappings
            const apiResults = [];
            const searchLower = searchTerm.toLowerCase();
            
            Object.entries(this.apiLeagueMappings).forEach(([apiId, leagueData]) => {
                if (leagueData.name.toLowerCase().includes(searchLower) ||
                    leagueData.country.toLowerCase().includes(searchLower)) {
                    apiResults.push({
                        apiId: apiId,
                        name: leagueData.name,
                        country: leagueData.country,
                        isActive: true
                    });
                }
            });

            return apiResults.slice(0, limit);
        } catch (error) {
            console.error('Error searching leagues:', error);
            return [];
        }
    }
}

module.exports = new LeagueService(); 