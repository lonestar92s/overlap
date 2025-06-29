import { useState, useEffect, useContext, createContext } from "react";
import { useAuth } from "../components/Auth";
import { getBackendUrl } from "../utils/api";

const SubscriptionContext = createContext();

export const SubscriptionProvider = ({ children }) => {
    const { user } = useAuth();
    const [subscriptionTier, setSubscriptionTier] = useState("freemium");
    const [restrictedLeagues, setRestrictedLeagues] = useState(["40"]); // Championship restricted for freemium
    const [loading, setLoading] = useState(true);

    const tierAccess = {
        freemium: {
            restrictedLeagues: ["40"], // Championship is restricted
            description: "Access to all leagues except Championship"
        },
        pro: {
            restrictedLeagues: [], // No restrictions
            description: "Access to all leagues including Championship"
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
                setRestrictedLeagues(tierAccess.freemium.restrictedLeagues);
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
                    setRestrictedLeagues(tierAccess[userTier]?.restrictedLeagues || tierAccess.freemium.restrictedLeagues);
                }
            } catch (error) {
                console.error("Error fetching user subscription:", error);
                setSubscriptionTier("freemium");
                setRestrictedLeagues(tierAccess.freemium.restrictedLeagues);
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
        return tierAccess[subscriptionTier] || tierAccess.freemium;
    };

    const getUpgradeMessage = (leagueId) => {
        if (leagueId === "40") {
            return "Upgrade to Pro to access Championship matches";
        }
        return "Upgrade to access this league";
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
