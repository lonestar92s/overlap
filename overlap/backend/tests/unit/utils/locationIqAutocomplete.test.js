const { describe, it, expect } = require('@jest/globals');
const { boundsFromLocationIqAutocompleteItem } = require('../../../src/utils/locationIqAutocomplete');

describe('boundsFromLocationIqAutocompleteItem', () => {
    it('returns southwest/northeast from Nominatim-style boundingbox (e.g. country)', () => {
        const item = {
            boundingbox: ['41.3333163', '51.0978425', '-5.1578426', '9.5597949'],
            lat: '46.603354',
            lon: '1.888334',
            display_name: 'France',
        };

        const bounds = boundsFromLocationIqAutocompleteItem(item);

        expect(bounds).toEqual({
            southwest: { lat: 41.3333163, lng: -5.1578426 },
            northeast: { lat: 51.0978425, lng: 9.5597949 },
        });
    });

    it('returns null when boundingbox is missing', () => {
        const item = {
            lat: '48.8566',
            lon: '2.3522',
            display_name: 'Paris, France',
        };

        expect(boundsFromLocationIqAutocompleteItem(item)).toBeNull();
    });

    it('returns null when boundingbox has wrong length', () => {
        expect(boundsFromLocationIqAutocompleteItem({ boundingbox: ['1', '2'] })).toBeNull();
    });

    it('returns null when boundingbox values are not numeric', () => {
        expect(
            boundsFromLocationIqAutocompleteItem({
                boundingbox: ['a', 'b', 'c', 'd'],
            })
        ).toBeNull();
    });
});
