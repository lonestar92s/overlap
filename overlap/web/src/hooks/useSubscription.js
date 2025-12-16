import { useState, useEffect, useContext, createContext } from "react";
import { useAuth } from "../components/Auth";
import { getBackendUrl } from "../utils/api";

const SubscriptionContext = createContext();

export const SubscriptionProvider = ({ children }) => {
    const { user } = useAuth();
    const [subscriptionTier, setSubscriptionTier] = useState("freemium");
    const [restrictedLeagues, setRestrictedLeagues] = useState([]); // Will be set based on user tier
    const [loading, setLoading] = useState(true);

    // Default tier access (fallback only)
    const defaultTierAccess = {
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

    useEffect(() => {
        const fetchUserSubscription = async () => {
            if (!user) {
                setSubscriptionTier("freemium");
                setRestrictedLeagues(defaultTierAccess.freemium.restrictedLeagues);
                setLoading(false);
                return;
            }

            try {
                const response = await fetch(`${getBackendUrl()}/api/leagues`, {
                    headers: {
                        "Authorization": `Bearer ${localStorage.getItem("token")}`,
                        "Content-Type": "application/json"
                    }
                });
                
                const data = await response.json();
                if (data.success) {
                    const userTier = data.userTier || "freemium";
                    setSubscriptionTier(userTier);
                    // Use restrictedLeagues from backend response, fallback to default if not provided
                    const backendRestrictedLeagues = data.restrictedLeagues || defaultTierAccess[userTier]?.restrictedLeagues || defaultTierAccess.freemium.restrictedLeagues;
                    setRestrictedLeagues(backendRestrictedLeagues);
                }
            } catch (error) {
                console.error("Error fetching user subscription:", error);
                setSubscriptionTier("freemium");
                setRestrictedLeagues(defaultTierAccess.freemium.restrictedLeagues);
            }
            
            setLoading(false);
        };

        fetchUserSubscription();
    }, [user]);

    const hasLeagueAccess = (leagueId) => {
        // Access granted if league is NOT in restricted list
        return !restrictedLeagues.includes(leagueId);
    };

    const getSubscriptionInfo = () => {
        return defaultTierAccess[subscriptionTier] || defaultTierAccess.freemium;
    };

    const getUpgradeMessage = (leagueId) => {
        return "Upgrade to Pro to access this league";
    };

    const value = {
        subscriptionTier,
        restrictedLeagues,
        loading,
        hasLeagueAccess,
        getSubscriptionInfo,
        getUpgradeMessage,
        tierAccess
    };

    return (
        <SubscriptionContext.Provider value={value}>
            {children}
        </SubscriptionContext.Provider>
    );
};

export const useSubscription = () => {
    const context = useContext(SubscriptionContext);
    if (!context) {
        throw new Error("useSubscription must be used within a SubscriptionProvider");
    }
    return context;
};
