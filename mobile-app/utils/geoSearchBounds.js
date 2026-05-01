/** Default radius (miles) for location-anchored match search (parity with backend NL search). */
export const SEARCH_RADIUS_MILES = 30;

function radiusMilesToLatLngDeltas(centerLat, radiusMiles = SEARCH_RADIUS_MILES) {
  const radiusKm = radiusMiles * 1.60934;
  const latDelta = radiusKm / 111.32;
  const lngDelta = radiusKm / (111.32 * Math.cos((centerLat * Math.PI) / 180));
  return { latDelta, lngDelta };
}

/**
 * Bounding box centered on lat/lng, matching backend natural-language geography.
 */
export function searchBoundsFromMiles(centerLat, centerLon, radiusMiles = SEARCH_RADIUS_MILES) {
  const { latDelta, lngDelta } = radiusMilesToLatLngDeltas(centerLat, radiusMiles);
  return {
    northeast: { lat: centerLat + latDelta, lng: centerLon + lngDelta },
    southwest: { lat: centerLat - latDelta, lng: centerLon - lngDelta },
  };
}

/** react-native-maps region spanning the search radius (~2 × half-span). */
export function mapRegionFromSearchRadius(centerLat, centerLon, radiusMiles = SEARCH_RADIUS_MILES) {
  const { latDelta, lngDelta } = radiusMilesToLatLngDeltas(centerLat, radiusMiles);
  const latitudeDelta = Math.min(Math.max(latDelta * 2, 0.02), 25);
  const longitudeDelta = Math.min(Math.max(lngDelta * 2, 0.02), 25);
  return {
    latitude: centerLat,
    longitude: centerLon,
    latitudeDelta,
    longitudeDelta,
  };
}
