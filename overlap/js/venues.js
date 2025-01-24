// Mapping of Premier League teams to their home venues
const TEAM_VENUES = {
    // Add team names exactly as they appear in the API response
    "Arsenal FC": {
        stadium: "Emirates Stadium",
        location: "London"
    },
    "Aston Villa FC": {
        stadium: "Villa Park",
        location: "Birmingham"
    },
    "AFC Bournemouth": {
        stadium: "Vitality Stadium",
        location: "Bournemouth"
    },
    "Brentford FC": {
        stadium: "Brentford Community Stadium",
        location: "London"
    },
    "Brighton & Hove Albion FC": {
        stadium: "Amex Stadium",
        location: "Brighton"
    },
    "Leicester City FC": {
        stadium: "King Power Stadium",
        location: "Leicester"
    },
    "Chelsea FC": {
        stadium: "Stamford Bridge",
        location: "London"
    },
    "Crystal Palace FC": {
        stadium: "Selhurst Park",
        location: "London"
    },
    "Everton FC": {
        stadium: "Goodison Park",
        location: "Liverpool"
    },
    "Fulham FC": {
        stadium: "Craven Cottage",
        location: "London"
    },
    "Liverpool FC": {
        stadium: "Anfield",
        location: "Liverpool"
    },
    "Southampton FC": {
        stadium: "St Mary's Stadium",
        location: "Southampton"
    },
    "Manchester City FC": {
        stadium: "Etihad Stadium",
        location: "Manchester"
    },
    "Manchester United FC": {
        stadium: "Old Trafford",
        location: "Manchester"
    },
    "Newcastle United FC": {
        stadium: "St. James' Park",
        location: "Newcastle"
    },
    "Nottingham Forest FC": {
        stadium: "The City Ground",
        location: "Nottingham"
    },
    "Ipswich Town FC": {
        stadium: "Portman Road",
        location: "Ipswich"
    },
    "Tottenham Hotspur FC": {
        stadium: "Tottenham Hotspur Stadium",
        location: "London"
    },
    "West Ham United FC": {
        stadium: "London Stadium",
        location: "London"
    },
    "Wolverhampton Wanderers FC": {
        stadium: "Molineux Stadium",
        location: "Wolverhampton"
    }
};

// Function to get venue information for a team
function getVenueForTeam(teamName) {
    return TEAM_VENUES[teamName] || null;
}

// Export the functions and data
export { TEAM_VENUES, getVenueForTeam }; 