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
    },
    // La Liga Teams
    "Real Madrid CF": {
        stadium: "Santiago Bernabéu",
        location: "Madrid",
        coordinates: [-3.688333, 40.453056]
    },
    "FC Barcelona": {
        stadium: "Spotify Camp Nou",
        location: "Barcelona",
        coordinates: [2.122917, 41.380898]
    },
    "Atlético de Madrid": {
        stadium: "Cívitas Metropolitano",
        location: "Madrid",
        coordinates: [-3.599722, 40.436111]
    },
    "Real Sociedad de Fútbol": {
        stadium: "Reale Arena",
        location: "San Sebastián",
        coordinates: [-1.973611, 43.301389]
    },
    "Real Betis Balompié": {
        stadium: "Estadio Benito Villamarín",
        location: "Seville",
        coordinates: [-5.981667, 37.356389]
    },
    "Sevilla FC": {
        stadium: "Ramón Sánchez-Pizjuán",
        location: "Seville",
        coordinates: [-5.970278, 37.383889]
    },
    "Villarreal CF": {
        stadium: "Estadio de la Cerámica",
        location: "Villarreal",
        coordinates: [-0.103611, 39.944167]
    },
    "Athletic Club": {
        stadium: "San Mamés",
        location: "Bilbao",
        coordinates: [-2.950278, 43.264167]
    },
    "Valencia CF": {
        stadium: "Mestalla",
        location: "Valencia",
        coordinates: [-0.358333, 39.474722]
    },
    "CA Osasuna": {
        stadium: "El Sadar",
        location: "Pamplona",
        coordinates: [-1.636944, 42.796389]
    },
    "Girona FC": {
        stadium: "Estadi Montilivi",
        location: "Girona",
        coordinates: [2.825833, 41.961111]
    },
    "Getafe CF": {
        stadium: "Coliseum Alfonso Pérez",
        location: "Getafe",
        coordinates: [-3.735556, 40.325556]
    },
    "RCD Mallorca": {
        stadium: "Visit Mallorca Estadi",
        location: "Palma",
        coordinates: [2.637778, 39.589444]
    },
    "Deportivo Alavés": {
        stadium: "Mendizorrotza",
        location: "Vitoria-Gasteiz",
        coordinates: [-2.688889, 42.839722]
    },
    "UD Las Palmas": {
        stadium: "Estadio Gran Canaria",
        location: "Las Palmas",
        coordinates: [-15.456944, 28.100278]
    },
    "Celta de Vigo": {
        stadium: "Abanca-Balaídos",
        location: "Vigo",
        coordinates: [-8.740278, 42.211944]
    },
    "Granada CF": {
        stadium: "Nuevo Los Cármenes",
        location: "Granada",
        coordinates: [-3.595833, 37.153889]
    },
    "Cádiz CF": {
        stadium: "Nuevo Mirandilla",
        location: "Cádiz",
        coordinates: [-6.270833, 36.501944]
    },
    "UD Almería": {
        stadium: "Power Horse Stadium",
        location: "Almería",
        coordinates: [-2.408333, 36.841111]
    },
    "Rayo Vallecano": {
        stadium: "Estadio de Vallecas",
        location: "Madrid",
        coordinates: [-3.657778, 40.391944]
    },
    // Bundesliga Teams
    "FC Bayern München": {
        stadium: "Allianz Arena",
        location: "Munich",
        coordinates: [11.624722, 48.218889]
    },
    "Borussia Dortmund": {
        stadium: "Signal Iduna Park",
        location: "Dortmund",
        coordinates: [7.451667, 51.492778]
    },
    "RB Leipzig": {
        stadium: "Red Bull Arena",
        location: "Leipzig",
        coordinates: [12.348056, 51.345833]
    },
    "Bayer 04 Leverkusen": {
        stadium: "BayArena",
        location: "Leverkusen",
        coordinates: [6.973056, 51.038056]
    },
    "Eintracht Frankfurt": {
        stadium: "Deutsche Bank Park",
        location: "Frankfurt",
        coordinates: [8.645278, 50.068611]
    },
    "VfL Wolfsburg": {
        stadium: "Volkswagen Arena",
        location: "Wolfsburg",
        coordinates: [10.803889, 52.431944]
    },
    "SC Freiburg": {
        stadium: "Europa-Park Stadion",
        location: "Freiburg",
        coordinates: [7.899444, 48.020278]
    },
    "1. FC Union Berlin": {
        stadium: "Stadion An der Alten Försterei",
        location: "Berlin",
        coordinates: [13.568333, 52.457222]
    },
    "1. FSV Mainz 05": {
        stadium: "MEWA ARENA",
        location: "Mainz",
        coordinates: [8.224167, 49.984167]
    },
    "TSG 1899 Hoffenheim": {
        stadium: "PreZero Arena",
        location: "Sinsheim",
        coordinates: [8.891667, 49.239444]
    },
    "Borussia Mönchengladbach": {
        stadium: "Borussia-Park",
        location: "Mönchengladbach",
        coordinates: [6.385556, 51.174722]
    },
    "1. FC Köln": {
        stadium: "RheinEnergieSTADION",
        location: "Cologne",
        coordinates: [6.875278, 50.933611]
    },
    "SV Werder Bremen": {
        stadium: "Weserstadion",
        location: "Bremen",
        coordinates: [8.837222, 53.066389]
    },
    "FC Augsburg": {
        stadium: "WWK ARENA",
        location: "Augsburg",
        coordinates: [10.931944, 48.332778]
    },
    "VfB Stuttgart": {
        stadium: "MHPArena",
        location: "Stuttgart",
        coordinates: [9.231667, 48.792222]
    },
    "VfL Bochum": {
        stadium: "Vonovia Ruhrstadion",
        location: "Bochum",
        coordinates: [7.215556, 51.465]
    },
    "1. FC Heidenheim": {
        stadium: "Voith-Arena",
        location: "Heidenheim",
        coordinates: [10.149722, 48.676111]
    },
    "SV Darmstadt 98": {
        stadium: "Merck-Stadion am Böllenfalltor",
        location: "Darmstadt",
        coordinates: [8.649444, 49.859167]
    }
};

// Function to get venue information for a team
function getVenueForTeam(teamName) {
    return TEAM_VENUES[teamName] || null;
}

// Export the functions and data
export { TEAM_VENUES, getVenueForTeam }; 