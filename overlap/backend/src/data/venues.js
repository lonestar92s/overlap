// Venue data organized by league
const PREMIER_LEAGUE_VENUES = {
    "Arsenal FC": {
        stadium: "Emirates Stadium",
        city: "London",
        country: "England",
        coordinates: [-0.108438, 51.555],
        ticketUrl: ''
    },
    "Aston Villa FC": {
        stadium: "Villa Park",
        city: "Birmingham",
        country: "England",
        coordinates: [-1.884746, 52.509],
        ticketUrl: ''
    },
    "AFC Bournemouth": {
        stadium: "Vitality Stadium",
        city: "Bournemouth",
        country: "England",
        coordinates: [-1.838517, 50.735278],
        ticketUrl: ''
    },
    "Brentford FC": {
        stadium: "Brentford Community Stadium",
        city: "London",
        country: "England",
        coordinates: [-0.288889, 51.490833],
        ticketUrl: ''
    },
    "Brighton & Hove Albion FC": {
        stadium: "Amex Stadium",
        city: "Brighton",
        country: "England",
        coordinates: [-0.083583, 50.861822],
        ticketUrl: ''
    },
    "Chelsea FC": {
        stadium: "Stamford Bridge",
        city: "London",
        country: "England",
        coordinates: [-0.191034, 51.481667],
        ticketUrl: ''
    },
    "Crystal Palace FC": {
        stadium: "Selhurst Park",
        city: "London",
        country: "England",
        coordinates: [-0.085556, 51.398333],
        ticketUrl: ''
    },
    "Everton FC": {
        stadium: "Goodison Park",
        city: "Liverpool",
        country: "England",
        coordinates: [-2.966389, 53.438889],
        ticketUrl: ''
    },
    "Fulham FC": {
        stadium: "Craven Cottage",
        city: "London",
        country: "England",
        coordinates: [-0.221667, 51.475],
        ticketUrl: ''
    },
    "Liverpool FC": {
        stadium: "Anfield",
        city: "Liverpool",
        country: "England",
        coordinates: [-2.96083, 53.43083],
        ticketUrl: ''
    },
    "Manchester City FC": {
        stadium: "Etihad Stadium",
        city: "Manchester",
        country: "England",
        coordinates: [-2.200278, 53.483056],
        ticketUrl: ''
    },
    "Manchester United FC": {
        stadium: "Old Trafford",
        city: "Manchester",
        country: "England",
        coordinates: [-2.291389, 53.463056],
        ticketUrl: ''
    },
    "Newcastle United FC": {
        stadium: "St. James' Park",
        city: "Newcastle",
        country: "England",
        coordinates: [-1.621667, 54.975556],
        ticketUrl: ''
    },
    "Nottingham Forest FC": {
        stadium: "The City Ground",
        city: "Nottingham",
        country: "England",
        coordinates: [-1.132778, 52.94],
        ticketUrl: ''
    },
    "Tottenham Hotspur FC": {
        stadium: "Tottenham Hotspur Stadium",
        city: "London",
        country: "England",
        coordinates: [-0.066389, 51.604444],
        ticketUrl: ''
    },
    "West Ham United FC": {
        stadium: "London Stadium",
        city: "London",
        country: "England",
        coordinates: [-0.016667, 51.538889],
        ticketUrl: ''
    },
    "Wolverhampton Wanderers FC": {
        stadium: "Molineux Stadium",
        city: "Wolverhampton",
        country: "England",
        coordinates: [-2.130278, 52.590278],
        ticketUrl: ''
    },
    "Leicester City FC": {
        stadium: "King Power Stadium",
        city: "Leicester",
        country: "England",
        coordinates: [-1.142222, 52.620278],
        ticketUrl: ''
    },
    "Southampton FC": {
        stadium: "St Mary's Stadium",
        city: "Southampton",
        country: "England",
        coordinates: [-1.391111, 50.905833],
        ticketUrl: ''
    },
    "Ipswich Town FC": {
        stadium: "Portman Road",
        city: "Ipswich",
        country: "England",
        coordinates: [1.144722, 52.054722],
        ticketUrl: ''
    },
    "West Bromwich Albion FC": {
        stadium: "The Hawthorns",
        city: "West Bromwich",
        country: "England",
        coordinates: [-1.963889, 52.509167],
        ticketUrl: ''
    },
    "Norwich City FC": {
        stadium: "Carrow Road",
        city: "Norwich",
        country: "England",
        coordinates: [1.308611, 52.622222],
        ticketUrl: ''
    },
    "Hull City AFC": {
        stadium: "MKM Stadium",
        city: "Hull",
        country: "England",
        coordinates: [-0.367778, 53.746111],
        ticketUrl: ''
    },
    "Coventry City FC": {
        stadium: "Coventry Building Society Arena",
        city: "Coventry",
        country: "England",
        coordinates: [-1.496667, 52.448056],
        ticketUrl: ''
    },
    "Sunderland AFC": {
        stadium: "Stadium of Light",
        city: "Sunderland",
        country: "England",
        coordinates: [-1.388333, 54.915556],
        ticketUrl: ''
    },
    "Preston North End FC": {
        stadium: "Deepdale",
        city: "Preston",
        country: "England",
        coordinates: [-2.688333, 53.772222],
        ticketUrl: ''
    },
    "Middlesbrough FC": {
        stadium: "Riverside Stadium",
        city: "Middlesbrough",
        country: "England",
        coordinates: [-1.216944, 54.578333],
        ticketUrl: ''
    },
    "Stoke City FC": {
        stadium: "bet365 Stadium",
        city: "Stoke-on-Trent",
        country: "England",
        coordinates: [-2.175556, 52.988333],
        ticketUrl: ''
    },
    "Bristol City FC": {
        stadium: "Ashton Gate",
        city: "Bristol",
        country: "England",
        coordinates: [-2.620278, 51.44],
        ticketUrl: ''
    },
    "Cardiff City FC": {
        stadium: "Cardiff City Stadium",
        city: "Cardiff",
        country: "Wales",
        coordinates: [-3.203056, 51.472778],
        ticketUrl: ''
    },
    "Birmingham City FC": {
        stadium: "St Andrew's",
        city: "Birmingham",
        country: "England",
        coordinates: [-1.868333, 52.475833],
        ticketUrl: ''
    },
    "Watford FC": {
        stadium: "Vicarage Road",
        city: "Watford",
        country: "England",
        coordinates: [-0.401667, 51.649722],
        ticketUrl: ''
    },
    "Plymouth Argyle FC": {
        stadium: "Home Park",
        city: "Plymouth",
        country: "England",
        coordinates: [-4.150833, 50.384722],
        ticketUrl: ''
    },
    "Queens Park Rangers FC": {
        stadium: "Loftus Road",
        city: "London",
        country: "England",
        coordinates: [-0.232222, 51.509167],
        ticketUrl: ''
    },
    "Millwall FC": {
        stadium: "The Den",
        city: "London",
        country: "England",
        coordinates: [-0.050833, 51.485833],
        ticketUrl: ''
    },
    "Swansea City AFC": {
        stadium: "Swansea.com Stadium",
        city: "Swansea",
        country: "Wales",
        coordinates: [-3.935278, 51.6425],
        ticketUrl: ''
    },
    "Huddersfield Town AFC": {
        stadium: "John Smith's Stadium",
        city: "Huddersfield",
        country: "England",
        coordinates: [-1.768333, 53.654167],
        ticketUrl: ''
    },
    "Sheffield Wednesday FC": {
        stadium: "Hillsborough",
        city: "Sheffield",
        country: "England",
        coordinates: [-1.500833, 53.411389],
        ticketUrl: ''
    },
    "Rotherham United FC": {
        stadium: "AESSEAL New York Stadium",
        city: "Rotherham",
        country: "England",
        coordinates: [-1.362222, 53.429722],
        ticketUrl: ''
    },
    "Blackburn Rovers FC": {
        stadium: "Ewood Park",
        city: "Blackburn",
        country: "England",
        coordinates: [-2.489167, 53.728611],
        ticketUrl: ''
    },
    "Burnley FC": {
        stadium: "Turf Moor",
        city: "Burnley",
        country: "England",
        coordinates: [-2.230833, 53.789167],
        ticketUrl: ''
    }
};

