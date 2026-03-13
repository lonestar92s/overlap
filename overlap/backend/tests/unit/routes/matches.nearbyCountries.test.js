const {
    getVisibleSearchContext,
    getDomesticCountriesFromContext
} = require('../../../src/utils/searchGeography');

describe('Viewport Domestic Country Selection', () => {
    it('keeps France in the domestic set for Marseille', () => {
        const searchContext = getVisibleSearchContext({
            northeast: { lat: 43.45, lng: 5.55 },
            southwest: { lat: 43.15, lng: 5.25 }
        });

        const domesticCountries = getDomesticCountriesFromContext(searchContext);

        expect(domesticCountries).toContain('France');
    });

    it('returns both sides of a border viewport for Lille', () => {
        const searchContext = getVisibleSearchContext({
            northeast: { lat: 50.78, lng: 3.24 },
            southwest: { lat: 50.55, lng: 2.95 }
        });

        const domesticCountries = getDomesticCountriesFromContext(searchContext);

        expect(domesticCountries).toEqual(
            expect.arrayContaining(['France', 'Belgium'])
        );
    });

    it('falls back to a regional country list when no country geometry intersects', () => {
        const domesticCountries = getDomesticCountriesFromContext({
            visibleCountries: [],
            primaryCountry: 'Europe-Region'
        });

        expect(domesticCountries).toEqual(
            expect.arrayContaining(['England', 'Spain', 'Germany', 'Italy', 'France'])
        );
    });
});
