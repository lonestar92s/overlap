const Team = require('../models/Team');

class TeamService {
    constructor() {
        // Use the same API-Sports that provides match data
        this.apiBaseUrl = 'https://v3.football.api-sports.io';
        this.apiKey = process.env.API_SPORTS_KEY || '0ab95ca9f7baeb6fd551af7ca41ed8d2'; // Use the same key as matches route
    }

    /**
     * Search for teams - checks cache first, then API if needed
     */
    async searchTeams(searchTerm, limit = 20) {
        try {
            // First, search our cached teams
            const cachedTeams = await Team.searchTeams(searchTerm, limit);
            
            // If we have enough results, return them
            if (cachedTeams.length >= Math.min(limit, 10)) {
                // Update search counts for returned teams
                await Promise.all(
                    cachedTeams.map(team => team.incrementSearch())
                );
                return this.formatTeamsForResponse(cachedTeams);
            }

            // If not enough cached results, fetch from API
            console.log(`🔍 Searching API for teams matching: ${searchTerm}`);
            const apiTeams = await this.fetchTeamsFromAPI(searchTerm);
            
            // Cache the new teams
            const savedTeams = await this.cacheTeams(apiTeams);
            
            // Combine cached and new results
            const allTeams = [...cachedTeams];
            savedTeams.forEach(newTeam => {
                // Avoid duplicates
                if (!allTeams.find(existing => existing.apiId === newTeam.apiId)) {
                    allTeams.push(newTeam);
                }
            });

            // Sort by relevance and return
            const sortedTeams = this.sortTeamsByRelevance(allTeams, searchTerm);
            return this.formatTeamsForResponse(sortedTeams.slice(0, limit));

        } catch (error) {
            console.error('Error searching teams:', error);
            // Fallback to cached results only
            const cachedTeams = await Team.searchTeams(searchTerm, limit);
            return this.formatTeamsForResponse(cachedTeams);
        }
    }

    /**
     * Get popular teams (for autocomplete suggestions)
     */
    async getPopularTeams(limit = 50) {
        try {
            const teams = await Team.getPopularTeams(limit);
            return this.formatTeamsForResponse(teams);
        } catch (error) {
            console.error('Error getting popular teams:', error);
            return [];
        }
    }