const CHAMPIONSHIP_VENUES = {
    "Leeds United FC": {
        stadium: "Elland Road",
        city: "Leeds",
        country: "England",
        coordinates: [-1.572222, 53.777778],
        ticketUrl: ''
    },
    "Southampton FC": {
        stadium: "St Mary's Stadium",
        city: "Southampton",
        country: "England",
        coordinates: [-1.391111, 50.905833],
        ticketUrl: ''
    },
    "Ipswich Town FC": {
        stadium: "Portman Road",
        city: "Ipswich",
        country: "England",
        coordinates: [1.144722, 52.054722],
        ticketUrl: ''
    },
    "West Bromwich Albion FC": {
        stadium: "The Hawthorns",
        city: "West Bromwich",
        country: "England",
        coordinates: [-1.963889, 52.509167],
        ticketUrl: ''
    },
    "Norwich City FC": {
        stadium: "Carrow Road",
        city: "Norwich",
        country: "England",
        coordinates: [1.308611, 52.622222],
        ticketUrl: ''
    },
    "Hull City AFC": {
        stadium: "MKM Stadium",
        city: "Hull",
        country: "England",
        coordinates: [-0.367778, 53.746111],
        ticketUrl: ''
    },
    "Coventry City FC": {
        stadium: "Coventry Building Society Arena",
        city: "Coventry",
        country: "England",
        coordinates: [-1.496667, 52.448056],
        ticketUrl: ''
    },
    "Sunderland AFC": {
        stadium: "Stadium of Light",
        city: "Sunderland",
        country: "England",
        coordinates: [-1.388333, 54.915556],
        ticketUrl: ''
    },
    "Preston North End FC": {
        stadium: "Deepdale",
        city: "Preston",
        country: "England",
        coordinates: [-2.688333, 53.772222],
        ticketUrl: ''
    },
    "Middlesbrough FC": {
        stadium: "Riverside Stadium",
        city: "Middlesbrough",
        country: "England",
        coordinates: [-1.216944, 54.578333],
        ticketUrl: ''
    },
    "Stoke City FC": {
        stadium: "bet365 Stadium",
        city: "Stoke-on-Trent",
        country: "England",
        coordinates: [-2.175556, 52.988333],
        ticketUrl: ''
    },
    "Bristol City FC": {
        stadium: "Ashton Gate",
        city: "Bristol",
        country: "England",
        coordinates: [-2.620278, 51.44],
        ticketUrl: ''
    },
    "Cardiff City FC": {
        stadium: "Cardiff City Stadium",
        city: "Cardiff",
        country: "Wales",
        coordinates: [-3.203056, 51.472778],
        ticketUrl: ''
    },
    "Birmingham City FC": {
        stadium: "St Andrew's",
        city: "Birmingham",
        country: "England",
        coordinates: [-1.868333, 52.475833],
        ticketUrl: ''
    },
    "Watford FC": {
        stadium: "Vicarage Road",
        city: "Watford",
        country: "England",
        coordinates: [-0.401667, 51.649722],
        ticketUrl: ''
    },
    "Plymouth Argyle FC": {
        stadium: "Home Park",
        city: "Plymouth",
        country: "England",
        coordinates: [-4.150833, 50.384722],
        ticketUrl: ''
    },
    "Queens Park Rangers FC": {
        stadium: "Loftus Road",
        city: "London",
        country: "England",
        coordinates: [-0.232222, 51.509167],
        ticketUrl: ''
    },
    "Millwall FC": {
        stadium: "The Den",
        city: "London",
        country: "England",
        coordinates: [-0.050833, 51.485833],
        ticketUrl: ''
    },
    "Swansea City AFC": {
        stadium: "Swansea.com Stadium",
        city: "Swansea",
        country: "Wales",
        coordinates: [-3.935278, 51.6425],
        ticketUrl: ''
    },
    "Huddersfield Town AFC": {
        stadium: "John Smith's Stadium",
        city: "Huddersfield",
        country: "England",
        coordinates: [-1.768333, 53.654167],
        ticketUrl: ''
    },
    "Sheffield Wednesday FC": {
        stadium: "Hillsborough",
        city: "Sheffield",
        country: "England",
        coordinates: [-1.500833, 53.411389],
        ticketUrl: ''
    },
    "Rotherham United FC": {
        stadium: "AESSEAL New York Stadium",
        city: "Rotherham",
        country: "England",
        coordinates: [-1.362222, 53.429722],
        ticketUrl: ''
    },
    "Blackburn Rovers FC": {
        stadium: "Ewood Park",
        city: "Blackburn",
        country: "England",
        coordinates: [-2.489167, 53.728611],
        ticketUrl: ''
    }
};

