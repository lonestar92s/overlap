const {
    calculateDistanceKm,
    getIntersectingRegions,
    getVisibleSearchContext,
    getDomesticCountriesFromContext
} = require('../../../src/utils/searchGeography');

describe('Match Search Geography', () => {
    describe('calculateDistanceKm', () => {
        it('calculates London to Paris distance', () => {
            const london = { lat: 51.5074, lng: -0.1278 };
            const paris = { lat: 48.8566, lng: 2.3522 };
            const distance = calculateDistanceKm(london.lat, london.lng, paris.lat, paris.lng);

            expect(distance).toBeGreaterThan(340);
            expect(distance).toBeLessThan(350);
        });
    });

    describe('getVisibleSearchContext', () => {
        it('includes France for Marseille instead of misclassifying it as Switzerland', () => {
            const bounds = {
                northeast: { lat: 43.45, lng: 5.55 },
                southwest: { lat: 43.15, lng: 5.25 }
            };

            const searchContext = getVisibleSearchContext(bounds);
            const domesticCountries = getDomesticCountriesFromContext(searchContext);

            expect(searchContext.visibleCountries).toContain('France');
            expect(domesticCountries).toContain('France');
            expect(domesticCountries).not.toContain('Switzerland');
        });

        it('includes both France and Belgium for a Lille border viewport', () => {
            const bounds = {
                northeast: { lat: 50.78, lng: 3.24 },
                southwest: { lat: 50.55, lng: 2.95 }
            };

            const searchContext = getVisibleSearchContext(bounds);

            expect(searchContext.visibleCountries).toEqual(
                expect.arrayContaining(['France', 'Belgium'])
            );
        });

        it('includes both France and Germany for a Strasbourg border viewport', () => {
            const bounds = {
                northeast: { lat: 48.68, lng: 7.95 },
                southwest: { lat: 48.48, lng: 7.62 }
            };

            const searchContext = getVisibleSearchContext(bounds);

            expect(searchContext.visibleCountries).toEqual(
                expect.arrayContaining(['France', 'Germany'])
            );
        });

        it('includes both France and Switzerland around Geneva', () => {
            const bounds = {
                northeast: { lat: 46.35, lng: 6.28 },
                southwest: { lat: 46.12, lng: 5.95 }
            };

            const searchContext = getVisibleSearchContext(bounds);

            expect(searchContext.visibleCountries).toEqual(
                expect.arrayContaining(['France', 'Switzerland'])
            );
        });
    });

    describe('getIntersectingRegions', () => {
        it('includes Europe for Marseille bounds', () => {
            const bounds = {
                northeast: { lat: 43.45, lng: 5.55 },
                southwest: { lat: 43.15, lng: 5.25 }
            };

            const regions = getIntersectingRegions(bounds);

            expect(regions.has('Europe')).toBe(true);
        });

        it('does not incorrectly classify Tashkent bounds as Europe', () => {
            const bounds = {
                northeast: { lat: 41.5, lng: 69.5 },
                southwest: { lat: 41.1, lng: 69.0 }
            };

            const regions = getIntersectingRegions(bounds);

            expect(regions.has('Europe')).toBe(false);
            expect(regions.has('Asia')).toBe(true);
        });
    });
});
