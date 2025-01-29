// Mapping of Premier League and Ligue 1 teams to their home venues
const TEAM_VENUES = {
    // Premier League Teams
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
    },
    "Leicester City FC": {
        stadium: "King Power Stadium",
        location: "Leicester",
        coordinates: [-1.142222, 52.620278]
    },
    "Southampton FC": {
        stadium: "St Mary's Stadium",
        location: "Southampton",
        coordinates: [-1.391111, 50.905833]
    },
    "Ipswich Town FC": {
        stadium: "Portman Road",
        location: "Ipswich",
        coordinates: [1.144722, 52.054722]
    },
    
    // Ligue 1 Teams
    "Paris Saint-Germain FC": {
        stadium: "Parc des Princes",
        location: "Paris",
        coordinates: [2.253049, 48.841389]
    },
    "Olympique de Marseille": {
        stadium: "Orange Vélodrome",
        location: "Marseille",
        coordinates: [5.396389, 43.269722]
    },
    "AS Monaco FC": {
        stadium: "Stade Louis II",
        location: "Monaco",
        coordinates: [7.415833, 43.727778]
    },
    "Olympique Lyonnais": {
        stadium: "Groupama Stadium",
        location: "Lyon",
        coordinates: [4.982222, 45.765278]
    },
    "Lille OSC": {
        stadium: "Stade Pierre-Mauroy",
        location: "Lille",
        coordinates: [3.130278, 50.611944]
    },
    "Stade Rennais FC 1901": {
        stadium: "Roazhon Park",
        location: "Rennes",
        coordinates: [-1.713056, 48.107778]
    },
    "Racing Club de Lens": {
        stadium: "Stade Bollaert-Delelis",
        location: "Lens",
        coordinates: [2.815278, 50.432778]
    },
    "OGC Nice": {
        stadium: "Allianz Riviera",
        location: "Nice",
        coordinates: [7.192778, 43.705278]
    },
    "FC Nantes": {
        stadium: "Stade de la Beaujoire",
        location: "Nantes",
        coordinates: [-1.525278, 47.255833]
    },
    "RC Strasbourg Alsace": {
        stadium: "Stade de la Meinau",
        location: "Strasbourg",
        coordinates: [7.758333, 48.560278]
    },
    "Stade de Reims": {
        stadium: "Stade Auguste-Delaune",
        location: "Reims",
        coordinates: [4.025556, 49.246667]
    },
    "Montpellier HSC": {
        stadium: "Stade de la Mosson",
        location: "Montpellier",
        coordinates: [3.812222, 43.622222]
    },
    "Toulouse FC": {
        stadium: "Stadium de Toulouse",
        location: "Toulouse",
        coordinates: [1.434167, 43.583333]
    },
    "Stade Brestois 29": {
        stadium: "Stade Francis-Le Blé",
        location: "Brest",
        coordinates: [-4.485278, 48.402778]
    },
    "FC Lorient": {
        stadium: "Stade du Moustoir",
        location: "Lorient",
        coordinates: [-3.370833, 47.748611]
    },
    "Clermont Foot 63": {
        stadium: "Stade Gabriel Montpied",
        location: "Clermont-Ferrand",
        coordinates: [3.149722, 45.788889]
    },
    "FC Metz": {
        stadium: "Stade Saint-Symphorien",
        location: "Metz",
        coordinates: [6.175278, 49.109722]
    },
    "Le Havre AC": {
        stadium: "Stade Océane",
        location: "Le Havre",
        coordinates: [0.168889, 49.496944]
    },
    "Angers SCO": {
        stadium: "Stade Raymond Kopa",
        location: "Angers",
        coordinates: [-0.525833, 47.461944]
    },
    "AJ Auxerre": {
        stadium: "Stade de l'Abbé-Deschamps",
        location: "Auxerre",
        coordinates: [3.570833, 47.780556]
    },
    "AS Saint-Étienne": {
        stadium: "Stade Geoffroy-Guichard",
        location: "Saint-Étienne",
        coordinates: [4.390278, 45.460833]
    }
};

// Function to get venue information for a team
function getVenueForTeam(teamName) {
    return TEAM_VENUES[teamName] || null;
}

// Export the functions and data
export { TEAM_VENUES, getVenueForTeam }; 