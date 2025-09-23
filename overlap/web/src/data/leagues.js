// League data with country mappings
export const LEAGUES = {
    'GB': [ // United Kingdom
        { id: '39', name: 'Premier League', tier: 1, country: 'England', countryCode: 'GB' },
        { id: '40', name: 'Championship', tier: 2, country: 'England', countryCode: 'GB' },
        { id: '41', name: 'League One', tier: 3, country: 'England', countryCode: 'GB' }
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
        // UEFA Competitions
        { id: '2', name: 'UEFA Champions League', tier: 1, country: 'Europe', countryCode: 'INT' },
        { id: '3', name: 'UEFA Europa League', tier: 1, country: 'Europe', countryCode: 'INT' },
        { id: '848', name: 'UEFA Europa Conference League', tier: 1, country: 'Europe', countryCode: 'INT' },
        { id: '4', name: 'European Championship', tier: 1, country: 'Europe', countryCode: 'INT' },
        { id: '960', name: 'Euro Championship - Qualification', tier: 1, country: 'Europe', countryCode: 'INT' },
        { id: '5', name: 'UEFA Nations League', tier: 1, country: 'Europe', countryCode: 'INT' },
        { id: '1040', name: 'UEFA Nations League - Women', tier: 1, country: 'Europe', countryCode: 'INT' },
        
        // FIFA World Cup & Qualifiers
        { id: '1', name: 'FIFA World Cup', tier: 1, country: 'International', countryCode: 'INT' },
        { id: '8', name: 'World Cup - Women', tier: 1, country: 'International', countryCode: 'INT' },
        { id: '29', name: 'World Cup - Qualification Africa', tier: 1, country: 'International', countryCode: 'INT' },
        { id: '30', name: 'World Cup - Qualification Asia', tier: 1, country: 'International', countryCode: 'INT' },
        { id: '31', name: 'World Cup - Qualification CONCACAF', tier: 1, country: 'International', countryCode: 'INT' },
        { id: '32', name: 'World Cup - Qualification Europe', tier: 1, country: 'International', countryCode: 'INT' },
        { id: '33', name: 'World Cup - Qualification Oceania', tier: 1, country: 'International', countryCode: 'INT' },
        { id: '34', name: 'World Cup - Qualification South America', tier: 1, country: 'International', countryCode: 'INT' },
        { id: '37', name: 'World Cup - Qualification Intercontinental Play-offs', tier: 1, country: 'International', countryCode: 'INT' },
        
        // Continental Championships
        { id: '6', name: 'Africa Cup of Nations', tier: 1, country: 'Africa', countryCode: 'INT' },
        { id: '36', name: 'Africa Cup of Nations - Qualification', tier: 1, country: 'Africa', countryCode: 'INT' },
        { id: '922', name: 'Africa Cup of Nations - Women', tier: 1, country: 'Africa', countryCode: 'INT' },
        { id: '7', name: 'Asian Cup', tier: 1, country: 'Asia', countryCode: 'INT' },
        { id: '35', name: 'Asian Cup - Qualification', tier: 1, country: 'Asia', countryCode: 'INT' },
        { id: '897', name: 'Asian Cup Women', tier: 1, country: 'Asia', countryCode: 'INT' },
        { id: '9', name: 'Copa America', tier: 1, country: 'South America', countryCode: 'INT' },
        { id: '926', name: 'Copa America Femenina', tier: 1, country: 'South America', countryCode: 'INT' },
        { id: '22', name: 'CONCACAF Gold Cup', tier: 1, country: 'North America', countryCode: 'INT' },
        { id: '858', name: 'CONCACAF Gold Cup - Qualification', tier: 1, country: 'North America', countryCode: 'INT' },
        { id: '1057', name: 'CONCACAF Gold Cup - Women', tier: 1, country: 'North America', countryCode: 'INT' },
        { id: '536', name: 'CONCACAF Nations League', tier: 1, country: 'North America', countryCode: 'INT' },
        
        // Club Competitions
        { id: '13', name: 'Copa Libertadores', tier: 1, country: 'South America', countryCode: 'INT' },
        { id: '11', name: 'CONMEBOL Sudamericana', tier: 1, country: 'South America', countryCode: 'INT' },
        { id: '12', name: 'CAF Champions League', tier: 1, country: 'Africa', countryCode: 'INT' },
        { id: '16', name: 'CONCACAF Champions League', tier: 1, country: 'North America', countryCode: 'INT' },
        { id: '17', name: 'AFC Champions League', tier: 1, country: 'Asia', countryCode: 'INT' },
        { id: '15', name: 'FIFA Club World Cup', tier: 1, country: 'International', countryCode: 'INT' },
        { id: '1168', name: 'FIFA Intercontinental Cup', tier: 1, country: 'International', countryCode: 'INT' },
        
        // International Friendlies & Others
        { id: '10', name: 'International Friendlies', tier: 1, country: 'International', countryCode: 'INT' },
        { id: '666', name: 'Friendlies Women', tier: 1, country: 'International', countryCode: 'INT' },
        { id: '667', name: 'Friendlies Clubs', tier: 1, country: 'International', countryCode: 'INT' },
        { id: '480', name: 'Olympics Men', tier: 1, country: 'International', countryCode: 'INT' },
        { id: '524', name: 'Olympics Women', tier: 1, country: 'International', countryCode: 'INT' },
        { id: '21', name: 'Confederations Cup', tier: 1, country: 'International', countryCode: 'INT' },
        { id: '913', name: 'CONMEBOL - UEFA Finalissima', tier: 1, country: 'International', countryCode: 'INT' },
        
        // Women's Competitions
        { id: '1083', name: 'UEFA Women\'s Euro 2025', tier: 1, country: 'Europe', countryCode: 'INT' },
        { id: '743', name: 'UEFA Championship - Women', tier: 1, country: 'Europe', countryCode: 'INT' },
        { id: '525', name: 'UEFA Champions League Women', tier: 1, country: 'Europe', countryCode: 'INT' },
        { id: '1191', name: 'UEFA Europa Cup - Women', tier: 1, country: 'Europe', countryCode: 'INT' },
        { id: '949', name: 'CONMEBOL Libertadores Femenina', tier: 1, country: 'South America', countryCode: 'INT' },
        { id: '1140', name: 'AFC Women\'s Champions League', tier: 1, country: 'Asia', countryCode: 'INT' },
        { id: '1164', name: 'CAF Women\'s Champions League', tier: 1, country: 'Africa', countryCode: 'INT' },
        { id: '1136', name: 'CONCACAF W Champions Cup', tier: 1, country: 'North America', countryCode: 'INT' }
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