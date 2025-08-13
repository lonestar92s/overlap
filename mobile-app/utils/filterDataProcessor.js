// Utility functions to process match data and extract filter options

/**
 * Process match data to extract filter options
 * @param {Array} matches - Array of match objects
 * @returns {Object} Object containing countries, leagues, and teams with counts
 */
export function processMatchDataForFilters(matches) {
  if (!matches || matches.length === 0) {
    return {
      countries: [],
      leagues: [],
      teams: [],
    };
  }

  const countryMap = new Map();
  const leagueMap = new Map();
  const teamMap = new Map();

  matches.forEach(match => {
    // Process country
    const countryId = extractCountryId(match);
    if (countryId) {
      if (!countryMap.has(countryId)) {
        countryMap.set(countryId, {
          id: countryId,
          name: extractCountryName(match),
          count: 0,
        });
      }
      countryMap.get(countryId).count++;
    }

    // Process league
    const leagueId = extractLeagueId(match);
    if (leagueId) {
      if (!leagueMap.has(leagueId)) {
        leagueMap.set(leagueId, {
          id: leagueId,
          name: extractLeagueName(match),
          country: countryId,
          count: 0,
          type: determineLeagueType(match),
        });
      }
      leagueMap.get(leagueId).count++;
    }

    // Process teams
    const homeTeamId = extractTeamId(match.homeTeam);
    const awayTeamId = extractTeamId(match.awayTeam);

    if (homeTeamId) {
      if (!teamMap.has(homeTeamId)) {
        teamMap.set(homeTeamId, {
          id: homeTeamId,
          name: extractTeamName(match.homeTeam),
          league: leagueId,
          country: countryId,
          count: 0,
          logo: extractTeamLogo(match.homeTeam),
        });
      }
      teamMap.get(homeTeamId).count++;
    }

    if (awayTeamId) {
      if (!teamMap.has(awayTeamId)) {
        teamMap.set(awayTeamId, {
          id: awayTeamId,
          name: extractTeamName(match.awayTeam),
          league: leagueId,
          country: countryId,
          count: 0,
          logo: extractTeamLogo(match.awayTeam),
        });
      }
      teamMap.get(awayTeamId).count++;
    }
  });

  // Convert maps to arrays and sort by count (descending)
  const countries = Array.from(countryMap.values())
    .sort((a, b) => b.count - a.count);

  const leagues = Array.from(leagueMap.values())
    .sort((a, b) => b.count - a.count);

  const teams = Array.from(teamMap.values())
    .sort((a, b) => b.count - a.count);

  return { countries, leagues, teams };
}

/**
 * Extract country ID from match data
 * @param {Object} match - Match object
 * @returns {String} Country ID
 */
function extractCountryId(match) {
  // Try to get country from venue first
  if (match.venue?.country) {
    return match.venue.country;
  }
  
  // Try to get country from league
  if (match.league?.country) {
    return match.league.country;
  }
  
  // Try to get country from teams
  if (match.homeTeam?.country) {
    return match.homeTeam.country;
  }
  
  if (match.awayTeam?.country) {
    return match.awayTeam.country;
  }
  
  // Default country based on league name or other indicators
  return determineDefaultCountry(match);
}

/**
 * Extract country name from match data
 * @param {Object} match - Match object
 * @returns {String} Country name
 */
function extractCountryName(match) {
  // Try to get country name from venue first
  if (match.venue?.countryName) {
    return match.venue.countryName;
  }
  
  // Try to get country name from league
  if (match.league?.countryName) {
    return match.league.countryName;
  }
  
  // Try to get country name from teams
  if (match.homeTeam?.countryName) {
    return match.homeTeam.countryName;
  }
  
  if (match.awayTeam?.countryName) {
    return match.awayTeam.countryName;
  }
  
  // Convert country code to name if available
  const countryId = extractCountryId(match);
  return convertCountryCodeToName(countryId);
}

/**
 * Extract league ID from match data
 * @param {Object} match - Match object
 * @returns {String} League ID
 */
function extractLeagueId(match) {
  if (match.league?.id) {
    return match.league.id;
  }
  
  if (match.fixture?.league?.id) {
    return match.fixture.league.id;
  }
  
  // Generate a unique ID based on league name if no ID exists
  const leagueName = extractLeagueName(match);
  if (leagueName) {
    return `league_${leagueName.toLowerCase().replace(/\s+/g, '_')}`;
  }
  
  return null;
}

/**
 * Extract league name from match data
 * @param {Object} match - Match object
 * @returns {String} League name
 */
function extractLeagueName(match) {
  if (match.league?.name) {
    return match.league.name;
  }
  
  if (match.fixture?.league?.name) {
    return match.fixture.league.name;
  }
  
  return null;
}

/**
 * Extract team ID from team data
 * @param {Object} team - Team object
 * @returns {String} Team ID
 */
