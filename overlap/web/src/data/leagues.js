// League data with country mappings
export const LEAGUES = {
    'GB': [ // United Kingdom
        { id: '39', name: 'Premier League', tier: 1 },
        { id: '40', name: 'Championship', tier: 2 }
    ],
    'FR': [ // France
        { id: '61', name: 'Ligue 1', tier: 1 }
    ],
    'ES': [ // Spain
        { id: '140', name: 'La Liga', tier: 1 }
    ],
    'DE': [ // Germany
        { id: '78', name: 'Bundesliga', tier: 1 }
    ],
    'NL': [ // Netherlands
        { id: '88', name: 'Eredivisie', tier: 1 }
    ],
    'PT': [ // Portugal
        { id: '94', name: 'Primeira Liga', tier: 1 }
    ],
    'IT': [ // Italy
        { id: '135', name: 'Serie A', tier: 1 }
    ],
    'BR': [ // Brazil
        { id: '71', name: 'Série A', tier: 1 }
    ],
    'US': [ // United States
        { id: '253', name: 'Major League Soccer', tier: 1 }
    ],
    'INT': [ // International Competitions
        { id: '2', name: 'UEFA Champions League', tier: 1 },
        { id: '4', name: 'European Championship', tier: 1 },
        { id: '13', name: 'Copa Libertadores', tier: 1 },
        { id: '1', name: 'FIFA World Cup', tier: 1 }
    ]
};

// Helper function to get leagues for a country
export const getLeaguesForCountry = (countryCode) => {
    return LEAGUES[countryCode] || [];
};

// Helper function to get all leagues
export const getAllLeagues = () => {
    return Object.values(LEAGUES).flat();
};

// Helper function to get country code from country name
export const getCountryCode = (countryName) => {
    const countryMapping = {
        'United Kingdom': 'GB',
        'England': 'GB',
        'France': 'FR',
        'Spain': 'ES',
        'Germany': 'DE',
        'Netherlands': 'NL',
        'Portugal': 'PT',
        'Italy': 'IT',
        'Brazil': 'BR',
        'United States': 'US',
        'USA': 'US',
        'International': 'INT'
    };
    return countryMapping[countryName];
};

// Get league name by ID
export const getLeagueName = (leagueId) => {
    const league = getAllLeagues().find(l => l.id === leagueId);
    return league ? league.name : null;
}; 