const LA_LIGA_VENUES = {
    "Real Madrid CF": {
        stadium: "Santiago Bernabéu",
        city: "Madrid",
        country: "Spain",
        coordinates: [-3.688333, 40.453056],
        ticketUrl: ''
    },
    "FC Barcelona": {
        stadium: "Spotify Camp Nou",
        city: "Barcelona",
        country: "Spain",
        coordinates: [2.122917, 41.380898],
        ticketUrl: ''
    },
    "Atlético de Madrid": {
        stadium: "Cívitas Metropolitano",
        city: "Madrid",
        country: "Spain",
        coordinates: [-3.599722, 40.436111],
        ticketUrl: ''
    },
    "Real Sociedad de Fútbol": {
        stadium: "Reale Arena",
        city: "San Sebastián",
        country: "Spain",
        coordinates: [-1.973611, 43.301389],
        ticketUrl: ''
    },
    "Real Betis Balompié": {
        stadium: "Estadio Benito Villamarín",
        city: "Seville",
        country: "Spain",
        coordinates: [-5.981667, 37.356389],
        ticketUrl: ''
    },
    "Sevilla FC": {
        stadium: "Ramón Sánchez-Pizjuán",
        city: "Seville",
        country: "Spain",
        coordinates: [-5.970278, 37.383889],
        ticketUrl: ''
    },
    "Villarreal CF": {
        stadium: "Estadio de la Cerámica",
        city: "Villarreal",
        country: "Spain",
        coordinates: [-0.103611, 39.944167],
        ticketUrl: ''
    },
    "Athletic Club": {
        stadium: "San Mamés",
        city: "Bilbao",
        country: "Spain",
        coordinates: [-2.950278, 43.264167],
        ticketUrl: ''
    },
    "Valencia CF": {
        stadium: "Mestalla",
        city: "Valencia",
        country: "Spain",
        coordinates: [-0.358333, 39.474722],
        ticketUrl: ''
    },
    "CA Osasuna": {
        stadium: "El Sadar",
        city: "Pamplona",
        country: "Spain",
        coordinates: [-1.636944, 42.796389],
        ticketUrl: ''
    },
    "Girona FC": {
        stadium: "Estadi Montilivi",
        city: "Girona",
        country: "Spain",
        coordinates: [2.825833, 41.961389],
        ticketUrl: ''
    },
    "Getafe CF": {
        stadium: "Coliseum Alfonso Pérez",
        city: "Getafe",
        country: "Spain",
        coordinates: [-3.735556, 40.325556],
        ticketUrl: ''
    },
    "RCD Mallorca": {
        stadium: "Visit Mallorca Estadi",
        city: "Palma",
        country: "Spain",
        coordinates: [2.637778, 39.589444],
        ticketUrl: ''
    },
    "Deportivo Alavés": {
        stadium: "Mendizorrotza",
        city: "Vitoria-Gasteiz",
        country: "Spain",
        coordinates: [-2.688889, 42.839722],
        ticketUrl: ''
    },
    "UD Las Palmas": {
        stadium: "Estadio Gran Canaria",
        city: "Las Palmas",
        country: "Spain",
        coordinates: [-15.456944, 28.100278],
        ticketUrl: ''
    },
    "Celta de Vigo": {
        stadium: "Abanca-Balaídos",
        city: "Vigo",
        country: "Spain",
        coordinates: [-8.740278, 42.211944],
        ticketUrl: ''
    },
    "Granada CF": {
        stadium: "Nuevo Los Cármenes",
        city: "Granada",
        country: "Spain",
        coordinates: [-3.595833, 37.153889],
        ticketUrl: ''
    },
    "Cádiz CF": {
        stadium: "Nuevo Mirandilla",
        city: "Cádiz",
        country: "Spain",
        coordinates: [-6.270833, 36.501944],
        ticketUrl: ''
    },
    "UD Almería": {
        stadium: "Power Horse Stadium",
        city: "Almería",
        country: "Spain",
        coordinates: [-2.408333, 36.841111],
        ticketUrl: ''
    },
    "Rayo Vallecano": {
        stadium: "Estadio de Vallecas",
        city: "Madrid",
        country: "Spain",
        coordinates: [-3.657778, 40.391944],
        ticketUrl: ''
    }
};

const BUNDESLIGA_VENUES = {
    "FC Bayern München": {
        stadium: "Allianz Arena",
        city: "Munich",
        country: "Germany",
        coordinates: [11.624722, 48.218889],
        ticketUrl: ''
    },
    "Borussia Dortmund": {
        stadium: "Signal Iduna Park",
        city: "Dortmund",
        country: "Germany",
        coordinates: [7.451667, 51.492778],
        ticketUrl: ''
    },
    "RB Leipzig": {
        stadium: "Red Bull Arena",
        city: "Leipzig",
        country: "Germany",
        coordinates: [12.348056, 51.345833],
        ticketUrl: ''
    },
    "Bayer 04 Leverkusen": {
        stadium: "BayArena",
        city: "Leverkusen",
        country: "Germany",
        coordinates: [6.973056, 51.038056],
        ticketUrl: ''
    },
    "Eintracht Frankfurt": {
        stadium: "Deutsche Bank Park",
        city: "Frankfurt",
        country: "Germany",
        coordinates: [8.645278, 50.068611],
        ticketUrl: ''
    },
    "VfL Wolfsburg": {
        stadium: "Volkswagen Arena",
        city: "Wolfsburg",
        country: "Germany",
        coordinates: [10.803889, 52.431944],
        ticketUrl: ''
    },
    "SC Freiburg": {
        stadium: "Europa-Park Stadion",
        city: "Freiburg",
        country: "Germany",
        coordinates: [7.899444, 48.020278],
        ticketUrl: ''
    },
    "1. FC Union Berlin": {
        stadium: "Stadion An der Alten Försterei",
        city: "Berlin",
        country: "Germany",
        coordinates: [13.568333, 52.457222],
        ticketUrl: ''
    },
    "1. FSV Mainz 05": {
        stadium: "MEWA ARENA",
        city: "Mainz",
        country: "Germany",
        coordinates: [8.224167, 49.984167],
        ticketUrl: ''
    },
    "TSG 1899 Hoffenheim": {
        stadium: "PreZero Arena",
        city: "Sinsheim",
        country: "Germany",
        coordinates: [8.891667, 49.239444],
        ticketUrl: ''
    },
    "Borussia Mönchengladbach": {
        stadium: "Borussia-Park",
        city: "Mönchengladbach",
        country: "Germany",
        coordinates: [6.385556, 51.174722],
        ticketUrl: ''
    },
    "1. FC Köln": {
        stadium: "RheinEnergieSTADION",
        city: "Cologne",
        country: "Germany",
        coordinates: [6.875278, 50.933611],
        ticketUrl: ''
    },
    "SV Werder Bremen": {
        stadium: "Weserstadion",
        city: "Bremen",
        country: "Germany",
        coordinates: [8.837222, 53.066389],
        ticketUrl: ''
    },
    "FC Augsburg": {
        stadium: "WWK ARENA",
        city: "Augsburg",
        country: "Germany",
        coordinates: [10.931944, 48.332778],
        ticketUrl: ''
    },
    "VfB Stuttgart": {
        stadium: "MHPArena",
        city: "Stuttgart",
        country: "Germany",
        coordinates: [9.231667, 48.792222],
        ticketUrl: ''
    },
    "VfL Bochum 1848": {
        stadium: "Vonovia Ruhrstadion",
        city: "Bochum",
        country: "Germany",
        coordinates: [7.215556, 51.465],
        ticketUrl: ''
    },
    "1. FC Heidenheim 1846": {
        stadium: "Voith-Arena",
        city: "Heidenheim",
        country: "Germany",
        coordinates: [10.149722, 48.676111],
        ticketUrl: ''
    },
    "SV Darmstadt 98": {
        stadium: "Merck-Stadion am Böllenfalltor",
        city: "Darmstadt",
        country: "Germany",
        coordinates: [8.649444, 49.859167],
        ticketUrl: ''
    },
    "Holstein Kiel": {
        stadium: "Holstein-Stadion",
        city: "Kiel",
        country: "Germany",
        coordinates: [10.122222, 54.340556],
        ticketUrl: ''
    },
    "FC St. Pauli 1910": {
        stadium: "Millerntor-Stadion",
        city: "Hamburg",
        country: "Germany",
        coordinates: [9.970556, 53.554722],
        ticketUrl: ''
    }
};

