export const DEFAULT_VIEWPORT_DELTA = 0.5;

/**
 * Builds API search bounds and map initialRegion from a selected location.
 * When the backend provides area/ country bounds (from LocationIQ boundingbox), uses full extent;
 * otherwise uses a fixed viewport around the center point.
 *
 * @param {{ lat: number, lon: number, bounds?: { southwest: { lat: number, lng: number }, northeast: { lat: number, lng: number } } }} location
 * @param {{ viewportDelta?: number }} [options]
 */
export function getSearchBoundsAndInitialRegion(location, options = {}) {
    const viewportDelta = options.viewportDelta ?? DEFAULT_VIEWPORT_DELTA;
    const lat = location.lat;
    const lon = location.lon;

    const swB = location.bounds?.southwest;
    const neB = location.bounds?.northeast;
    if (
        swB &&
        neB &&
        typeof swB.lat === 'number' &&
        typeof swB.lng === 'number' &&
        typeof neB.lat === 'number' &&
        typeof neB.lng === 'number'
    ) {
        const bounds = {
            southwest: { lat: swB.lat, lng: swB.lng },
            northeast: { lat: neB.lat, lng: neB.lng },
        };
        const latitude = (bounds.southwest.lat + bounds.northeast.lat) / 2;
        const longitude = (bounds.southwest.lng + bounds.northeast.lng) / 2;
        const latitudeDelta = Math.max(bounds.northeast.lat - bounds.southwest.lat, 1e-6);
        const longitudeDelta = Math.max(bounds.northeast.lng - bounds.southwest.lng, 1e-6);
        return {
            bounds,
            initialRegion: { latitude, longitude, latitudeDelta, longitudeDelta },
        };
    }

    const bounds = {
        northeast: {
            lat: lat + viewportDelta / 2,
            lng: lon + viewportDelta / 2,
        },
        southwest: {
            lat: lat - viewportDelta / 2,
            lng: lon - viewportDelta / 2,
        },
    };
    return {
        bounds,
        initialRegion: {
            latitude: lat,
            longitude: lon,
            latitudeDelta: viewportDelta,
            longitudeDelta: viewportDelta,
        },
    };
}
