/**
 * LocationIQ autocomplete responses follow Nominatim-style fields when present.
 * boundingbox: [south, north, west, east] — each value may be a string or number.
 *
 * @param {object} item Raw autocomplete result item from LocationIQ
 * @returns {{ southwest: { lat: number, lng: number }, northeast: { lat: number, lng: number } } | null}
 */
function boundsFromLocationIqAutocompleteItem(item) {
    const bb = item?.boundingbox;
    if (!Array.isArray(bb) || bb.length !== 4) {
        return null;
    }
    const nums = bb.map((v) => parseFloat(v, 10));
    if (nums.some((n) => Number.isNaN(n))) {
        return null;
    }
    const [south, north, west, east] = nums;
    return {
        southwest: { lat: south, lng: west },
        northeast: { lat: north, lng: east },
    };
}

module.exports = { boundsFromLocationIqAutocompleteItem };
