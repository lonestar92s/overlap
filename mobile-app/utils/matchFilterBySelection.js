/**
 * Filter a match list by country / league / team selection (OR logic per dimension).
 * Kept in sync with getFilteredMatches in MapResultsScreen / useMatchFilters.
 *
 * @param {Array} matchList
 * @param {{ countries?: string[], leagues?: string[], teams?: string[] }} filters
 * @param {{ matchIds?: string[] }} filterData
 * @returns {Array}
 */
export function filterMatchesBySelection(matchList, filters, filterData) {
  if (!matchList) return [];
  if (!filterData || !filterData.matchIds || filterData.matchIds.length === 0) {
    return matchList;
  }
  if (!filters) return matchList;

  const { countries, leagues, teams } = filters;
  const selectedCountryIds = (countries || []).map((id) => id?.toString());
  const selectedLeagueIds = (leagues || []).map((id) => id?.toString());
  const selectedTeamIds = (teams || []).map((id) => id?.toString());

  if (
    selectedCountryIds.length === 0 &&
    selectedLeagueIds.length === 0 &&
    selectedTeamIds.length === 0
  ) {
    return matchList;
  }

  return matchList.filter((match) => {
    let matched = false;

    if (selectedCountryIds.length > 0) {
      const matchCountry =
        match.area?.code ||
        match.area?.id?.toString() ||
        (typeof match.venue?.country === 'string'
          ? match.venue.country
          : match.venue?.country?.id?.toString());
      if (selectedCountryIds.includes(matchCountry)) {
        matched = true;
      }
    }

    if (selectedLeagueIds.length > 0) {
      const matchLeague =
        match.competition?.id?.toString() ||
        match.competition?.code?.toString() ||
        (typeof match.league === 'string'
          ? match.league
          : match.league?.id?.toString() || match.league?.name);
      if (selectedLeagueIds.includes(matchLeague)) {
        matched = true;
      }
    }

    if (selectedTeamIds.length > 0) {
      const homeTeamId = match.teams?.home?.id;
      const awayTeamId = match.teams?.away?.id;
      const homeTeamIdStr = homeTeamId?.toString();
      const awayTeamIdStr = awayTeamId?.toString();
      const homeMatch =
        selectedTeamIds.includes(homeTeamIdStr) || selectedTeamIds.includes(homeTeamId);
      const awayMatch =
        selectedTeamIds.includes(awayTeamIdStr) || selectedTeamIds.includes(awayTeamId);
      if (homeMatch || awayMatch) {
        matched = true;
      }
    }

    return matched;
  });
}
