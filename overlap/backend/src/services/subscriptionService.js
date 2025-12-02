const League = require('../models/League');

class SubscriptionService {
    constructor() {
        this.tierAccess = {
            freemium: {
                restrictedLeagues: ["40", "41"], // Championship and League One are restricted for freemium
                description: "Access to Premier League and international competitions only"
            },
            pro: {
                restrictedLeagues: [], // No restrictions
                description: "Access to leagues around the world"
            },
            planner: {
                restrictedLeagues: [], // No restrictions
                description: "Access to all leagues and premium features"
            }
        };
        this._allLeaguesCache = null;
        this._cacheExpiry = null;
        this._cacheTTL = 60 * 60 * 1000; // 1 hour cache
    }

    hasLeagueAccess(user, leagueId) {
        if (!user || !user.subscription) {
            // Default to freemium for unauthenticated users
            return !this.tierAccess.freemium.restrictedLeagues.includes(leagueId);
        }
        
        const userTier = user.subscription.tier || "freemium";
        const tierConfig = this.tierAccess[userTier];
        
        if (!tierConfig) {
            // Default to freemium if unknown tier
            return !this.tierAccess.freemium.restrictedLeagues.includes(leagueId);
        }
        
        // Check if league is restricted for this tier
        return !tierConfig.restrictedLeagues.includes(leagueId);
    }

    async getAllLeaguesFromDatabase() {
        // Check cache first
        if (this._allLeaguesCache && this._cacheExpiry && Date.now() < this._cacheExpiry) {
            return this._allLeaguesCache;
        }

        try {
            // Fetch all active leagues from database
            const leagues = await League.find({ isActive: true }).select('apiId').lean();
            const leagueIds = leagues.map(league => league.apiId.toString());
            
            // Update cache
            this._allLeaguesCache = leagueIds;
            this._cacheExpiry = Date.now() + this._cacheTTL;
            
            return leagueIds;
        } catch (error) {
            console.error('Error fetching leagues from database:', error);
            // Fallback to empty array if database query fails
            return [];
        }
    }

    async getAccessibleLeagues(user) {
        // Fetch all leagues from database (cached)
        const allLeagues = await this.getAllLeaguesFromDatabase();
        
        if (allLeagues.length === 0) {
            // Fallback to empty array if no leagues in database
            console.warn('No leagues found in database, returning empty array');
            return [];
        }
        
        if (!user || !user.subscription) {
            return allLeagues.filter(leagueId => !this.tierAccess.freemium.restrictedLeagues.includes(leagueId));
        }
        
        const userTier = user.subscription.tier || "freemium";
        const tierConfig = this.tierAccess[userTier];
        
        if (!tierConfig) {
            return allLeagues.filter(leagueId => !this.tierAccess.freemium.restrictedLeagues.includes(leagueId));
        }
        
        return allLeagues.filter(leagueId => !tierConfig.restrictedLeagues.includes(leagueId));
    }

    // Synchronous version for backward compatibility (uses cached data)
    getAccessibleLeaguesSync(user) {
        // Use cached data if available, otherwise return empty array
        const allLeagues = this._allLeaguesCache || [];
        
        if (allLeagues.length === 0) {
            return [];
        }
        
        if (!user || !user.subscription) {
            return allLeagues.filter(leagueId => !this.tierAccess.freemium.restrictedLeagues.includes(leagueId));
        }
        
        const userTier = user.subscription.tier || "freemium";
        const tierConfig = this.tierAccess[userTier];
        
        if (!tierConfig) {
            return allLeagues.filter(leagueId => !this.tierAccess.freemium.restrictedLeagues.includes(leagueId));
        }
        
        return allLeagues.filter(leagueId => !tierConfig.restrictedLeagues.includes(leagueId));
    }

    getAllTiers() {
        return this.tierAccess;
    }

    getRestrictedLeagues(subscriptionTier) {
        const tierConfig = this.tierAccess[subscriptionTier];
        return tierConfig ? tierConfig.restrictedLeagues : this.tierAccess.freemium.restrictedLeagues;
    }

    updateUserTier(user, newTier) {
        if (!this.tierAccess[newTier]) {
            throw new Error("Invalid subscription tier");
        }
        user.subscription = user.subscription || {};
        user.subscription.tier = newTier;
        user.subscription.startDate = new Date();
        user.subscription.isActive = true;
        // Set endDate to null for all tiers (never expire)
        user.subscription.endDate = null;
        return user.subscription;
    }
}

module.exports = new SubscriptionService();
