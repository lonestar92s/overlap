// Venue data organized by league
const PREMIER_LEAGUE_VENUES = {
    "Arsenal FC": {
        stadium: "Emirates Stadium",
        location: "London",
        coordinates: [-0.108438, 51.555],
        ticketUrl: ''
    },
    "Aston Villa FC": {
        stadium: "Villa Park",
        location: "Birmingham",
        coordinates: [-1.884746, 52.509],
        ticketUrl: ''
    },
    "AFC Bournemouth": {
        stadium: "Vitality Stadium",
        location: "Bournemouth",
        coordinates: [-1.838517, 50.735278],
        ticketUrl: ''
    },
    "Brentford FC": {
        stadium: "Brentford Community Stadium",
        location: "London",
        coordinates: [-0.288889, 51.490833],
        ticketUrl: ''
    },
    "Brighton & Hove Albion FC": {
        stadium: "Amex Stadium",
        location: "Brighton",
        coordinates: [-0.083583, 50.861822],
        ticketUrl: ''
    },
    "Chelsea FC": {
        stadium: "Stamford Bridge",
        location: "London",
        coordinates: [-0.191034, 51.481667],
        ticketUrl: ''
    },
    "Crystal Palace FC": {
        stadium: "Selhurst Park",
        location: "London",
        coordinates: [-0.085556, 51.398333],
        ticketUrl: ''
    },
    "Everton FC": {
        stadium: "Goodison Park",
        location: "Liverpool",
        coordinates: [-2.966389, 53.438889],
        ticketUrl: ''
    },
    "Fulham FC": {
        stadium: "Craven Cottage",
        location: "London",
        coordinates: [-0.221667, 51.475],
        ticketUrl: ''
    },
    "Liverpool FC": {
        stadium: "Anfield",
        location: "Liverpool",
        coordinates: [-2.96083, 53.43083],
        ticketUrl: ''
    },
    "Manchester City FC": {
        stadium: "Etihad Stadium",
        location: "Manchester",
        coordinates: [-2.200278, 53.483056],
        ticketUrl: ''
    },
    "Manchester United FC": {
        stadium: "Old Trafford",
        location: "Manchester",
        coordinates: [-2.291389, 53.463056],
        ticketUrl: ''
    },
    "Newcastle United FC": {
        stadium: "St. James' Park",
        location: "Newcastle",
        coordinates: [-1.621667, 54.975556],
        ticketUrl: ''
    },
    "Nottingham Forest FC": {
        stadium: "The City Ground",
        location: "Nottingham",
        coordinates: [-1.132778, 52.94],
        ticketUrl: ''
    },
    "Tottenham Hotspur FC": {
        stadium: "Tottenham Hotspur Stadium",
        location: "London",
        coordinates: [-0.066389, 51.604444],
        ticketUrl: ''
    },
    "West Ham United FC": {
        stadium: "London Stadium",
        location: "London",
        coordinates: [-0.016667, 51.538889],
        ticketUrl: ''
    },
    "Wolverhampton Wanderers FC": {
        stadium: "Molineux Stadium",
        location: "Wolverhampton",
        coordinates: [-2.130278, 52.590278],
        ticketUrl: ''
    },
    "Leicester City FC": {
        stadium: "King Power Stadium",
        location: "Leicester",
        coordinates: [-1.142222, 52.620278],
        ticketUrl: ''
    },
    "Southampton FC": {
        stadium: "St Mary's Stadium",
        location: "Southampton",
        coordinates: [-1.391111, 50.905833],
        ticketUrl: ''
    },
    "Ipswich Town FC": {
        stadium: "Portman Road",
        location: "Ipswich",
        coordinates: [1.144722, 52.054722],
        ticketUrl: ''
    },
    "West Bromwich Albion FC": {
        stadium: "The Hawthorns",
        location: "West Bromwich",
        coordinates: [-1.963889, 52.509167],
        ticketUrl: ''
    },
    "Norwich City FC": {
        stadium: "Carrow Road",
        location: "Norwich",
        coordinates: [1.308611, 52.622222],
        ticketUrl: ''
    },
    "Hull City AFC": {
        stadium: "MKM Stadium",
        location: "Hull",
        coordinates: [-0.367778, 53.746111],
        ticketUrl: ''
    },
    "Coventry City FC": {
        stadium: "Coventry Building Society Arena",
        location: "Coventry",
        coordinates: [-1.496667, 52.448056],
        ticketUrl: ''
    },
    "Sunderland AFC": {
        stadium: "Stadium of Light",
        location: "Sunderland",
        coordinates: [-1.388333, 54.915556],
        ticketUrl: ''
    },
    "Preston North End FC": {
        stadium: "Deepdale",
        location: "Preston",
        coordinates: [-2.688333, 53.772222],
        ticketUrl: ''
    },
    "Middlesbrough FC": {
        stadium: "Riverside Stadium",
        location: "Middlesbrough",
        coordinates: [-1.216944, 54.578333],
        ticketUrl: ''
    },
    "Stoke City FC": {
        stadium: "bet365 Stadium",
        location: "Stoke-on-Trent",
        coordinates: [-2.175556, 52.988333],
        ticketUrl: ''
    },
    "Bristol City FC": {
        stadium: "Ashton Gate",
        location: "Bristol",
        coordinates: [-2.620278, 51.44],
        ticketUrl: ''
    },
    "Cardiff City FC": {
        stadium: "Cardiff City Stadium",
        location: "Cardiff",
        coordinates: [-3.203056, 51.472778],
        ticketUrl: ''
    },
    "Birmingham City FC": {
        stadium: "St Andrew's",
        location: "Birmingham",
        coordinates: [-1.868333, 52.475833],
        ticketUrl: ''
    },
    "Watford FC": {
        stadium: "Vicarage Road",
        location: "Watford",
        coordinates: [-0.401667, 51.649722],
        ticketUrl: ''
    },
    "Plymouth Argyle FC": {
        stadium: "Home Park",
        location: "Plymouth",
        coordinates: [-4.150833, 50.384722],
        ticketUrl: ''
    },
    "Queens Park Rangers FC": {
        stadium: "Loftus Road",
        location: "London",
        coordinates: [-0.232222, 51.509167],
        ticketUrl: ''
    },
    "Millwall FC": {
        stadium: "The Den",
        location: "London",
        coordinates: [-0.050833, 51.485833],
        ticketUrl: ''
    },
    "Swansea City AFC": {
        stadium: "Swansea.com Stadium",
        location: "Swansea",
        coordinates: [-3.935278, 51.6425],
        ticketUrl: ''
    },
    "Huddersfield Town AFC": {
        stadium: "John Smith's Stadium",
        location: "Huddersfield",
        coordinates: [-1.768333, 53.654167],
        ticketUrl: ''
    },
    "Sheffield Wednesday FC": {
        stadium: "Hillsborough",
        location: "Sheffield",
        coordinates: [-1.500833, 53.411389],
        ticketUrl: ''
    },
    "Rotherham United FC": {
        stadium: "AESSEAL New York Stadium",
        location: "Rotherham",
        coordinates: [-1.362222, 53.429722],
        ticketUrl: ''
    },
    "Blackburn Rovers FC": {
        stadium: "Ewood Park",
        location: "Blackburn",
        coordinates: [-2.489167, 53.728611],
        ticketUrl: ''
    }
};

