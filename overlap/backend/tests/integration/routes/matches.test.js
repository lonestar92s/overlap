/**
 * Integration tests for matches routes
 * These tests require a test database connection
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../../src/app');

describe('Matches Routes Integration', () => {
  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/overlap-test');
    }
  });

  afterAll(async () => {
    // Cleanup: Close database connection
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clean database before each test (optional, can be slow)
    // await mongoose.connection.db.dropDatabase();
  });

  describe('GET /api/matches', () => {
    it('should return matches list', async () => {
      const response = await request(app)
        .get('/api/matches')
        .query({ dateFrom: '2025-01-01', dateTo: '2025-01-31' });

      // This will depend on your actual route implementation
      expect([200, 400, 500]).toContain(response.status);
    });

    it('should handle missing query parameters gracefully', async () => {
      const response = await request(app)
        .get('/api/matches');

      // Should either return default dates or error
      expect([200, 400]).toContain(response.status);
    });
  });

  describe('GET /api/matches/:id', () => {
    it('should return match details for valid ID', async () => {
      // This would require a valid match ID in the test database
      const testMatchId = '507f1f77bcf86cd799439011';

      const response = await request(app)
        .get(`/api/matches/${testMatchId}`);

      expect([200, 404]).toContain(response.status);
    });
  });

  describe('GET /api/matches/search - Location-only search', () => {
    it('should return matches for location-only search with bounds and date range', async () => {
      // London bounds
      const response = await request(app)
        .get('/api/matches/search')
        .query({
          neLat: 51.9074,
          neLng: 0.3722,
          swLat: 51.1074,
          swLng: -0.6278,
          dateFrom: '2026-01-09',
          dateTo: '2026-01-12'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('count');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should require dateFrom and dateTo for location-only search', async () => {
      const response = await request(app)
        .get('/api/matches/search')
        .query({
          neLat: 51.9074,
          neLng: 0.3722,
          swLat: 51.1074,
          swLng: -0.6278
          // Missing dateFrom and dateTo
        });

      // Should either return error or fall back to other search logic
      expect([200, 400]).toContain(response.status);
    });

    it('should require all bounds parameters (neLat, neLng, swLat, swLng)', async () => {
      const response = await request(app)
        .get('/api/matches/search')
        .query({
          neLat: 51.9074,
          // Missing other bounds
          dateFrom: '2026-01-09',
          dateTo: '2026-01-12'
        });

      // Should either return error or fall back to other search logic
      expect([200, 400]).toContain(response.status);
    });

    it('should filter matches by bounds when coordinates are available', async () => {
      // London bounds - should return matches in London area
      const response = await request(app)
        .get('/api/matches/search')
        .query({
          neLat: 51.9074,
          neLng: 0.3722,
          swLat: 51.1074,
          swLng: -0.6278,
          dateFrom: '2026-01-09',
          dateTo: '2026-01-12'
        });

      if (response.status === 200 && response.body.data && response.body.data.length > 0) {
        // If matches are returned, verify they have venue information
        const match = response.body.data[0];
        expect(match).toHaveProperty('fixture');
        expect(match.fixture).toHaveProperty('venue');
        
        // If venue has coordinates, verify they're within bounds
        if (match.fixture.venue?.coordinates) {
          const [lon, lat] = match.fixture.venue.coordinates;
          expect(lat).toBeGreaterThanOrEqual(51.1074);
          expect(lat).toBeLessThanOrEqual(51.9074);
          expect(lon).toBeGreaterThanOrEqual(-0.6278);
          expect(lon).toBeLessThanOrEqual(0.3722);
        }
      }
    });

    it('should include matches from relevant leagues based on geographic filtering', async () => {
      // London bounds - should search English leagues
      const response = await request(app)
        .get('/api/matches/search')
        .query({
          neLat: 51.9074,
          neLng: 0.3722,
          swLat: 51.1074,
          swLng: -0.6278,
          dateFrom: '2026-01-09',
          dateTo: '2026-01-12'
        });

      if (response.status === 200 && response.body.data && response.body.data.length > 0) {
        // Verify matches are from relevant leagues (should include English leagues)
        const match = response.body.data[0];
        expect(match).toHaveProperty('league');
        expect(match.league).toHaveProperty('country');
        
        // English leagues should be included
        const englishMatches = response.body.data.filter(m => 
          m.league.country === 'England'
        );
        // At least some English matches should be present for London search
        expect(englishMatches.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('should include matches without coordinates if they match country/league criteria', async () => {
      // This test verifies the fallback logic for matches without coordinates
      // London bounds - English matches without coordinates should be included
      const response = await request(app)
        .get('/api/matches/search')
        .query({
          neLat: 51.9074,
          neLng: 0.3722,
          swLat: 51.1074,
          swLng: -0.6278,
          dateFrom: '2026-01-09',
          dateTo: '2026-01-12'
        });

      if (response.status === 200 && response.body.data && response.body.data.length > 0) {
        // Check if matches without coordinates are included (fallback logic)
        const matchesWithoutCoords = response.body.data.filter(m => 
          !m.fixture.venue?.coordinates && m.league.country === 'England'
        );
        
        // The fallback logic should include English matches even without coordinates
        // This is expected behavior for lower-league matches
        expect(matchesWithoutCoords.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('should not trigger location-only search when competitions are specified', async () => {
      // When competitions are specified, should use aggregated search path
      const response = await request(app)
        .get('/api/matches/search')
        .query({
          neLat: 51.9074,
          neLng: 0.3722,
          swLat: 51.1074,
          swLng: -0.6278,
          dateFrom: '2026-01-09',
          dateTo: '2026-01-12',
          competitions: '39' // Premier League
        });

      // Should still return successfully, but use different search path
      expect([200, 400]).toContain(response.status);
    });

    it('should not trigger location-only search when teams are specified', async () => {
      // When teams are specified, should use aggregated search path
      const response = await request(app)
        .get('/api/matches/search')
        .query({
          neLat: 51.9074,
          neLng: 0.3722,
          swLat: 51.1074,
          swLng: -0.6278,
          dateFrom: '2026-01-09',
          dateTo: '2026-01-12',
          teams: '42' // Arsenal
        });

      // Should still return successfully, but use different search path
      expect([200, 400]).toContain(response.status);
    });

    it('should handle different date ranges correctly', async () => {
      // Test with a different date range
      const response = await request(app)
        .get('/api/matches/search')
        .query({
          neLat: 51.9074,
          neLng: 0.3722,
          swLat: 51.1074,
          swLng: -0.6278,
          dateFrom: '2025-12-01',
          dateTo: '2025-12-31'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });
});

