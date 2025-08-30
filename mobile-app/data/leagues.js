// League data for mobile app
export const LEAGUES = [
  // Premier League
  { id: '39', name: 'Premier League', country: 'England', countryCode: 'GB', tier: 1 },
  { id: '40', name: 'Championship', country: 'England', countryCode: 'GB', tier: 2 },
  { id: '41', name: 'League One', country: 'England', countryCode: 'GB', tier: 3 },
  
  // Women's Football
  { id: '44', name: 'Women\'s Super League', country: 'England', countryCode: 'GB', tier: 1 },
  { id: '699', name: 'Women\'s Championship', country: 'England', countryCode: 'GB', tier: 2 },
  
  // La Liga
  { id: '140', name: 'La Liga', country: 'Spain', countryCode: 'ES', tier: 1 },
  
  // Bundesliga
  { id: '78', name: 'Bundesliga', country: 'Germany', countryCode: 'DE', tier: 1 },
  
  // Serie A
  { id: '135', name: 'Serie A', country: 'Italy', countryCode: 'IT', tier: 1 },
  
  // Ligue 1
  { id: '61', name: 'Ligue 1', country: 'France', countryCode: 'FR', tier: 1 },
  
  // Other European Leagues
  { id: '88', name: 'Eredivisie', country: 'Netherlands', countryCode: 'NL', tier: 1 },
  { id: '94', name: 'Primeira Liga', country: 'Portugal', countryCode: 'PT', tier: 1 },
  { id: '144', name: 'Belgian Pro League', country: 'Belgium', countryCode: 'BE', tier: 1 },
  { id: '207', name: 'Swiss Super League', country: 'Switzerland', countryCode: 'CH', tier: 1 },
  
  // International Leagues
  { id: '71', name: 'Série A', country: 'Brazil', countryCode: 'BR', tier: 1 },
  { id: '253', name: 'Major League Soccer', country: 'United States', countryCode: 'US', tier: 1 },
  { id: '98', name: 'J1 League', country: 'Japan', countryCode: 'JP', tier: 1 },
  
  // International Competitions
  { id: '2', name: 'UEFA Champions League', country: 'Europe', countryCode: 'INT', tier: 1 },
  { id: '4', name: 'European Championship', country: 'Europe', countryCode: 'INT', tier: 1 },
  { id: '13', name: 'Copa Libertadores', country: 'South America', countryCode: 'INT', tier: 1 },
  { id: '1', name: 'FIFA World Cup', country: 'International', countryCode: 'INT', tier: 1 },
  { id: '1083', name: 'UEFA Women\'s Euro 2025', country: 'Europe', countryCode: 'INT', tier: 1 }
];

// Popular leagues for quick selection
export const POPULAR_LEAGUES = [
  { id: '39', name: 'Premier League', country: 'England' },
  { id: '44', name: 'Women\'s Super League', country: 'England' },
  { id: '140', name: 'La Liga', country: 'Spain' },
  { id: '78', name: 'Bundesliga', country: 'Germany' },
  { id: '135', name: 'Serie A', country: 'Italy' },
  { id: '61', name: 'Ligue 1', country: 'France' },
  { id: '2', name: 'Champions League', country: 'Europe' }
];

// Helper functions
export const getAllLeagues = () => LEAGUES;

export const getLeagueById = (leagueId) => {
  return LEAGUES.find(league => league.id === leagueId) || null;
};

export const getLeaguesByCountry = (countryCode) => {
  return LEAGUES.filter(league => league.countryCode === countryCode);
};

export const getPopularLeagues = () => POPULAR_LEAGUES; 