const LIGUE_1_VENUES = {
    "Paris Saint-Germain FC": {
        stadium: "Parc des Princes",
        city: "Paris",
        country: "France",
        coordinates: [2.253056, 48.841389],
        ticketUrl: ''
    },
    "Olympique de Marseille": {
        stadium: "Orange Vélodrome",
        city: "Marseille",
        country: "France",
        coordinates: [5.396389, 43.269722],
        ticketUrl: ''
    },
    "AS Monaco FC": {
        stadium: "Stade Louis II",
        city: "Monaco",
        country: "Monaco",
        coordinates: [7.415833, 43.727778],
        ticketUrl: ''
    },
    "Olympique Lyonnais": {
        stadium: "Groupama Stadium",
        city: "Lyon",
        country: "France",
        coordinates: [4.982222, 45.765278],
        ticketUrl: ''
    },
    "Lille OSC": {
        stadium: "Stade Pierre-Mauroy",
        city: "Lille",
        country: "France",
        coordinates: [3.130278, 50.611944],
        ticketUrl: 'https://billetterie.losc.fr/en/'
    },
    "Stade Rennais FC 1901": {
        stadium: "Roazhon Park",
        city: "Rennes",
        country: "France",
        coordinates: [-1.713056, 48.107778],
        ticketUrl: ''
    },
    "Racing Club de Lens": {
        stadium: "Stade Bollaert-Delelis",
        city: "Lens",
        country: "France",
        coordinates: [2.815278, 50.432778],
        ticketUrl: ''
    },
    "OGC Nice": {
        stadium: "Allianz Riviera",
        city: "Nice",
        country: "France",
        coordinates: [7.192778, 43.705278],
        ticketUrl: ''
    },
    "FC Nantes": {
        stadium: "Stade de la Beaujoire",
        city: "Nantes",
        country: "France",
        coordinates: [-1.525278, 47.255833],
        ticketUrl: ''
    },
    "RC Strasbourg Alsace": {
        stadium: "Stade de la Meinau",
        city: "Strasbourg",
        country: "France",
        coordinates: [7.758333, 48.560278],
        ticketUrl: ''
    },
    "Stade de Reims": {
        stadium: "Stade Auguste-Delaune",
        city: "Reims",
        country: "France",
        coordinates: [4.025556, 49.246667],
        ticketUrl: ''
    },
    "Montpellier HSC": {
        stadium: "Stade de la Mosson",
        city: "Montpellier",
        country: "France",
        coordinates: [3.812222, 43.622222],
        ticketUrl: ''
    },
    "Toulouse FC": {
        stadium: "Stadium de Toulouse",
        city: "Toulouse",
        country: "France",
        coordinates: [1.434167, 43.583333],
        ticketUrl: ''
    },
    "Stade Brestois 29": {
        stadium: "Stade Francis-Le Blé",
        city: "Brest",
        country: "France",
        coordinates: [-4.485278, 48.402778],
        ticketUrl: ''
    },
    "FC Lorient": {
        stadium: "Stade du Moustoir",
        city: "Lorient",
        country: "France",
        coordinates: [-3.370833, 47.748611],
        ticketUrl: ''
    },
    "Clermont Foot 63": {
        stadium: "Stade Gabriel Montpied",
        city: "Clermont-Ferrand",
        country: "France",
        coordinates: [3.149722, 45.788889],
        ticketUrl: ''
    },
    "FC Metz": {
        stadium: "Stade Saint-Symphorien",
        city: "Metz",
        country: "France",
        coordinates: [6.175278, 49.109722],
        ticketUrl: ''
    },
    "Le Havre AC": {
        stadium: "Stade Océane",
        city: "Le Havre",
        country: "France",
        coordinates: [0.168889, 49.496944],
        ticketUrl: ''
    },
    "Angers SCO": {
        stadium: "Stade Raymond Kopa",
        city: "Angers",
        country: "France",
        coordinates: [-0.525833, 47.461944],
        ticketUrl: ''
    },
    "AJ Auxerre": {
        stadium: "Stade de l'Abé-Deschamps",
        city: "Auxerre",
        country: "France",
        coordinates: [3.570833, 47.780556],
        ticketUrl: ''
    },
    "AS Saint-Étienne": {
        stadium: "Stade Geoffroy-Guichard",
        city: "Saint-Étienne",
        country: "France",
        coordinates: [4.390278, 45.460833],
        ticketUrl: ''
    }
};

