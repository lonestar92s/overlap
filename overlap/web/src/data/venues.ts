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