const CHAMPIONSHIP_VENUES = {
    "Leeds United FC": {
        stadium: "Elland Road",
        location: "Leeds",
        coordinates: [-1.572222, 53.777778],
        ticketUrl: ''
    },
    "Southampton FC": {
        stadium: "St Mary's Stadium",
        location: "Southampton",
        coordinates: [-1.391111, 50.905833],
        ticketUrl: ''
    },
    "Ipswich Town FC": {
        stadium: "Portman Road",
        location: "Ipswich",
        coordinates: [1.144722, 52.054722],
        ticketUrl: ''
    },
    "West Bromwich Albion FC": {
        stadium: "The Hawthorns",
        location: "West Bromwich",
        coordinates: [-1.963889, 52.509167],
        ticketUrl: ''
    },
    "Norwich City FC": {
        stadium: "Carrow Road",
        location: "Norwich",
        coordinates: [1.308611, 52.622222],
        ticketUrl: ''
    },
    "Hull City AFC": {
        stadium: "MKM Stadium",
        location: "Hull",
        coordinates: [-0.367778, 53.746111],
        ticketUrl: ''
    },
    "Coventry City FC": {
        stadium: "Coventry Building Society Arena",
        location: "Coventry",
        coordinates: [-1.496667, 52.448056],
        ticketUrl: ''
    },
    "Sunderland AFC": {
        stadium: "Stadium of Light",
        location: "Sunderland",
        coordinates: [-1.388333, 54.915556],
        ticketUrl: ''
    },
    "Preston North End FC": {
        stadium: "Deepdale",
        location: "Preston",
        coordinates: [-2.688333, 53.772222],
        ticketUrl: ''
    },
    "Middlesbrough FC": {
        stadium: "Riverside Stadium",
        location: "Middlesbrough",
        coordinates: [-1.216944, 54.578333],
        ticketUrl: ''
    },
    "Stoke City FC": {
        stadium: "bet365 Stadium",
        location: "Stoke-on-Trent",
        coordinates: [-2.175556, 52.988333],
        ticketUrl: ''
    },
    "Bristol City FC": {
        stadium: "Ashton Gate",
        location: "Bristol",
        coordinates: [-2.620278, 51.44],
        ticketUrl: ''
    },
    "Cardiff City FC": {
        stadium: "Cardiff City Stadium",
        location: "Cardiff",
        coordinates: [-3.203056, 51.472778],
        ticketUrl: ''
    },
    "Birmingham City FC": {
        stadium: "St Andrew's",
        location: "Birmingham",
        coordinates: [-1.868333, 52.475833],
        ticketUrl: ''
    },
    "Watford FC": {
        stadium: "Vicarage Road",
        location: "Watford",
        coordinates: [-0.401667, 51.649722],
        ticketUrl: ''
    },
    "Plymouth Argyle FC": {
        stadium: "Home Park",
        location: "Plymouth",
        coordinates: [-4.150833, 50.384722],
        ticketUrl: ''
    },
    "Queens Park Rangers FC": {
        stadium: "Loftus Road",
        location: "London",
        coordinates: [-0.232222, 51.509167],
        ticketUrl: ''
    },
    "Millwall FC": {
        stadium: "The Den",
        location: "London",
        coordinates: [-0.050833, 51.485833],
        ticketUrl: ''
    },
    "Swansea City AFC": {
        stadium: "Swansea.com Stadium",
        location: "Swansea",
        coordinates: [-3.935278, 51.6425],
        ticketUrl: ''
    },
    "Huddersfield Town AFC": {
        stadium: "John Smith's Stadium",
        location: "Huddersfield",
        coordinates: [-1.768333, 53.654167],
        ticketUrl: ''
    },
    "Sheffield Wednesday FC": {
        stadium: "Hillsborough",
        location: "Sheffield",
        coordinates: [-1.500833, 53.411389],
        ticketUrl: ''
    },
    "Rotherham United FC": {
        stadium: "AESSEAL New York Stadium",
        location: "Rotherham",
        coordinates: [-1.362222, 53.429722],
        ticketUrl: ''
    },
    "Blackburn Rovers FC": {
        stadium: "Ewood Park",
        location: "Blackburn",
        coordinates: [-2.489167, 53.728611],
        ticketUrl: ''
    }
};