const EREDIVISIE_VENUES = {
    "PSV": {
        stadium: "Philips Stadion",
        city: "Eindhoven",
        country: "Netherlands",
        coordinates: [5.467778, 51.441944],
        ticketUrl: ''
    },
    "Feyenoord Rotterdam": {
        stadium: "De Kuip",
        city: "Rotterdam",
        country: "Netherlands",
        coordinates: [4.523889, 51.893889],
        ticketUrl: ''
    },
    "AFC Ajax": {
        stadium: "Johan Cruijff ArenA",
        city: "Amsterdam",
        country: "Netherlands",
        coordinates: [4.941944, 52.314167],
        ticketUrl: ''
    },
    "AZ": {
        stadium: "AFAS Stadion",
        city: "Alkmaar",
        country: "Netherlands",
        coordinates: [4.744722, 52.605833],
        ticketUrl: ''
    },
    "FC Twente '65": {
        stadium: "De Grolsch Veste",
        city: "Enschede",
        country: "Netherlands",
        coordinates: [6.865278, 52.236111],
        ticketUrl: ''
    },
    "Vitesse Arnhem": {
        stadium: "GelreDome",
        city: "Arnhem",
        country: "Netherlands",
        coordinates: [5.911944, 51.965],
        ticketUrl: ''
    },
    "FC Utrecht": {
        stadium: "Stadion Galgenwaard",
        city: "Utrecht",
        country: "Netherlands",
        coordinates: [5.145556, 52.078611],
        ticketUrl: ''
    },
    "SC Heerenveen": {
        stadium: "Abe Lenstra Stadion",
        city: "Heerenveen",
        country: "Netherlands",
        coordinates: [5.930556, 52.956944],
        ticketUrl: ''
    },
    "Sparta Rotterdam": {
        stadium: "Sparta Stadion Het Kasteel",
        city: "Rotterdam",
        country: "Netherlands",
        coordinates: [4.431944, 51.920278],
        ticketUrl: ''
    },
    "NEC": {
        stadium: "Goffertstadion",
        city: "Nijmegen",
        country: "Netherlands",
        coordinates: [5.856944, 51.826667],
        ticketUrl: ''
    },
    "PEC Zwolle": {
        stadium: "MAC³PARK stadion",
        city: "Zwolle",
        country: "Netherlands",
        coordinates: [6.094444, 52.524167],
        ticketUrl: ''
    },
    "Go Ahead Eagles": {
        stadium: "De Adelaarshorst",
        city: "Deventer",
        country: "Netherlands",
        coordinates: [6.186389, 52.255],
        ticketUrl: ''
    },
    "Almere City FC": {
        stadium: "Yanmar Stadion",
        city: "Almere",
        country: "Netherlands",
        coordinates: [5.2875, 52.341944],
        ticketUrl: ''
    },
    "Excelsior Rotterdam": {
        stadium: "Van Donge & De Roo Stadion",
        city: "Rotterdam",
        country: "Netherlands",
        coordinates: [4.511944, 51.918889],
        ticketUrl: ''
    },
    "Heracles Almelo": {
        stadium: "Erve Asito",
        city: "Almelo",
        country: "Netherlands",
        coordinates: [6.658333, 52.356944],
        ticketUrl: ''
    },
    "RKC Waalwijk": {
        stadium: "Mandemakers Stadion",
        city: "Waalwijk",
        country: "Netherlands",
        coordinates: [5.065833, 51.688889],
        ticketUrl: ''
    },
    "Fortuna Sittard": {
        stadium: "Fortuna Sittard Stadion",
        city: "Sittard",
        country: "Netherlands",
        coordinates: [5.866667, 51.001389],
        ticketUrl: ''
    },
    "FC Volendam": {
        stadium: "Kras Stadion",
        city: "Volendam",
        country: "Netherlands",
        coordinates: [5.070556, 52.497778],
        ticketUrl: ''
    },
    "FC Groningen": {
        stadium: "Euroborg",
        city: "Groningen",
        country: "Netherlands",
        coordinates: [6.574722, 53.196944],
        ticketUrl: ''
    },
    "Willem II Tilburg": {
        stadium: "Koning Willem II Stadion",
        city: "Tilburg",
        country: "Netherlands",
        coordinates: [5.081944, 51.553889],
        ticketUrl: ''
    },
    "NAC Breda": {
        stadium: "Rat Verlegh Stadion",
        city: "Breda",
        country: "Netherlands",
        coordinates: [4.801944, 51.588333],
        ticketUrl: ''
    }
};

const PRIMEIRA_LIGA_VENUES = {
    "SL Benfica": {
        stadium: "Estádio da Luz",
        city: "Lisbon",
        country: "Portugal",
        coordinates: [-9.184674, 38.752827],
        ticketUrl: ''
    },
    "FC Porto": {
        stadium: "Estádio do Dragão",
        city: "Porto",
        country: "Portugal",
        coordinates: [-8.583533, 41.161758],
        ticketUrl: ''
    },
    "Sporting CP": {
        stadium: "Estádio José Alvalade",
        city: "Lisbon",
        country: "Portugal",
        coordinates: [-9.160944, 38.761444],
        ticketUrl: ''
    },
    "SC Braga": {
        stadium: "Estádio Municipal de Braga",
        city: "Braga",
        country: "Portugal",
        coordinates: [-8.431389, 41.563611],
        ticketUrl: ''
    },
    "Vitória SC": {
        stadium: "Estádio D. Afonso Henriques",
        city: "Guimarães",
        country: "Portugal",
        coordinates: [-8.312778, 41.445278],
        ticketUrl: ''
    }
};

