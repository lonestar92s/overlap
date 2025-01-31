// League data with country mappings
export const LEAGUES = {
    'GB': [ // United Kingdom
        { id: 'PL', name: 'Premier League', tier: 1 },
        // Ready for expansion:
        // { id: 'ELC', name: 'Championship', tier: 2 },
        // { id: 'EL1', name: 'League One', tier: 3 },
        // { id: 'EL2', name: 'League Two', tier: 4 }
    ],
    'FR': [ // France
        { id: 'FL1', name: 'Ligue 1', tier: 1 },
        // Ready for expansion:
        // { id: 'FL2', name: 'Ligue 2', tier: 2 }
    ],
    'ES': [ // Spain
        { id: 'PD', name: 'La Liga', tier: 1 },
        // Ready for expansion:
        // { id: 'SD', name: 'La Liga 2', tier: 2 }
    ],
    'DE': [ // Germany
        { id: 'BL1', name: 'Bundesliga', tier: 1 },
        // Ready for expansion:
        // { id: 'BL2', name: 'Bundesliga 2', tier: 2 },
        // { id: 'BL3', name: '3. Liga', tier: 3 }
    ]
};

// Helper function to get leagues for a country
export const getLeaguesForCountry = (countryCode) => {
    return LEAGUES[countryCode] || [];
};

// Helper function to get all available leagues
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
        'Germany': 'DE'
    };
    return countryMapping[countryName];
};

// Get league name by ID
export const getLeagueName = (leagueId) => {
    const league = getAllLeagues().find(l => l.id === leagueId);
    return league ? league.name : null;
}; 