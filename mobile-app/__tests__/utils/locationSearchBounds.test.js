import { getSearchBoundsAndInitialRegion } from '../../utils/locationSearchBounds';

describe('getSearchBoundsAndInitialRegion', () => {
    it('uses full area bounds when location includes bounds (e.g. country from LocationIQ)', () => {
        const location = {
            lat: 46.603354,
            lon: 1.888334,
            city: 'France',
            country: 'France',
            bounds: {
                southwest: { lat: 41.33, lng: -5.15 },
                northeast: { lat: 51.09, lng: 9.55 },
            },
        };

        const { bounds, initialRegion } = getSearchBoundsAndInitialRegion(location);

        expect(bounds).toEqual({
            southwest: { lat: 41.33, lng: -5.15 },
            northeast: { lat: 51.09, lng: 9.55 },
        });

        expect(initialRegion.latitude).toBeCloseTo((41.33 + 51.09) / 2, 5);
        expect(initialRegion.longitude).toBeCloseTo((-5.15 + 9.55) / 2, 5);
        expect(initialRegion.latitudeDelta).toBeCloseTo(51.09 - 41.33, 5);
        expect(initialRegion.longitudeDelta).toBeCloseTo(9.55 - -5.15, 5);
    });

    it('falls back to viewportDelta around center when bounds are absent', () => {
        const location = {
            lat: 48.8566,
            lon: 2.3522,
            city: 'Paris',
            country: 'France',
        };

        const { bounds, initialRegion } = getSearchBoundsAndInitialRegion(location, {
            viewportDelta: 0.5,
        });

        expect(bounds.southwest).toEqual({
            lat: 48.8566 - 0.25,
            lng: 2.3522 - 0.25,
        });
        expect(bounds.northeast).toEqual({
            lat: 48.8566 + 0.25,
            lng: 2.3522 + 0.25,
        });
        expect(initialRegion).toEqual({
            latitude: 48.8566,
            longitude: 2.3522,
            latitudeDelta: 0.5,
            longitudeDelta: 0.5,
        });
    });

    it('ignores partial bounds object and uses fallback', () => {
        const location = {
            lat: 40,
            lon: -3,
            bounds: { southwest: { lat: 39, lng: -4 } },
        };

        const { bounds } = getSearchBoundsAndInitialRegion(location, { viewportDelta: 0.5 });

        expect(bounds.southwest.lat).toBe(40 - 0.25);
        expect(bounds.northeast.lat).toBe(40 + 0.25);
    });
});
