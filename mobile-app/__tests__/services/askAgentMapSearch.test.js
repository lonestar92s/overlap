import {
  buildInitialRegionFromNlMatches,
} from '../../services/askAgentMapSearch';

describe('buildInitialRegionFromNlMatches', () => {
  it('fits region to spanning venues (widens beyond Duomo centroid)', () => {
    const matches = [
      { fixture: { venue: { coordinates: [9.071, 45.813] } } }, // Como direction
      { fixture: { venue: { coordinates: [9.682, 45.709] } } }, // Bergamo direction
    ];
    const region = buildInitialRegionFromNlMatches(matches, [
      9.189982, 45.464203,
    ]);
    expect(region).not.toBeNull();
    expect(region.latitudeDelta).toBeGreaterThan(0.1);
    expect(region.longitudeDelta).toBeGreaterThan(0.1);
    const midLat = (45.813 + 45.709) / 2;
    expect(Math.abs(region.latitude - midLat)).toBeLessThan(0.05);
  });

  it('uses fallback lng/lat when matches have no coordinates', () => {
    const region = buildInitialRegionFromNlMatches(
      [{ fixture: { venue: {} } }],
      [9.19, 45.464],
    );
    expect(region).not.toBeNull();
    expect(region.latitude).toBeCloseTo(45.464);
    expect(region.longitude).toBeCloseTo(9.19);
  });

  it('returns null when no coords and invalid fallback', () => {
    expect(buildInitialRegionFromNlMatches([], null)).toBeNull();
    expect(buildInitialRegionFromNlMatches([], [NaN, 45])).toBeNull();
  });
});
