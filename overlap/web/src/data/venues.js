// Mapping of Premier League teams to their home venues
const TEAM_VENUES = {
    // Add team names exactly as they appear in the API response
    "Arsenal FC": {
        stadium: "Emirates Stadium",
        location: "London",
        coordinates: [-0.108438, 51.555]
    },
    "Aston Villa FC": {
        stadium: "Villa Park",
        location: "Birmingham",
        coordinates: [-1.884746, 52.509]
    },
    "AFC Bournemouth": {
        stadium: "Vitality Stadium",
        location: "Bournemouth",
        coordinates: [-1.838517, 50.735278]
    },
    "Brentford FC": {
        stadium: "Brentford Community Stadium",
        location: "London",
        coordinates: [-0.288889, 51.490833]
    },
    "Brighton & Hove Albion FC": {
        stadium: "Amex Stadium",
        location: "Brighton",
        coordinates: [-0.083583, 50.861822]
    },
    "Leicester City FC": {
        stadium: "King Power Stadium",
        location: "Leicester"
    },
    "Chelsea FC": {
        stadium: "Stamford Bridge",
        location: "London",
        coordinates: [-0.191034, 51.481667]
    },
    "Crystal Palace FC": {
        stadium: "Selhurst Park",
        location: "London",
        coordinates: [-0.085556, 51.398333]
    },
    "Everton FC": {
        stadium: "Goodison Park",
        location: "Liverpool",
        coordinates: [-2.966389, 53.438889]
    },
    "Fulham FC": {
        stadium: "Craven Cottage",
        location: "London",
        coordinates: [-0.221667, 51.475]
    },
    "Liverpool FC": {
        stadium: "Anfield",
        location: "Liverpool",
        coordinates: [-2.96083, 53.43083]
    },
    "Southampton FC": {
        stadium: "St Mary's Stadium",
        location: "Southampton"
    },
    "Manchester City FC": {
        stadium: "Etihad Stadium",
        location: "Manchester",
        coordinates: [-2.200278, 53.483056]
    },
    "Manchester United FC": {
        stadium: "Old Trafford",
        location: "Manchester",
        coordinates: [-2.291389, 53.463056]
    },
    "Newcastle United FC": {
        stadium: "St. James' Park",
        location: "Newcastle",
        coordinates: [-1.621667, 54.975556]
    },
    "Nottingham Forest FC": {
        stadium: "The City Ground",
        location: "Nottingham",
        coordinates: [-1.132778, 52.94]
    },
    "Ipswich Town FC": {
        stadium: "Portman Road",
        location: "Ipswich"
    },
    "Tottenham Hotspur FC": {
        stadium: "Tottenham Hotspur Stadium",
        location: "London",
        coordinates: [-0.066389, 51.604444]
    },
    "West Ham United FC": {
        stadium: "London Stadium",
        location: "London",
        coordinates: [-0.016667, 51.538889]
    },
    "Wolverhampton Wanderers FC": {
        stadium: "Molineux Stadium",
        location: "Wolverhampton",
        coordinates: [-2.130278, 52.590278]
    }
};

// Function to get venue information for a team
function getVenueForTeam(teamName) {
    return TEAM_VENUES[teamName] || null;
}

// Export the functions and data
export { TEAM_VENUES, getVenueForTeam }; 