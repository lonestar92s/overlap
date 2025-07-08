interface Venue {
    stadium: string;
    location: string;
    coordinates: [number, number]; // [longitude, latitude]
    ticketUrl: string;
}

interface VenueMap {
    [key: string]: Venue;
}

// Venue data organized by league
const PREMIER_LEAGUE_VENUES: VenueMap = {
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
    "Manchester United FC": {
        stadium: "Old Trafford",
        location: "Manchester",
        coordinates: [-2.291389, 53.463056],
        ticketUrl: ''
    },
    "Manchester City FC": {
        stadium: "Etihad Stadium",
        location: "Manchester",
        coordinates: [-2.200278, 53.483056],
        ticketUrl: ''
    },
    "Liverpool FC": {
        stadium: "Anfield",
        location: "Liverpool",
        coordinates: [-2.96083, 53.43083],
        ticketUrl: ''
    },
    "Chelsea FC": {
        stadium: "Stamford Bridge",
        location: "London",
        coordinates: [-0.191034, 51.481667],
        ticketUrl: ''
    },
    "Tottenham Hotspur FC": {
        stadium: "Tottenham Hotspur Stadium",
        location: "London",
        coordinates: [-0.066389, 51.604444],
        ticketUrl: ''
    }
};

const LA_LIGA_VENUES: VenueMap = {
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
    }
};

const BUNDESLIGA_VENUES: VenueMap = {
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
        coordinates: [12.348889, 51.345833],
        ticketUrl: ''
    },
    "Bayer 04 Leverkusen": {
        stadium: "BayArena",
        location: "Leverkusen",
        coordinates: [7.002778, 51.038889],
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
        coordinates: [10.804167, 52.432222],
        ticketUrl: ''
    },
    "SC Freiburg": {
        stadium: "Europa-Park Stadion",
        location: "Freiburg",
        coordinates: [7.893333, 48.021667],
        ticketUrl: ''
    },
    "1. FC Union Berlin": {
        stadium: "Stadion An der Alten Försterei",
        location: "Berlin",
        coordinates: [13.568889, 52.457222],
        ticketUrl: ''
    },
    "VfB Stuttgart": {
        stadium: "Mercedes-Benz Arena",
        location: "Stuttgart",
        coordinates: [9.232222, 48.792500],
        ticketUrl: ''
    },
    "Werder Bremen": {
        stadium: "Weserstadion",
        location: "Bremen",
        coordinates: [8.837500, 53.066389],
        ticketUrl: ''
    },
    "Borussia Mönchengladbach": {
        stadium: "Stadion im Borussia-Park",
        location: "Mönchengladbach",
        coordinates: [6.385833, 51.174722],
        ticketUrl: ''
    },
    "1. FC Heidenheim": {
        stadium: "Voith-Arena",
        location: "Heidenheim",
        coordinates: [10.157500, 48.671944],
        ticketUrl: ''
    },
    "TSG Hoffenheim": {
        stadium: "PreZero Arena",
        location: "Sinsheim",
        coordinates: [8.887500, 49.239444],
        ticketUrl: ''
    },
    "1. FSV Mainz 05": {
        stadium: "MEWA Arena",
        location: "Mainz",
        coordinates: [8.224167, 49.984167],
        ticketUrl: ''
    },
    "FC Augsburg": {
        stadium: "WWK Arena",
        location: "Augsburg",
        coordinates: [10.886111, 48.323333],
        ticketUrl: ''
    },
    "FC St. Pauli": {
        stadium: "Millerntor-Stadion",
        location: "Hamburg",
        coordinates: [9.968056, 53.554444],
        ticketUrl: ''
    },
    "VfL Bochum": {
        stadium: "Vonovia Ruhrstadion",
        location: "Bochum",
        coordinates: [7.241389, 51.490278],
        ticketUrl: ''
    },
    "Holstein Kiel": {
        stadium: "Holstein-Stadion",
        location: "Kiel",
        coordinates: [10.124722, 54.349167],
        ticketUrl: ''
    }
};

const PRIMEIRA_LIGA_VENUES: VenueMap = {
    "SL Benfica": {
        stadium: "Estádio da Luz",
        location: "Lisbon",
        coordinates: [-9.184674, 38.752827],
        ticketUrl: ''
    },
    "FC Porto": {
        stadium: "Estádio do Dragão",
        location: "Porto",
        coordinates: [-8.583533, 41.161758],
        ticketUrl: ''
    },
    "Sporting CP": {
        stadium: "Estádio José Alvalade",
        location: "Lisbon",
        coordinates: [-9.160944, 38.761444],
        ticketUrl: ''
    }
};

// Function to get venue information for a team
export function getVenueForTeam(teamName: string): Venue | null {
    const allVenues = {
        ...PREMIER_LEAGUE_VENUES,
        ...LA_LIGA_VENUES,
        ...BUNDESLIGA_VENUES,
        ...PRIMEIRA_LIGA_VENUES
    };
    return allVenues[teamName] || null;
}

export {
    PREMIER_LEAGUE_VENUES,
    LA_LIGA_VENUES,
    BUNDESLIGA_VENUES,
    PRIMEIRA_LIGA_VENUES
}; 