function extractTeamId(team) {
  if (!team) return null;
  
  if (team.id) {
    return team.id;
  }
  
  if (team.teamId) {
    return team.teamId;
  }
  
  // Generate a unique ID based on team name if no ID exists
  const teamName = extractTeamName(team);
  if (teamName) {
    return `team_${teamName.toLowerCase().replace(/\s+/g, '_')}`;
  }
  
  return null;
}

/**
 * Extract team name from team data
 * @param {Object} team - Team object
 * @returns {String} Team name
 */
function extractTeamName(team) {
  if (!team) return null;
  
  if (team.name) {
    return team.name;
  }
  
  if (team.teamName) {
    return team.teamName;
  }
  
  return null;
}

/**
 * Extract team logo from team data
 * @param {Object} team - Team object
 * @returns {String} Team logo URL
 */
function extractTeamLogo(team) {
  if (!team) return null;
  
  if (team.logo) {
    return team.logo;
  }
  
  if (team.teamLogo) {
    return team.teamLogo;
  }
  
  return null;
}

/**
 * Determine if a league is domestic or continental
 * @param {Object} match - Match object
 * @returns {String} 'domestic' or 'continental'
 */
function determineLeagueType(match) {
  const leagueName = extractLeagueName(match);
  if (!leagueName) return 'domestic';
  
  const continentalLeagues = [
    'champions league',
    'europa league',
    'europa conference league',
    'uefa',
    'european',
  ];
  
  const isContinental = continentalLeagues.some(continental => 
    leagueName.toLowerCase().includes(continental)
  );
  
  return isContinental ? 'continental' : 'domestic';
}

/**
 * Determine default country based on match data
 * @param {Object} match - Match object
 * @returns {String} Default country ID
 */
function determineDefaultCountry(match) {
  // This is a fallback - in practice, you should have country data
  // For now, return a default based on common patterns
  
  const leagueName = extractLeagueName(match);
  if (!leagueName) return 'unknown';
  
  // Map common league names to countries
  const leagueCountryMap = {
    'premier league': 'GB',
    'bundesliga': 'DE',
    'la liga': 'ES',
    'serie a': 'IT',
    'ligue 1': 'FR',
    'eredivisie': 'NL',
    'primeira liga': 'PT',
    'super lig': 'TR',
  };
  
  const lowerLeagueName = leagueName.toLowerCase();
  for (const [league, country] of Object.entries(leagueCountryMap)) {
    if (lowerLeagueName.includes(league)) {
      return country;
    }
  }
  
  return 'unknown';
}

/**
 * Convert country code to country name
 * @param {String} countryCode - Country code
 * @returns {String} Country name
 */
function convertCountryCodeToName(countryCode) {
  const countryNames = {
    'GB': 'United Kingdom',
    'DE': 'Germany',
    'ES': 'Spain',
    'IT': 'Italy',
    'FR': 'France',
    'NL': 'Netherlands',
    'PT': 'Portugal',
    'TR': 'Turkey',
    'international': 'International',
    'unknown': 'Unknown',
  };
  
  return countryNames[countryCode] || countryCode;
}

/**
 * Generate match counts for filter options
 * @param {Array} matches - Array of match objects
 * @param {Object} filterData - Current filter data
 * @returns {Object} Object with counts for countries, leagues, and teams
 */
export function generateFilterCounts(matches, filterData) {
  const counts = {
    countries: {},
    leagues: {},
    teams: {},
  };

  matches.forEach(match => {
    const countryId = extractCountryId(match);
    const leagueId = extractLeagueId(match);
    const homeTeamId = extractTeamId(match.homeTeam);
    const awayTeamId = extractTeamId(match.awayTeam);

    if (countryId) {
      counts.countries[countryId] = (counts.countries[countryId] || 0) + 1;
    }

    if (leagueId) {
      counts.leagues[leagueId] = (counts.leagues[leagueId] || 0) + 1;
    }

    if (homeTeamId) {
      counts.teams[homeTeamId] = (counts.teams[homeTeamId] || 0) + 1;
    }

    if (awayTeamId) {
      counts.teams[awayTeamId] = (counts.teams[awayTeamId] || 0) + 1;
    }
  });

  return counts;
}

/**
 * Validate filter combination
 * @param {Object} selectedFilters - Currently selected filters
 * @returns {Object} Validation result with isValid and message
 */
export function validateFilterCombination(selectedFilters) {
  const { countries, leagues, teams } = selectedFilters;
  const totalFilters = countries.length + leagues.length + teams.length;
  
  if (totalFilters > 10) {
    return {
      isValid: false,
      message: `Maximum 10 filters allowed. You have selected ${totalFilters}.`,
    };
  }
  
  return {
    isValid: true,
    message: null,
  };
}