const LA_LIGA_VENUES = {
    "Real Madrid CF": {
        stadium: "Santiago Bernabéu",
        location: "Madrid",
        coordinates: [-3.688333, 40.453056],
        ticketUrl: ''
    },
    "FC Barcelona": {
        stadium: "Spotify Camp Nou",
        location: "Barcelona",
        coordinates: [2.122917, 41.380898],
        ticketUrl: ''
    },
    "Atlético de Madrid": {
        stadium: "Cívitas Metropolitano",
        location: "Madrid",
        coordinates: [-3.599722, 40.436111],
        ticketUrl: ''
    },
    "Real Sociedad de Fútbol": {
        stadium: "Reale Arena",
        location: "San Sebastián",
        coordinates: [-1.973611, 43.301389],
        ticketUrl: ''
    },
    "Real Betis Balompié": {
        stadium: "Estadio Benito Villamarín",
        location: "Seville",
        coordinates: [-5.981667, 37.356389],
        ticketUrl: ''
    },
    "Sevilla FC": {
        stadium: "Ramón Sánchez-Pizjuán",
        location: "Seville",
        coordinates: [-5.970278, 37.383889],
        ticketUrl: ''
    },
    "Villarreal CF": {
        stadium: "Estadio de la Cerámica",
        location: "Villarreal",
        coordinates: [-0.103611, 39.944167],
        ticketUrl: ''
    },
    "Athletic Club": {
        stadium: "San Mamés",
        location: "Bilbao",
        coordinates: [-2.950278, 43.264167],
        ticketUrl: ''
    },
    "Valencia CF": {
        stadium: "Mestalla",
        location: "Valencia",
        coordinates: [-0.358333, 39.474722],
        ticketUrl: ''
    },
    "CA Osasuna": {
        stadium: "El Sadar",
        location: "Pamplona",
        coordinates: [-1.636944, 42.796389],
        ticketUrl: ''
    },
    "Girona FC": {
        stadium: "Estadi Montilivi",
        location: "Girona",
        coordinates: [2.825833, 41.961389],
        ticketUrl: ''
    },
    "Getafe CF": {
        stadium: "Coliseum Alfonso Pérez",
        location: "Getafe",
        coordinates: [-3.735556, 40.325556],
        ticketUrl: ''
    },
    "RCD Mallorca": {
        stadium: "Visit Mallorca Estadi",
        location: "Palma",
        coordinates: [2.637778, 39.589444],
        ticketUrl: ''
    },
    "Deportivo Alavés": {
        stadium: "Mendizorrotza",
        location: "Vitoria-Gasteiz",
        coordinates: [-2.688889, 42.839722],
        ticketUrl: ''
    },
    "UD Las Palmas": {
        stadium: "Estadio Gran Canaria",
        location: "Las Palmas",
        coordinates: [-15.456944, 28.100278],
        ticketUrl: ''
    },
    "Celta de Vigo": {
        stadium: "Abanca-Balaídos",
        location: "Vigo",
        coordinates: [-8.740278, 42.211944],
        ticketUrl: ''
    },
    "Granada CF": {
        stadium: "Nuevo Los Cármenes",
        location: "Granada",
        coordinates: [-3.595833, 37.153889],
        ticketUrl: ''
    },
    "Cádiz CF": {
        stadium: "Nuevo Mirandilla",
        location: "Cádiz",
        coordinates: [-6.270833, 36.501944],
        ticketUrl: ''
    },
    "UD Almería": {
        stadium: "Power Horse Stadium",
        location: "Almería",
        coordinates: [-2.408333, 36.841111],
        ticketUrl: ''
    },
    "Rayo Vallecano": {
        stadium: "Estadio de Vallecas",
        location: "Madrid",
        coordinates: [-3.657778, 40.391944],
        ticketUrl: ''
    }
};