const ITALIAN_SERIE_A_VENUES = {
    "Juventus FC": {
        stadium: "Allianz Stadium",
        city: "Turin",
        country: "Italy",
        coordinates: [7.641389, 45.109722],
        ticketUrl: ''
    },
    "AC Milan": {
        stadium: "San Siro",
        city: "Milan",
        country: "Italy",
        coordinates: [9.123889, 45.478889],
        ticketUrl: ''
    },
    "Inter Milan": {
        stadium: "San Siro",
        city: "Milan",
        country: "Italy",
        coordinates: [9.123889, 45.478889],
        ticketUrl: ''
    },
    "AS Roma": {
        stadium: "Stadio Olimpico",
        city: "Rome",
        country: "Italy",
        coordinates: [12.454722, 41.933889],
        ticketUrl: ''
    },
    "SS Lazio": {
        stadium: "Stadio Olimpico",
        city: "Rome",
        country: "Italy",
        coordinates: [12.454722, 41.933889],
        ticketUrl: ''
    },
    "SSC Napoli": {
        stadium: "Diego Armando Maradona Stadium",
        city: "Naples",
        country: "Italy",
        coordinates: [14.193889, 40.833889],
        ticketUrl: ''
    },
    "Atalanta BC": {
        stadium: "Gewiss Stadium",
        city: "Bergamo",
        country: "Italy",
        coordinates: [9.678889, 45.698889],
        ticketUrl: ''
    },
    "ACF Fiorentina": {
        stadium: "Artemio Franchi",
        city: "Florence",
        country: "Italy",
        coordinates: [11.278889, 43.778889],
        ticketUrl: ''
    },
    "Bologna FC 1909": {
        stadium: "Renato Dall'Ara",
        city: "Bologna",
        country: "Italy",
        coordinates: [11.308889, 44.498889],
        ticketUrl: ''
    },
    "Torino FC": {
        stadium: "Olimpico Grande Torino",
        city: "Turin",
        country: "Italy",
        coordinates: [7.641389, 45.109722],
        ticketUrl: ''
    },
    "Cagliari Calcio": {
        stadium: "Unipol Domus",
        city: "Cagliari",
        country: "Italy",
        coordinates: [9.138889, 39.197222],
        ticketUrl: ''
    },
    "Parma Calcio 1913": {
        stadium: "Stadio Ennio Tardini",
        city: "Parma",
        country: "Italy",
        coordinates: [10.338889, 44.798889],
        ticketUrl: ''
    },
    "Hellas Verona FC": {
        stadium: "Stadio Marcantonio Bentegodi",
        city: "Verona",
        country: "Italy",
        coordinates: [10.968889, 45.435],
        ticketUrl: ''
    },
    "Pisa SC": {
        stadium: "Arena Garibaldi",
        city: "Pisa",
        country: "Italy",
        coordinates: [10.395833, 43.720833],
        ticketUrl: ''
    },
    "Como 1907": {
        stadium: "Stadio Giuseppe Sinigaglia",
        city: "Como",
        country: "Italy",
        coordinates: [9.085556, 45.808889],
        ticketUrl: ''
    },
    "Udinese Calcio": {
        stadium: "Dacia Arena",
        city: "Udine",
        country: "Italy",
        coordinates: [13.248889, 46.082222],
        ticketUrl: ''
    },
    "US Lecce": {
        stadium: "Stadio Via del Mare",
        city: "Lecce",
        country: "Italy",
        coordinates: [18.172222, 40.354167],
        ticketUrl: ''
    },
    "Genoa CFC": {
        stadium: "Stadio Luigi Ferraris",
        city: "Genoa",
        country: "Italy",
        coordinates: [8.952222, 44.416667],
        ticketUrl: ''
    },
    "Empoli FC": {
        stadium: "Stadio Carlo Castellani",
        city: "Empoli",
        country: "Italy",
        coordinates: [10.946944, 43.726944],
        ticketUrl: ''
    },
    "AC Monza": {
        stadium: "U-Power Stadium",
        city: "Monza",
        country: "Italy",
        coordinates: [9.310833, 45.590278],
        ticketUrl: ''
    },
    "Venezia FC": {
        stadium: "Stadio Pier Luigi Penzo",
        city: "Venice",
        country: "Italy",
        coordinates: [12.383333, 45.374444],
        ticketUrl: ''
    }
};

const BRAZILIAN_SERIE_A_VENUES = {
    "CR Flamengo": {
        stadium: "Maracanã",
        city: "Rio de Janeiro",
        country: "Brazil",
        coordinates: [-43.230556, -22.912222],
        ticketUrl: ''
    },
    "SE Palmeiras": {
        stadium: "Allianz Parque",
        city: "São Paulo",
        country: "Brazil",
        coordinates: [-46.684444, -23.527222],
        ticketUrl: ''
    },
    "São Paulo FC": {
        stadium: "Morumbi",
        city: "São Paulo",
        country: "Brazil",
        coordinates: [-46.720556, -23.600833],
        ticketUrl: ''
    },
    "SC Internacional": {
        stadium: "Beira-Rio",
        city: "Porto Alegre",
        country: "Brazil",
        coordinates: [-51.238889, -30.064722],
        ticketUrl: ''
    },
    "CA Mineiro": {
        stadium: "Arena MRV",
        city: "Belo Horizonte",
        country: "Brazil",
        coordinates: [-43.938889, -19.920833],
        ticketUrl: ''
    },
    "CR Vasco da Gama": {
        stadium: "São Januário",
        city: "Rio de Janeiro",
        country: "Brazil",
        coordinates: [-43.228889, -22.888889],
        ticketUrl: ''
    },
    "Grêmio FBPA": {
        stadium: "Arena do Grêmio",
        city: "Porto Alegre",
        country: "Brazil",
        coordinates: [-51.130833, -30.081944],
        ticketUrl: ''
    },
    "SC Corinthians Paulista": {
        stadium: "Neo Química Arena",
        city: "São Paulo",
        country: "Brazil",
        coordinates: [-46.474722, -23.545833],
        ticketUrl: ''
    },
    "Fortaleza EC": {
        stadium: "Arena Castelão",
        city: "Fortaleza",
        country: "Brazil",
        coordinates: [-38.522778, -3.807778],
        ticketUrl: ''
    },
    "Santos FC": {
        stadium: "Vila Belmiro",
        city: "Santos",
        country: "Brazil",
        coordinates: [-46.333889, -23.961944],
        ticketUrl: ''
    },
    "EC Bahia": {
        stadium: "Arena Fonte Nova",
        city: "Salvador",
        country: "Brazil",
        coordinates: [-38.504722, -12.978889],
        ticketUrl: ''
    },
    "Cruzeiro EC": {
        stadium: "Mineirão",
        city: "Belo Horizonte",
        country: "Brazil",
        coordinates: [-43.970833, -19.865833],
        ticketUrl: ''
    },
    "EC Vitória": {
        stadium: "Barradão",
        city: "Salvador",
        country: "Brazil",
        coordinates: [-38.504722, -12.978889],
        ticketUrl: ''
    },
    "RB Bragantino": {
        stadium: "Nabi Abi Chedid",
        city: "Bragança Paulista",
        country: "Brazil",
        coordinates: [-46.541944, -22.953889],
        ticketUrl: ''
    },
    "Fluminense FC": {
        stadium: "Maracanã",
        city: "Rio de Janeiro",
        country: "Brazil",
        coordinates: [-43.230556, -22.912222],
        ticketUrl: ''
    },
    "Ceará SC": {
        stadium: "Arena Castelão",
        city: "Fortaleza",
        country: "Brazil",
        coordinates: [-38.522778, -3.807778],
        ticketUrl: ''
    },
    "Botafogo FR": {
        stadium: "Nilton Santos",
        city: "Rio de Janeiro",
        country: "Brazil",
        coordinates: [-43.230556, -22.912222],
        ticketUrl: ''
    },
    "Mirassol FC": {
        stadium: "Estádio Municipal José Maria de Campos Maia",
        city: "Mirassol",
        country: "Brazil",
        coordinates: [-49.521944, -20.818889],
        ticketUrl: ''
    },
    "EC Juventude": {
        stadium: "Alfredo Jaconi",
        city: "Caxias do Sul",
        country: "Brazil",
        coordinates: [-51.179722, -29.168889],
        ticketUrl: ''
    },
    "Sport Recife": {
        stadium: "Arena de Pernambuco",
        city: "Recife",
        country: "Brazil",
        coordinates: [-34.958889, -8.033889],
        ticketUrl: ''
    }
};

