import ApiService from './api';

const DEFAULT_VIEWPORT_DELTA = 0.5;
const DEFAULT_BOUNDS_DELTA = 0.25;

export const resolveAgentSearchToMapData = async (data) => {
  const parsed = data?.parsed || {};
  const location = parsed.location;
  const dateFrom = parsed.dateRange?.start || null;
  const dateTo = parsed.dateRange?.end || null;
  const leagues = parsed.leagues?.map((l) => l.id).filter(Boolean) || [];
  const teams = parsed.teams?.map((t) => t.id) || [];

  const hasLocation = Boolean(location?.coordinates && location.coordinates.length === 2);
  const hasDates = Boolean(dateFrom && dateTo);
  // Broad NL queries can include inferred leagues from backend fallback expansion.
  // Treat explicit teams as "who"; only use leagues as "who" when teams are present
  // or when leagues appear intentionally constrained.
  const hasExplicitTeams = teams.length > 0;
  const hasWho = hasExplicitTeams;

  if (!hasWho && (!hasLocation || !hasDates)) {
    return {
      success: false,
      type: 'clarification',
      message: 'Please include a location and date range, or specify leagues/teams.',
    };
  }

  if (hasWho && !hasLocation && !hasDates) {
    return {
      success: false,
      type: 'clarification',
      message: 'Please include a location or date range when searching by teams/leagues.',
    };
  }

  const searchParams = {
    location,
    dateFrom,
    dateTo,
  };

  let matches = [];
  let initialRegion = null;
  let autoFitKey = 0;

  if (hasWho) {
    const apiParams = {
      competitions: leagues.map((l) => String(l)),
      teams: teams.map((t) => String(t)),
    };

    if (hasDates) {
      apiParams.dateFrom = dateFrom;
      apiParams.dateTo = dateTo;
    }

    if (hasLocation) {
      apiParams.bounds = {
        northeast: {
          lat: location.coordinates[1] + DEFAULT_VIEWPORT_DELTA / 2,
          lng: location.coordinates[0] + DEFAULT_VIEWPORT_DELTA / 2,
        },
        southwest: {
          lat: location.coordinates[1] - DEFAULT_VIEWPORT_DELTA / 2,
          lng: location.coordinates[0] - DEFAULT_VIEWPORT_DELTA / 2,
        },
      };

      initialRegion = {
        latitude: location.coordinates[1],
        longitude: location.coordinates[0],
        latitudeDelta: DEFAULT_VIEWPORT_DELTA,
        longitudeDelta: DEFAULT_VIEWPORT_DELTA,
      };
    }

    const aggregated = await ApiService.searchAggregatedMatches(apiParams);
    matches = aggregated?.data || [];
    autoFitKey = Date.now();

    // Parity fallback: broad/conversational asks sometimes resolve to inferred leagues
    // that over-constrain aggregated search. If that happens, retry with bounds search.
    if (matches.length === 0 && hasLocation && hasDates) {
      const bounds = {
        northeast: {
          lat: location.coordinates[1] + DEFAULT_BOUNDS_DELTA,
          lng: location.coordinates[0] + DEFAULT_BOUNDS_DELTA,
        },
        southwest: {
          lat: location.coordinates[1] - DEFAULT_BOUNDS_DELTA,
          lng: location.coordinates[0] - DEFAULT_BOUNDS_DELTA,
        },
      };

      const fallbackResponse = await ApiService.searchMatchesByBounds({
        bounds,
        dateFrom,
        dateTo,
      });
      matches = fallbackResponse?.data || [];
    }
  } else {
    const bounds = {
      northeast: {
        lat: location.coordinates[1] + DEFAULT_BOUNDS_DELTA,
        lng: location.coordinates[0] + DEFAULT_BOUNDS_DELTA,
      },
      southwest: {
        lat: location.coordinates[1] - DEFAULT_BOUNDS_DELTA,
        lng: location.coordinates[0] - DEFAULT_BOUNDS_DELTA,
      },
    };

    const response = await ApiService.searchMatchesByBounds({
      bounds,
      dateFrom,
      dateTo,
    });
    matches = response?.data || [];

    initialRegion = {
      latitude: location.coordinates[1],
      longitude: location.coordinates[0],
      latitudeDelta: DEFAULT_VIEWPORT_DELTA,
      longitudeDelta: DEFAULT_VIEWPORT_DELTA,
    };
  }

  return {
    success: true,
    type: matches.length > 0 ? 'success' : 'no_results',
    count: matches.length,
    matches,
    searchParams,
    initialRegion,
    autoFitKey,
    hasLocation,
    hasDates,
    hasWho,
    preSelectedFilters: data?.preSelectedFilters,
  };
};
