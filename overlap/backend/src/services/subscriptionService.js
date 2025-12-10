const League = require('../models/League');
const TierAccess = require('../models/TierAccess');

class SubscriptionService {
    constructor() {
        // Default values (used as fallback and for initialization)
        this.defaultTierAccess = {
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
        this.tierAccess = { ...this.defaultTierAccess }; // Will be loaded from DB
        this._allLeaguesCache = null;
        this._cacheExpiry = null;
        this._cacheTTL = 60 * 60 * 1000; // 1 hour cache
        this._tierAccessCache = null;
        this._tierAccessCacheExpiry = null;
        this._tierAccessCacheTTL = 5 * 60 * 1000; // 5 minute cache for tier access
        this._initialized = false;
    }

    // Initialize tier access from database
    async initializeTierAccess() {
        if (this._initialized && this._tierAccessCache && this._tierAccessCacheExpiry && Date.now() < this._tierAccessCacheExpiry) {
            return;
        }

        try {
            const tierAccessDocs = await TierAccess.find().lean();
            const allLeagues = await this.getAllLeaguesFromDatabase();
            
            // Build tier access object from database
            const dbTierAccess = {};
            for (const tier of ['freemium', 'pro', 'planner']) {
                const doc = tierAccessDocs.find(d => d.tier === tier);
                if (doc) {
                    // Support both allowedLeagues (new) and restrictedLeagues (legacy)
                    let allowedLeagues = doc.allowedLeagues;
                    
                    // If allowedLeagues doesn't exist but restrictedLeagues does, migrate
                    if (!allowedLeagues || allowedLeagues.length === 0) {
                        if (doc.restrictedLeagues && doc.restrictedLeagues.length > 0) {
                            // Convert restricted to allowed: allowed = all - restricted
                            allowedLeagues = allLeagues.filter(id => !doc.restrictedLeagues.includes(id));
                        } else {
                            // No restrictions = all leagues allowed
                            allowedLeagues = allLeagues;
                        }
                    }
                    
                    dbTierAccess[tier] = {
                        allowedLeagues: allowedLeagues,
                        restrictedLeagues: doc.restrictedLeagues || [], // Keep for backward compat
                        description: doc.description || this.defaultTierAccess[tier].description
                    };
                } else {
                    // If not in DB, use default and create it
                    // Convert default restricted to allowed
                    const defaultRestricted = this.defaultTierAccess[tier].restrictedLeagues || [];
                    const defaultAllowed = allLeagues.filter(id => !defaultRestricted.includes(id));
                    
                    dbTierAccess[tier] = {
                        allowedLeagues: defaultAllowed,
                        restrictedLeagues: defaultRestricted,
                        description: this.defaultTierAccess[tier].description
                    };
                    
                    // Create in DB with both fields for migration
                    await TierAccess.create({
                        tier,
                        allowedLeagues: defaultAllowed,
                        restrictedLeagues: defaultRestricted,
                        description: this.defaultTierAccess[tier].description
                    });
                }
            }
            
            this.tierAccess = dbTierAccess;
            this._tierAccessCache = dbTierAccess;
            this._tierAccessCacheExpiry = Date.now() + this._tierAccessCacheTTL;
            this._initialized = true;
        } catch (error) {
            console.error('Error initializing tier access from database:', error);
            // Fallback to default values
            this.tierAccess = { ...this.defaultTierAccess };
        }
    }

    // Refresh tier access cache
    async refreshTierAccess() {
        this._tierAccessCache = null;
        this._tierAccessCacheExpiry = null;
        await this.initializeTierAccess();
    }

    async hasLeagueAccess(user, leagueId) {
        await this.initializeTierAccess();
        
        if (!user || !user.subscription) {
            // Default to freemium for unauthenticated users
            const freemiumConfig = this.tierAccess.freemium;
            if (freemiumConfig.allowedLeagues) {
                return freemiumConfig.allowedLeagues.includes(leagueId);
            }
            return !freemiumConfig.restrictedLeagues.includes(leagueId);
        }
        
        const userTier = user.subscription.tier || "freemium";
        const tierConfig = this.tierAccess[userTier];
        
        if (!tierConfig) {
            // Default to freemium if unknown tier
            const freemiumConfig = this.tierAccess.freemium;
            if (freemiumConfig.allowedLeagues) {
                return freemiumConfig.allowedLeagues.includes(leagueId);
            }
            return !freemiumConfig.restrictedLeagues.includes(leagueId);
        }
        
        // Check if league is in allowed list (preferred) or not in restricted list (legacy)
        if (tierConfig.allowedLeagues && tierConfig.allowedLeagues.length > 0) {
            return tierConfig.allowedLeagues.includes(leagueId);
        }
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
        await this.initializeTierAccess();
        
        // Fetch all leagues from database (cached)
        const allLeagues = await this.getAllLeaguesFromDatabase();
        
        if (allLeagues.length === 0) {
            // Fallback to empty array if no leagues in database
            console.warn('No leagues found in database, returning empty array');
            return [];
        }
        
        if (!user || !user.subscription) {
            const freemiumConfig = this.tierAccess.freemium;
            if (freemiumConfig.allowedLeagues && freemiumConfig.allowedLeagues.length > 0) {
                return freemiumConfig.allowedLeagues;
            }
            return allLeagues.filter(leagueId => !freemiumConfig.restrictedLeagues.includes(leagueId));
        }
        
        const userTier = user.subscription.tier || "freemium";
        const tierConfig = this.tierAccess[userTier];
        
        if (!tierConfig) {
            const freemiumConfig = this.tierAccess.freemium;
            if (freemiumConfig.allowedLeagues && freemiumConfig.allowedLeagues.length > 0) {
                return freemiumConfig.allowedLeagues;
            }
            return allLeagues.filter(leagueId => !freemiumConfig.restrictedLeagues.includes(leagueId));
        }
        
        // Use allowedLeagues if available, otherwise calculate from restrictedLeagues
        if (tierConfig.allowedLeagues && tierConfig.allowedLeagues.length > 0) {
            return tierConfig.allowedLeagues;
        }
        return allLeagues.filter(leagueId => !tierConfig.restrictedLeagues.includes(leagueId));
    }

    // Synchronous version for backward compatibility (uses cached data)
    // Note: This may use stale tier access data if cache hasn't been initialized
    getAccessibleLeaguesSync(user) {
        // Use cached data if available, otherwise return empty array
        const allLeagues = this._allLeaguesCache || [];
        
        if (allLeagues.length === 0) {
            return [];
        }
        
        // Ensure tier access is initialized (synchronous - uses cache)
        if (!this._initialized) {
            // If not initialized, use defaults
            const tierAccess = this._tierAccessCache || this.defaultTierAccess;
            if (!user || !user.subscription) {
                return allLeagues.filter(leagueId => !tierAccess.freemium.restrictedLeagues.includes(leagueId));
            }
            const userTier = user.subscription.tier || "freemium";
            const tierConfig = tierAccess[userTier] || tierAccess.freemium;
            return allLeagues.filter(leagueId => !tierConfig.restrictedLeagues.includes(leagueId));
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

    async getAllTiers() {
        await this.initializeTierAccess();
        return this.tierAccess;
    }

    async getRestrictedLeagues(subscriptionTier) {
        await this.initializeTierAccess();
        const tierConfig = this.tierAccess[subscriptionTier];
        return tierConfig ? tierConfig.restrictedLeagues : this.tierAccess.freemium.restrictedLeagues;
    }

    async updateUserTier(user, newTier) {
        await this.initializeTierAccess();
        
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

    // Update tier access configuration
    // Supports both allowedLeagues (preferred) and restrictedLeagues (legacy)
    async updateTierAccess(tier, allowedLeagues, description, restrictedLeagues = null) {
        if (!['freemium', 'pro', 'planner'].includes(tier)) {
            throw new Error("Invalid tier");
        }

        const allLeagues = await this.getAllLeaguesFromDatabase();
        const updateData = {
            tier,
            description: description || this.defaultTierAccess[tier].description
        };

        // If allowedLeagues is provided, use it (preferred approach)
        if (allowedLeagues !== null && allowedLeagues !== undefined) {
            updateData.allowedLeagues = allowedLeagues || [];
            // Also calculate restrictedLeagues for backward compatibility
            updateData.restrictedLeagues = allLeagues.filter(id => !allowedLeagues.includes(id));
        } else if (restrictedLeagues !== null && restrictedLeagues !== undefined) {
            // Legacy: if only restrictedLeagues provided, calculate allowedLeagues
            updateData.restrictedLeagues = restrictedLeagues || [];
            updateData.allowedLeagues = allLeagues.filter(id => !restrictedLeagues.includes(id));
        } else {
            // Default: all leagues allowed
            updateData.allowedLeagues = allLeagues;
            updateData.restrictedLeagues = [];
        }

        const tierAccess = await TierAccess.findOneAndUpdate(
            { tier },
            updateData,
            { upsert: true, new: true }
        );

        // Refresh cache
        await this.refreshTierAccess();

        return tierAccess;
    }

    // Get tier access configuration
    async getTierAccessConfig() {
        await this.initializeTierAccess();
        return this.tierAccess;
    }
}

module.exports = new SubscriptionService();
