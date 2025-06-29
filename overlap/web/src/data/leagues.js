// League data with country mappings
export const LEAGUES = {
    'GB': [ // United Kingdom
        { id: '39', name: 'Premier League', tier: 1, country: 'England', countryCode: 'GB' },
        { id: '40', name: 'Championship', tier: 2, country: 'England', countryCode: 'GB' }
    ],
    'FR': [ // France
        { id: '61', name: 'Ligue 1', tier: 1, country: 'France', countryCode: 'FR' }
    ],
    'ES': [ // Spain
        { id: '140', name: 'La Liga', tier: 1, country: 'Spain', countryCode: 'ES' }
    ],
    'DE': [ // Germany
        { id: '78', name: 'Bundesliga', tier: 1, country: 'Germany', countryCode: 'DE' }
    ],
    'CH': [ // Switzerland
        { id: '207', name: 'Swiss Super League', tier: 1, country: 'Switzerland', countryCode: 'CH' }
    ],
    'NL': [ // Netherlands
        { id: '88', name: 'Eredivisie', tier: 1, country: 'Netherlands', countryCode: 'NL' }
    ],
    'PT': [ // Portugal
        { id: '94', name: 'Primeira Liga', tier: 1, country: 'Portugal', countryCode: 'PT' }
    ],
    'IT': [ // Italy
        { id: '135', name: 'Serie A', tier: 1, country: 'Italy', countryCode: 'IT' }
    ],
    'BE': [ // Belgium
        { id: '144', name: 'Belgian Pro League', tier: 1, country: 'Belgium', countryCode: 'BE' }
    ],
    'BR': [ // Brazil
        { id: '71', name: 'Série A', tier: 1, country: 'Brazil', countryCode: 'BR' }
    ],
    'US': [ // United States
        { id: '253', name: 'Major League Soccer', tier: 1, country: 'United States', countryCode: 'US' }
    ],
    'JP': [ // Japan
        { id: '98', name: 'J1 League', tier: 1, country: 'Japan', countryCode: 'JP' }
    ],
    'INT': [ // International Competitions
        { id: '2', name: 'UEFA Champions League', tier: 1, country: 'Europe', countryCode: 'INT' },
        { id: '4', name: 'European Championship', tier: 1, country: 'Europe', countryCode: 'INT' },
        { id: '13', name: 'Copa Libertadores', tier: 1, country: 'South America', countryCode: 'INT' },
        { id: '1', name: 'FIFA World Cup', tier: 1, country: 'International', countryCode: 'INT' }
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
        'Switzerland': 'CH',
        'Netherlands': 'NL',
        'Portugal': 'PT',
        'Italy': 'IT',
        'Belgium': 'BE',
        'Brazil': 'BR',
        'United States': 'US',
        'USA': 'US',
        'Japan': 'JP',
        'International': 'INT'
    };
    return countryMapping[countryName];
};

// Get league name by ID
export const getLeagueName = (leagueId) => {
    const league = getAllLeagues().find(l => l.id === leagueId);
    return league ? league.name : null;
};

// Get league information by ID
export const getLeagueById = (leagueId) => {
    return getAllLeagues().find(l => l.id === leagueId) || null;
}; 