const MLS_VENUES = {
    "Real Salt Lake": {
        stadium: "America First Field",
        city: "Sandy",
        country: "USA",
        coordinates: [-111.893889, 40.582222],
        ticketUrl: ''
    },
    "Sporting Kansas City": {
        stadium: "Children's Mercy Park",
        city: "Kansas City",
        country: "USA",
        coordinates: [-94.823889, 39.121667],
        ticketUrl: ''
    },
    "Chicago Fire FC": {
        stadium: "Soldier Field",
        city: "Chicago",
        country: "USA",
        coordinates: [-87.616667, 41.862222],
        ticketUrl: ''
    },
    "St. Louis City SC": {
        stadium: "Energizer Park",
        city: "St. Louis",
        country: "USA",
        coordinates: [-90.376944, 38.627778],
        ticketUrl: ''
    },
    "Atlanta United FC": {
        stadium: "Mercedes-Benz Stadium",
        city: "Atlanta",
        country: "USA",
        coordinates: [-84.400833, 33.755556],
        ticketUrl: ''
    },
    "Charlotte FC": {
        stadium: "Bank of America Stadium",
        city: "Charlotte",
        country: "USA",
        coordinates: [-80.852778, 35.225833],
        ticketUrl: ''
    },
    "FC Cincinnati": {
        stadium: "TQL Stadium",
        city: "Cincinnati",
        country: "USA",
        coordinates: [-84.520833, 39.110556],
        ticketUrl: ''
    },
    "D.C. United": {
        stadium: "Audi Field",
        city: "Washington",
        country: "USA",
        coordinates: [-77.012222, 38.867778],
        ticketUrl: ''
    },
    "CF Montréal": {
        stadium: "Stade Saputo",
        city: "Montreal",
        country: "Canada",
        coordinates: [-73.553056, 45.561944],
        ticketUrl: ''
    },
    "New England Revolution": {
        stadium: "Gillette Stadium",
        city: "Foxborough",
        country: "USA",
        coordinates: [-71.264444, 42.090833],
        ticketUrl: ''
    },
    "San Jose Earthquakes": {
        stadium: "PayPal Park",
        city: "San Jose",
        country: "USA",
        coordinates: [-121.925556, 37.351111],
        ticketUrl: ''
    },
    "FC Dallas": {
        stadium: "Toyota Stadium",
        city: "Frisco",
        country: "USA",
        coordinates: [-96.835278, 33.154167],
        ticketUrl: ''
    },
    "Seattle Sounders FC": {
        stadium: "Lumen Field",
        city: "Seattle",
        country: "USA",
        coordinates: [-122.331944, 47.595278],
        ticketUrl: ''
    },
    "Colorado Rapids": {
        stadium: "Dick's Sporting Goods Park",
        city: "Commerce City",
        country: "USA",
        coordinates: [-104.891944, 39.805556],
        ticketUrl: ''
    },
    "Vancouver Whitecaps FC": {
        stadium: "BC Place",
        city: "Vancouver",
        country: "Canada",
        coordinates: [-123.111944, 49.276667],
        ticketUrl: ''
    },
    "Portland Timbers": {
        stadium: "Providence Park",
        city: "Portland",
        country: "USA",
        coordinates: [-122.691667, 45.521389],
        ticketUrl: ''
    },
    "Inter Miami CF": {
        stadium: "DRV PNK Stadium",
        city: "Fort Lauderdale",
        country: "USA",
        coordinates: [-80.161111, 26.193056],
        ticketUrl: ''
    },
    "New York City FC": {
        stadium: "Yankee Stadium",
        city: "Bronx",
        country: "USA",
        coordinates: [-73.926389, 40.829167],
        ticketUrl: ''
    },
    "Philadelphia Union": {
        stadium: "Subaru Park",
        city: "Chester",
        country: "USA",
        coordinates: [-75.378889, 39.831944],
        ticketUrl: ''
    },
    "Columbus Crew": {
        stadium: "Field",
        city: "Columbus",
        country: "USA",
        coordinates: [-83.017778, 39.968333],
        ticketUrl: ''
    },
    "Orlando City SC": {
        stadium: "Exploria Stadium",
        city: "Orlando",
        country: "USA",
        coordinates: [-81.389167, 28.541389],
        ticketUrl: ''
    },
    "Austin FC": {
        stadium: "Q2 Stadium",
        city: "Austin",
        country: "USA",
        coordinates: [-97.720556, 30.388889],
        ticketUrl: ''
    },
    "Houston Dynamo FC": {
        stadium: "Shell Energy Stadium",
        city: "Houston",
        country: "USA",
        coordinates: [-95.351944, 29.752222],
        ticketUrl: ''
    },
    "Minnesota United FC": {
        stadium: "Allianz Field",
        city: "Saint Paul",
        country: "USA",
        coordinates: [-93.165556, 44.953056],
        ticketUrl: ''
    },
    "LA Galaxy": {
        stadium: "Dignity Health Sports Park",
        city: "Carson",
        country: "USA",
        coordinates: [-118.261111, 33.864444],
        ticketUrl: ''
    },
    "Los Angeles FC": {
        stadium: "BMO Stadium",
        city: "Los Angeles",
        country: "USA",
        coordinates: [-118.285556, 34.012222],
        ticketUrl: ''
    },
    "San Diego FC": {
        stadium: "Snapdragon Stadium",
        city: "San Diego",
        country: "USA",
        coordinates: [-117.119444, 32.783056],
        ticketUrl: ''
    },
    "New York Red Bulls": {
        stadium: "Red Bull Arena",
        city: "Harrison, NJ",
        country: "USA",
        coordinates: [-74.150833, 40.736944],
        ticketUrl: ''
    },
    "Toronto FC": {
        stadium: "BMO Field",
        city: "Toronto",
        country: "Canada",
        coordinates: [-79.418611, 43.633333],
        ticketUrl: ''
    },
    "Nashville SC": {
        stadium: "GEODIS Park",
        city: "Nashville",
        country: "USA",
        coordinates: [-86.767222, 36.131944],
        ticketUrl: ''
    }
};