    /**
     * Fetch teams from external API
     */
    async fetchTeamsFromAPI(searchTerm) {
        if (!this.apiKey) {
            console.warn('No API-Sports key configured');
            return [];
        }

        try {
            // For API-Sports, we'll search teams directly
            console.log(`🔍 Searching API-Sports for teams matching: ${searchTerm}`);
            
            const response = await fetch(`${this.apiBaseUrl}/teams?search=${encodeURIComponent(searchTerm)}`, {
                headers: {
                    'x-apisports-key': this.apiKey
                }
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            const data = await response.json();
            console.log(`📡 API-Sports returned ${data.response?.length || 0} teams for "${searchTerm}"`);
            
            return data.response || [];

        } catch (error) {
            console.error('Error fetching from API-Sports:', error);
            return [];
        }
    }

    // Removed unused methods - API-Sports uses direct team search

    /**
     * Cache teams in our database
     */
    async cacheTeams(apiTeams) {
        const savedTeams = [];

        for (const apiTeam of apiTeams) {
            try {
                // Validate API team structure
                if (!apiTeam.team || !apiTeam.team.id) {
                    console.warn('Invalid API team structure:', apiTeam);
                    continue;
                }

                // Check if team already exists
                let existingTeam = await Team.findOne({ apiId: apiTeam.team.id.toString() });

                if (existingTeam) {
                    // Update existing team if data is stale
                    if (existingTeam.isStale()) {
                        existingTeam = await this.updateTeamFromAPI(existingTeam, apiTeam);
                    }
                    savedTeams.push(existingTeam);
                } else {
                    // Create new team
                    const newTeam = await this.createTeamFromAPI(apiTeam);
                    savedTeams.push(newTeam);
                }
            } catch (error) {
                console.error(`Error caching team ${apiTeam.team?.name || 'unknown'}:`, error);
            }
        }

        return savedTeams;
    }

    /**
     * Create a new team from API data
     */
    async createTeamFromAPI(apiTeam) {
        const teamData = {
            apiId: apiTeam.team.id.toString(),
            name: apiTeam.team.name,
            aliases: [
                apiTeam.team.name,
                apiTeam.team.code
            ].filter(Boolean),
            code: apiTeam.team.code,
            founded: apiTeam.team.founded,
            logo: apiTeam.team.logo,
            country: apiTeam.team.country,
            city: this.extractCity(apiTeam.venue?.name),
            venue: {
                name: apiTeam.venue?.name || 'Unknown Venue',
                capacity: apiTeam.venue?.capacity || null,
                coordinates: [] // API-Sports doesn't provide coordinates
            },
            lastUpdated: new Date(),
            apiSource: 'api-sports'
        };

        console.log(`💾 Caching new team: ${teamData.name} (${teamData.country})`);
        return await Team.create(teamData);
    }

    /**
     * Update existing team with fresh API data
     */
    async updateTeamFromAPI(existingTeam, apiTeam) {
        existingTeam.name = apiTeam.team.name;
        existingTeam.aliases = [
            apiTeam.team.name,
            apiTeam.team.code
        ].filter(Boolean);
        existingTeam.code = apiTeam.team.code;
        existingTeam.founded = apiTeam.team.founded;
        existingTeam.logo = apiTeam.team.logo;
        existingTeam.country = apiTeam.team.country;
        existingTeam.lastUpdated = new Date();

        console.log(`🔄 Updated team: ${existingTeam.name}`);
        return await existingTeam.save();
    }

    /**
     * Sort teams by relevance to search term
     */
    sortTeamsByRelevance(teams, searchTerm) {
        const term = searchTerm.toLowerCase();
        
        return teams.sort((a, b) => {
            // Exact name match gets highest priority
            const aExactMatch = a.name.toLowerCase() === term;
            const bExactMatch = b.name.toLowerCase() === term;
            if (aExactMatch && !bExactMatch) return -1;
            if (!aExactMatch && bExactMatch) return 1;

            // Name starts with search term
            const aStartsWith = a.name.toLowerCase().startsWith(term);
            const bStartsWith = b.name.toLowerCase().startsWith(term);
            if (aStartsWith && !bStartsWith) return -1;
            if (!aStartsWith && bStartsWith) return 1;

            // Fall back to popularity
            return b.popularity - a.popularity;
        });
    }

    /**
     * Format teams for API response
     */
    formatTeamsForResponse(teams) {
        return teams.map(team => ({
            id: team._id,
            apiId: team.apiId,
            name: team.name,
            code: team.code,
            country: team.country,
            city: team.city,
            logo: team.logo,
            venue: team.venue?.name,
            popularity: team.popularity,
            searchCount: team.searchCount
        }));
    }

    /**
     * Extract city from venue string
     */
    extractCity(venue) {
        // This is a simple extraction - could be improved with geocoding
        return venue || null;
    }

    /**
     * Populate database with popular teams by searching common team names
     */
    async populatePopularTeams() {
        try {
            console.log('🌍 Populating database with popular teams...');
            
            // Common team names to search for
            const popularTeamNames = [
                'Liverpool', 'Manchester United', 'Real Madrid', 'Barcelona', 
                'Bayern Munich', 'Juventus', 'Chelsea', 'Arsenal', 'PSG',
                'Manchester City', 'Tottenham', 'Ajax', 'Inter Milan', 'AC Milan'
            ];

            for (const teamName of popularTeamNames) {
                try {
                    const teams = await this.fetchTeamsFromAPI(teamName);
                    if (teams.length > 0) {
                        await this.cacheTeams(teams.slice(0, 3)); // Take top 3 results
                        console.log(`✅ Cached teams for "${teamName}"`);
                    }
                    
                    // Delay to respect rate limits
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    console.warn(`⚠️  Failed to populate "${teamName}":`, error.message);
                }
            }

            console.log('🎉 Finished populating popular teams');
        } catch (error) {
            console.error('Error populating teams:', error);
        }
    }
}

module.exports = new TeamService(); 