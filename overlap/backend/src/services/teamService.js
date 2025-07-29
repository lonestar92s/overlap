const Team = require('../models/Team');
const League = require('../models/League');

class TeamService {
    constructor() {
        this.cache = new Map();
        this.cacheExpiry = 30 * 60 * 1000; // 30 minutes cache
        this.apiBaseUrl = process.env.EXTERNAL_API_URL || 'https://api.football-data.org/v4';
        this.apiKey = process.env.FOOTBALL_DATA_API_KEY;
        this.logUnmappedTeam = null; // Will be set by admin routes
    }

    // Set the logging function from admin routes
    setUnmappedLogger(logFunction) {
        this.logUnmappedTeam = logFunction;
    }

    /**
     * Map API-Sports team name to database team name
     */
    async mapApiNameToTeam(apiSportsName) {
        try {
            // console.log(`\n🔍 Mapping team: "${apiSportsName}"`);
            
            // Check cache first
            const cacheKey = `map_${apiSportsName}`;
            const cached = this.cache.get(cacheKey);
            if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
        
                return cached.result;
            }
    

            // Try direct match first
            let team = await Team.findOne({ apiName: apiSportsName });
            if (team) {

                return team.name;
            }
            // console.log(`❌ No match by apiName`);

            // Try exact name match
            team = await Team.findOne({ name: apiSportsName });
            if (team) {

                return team.name;
            }
            // console.log(`❌ No match by exact name`);

            // Try aliases
            team = await Team.findOne({ aliases: apiSportsName });
            if (team) {

                return team.name;
            }
            // console.log(`❌ No match by alias`);

            // If still not found, return the original name
    
            return apiSportsName;
        } catch (error) {
            console.error('❌ Error in mapApiNameToTeam:', error);
            return apiSportsName;
        }
    }

    /**
     * Get team by database name (existing functionality)
     */
    async getTeamByName(teamName) {
        try {
            const team = await Team.findOne({ name: teamName })
                .populate('leagueId')
                .populate('venueId');
            return team;
        } catch (error) {
            console.error(`Error getting team ${teamName}:`, error);
            return null;
        }
    }

    /**
     * Bulk update teams with API names from hardcoded mapping
     */
    async updateTeamsWithApiNames(teamNameMapping) {
        let updated = 0;
        let errors = 0;



        for (const [apiName, teamName] of Object.entries(teamNameMapping)) {
            try {
                const result = await Team.updateOne(
                    { name: teamName },
                    { 
                        $set: { apiName: apiName },
                        $addToSet: { aliases: apiName } // Also add to aliases for search
                    }
                );

                if (result.modifiedCount > 0) {
                    updated++;
                    if (updated % 50 === 0) {
        
                    }
                } else {

                }
            } catch (error) {
                console.error(`❌ Error updating ${teamName}:`, error.message);
                errors++;
            }
        }


        
        return { updated, errors };
    }

    /**
     * Search teams (existing functionality enhanced)
     */
    async searchTeams(searchTerm, options = {}) {
        const limit = options.limit || 20;
        const country = options.country;
        const league = options.league;

        try {
            let query = {
                $or: [
                    { name: { $regex: searchTerm, $options: 'i' } },
                    { aliases: { $regex: searchTerm, $options: 'i' } },
                    { apiName: { $regex: searchTerm, $options: 'i' } }, // Include API name in search
                    { code: { $regex: searchTerm, $options: 'i' } }
                ]
            };

            if (country) {
                query.country = country;
            }

            if (league) {
                const leagueDoc = await League.findOne({ 
                    $or: [
                        { name: { $regex: league, $options: 'i' } },
                        { apiId: league }
                    ]
                });
                if (leagueDoc) {
                    query.leagueId = leagueDoc._id;
                }
            }

            const teams = await Team.find(query)
                .populate('leagueId')
                .populate('venueId')
                .sort({ popularity: -1, searchCount: -1 })
                .limit(limit);

            // Update search counts for found teams
            const updatePromises = teams.map(team => team.incrementSearch());
            await Promise.all(updatePromises);

            return teams;
        } catch (error) {
            console.error('Error searching teams:', error);
            return [];
        }
    }

    /**
     * Get popular teams (existing functionality)
     */
    async getPopularTeams(limit = 50) {
        try {
            const teams = await Team.find({})
                .populate('leagueId')
                .populate('venueId')
                .sort({ popularity: -1, searchCount: -1 })
                .limit(limit);
            return teams;
        } catch (error) {
            console.error('Error getting popular teams:', error);
            return [];
        }
    }

    /**
     * Get teams by league
     */
    async getTeamsByLeague(leagueApiId) {
        try {
            const league = await League.findOne({ apiId: leagueApiId });
            if (!league) {
                return [];
            }

            const teams = await Team.find({ leagueId: league._id })
                .populate('venueId')
                .sort({ name: 1 });
            
            return teams;
        } catch (error) {
            console.error(`Error getting teams for league ${leagueApiId}:`, error);
            return [];
        }
    }

    /**
     * External API integration (existing functionality)
     */
    async searchTeamsFromAPI(searchTerm) {
        if (!this.apiKey) {
            console.warn('No external API key configured, skipping external search');
            return [];
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/teams?search=${encodeURIComponent(searchTerm)}`, {
                headers: {
                    'X-Auth-Token': this.apiKey
                }
            });

            if (!response.ok) {
                console.error('External API request failed:', response.status, response.statusText);
                return [];
            }

            const data = await response.json();
            return data.teams || [];
        } catch (error) {
            console.error('Error searching teams from external API:', error);
            return [];
        }
    }

    /**
     * Cache management
     */
    clearCache() {
        this.cache.clear();

    }

    getCacheStats() {
        return {
            cacheSize: this.cache.size,
            cacheEntries: Array.from(this.cache.keys())
        };
    }
}

module.exports = new TeamService(); 