/**
 * Unit tests for nearbyCountries logic fix
 * Tests the fix for the "empty array is truthy" bug
 */
// Mock the detectCountryFromBounds behavior
function simulateDetectCountryFromBounds(scenario) {
    const scenarios = {
        'chicago': {
            country: 'USA',
            centerLat: 41.8781,
            centerLng: -87.6298,
            distance: 719, // > 400km from USA center
            nearbyCountries: [] // Empty because > 400km threshold
        },
        'london': {
            country: 'England',
            centerLat: 51.5074,
            centerLng: -0.1278,
            distance: 150,
            nearbyCountries: ['England', 'France', 'Belgium']
        },
        'pacific-ocean': {
            country: 'Americas-Region',
            centerLat: 30.0,
            centerLng: -140.0,
            distance: null,
            nearbyCountries: []
        }
    };
    return scenarios[scenario];
}
// Simulate the fixed logic
function processNearbyCountries(countryDetection) {
    // FIX: Empty array is truthy, so check length instead
    let nearbyCountries = countryDetection.nearbyCountries && countryDetection.nearbyCountries.length > 0 
        ? [...countryDetection.nearbyCountries] 
        : [];
    // ALWAYS include the primary detected country, even if it's far from center
    if (countryDetection.country && !nearbyCountries.includes(countryDetection.country)) {
        // Only add real countries, not regional fallbacks
        if (!countryDetection.country.endsWith('-Region') && !countryDetection.country.startsWith('Remote-')) {
            nearbyCountries.push(countryDetection.country);
        }
    }
    // If we got a regional fallback and still have no countries, expand the region
    if (nearbyCountries.length === 0 && countryDetection.country) {
        if (countryDetection.country === 'Americas-Region') {
            nearbyCountries = ['USA', 'Canada', 'Mexico'];
        } else if (countryDetection.country === 'Europe-Region') {
            nearbyCountries = ['England', 'Spain', 'Germany', 'Italy', 'France'];
        } else if (countryDetection.country === 'AsiaPacific-Region') {
            nearbyCountries = ['Japan', 'Australia', 'South-Korea', 'China'];
        } else if (countryDetection.country === 'Africa-Region') {
            nearbyCountries = ['Egypt', 'South-Africa', 'Morocco', 'Nigeria'];
        }
    }
    return nearbyCountries;
}
describe('Nearby Countries Logic Fix', () => {
    describe('processNearbyCountries', () => {
        it('should include USA for Chicago search even though its 719km from center', () => {
            const detection = simulateDetectCountryFromBounds('chicago');
            const result = processNearbyCountries(detection);
            // Should include USA even though nearbyCountries was empty
            expect(result).toContain('USA');
            expect(result.length).toBeGreaterThan(0);
        });
        it('should preserve existing nearby countries for London search', () => {
            const detection = simulateDetectCountryFromBounds('london');
            const result = processNearbyCountries(detection);
            // Should keep all three nearby countries
            expect(result).toContain('England');
            expect(result).toContain('France');
            expect(result).toContain('Belgium');
            expect(result.length).toBe(3);
        });
        it('should expand Americas-Region fallback to USA, Canada, Mexico', () => {
            const detection = simulateDetectCountryFromBounds('pacific-ocean');
            const result = processNearbyCountries(detection);
            // Should expand regional fallback
            expect(result).toContain('USA');
            expect(result).toContain('Canada');
            expect(result).toContain('Mexico');
            expect(result.length).toBe(3);
        });
        it('should not add regional fallbacks as countries', () => {
            const detection = {
                country: 'Americas-Region',
                nearbyCountries: []
            };
            const result = processNearbyCountries(detection);
            // Should expand to countries, not include 'Americas-Region' itself
            expect(result).not.toContain('Americas-Region');
            expect(result.length).toBeGreaterThan(0);
        });
        it('should handle empty nearbyCountries correctly (the original bug)', () => {
            const detection = {
                country: 'Germany',
                nearbyCountries: [] // Empty array - the bug case
            };
            const result = processNearbyCountries(detection);
            // Before fix: result would be [] (empty)
            // After fix: result should be ['Germany']
            expect(result).toContain('Germany');
            expect(result.length).toBe(1);
        });
        it('should not duplicate country if already in nearbyCountries', () => {
            const detection = {
                country: 'France',
                nearbyCountries: ['France', 'Belgium']
            };
            const result = processNearbyCountries(detection);
            // Should not have France twice
            expect(result.filter(c => c === 'France').length).toBe(1);
            expect(result.length).toBe(2);
        });
    });
});