const BUNDESLIGA_VENUES = {
    "FC Bayern München": {
        stadium: "Allianz Arena",
        location: "Munich",
        coordinates: [11.624722, 48.218889],
        ticketUrl: ''
    },
    "Borussia Dortmund": {
        stadium: "Signal Iduna Park",
        location: "Dortmund",
        coordinates: [7.451667, 51.492778],
        ticketUrl: ''
    },
    "RB Leipzig": {
        stadium: "Red Bull Arena",
        location: "Leipzig",
        coordinates: [12.348056, 51.345833],
        ticketUrl: ''
    },
    "Bayer 04 Leverkusen": {
        stadium: "BayArena",
        location: "Leverkusen",
        coordinates: [6.973056, 51.038056],
        ticketUrl: ''
    },
    "Eintracht Frankfurt": {
        stadium: "Deutsche Bank Park",
        location: "Frankfurt",
        coordinates: [8.645278, 50.068611],
        ticketUrl: ''
    },
    "VfL Wolfsburg": {
        stadium: "Volkswagen Arena",
        location: "Wolfsburg",
        coordinates: [10.803889, 52.431944],
        ticketUrl: ''
    },
    "SC Freiburg": {
        stadium: "Europa-Park Stadion",
        location: "Freiburg",
        coordinates: [7.899444, 48.020278],
        ticketUrl: ''
    },
    "1. FC Union Berlin": {
        stadium: "Stadion An der Alten Försterei",
        location: "Berlin",
        coordinates: [13.568333, 52.457222],
        ticketUrl: ''
    },
    "1. FSV Mainz 05": {
        stadium: "MEWA ARENA",
        location: "Mainz",
        coordinates: [8.224167, 49.984167],
        ticketUrl: ''
    },
    "TSG 1899 Hoffenheim": {
        stadium: "PreZero Arena",
        location: "Sinsheim",
        coordinates: [8.891667, 49.239444],
        ticketUrl: ''
    },
    "Borussia Mönchengladbach": {
        stadium: "Borussia-Park",
        location: "Mönchengladbach",
        coordinates: [6.385556, 51.174722],
        ticketUrl: ''
    },
    "1. FC Köln": {
        stadium: "RheinEnergieSTADION",
        location: "Cologne",
        coordinates: [6.875278, 50.933611],
        ticketUrl: ''
    },
    "SV Werder Bremen": {
        stadium: "Weserstadion",
        location: "Bremen",
        coordinates: [8.837222, 53.066389],
        ticketUrl: ''
    },
    "FC Augsburg": {
        stadium: "WWK ARENA",
        location: "Augsburg",
        coordinates: [10.931944, 48.332778],
        ticketUrl: ''
    },
    "VfB Stuttgart": {
        stadium: "MHPArena",
        location: "Stuttgart",
        coordinates: [9.231667, 48.792222],
        ticketUrl: ''
    },
    "VfL Bochum 1848": {
        stadium: "Vonovia Ruhrstadion",
        location: "Bochum",
        coordinates: [7.215556, 51.465],
        ticketUrl: ''
    },
    "1. FC Heidenheim 1846": {
        stadium: "Voith-Arena",
        location: "Heidenheim",
        coordinates: [10.149722, 48.676111],
        ticketUrl: ''
    },
    "SV Darmstadt 98": {
        stadium: "Merck-Stadion am Böllenfalltor",
        location: "Darmstadt",
        coordinates: [8.649444, 49.859167],
        ticketUrl: ''
    },
    "Holstein Kiel": {
        stadium: "Holstein-Stadion",
        location: "Kiel",
        coordinates: [10.122222, 54.340556],
        ticketUrl: ''
    },
    "FC St. Pauli 1910": {
        stadium: "Millerntor-Stadion",
        location: "Hamburg",
        coordinates: [9.970556, 53.554722],
        ticketUrl: ''
    }
};