const SWISS_SUPER_LEAGUE_VENUES = {
    "FC Zurich": {
        stadium: "Letzigrund Stadium",
        city: "Zurich",
        country: "Switzerland",
        coordinates: [8.497778, 47.383333],
        ticketUrl: 'https://fcz.ch/tickets'
    },
    "BSC Young Boys": {
        stadium: "Wankdorf Stadium",
        city: "Bern",
        country: "Switzerland",
        coordinates: [7.463889, 46.963333],
        ticketUrl: 'https://www.bscyb.ch/tickets'
    },
    "FC Basel 1893": {
        stadium: "St. Jakob-Park",
        city: "Basel",
        country: "Switzerland",
        coordinates: [7.621944, 47.542222],
        ticketUrl: 'https://www.fcb.ch/tickets'
    },
    "Servette FC": {
        stadium: "Stade de Genève",
        city: "Geneva",
        country: "Switzerland",
        coordinates: [6.122222, 46.183333],
        ticketUrl: 'https://www.servettefc.ch/tickets'
    },
    "FC Lugano": {
        stadium: "Cornaredo Stadium",
        city: "Lugano",
        country: "Switzerland",
        coordinates: [8.960556, 46.020556],
        ticketUrl: 'https://www.fclugano.com/tickets'
    },
    "FC ST. Gallen": {
        stadium: "Kybunpark",
        city: "St. Gallen",
        country: "Switzerland",
        coordinates: [9.401111, 47.450556],
        ticketUrl: 'https://www.fcsg.ch/tickets'
    },
    "FC Luzern": {
        stadium: "Swissporarena",
        city: "Lucerne",
        country: "Switzerland",
        coordinates: [8.338889, 47.032778],
        ticketUrl: 'https://www.fcl.ch/tickets'
    },
    "FC Sion": {
        stadium: "Stade Tourbillon",
        city: "Sion",
        country: "Switzerland",
        coordinates: [7.384444, 46.234722],
        ticketUrl: 'https://www.fc-sion.ch/tickets'
    },
    "Grasshoppers": {
        stadium: "Letzigrund Stadium",
        city: "Zurich",
        country: "Switzerland",
        coordinates: [8.497778, 47.383333],
        ticketUrl: 'https://www.gcz.ch/tickets'
    },
    "Lausanne": {
        stadium: "Stade de la Tuilière",
        city: "Lausanne",
        country: "Switzerland",
        coordinates: [6.579167, 46.561944],
        ticketUrl: 'https://www.lausanne-sport.ch/tickets'
    },
    "FC Winterthur": {
        stadium: "Schützenwiese",
        city: "Winterthur",
        country: "Switzerland",
        coordinates: [8.742222, 47.505556],
        ticketUrl: 'https://www.fcwinterthur.ch/tickets'
    },
    "FC Thun": {
        stadium: "Arena Thun",
        city: "Thun",
        country: "Switzerland",
        coordinates: [7.627778, 46.758333],
        ticketUrl: 'https://www.fcthun.ch/tickets'
    }
};

// Cached venues object - built once and reused
let cachedVenues = null;
let cacheStats = {
    hits: 0,
    misses: 0,
    cacheBuilds: 0
};

// Function to build the combined venues cache
function buildVenuesCache() {
    console.log('🏟️  Building venues cache...');
    const startTime = Date.now();
    
    const allVenues = {
        ...PREMIER_LEAGUE_VENUES,
        ...CHAMPIONSHIP_VENUES,
        ...LA_LIGA_VENUES,
        ...BUNDESLIGA_VENUES,
        ...SWISS_SUPER_LEAGUE_VENUES,
        ...LIGUE_1_VENUES,
        ...EREDIVISIE_VENUES,
        ...PRIMEIRA_LIGA_VENUES,
        ...ITALIAN_SERIE_A_VENUES,
        ...BRAZILIAN_SERIE_A_VENUES,
        ...MLS_VENUES
    };
    
    const buildTime = Date.now() - startTime;
    const venueCount = Object.keys(allVenues).length;
    cacheStats.cacheBuilds++;
    
    console.log(`✅ Venues cache built: ${venueCount} venues in ${buildTime}ms`);
    return allVenues;
}

// Function to get venue information for a team (with caching)
function getVenueForTeam(teamName) {
    // Build cache on first access
    if (!cachedVenues) {
        cachedVenues = buildVenuesCache();
    }
    
    const venue = cachedVenues[teamName] || null;
    
    // Update cache statistics
    if (venue) {
        cacheStats.hits++;
    } else {
        cacheStats.misses++;
    }
    
    return venue;
}

// Function to get cache statistics
function getCacheStats() {
    return {
        ...cacheStats,
        totalRequests: cacheStats.hits + cacheStats.misses,
        hitRate: cacheStats.hits + cacheStats.misses > 0 
            ? ((cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100).toFixed(2) + '%'
            : '0%',
        cachedVenues: cachedVenues ? Object.keys(cachedVenues).length : 0
    };
}

// Function to clear cache (useful for testing or updates)
function clearVenuesCache() {
    cachedVenues = null;
    console.log('🗑️  Venues cache cleared');
}

// Function to refresh cache
function refreshVenuesCache() {
    console.log('🔄 Refreshing venues cache...');
    cachedVenues = buildVenuesCache();
    return cachedVenues;
}

// Export the functions and data
module.exports = {
    getVenueForTeam,
    getCacheStats,
    clearVenuesCache,
    refreshVenuesCache,
    PREMIER_LEAGUE_VENUES,
    CHAMPIONSHIP_VENUES,
    LA_LIGA_VENUES,
    BUNDESLIGA_VENUES,
    SWISS_SUPER_LEAGUE_VENUES,
    LIGUE_1_VENUES,
    EREDIVISIE_VENUES,
    PRIMEIRA_LIGA_VENUES,
    ITALIAN_SERIE_A_VENUES,
    BRAZILIAN_SERIE_A_VENUES,
    MLS_VENUES
}; 