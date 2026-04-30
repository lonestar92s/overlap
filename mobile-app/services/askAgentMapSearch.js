import ApiService from './api';

const DEFAULT_VIEWPORT_DELTA = 0.5;
const DEFAULT_BOUNDS_DELTA = 0.25;
/** Padding around bbox when fitting map to NL matches (avoids pins on viewport edge). */
const NL_MATCHES_REGION_PAD = 1.4;

/**
 * Fits a react-native-maps Region to venue coordinates [lng, lat], or falls back to city POI.
 * @param {Array} matches - NL/backend match objects with fixture.venue.coordinates
 * @param {[number, number]|null} fallbackLngLat - [lng, lat] from parsed.location
 */
export function buildInitialRegionFromNlMatches(matches, fallbackLngLat) {
  const coords = [];
  for (const m of matches || []) {
    const c = m?.fixture?.venue?.coordinates;
    if (!c || !Array.isArray(c) || c.length !== 2) continue;
    const [lon, lat] = c;
    if (
      typeof lon !== 'number' ||
      typeof lat !== 'number' ||
      Number.isNaN(lon) ||
      Number.isNaN(lat)
    ) {
      continue;
    }
    if (lon < -180 || lon > 180 || lat < -90 || lat > 90) continue;
    coords.push({ lon, lat });
  }

  if (coords.length === 0 && fallbackLngLat?.length === 2) {
    const [lng, lat] = fallbackLngLat;
    if (
      typeof lng === 'number' &&
      typeof lat === 'number' &&
      !Number.isNaN(lng) &&
      !Number.isNaN(lat)
    ) {
      return {
        latitude: lat,
        longitude: lng,
        latitudeDelta: DEFAULT_VIEWPORT_DELTA,
        longitudeDelta: DEFAULT_VIEWPORT_DELTA,
      };
    }
    return null;
  }

  if (coords.length === 0) return null;

  let minLat = coords[0].lat;
  let maxLat = coords[0].lat;
  let minLng = coords[0].lon;
  let maxLng = coords[0].lon;
  for (let i = 1; i < coords.length; i += 1) {
    const { lat, lon } = coords[i];
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lon);
    maxLng = Math.max(maxLng, lon);
  }

  const latSpanRaw = Math.max(maxLat - minLat, 0.02);
  const lngSpanRaw = Math.max(maxLng - minLng, 0.02);
  const latitudeDelta = Math.min(
    Math.max(latSpanRaw * NL_MATCHES_REGION_PAD, DEFAULT_VIEWPORT_DELTA * 0.6),
    25,
  );
  const longitudeDelta = Math.min(
    Math.max(lngSpanRaw * NL_MATCHES_REGION_PAD, DEFAULT_VIEWPORT_DELTA * 0.6),
    25,
  );

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta,
    longitudeDelta,
  };
}

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

  const searchParams = {
    location,
    dateFrom,
    dateTo,
  };

  // NL already resolved fixtures with the same geography as parsed.distance (~50 mi) on the server.
  // Re-querying with tiny bounds often drops Como/Bergamo-style rows vs Duomo centroid — use NL list.
  const nlMatches = Array.isArray(data?.matches) ? data.matches.filter(Boolean) : [];
  if (nlMatches.length > 0) {
    const fallbackCoords = location?.coordinates?.length === 2 ? location.coordinates : null;
    let initialRegion = buildInitialRegionFromNlMatches(nlMatches, fallbackCoords);
    if (!initialRegion && hasLocation) {
      initialRegion = {
        latitude: location.coordinates[1],
        longitude: location.coordinates[0],
        latitudeDelta: DEFAULT_VIEWPORT_DELTA,
        longitudeDelta: DEFAULT_VIEWPORT_DELTA,
      };
    }
    return {
      success: true,
      type: 'success',
      count: nlMatches.length,
      matches: nlMatches,
      searchParams,
      initialRegion,
      autoFitKey: Date.now(),
      hasLocation,
      hasDates,
      hasWho,
      preSelectedFilters: data?.preSelectedFilters,
    };
  }

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