const LIGUE_1_VENUES = {
    "Paris Saint-Germain FC": {
        stadium: "Parc des Princes",
        location: "Paris",
        coordinates: [2.253056, 48.841389],
        ticketUrl: ''
    },
    "Olympique de Marseille": {
        stadium: "Orange Vélodrome",
        location: "Marseille",
        coordinates: [5.396389, 43.269722],
        ticketUrl: ''
    },
    "AS Monaco FC": {
        stadium: "Stade Louis II",
        location: "Monaco",
        coordinates: [7.415833, 43.727778],
        ticketUrl: ''
    },
    "Olympique Lyonnais": {
        stadium: "Groupama Stadium",
        location: "Lyon",
        coordinates: [4.982222, 45.765278],
        ticketUrl: ''
    },
    "Lille OSC": {
        stadium: "Stade Pierre-Mauroy",
        location: "Lille",
        coordinates: [3.130278, 50.611944],
        ticketUrl: 'https://billetterie.losc.fr/en/'
    },
    "Stade Rennais FC 1901": {
        stadium: "Roazhon Park",
        location: "Rennes",
        coordinates: [-1.713056, 48.107778],
        ticketUrl: ''
    },
    "Racing Club de Lens": {
        stadium: "Stade Bollaert-Delelis",
        location: "Lens",
        coordinates: [2.815278, 50.432778],
        ticketUrl: ''
    },
    "OGC Nice": {
        stadium: "Allianz Riviera",
        location: "Nice",
        coordinates: [7.192778, 43.705278],
        ticketUrl: ''
    },
    "FC Nantes": {
        stadium: "Stade de la Beaujoire",
        location: "Nantes",
        coordinates: [-1.525278, 47.255833],
        ticketUrl: ''
    },
    "RC Strasbourg Alsace": {
        stadium: "Stade de la Meinau",
        location: "Strasbourg",
        coordinates: [7.758333, 48.560278],
        ticketUrl: ''
    },
    "Stade de Reims": {
        stadium: "Stade Auguste-Delaune",
        location: "Reims",
        coordinates: [4.025556, 49.246667],
        ticketUrl: ''
    },
    "Montpellier HSC": {
        stadium: "Stade de la Mosson",
        location: "Montpellier",
        coordinates: [3.812222, 43.622222],
        ticketUrl: ''
    },
    "Toulouse FC": {
        stadium: "Stadium de Toulouse",
        location: "Toulouse",
        coordinates: [1.434167, 43.583333],
        ticketUrl: ''
    },
    "Stade Brestois 29": {
        stadium: "Stade Francis-Le Blé",
        location: "Brest",
        coordinates: [-4.485278, 48.402778],
        ticketUrl: ''
    },
    "FC Lorient": {
        stadium: "Stade du Moustoir",
        location: "Lorient",
        coordinates: [-3.370833, 47.748611],
        ticketUrl: ''
    },
    "Clermont Foot 63": {
        stadium: "Stade Gabriel Montpied",
        location: "Clermont-Ferrand",
        coordinates: [3.149722, 45.788889],
        ticketUrl: ''
    },
    "FC Metz": {
        stadium: "Stade Saint-Symphorien",
        location: "Metz",
        coordinates: [6.175278, 49.109722],
        ticketUrl: ''
    },
    "Le Havre AC": {
        stadium: "Stade Océane",
        location: "Le Havre",
        coordinates: [0.168889, 49.496944],
        ticketUrl: ''
    },
    "Angers SCO": {
        stadium: "Stade Raymond Kopa",
        location: "Angers",
        coordinates: [-0.525833, 47.461944],
        ticketUrl: ''
    },
    "AJ Auxerre": {
        stadium: "Stade de l'Abbé-Deschamps",
        location: "Auxerre",
        coordinates: [3.570833, 47.780556],
        ticketUrl: ''
    },
    "AS Saint-Étienne": {
        stadium: "Stade Geoffroy-Guichard",
        location: "Saint-Étienne",
        coordinates: [4.390278, 45.460833],
        ticketUrl: ''
    }
};

