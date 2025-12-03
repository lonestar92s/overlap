/**
 * Filter Data Processor Utility
 * 
 * Processes match data to extract filter options (countries, leagues, teams)
 * This logic was extracted from MapResultsScreen to improve maintainability and testability
 */

/**
 * Processes matches and returns filter data object
 * @param {Array} matchesToProcess - Array of match objects to process
 * @returns {Object} Filter data object with countries, leagues, teams, and matchIds
 */
export const processMatchesForFilterData = (matchesToProcess) => {
  if (!matchesToProcess || matchesToProcess.length === 0) {
    return {
      countries: [],
      leagues: [],
      teams: [],
      matchIds: []
    };
  }
  
  const currentMatchIds = matchesToProcess.map(m => m.id || m.fixture?.id).filter(Boolean).sort();
  
  // Extract unique countries, leagues, and teams from matches
  const countriesMap = new Map();
  const leaguesMap = new Map();
  const teamsMap = new Map();

  matchesToProcess.forEach((match) => {
    // Process country from area.name
    let countryId = null;
    let countryName = null;
    
    if (match.area?.name) {
      countryId = match.area.code || match.area.id?.toString();
      countryName = match.area.name;
    }
    
    // Fallback: try to extract from league.country (backend returns this)
    if (!countryId && match.league && match.league.country) {
      countryId = match.league.country;
      countryName = match.league.country;
    }
    
    // Fallback: try to extract from venue or other fields
    if (!countryId && match.venue && match.venue.country) {
      if (typeof match.venue.country === 'string') {
        countryId = match.venue.country;
        countryName = match.venue.country;
      } else if (match.venue.country.id) {
        countryId = match.venue.country.id;
        countryName = match.venue.country.name;
      }
    }

    if (countryId) {
      if (!countriesMap.has(countryId)) {
        countriesMap.set(countryId, {
          id: countryId,
          name: countryName,
          count: 1
        });
      } else {
        countriesMap.get(countryId).count++;
      }
    }

    // Process league from competition.name
    let leagueId = null;
    let leagueName = null;
    
    if (match.competition?.name) {
      leagueId = match.competition.id || match.competition.code;
      leagueName = match.competition.name;
    }
    
    // Fallback: try match.league if competition doesn't exist
    if (!leagueId && match.league) {
      if (typeof match.league === 'string') {
        leagueId = match.league;
        leagueName = match.league;
      } else if (match.league.id) {
        leagueId = match.league.id;
        leagueName = match.league.name;
      } else if (match.league.name) {
        leagueId = match.league.name;
        leagueName = match.league.name;
      }
    }

    if (leagueId) {
      if (!leaguesMap.has(leagueId)) {
        leaguesMap.set(leagueId, {
          id: leagueId,
          name: leagueName,
          countryId: countryId || 'unknown',
          count: 1
        });
      } else {
        leaguesMap.get(leagueId).count++;
      }
    }

    // Process teams from teams.home and teams.away
    const processTeam = (team) => {
      let teamId = null;
      let teamName = null;
      
      if (team) {
        if (typeof team === 'string') {
          teamId = team;
          teamName = team;
        } else if (team.id) {
          teamId = team.id;
          teamName = team.name;
        } else if (team.name) {
          teamId = team.name;
          teamName = team.name;
        }
      }

      if (teamId) {
        if (!teamsMap.has(teamId)) {
          teamsMap.set(teamId, {
            id: teamId,
            name: teamName,
            countryId: countryId || 'unknown',
            leagueId: leagueId || 'unknown',
            count: 1
          });
        } else {
          teamsMap.get(teamId).count++;
        }
      }
    };

    // Process home team from teams.home
    if (match.teams?.home) {
      processTeam(match.teams.home);
    }
    
    // Process away team from teams.away
    if (match.teams?.away) {
      processTeam(match.teams.away);
    }
  });

  const computedFilterData = {
    countries: Array.from(countriesMap.values()),
    leagues: Array.from(leaguesMap.values()),
    teams: Array.from(teamsMap.values()),
    matchIds: currentMatchIds
  };

  // If we still don't have any data, create some basic fallback data
  if (computedFilterData.countries.length === 0 && computedFilterData.leagues.length === 0 && computedFilterData.teams.length === 0) {
    if (__DEV__) {
      console.log('No structured data found, creating fallback data');
    }
    
    // Try to create some basic data from the first match
    const firstMatch = matchesToProcess[0];
    let fallbackData = {
      countries: [],
      leagues: [],
      teams: [],
      matchIds: currentMatchIds
    };
    
    // Try to extract basic info from the first match
    if (firstMatch) {
      if (firstMatch.area?.name) {
        fallbackData.countries.push({
          id: firstMatch.area.code || firstMatch.area.id?.toString() || 'unknown',
          name: firstMatch.area.name,
          count: matchesToProcess.length
        });
      }
      
      if (firstMatch.competition?.name) {
        fallbackData.leagues.push({
          id: firstMatch.competition.id || firstMatch.competition.code || 'unknown',
          name: firstMatch.competition.name,
          countryId: firstMatch.area?.code || firstMatch.area?.id?.toString() || 'unknown',
          count: matchesToProcess.length
        });
      }
      
      if (firstMatch.teams?.home?.name) {
        fallbackData.teams.push({
          id: firstMatch.teams.home.id || firstMatch.teams.home.name,
          name: firstMatch.teams.home.name,
          countryId: firstMatch.area?.code || firstMatch.area?.id?.toString() || 'unknown',
          leagueId: firstMatch.competition?.id || firstMatch.competition?.code || 'unknown',
          count: 1
        });
      }
      
      if (firstMatch.teams?.away?.name) {
        fallbackData.teams.push({
          id: firstMatch.teams.away.id || firstMatch.teams.away.name,
          name: firstMatch.teams.away.name,
          countryId: firstMatch.area?.code || firstMatch.area?.id?.toString() || 'unknown',
          leagueId: firstMatch.competition?.id || firstMatch.competition?.code || 'unknown',
          count: 1
        });
      }
    }
    
    // If we still don't have data, use generic fallback
    if (fallbackData.countries.length === 0) {
      fallbackData.countries.push({
        id: 'unknown', 
        name: 'Unknown Country', 
        count: matchesToProcess.length
      });
    }
    
    if (fallbackData.leagues.length === 0) {
      fallbackData.leagues.push({
        id: 'unknown', 
        name: 'Unknown League', 
        countryId: fallbackData.countries[0].id, 
        count: matchesToProcess.length
      });
    }
    
    if (fallbackData.teams.length === 0) {
      fallbackData.teams.push({
        id: 'unknown', 
        name: 'Unknown Team', 
        countryId: fallbackData.countries[0].id, 
        leagueId: fallbackData.leagues[0].id, 
        count: matchesToProcess.length
      });
    }
    
    return fallbackData;
  }
  
  return computedFilterData;
};

export default {
  processMatchesForFilterData
};
