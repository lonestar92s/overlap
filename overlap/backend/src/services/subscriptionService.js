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

    getAccessibleLeagues(user) {
        // This method is now less useful since we use blacklist approach
        // But keeping for compatibility - return all leagues except restricted ones
        const allLeagues = ["39", "40", "41", "61", "140", "78", "207", "88", "94", "135", "144", "71", "253", "98", "2", "4", "13", "1"];
        
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