const EREDIVISIE_VENUES = {
    "PSV": {
        stadium: "Philips Stadion",
        location: "Eindhoven",
        coordinates: [5.467778, 51.441944],
        ticketUrl: ''
    },
    "Feyenoord Rotterdam": {
        stadium: "De Kuip",
        location: "Rotterdam",
        coordinates: [4.523889, 51.893889],
        ticketUrl: ''
    },
    "AFC Ajax": {
        stadium: "Johan Cruijff ArenA",
        location: "Amsterdam",
        coordinates: [4.941944, 52.314167],
        ticketUrl: ''
    },
    "AZ": {
        stadium: "AFAS Stadion",
        location: "Alkmaar",
        coordinates: [4.744722, 52.605833],
        ticketUrl: ''
    },
    "FC Twente '65": {
        stadium: "De Grolsch Veste",
        location: "Enschede",
        coordinates: [6.865278, 52.236111],
        ticketUrl: ''
    },
    "Vitesse Arnhem": {
        stadium: "GelreDome",
        location: "Arnhem",
        coordinates: [5.911944, 51.965],
        ticketUrl: ''
    },
    "FC Utrecht": {
        stadium: "Stadion Galgenwaard",
        location: "Utrecht",
        coordinates: [5.145556, 52.078611],
        ticketUrl: ''
    },
    "SC Heerenveen": {
        stadium: "Abe Lenstra Stadion",
        location: "Heerenveen",
        coordinates: [5.930556, 52.956944],
        ticketUrl: ''
    },
    "Sparta Rotterdam": {
        stadium: "Sparta Stadion Het Kasteel",
        location: "Rotterdam",
        coordinates: [4.431944, 51.920278],
        ticketUrl: ''
    },
    "NEC": {
        stadium: "Goffertstadion",
        location: "Nijmegen",
        coordinates: [5.856944, 51.826667],
        ticketUrl: ''
    },
    "PEC Zwolle": {
        stadium: "MAC³PARK stadion",
        location: "Zwolle",
        coordinates: [6.094444, 52.524167],
        ticketUrl: ''
    },
    "Go Ahead Eagles": {
        stadium: "De Adelaarshorst",
        location: "Deventer",
        coordinates: [6.186389, 52.255],
        ticketUrl: ''
    },
    "Almere City FC": {
        stadium: "Yanmar Stadion",
        location: "Almere",
        coordinates: [5.2875, 52.341944],
        ticketUrl: ''
    },
    "Excelsior Rotterdam": {
        stadium: "Van Donge & De Roo Stadion",
        location: "Rotterdam",
        coordinates: [4.511944, 51.918889],
        ticketUrl: ''
    },
    "Heracles Almelo": {
        stadium: "Erve Asito",
        location: "Almelo",
        coordinates: [6.658333, 52.356944],
        ticketUrl: ''
    },
    "RKC Waalwijk": {
        stadium: "Mandemakers Stadion",
        location: "Waalwijk",
        coordinates: [5.065833, 51.688889],
        ticketUrl: ''
    },
    "Fortuna Sittard": {
        stadium: "Fortuna Sittard Stadion",
        location: "Sittard",
        coordinates: [5.866667, 51.001389],
        ticketUrl: ''
    },
    "FC Volendam": {
        stadium: "Kras Stadion",
        location: "Volendam",
        coordinates: [5.070556, 52.497778],
        ticketUrl: ''
    },
    "FC Groningen": {
        stadium: "Euroborg",
        location: "Groningen",
        coordinates: [6.574722, 53.196944],
        ticketUrl: ''
    },
    "Willem II Tilburg": {
        stadium: "Koning Willem II Stadion",
        location: "Tilburg",
        coordinates: [5.081944, 51.553889],
        ticketUrl: ''
    },
    "NAC Breda": {
        stadium: "Rat Verlegh Stadion",
        location: "Breda",
        coordinates: [4.801944, 51.588333],
        ticketUrl: ''
    }
};

// Function to get venue information for a team
export function getVenueForTeam(teamName) {
    const allVenues = {
        ...PREMIER_LEAGUE_VENUES,
        ...CHAMPIONSHIP_VENUES,
        ...LA_LIGA_VENUES,
        ...BUNDESLIGA_VENUES,
        ...LIGUE_1_VENUES,
        ...EREDIVISIE_VENUES
    };
    return allVenues[teamName] || null;
}

// Export the functions and data
export {
    PREMIER_LEAGUE_VENUES,
    CHAMPIONSHIP_VENUES,
    LA_LIGA_VENUES,
    BUNDESLIGA_VENUES,
    LIGUE_1_VENUES,
    EREDIVISIE_VENUES
}; 