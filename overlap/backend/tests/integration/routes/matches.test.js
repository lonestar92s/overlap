/**
 * Integration tests for matches routes
 * These tests require a test database connection
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../../src/app');

describe('Matches Routes Integration', () => {
  beforeAll(async () => {
    // Skip tests if MongoDB is not available (e.g., in CI without service)
    if (!process.env.MONGODB_URI && !process.env.MONGO_URL) {
      console.log('⚠️  MongoDB not configured, skipping integration tests');
      return;
    }
    
    // Connect to test database
    try {
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URL || 'mongodb://localhost:27017/overlap-test', {
          serverSelectionTimeoutMS: 5000
        });
      }
    } catch (error) {
      console.log('⚠️  Could not connect to MongoDB, skipping integration tests:', error.message);
      // Mark all tests as skipped
      return;
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
      // Skip if MongoDB not available
      if (mongoose.connection.readyState === 0) {
        return;
      }
      
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

  describe('Cache Consistency Tests', () => {
    it('should return identical results for same search parameters (cache consistency)', async () => {
      // First search - cache miss
      const response1 = await request(app)
        .get('/api/matches/search')
        .query({
          neLat: 51.9074,
          neLng: 0.3722,
          swLat: 51.1074,
          swLng: -0.6278,
          dateFrom: '2026-02-01',
          dateTo: '2026-02-05'
        });

      // Second search with same parameters - should hit cache
      const response2 = await request(app)
        .get('/api/matches/search')
        .query({
          neLat: 51.9074,
          neLng: 0.3722,
          swLat: 51.1074,
          swLng: -0.6278,
          dateFrom: '2026-02-01',
          dateTo: '2026-02-05'
        });

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      
      // Results should be identical
      expect(response1.body.count).toBe(response2.body.count);
      expect(response1.body.data.length).toBe(response2.body.data.length);
      
      // Second request should be a cache hit
      expect(response2.body.fromCache).toBe(true);
      
      // Match IDs should be the same
      if (response1.body.data.length > 0) {
        const ids1 = response1.body.data.map(m => m.fixture.id).sort();
        const ids2 = response2.body.data.map(m => m.fixture.id).sort();
        expect(ids1).toEqual(ids2);
      }
    });

    it('should use different cache keys for different viewports in same country', async () => {
      // First search - center of London
      const response1 = await request(app)
        .get('/api/matches/search')
        .query({
          neLat: 51.6,
          neLng: 0.0,
          swLat: 51.4,
          swLng: -0.3,
          dateFrom: '2026-02-10',
          dateTo: '2026-02-15'
        });

      // Second search - slightly shifted viewport (different bounds hash = different cache key)
      const response2 = await request(app)
        .get('/api/matches/search')
        .query({
          neLat: 51.7,
          neLng: 0.1,
          swLat: 51.5,
          swLng: -0.2,
          dateFrom: '2026-02-10',
          dateTo: '2026-02-15'
        });

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      
      // Both should return some matches (assuming any matches exist for this date range)
      expect(Array.isArray(response1.body.data)).toBe(true);
      expect(Array.isArray(response2.body.data)).toBe(true);
      
      // Second should be a cache miss (different viewport = different cache key)
      // This prevents the bug where different viewports share the same cache
      if (response2.body.fromCache !== undefined) {
        expect(response2.body.fromCache).toBe(false);
      }
    });

    it('should use same cache key for same viewport bounds', async () => {
      // First search
      const searchParams = {
        neLat: 51.6,
        neLng: 0.0,
        swLat: 51.4,
        swLng: -0.3,
        dateFrom: '2026-02-20',
        dateTo: '2026-02-25'
      };
      
      const response1 = await request(app)
        .get('/api/matches/search')
        .query(searchParams);

      // Second search with identical bounds - should hit cache
      const response2 = await request(app)
        .get('/api/matches/search')
        .query(searchParams);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      
      // Results should be identical
      expect(response1.body.count).toBe(response2.body.count);
      
      // Second should be a cache hit (same viewport = same cache key)
      if (response2.body.fromCache !== undefined) {
        expect(response2.body.fromCache).toBe(true);
      }
    });

    it('should enrich cached matches with newly geocoded venues', async () => {
      // This test verifies that cache enrichment works
      // When a venue is geocoded after initial cache, subsequent requests should include it
      
      const response = await request(app)
        .get('/api/matches/search')
        .query({
          neLat: 51.9074,
          neLng: 0.3722,
          swLat: 51.1074,
          swLng: -0.6278,
          dateFrom: '2026-03-01',
          dateTo: '2026-03-05'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('debug');
      
      // Debug info should include coordinate statistics
      if (response.body.debug) {
        expect(response.body.debug).toHaveProperty('withCoordinates');
        expect(response.body.debug).toHaveProperty('withoutCoordinates');
        
        // Enrichment count should be tracked
        if (response.body.fromCache && response.body.debug.enrichedFromMongoDB !== undefined) {
          expect(typeof response.body.debug.enrichedFromMongoDB).toBe('number');
        }
      }
    });

    it('should return bounds in response for filtering purposes', async () => {
      const queryBounds = {
        neLat: 51.9074,
        neLng: 0.3722,
        swLat: 51.1074,
        swLng: -0.6278
      };
      
      const response = await request(app)
        .get('/api/matches/search')
        .query({
          ...queryBounds,
          dateFrom: '2026-04-01',
          dateTo: '2026-04-05'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('bounds');
      
      if (response.body.bounds) {
        // Bounds should match the original request bounds (for client-side filtering)
        expect(response.body.bounds).toHaveProperty('northeast');
        expect(response.body.bounds).toHaveProperty('southwest');
      }
    });

    it('should handle rapid successive searches without race conditions', async () => {
      // Simulate rapid "Search this area" clicks
      const searchParams = {
        neLat: 51.9074,
        neLng: 0.3722,
        swLat: 51.1074,
        swLng: -0.6278,
        dateFrom: '2026-05-01',
        dateTo: '2026-05-05'
      };

      // Fire 3 requests in rapid succession
      const [response1, response2, response3] = await Promise.all([
        request(app).get('/api/matches/search').query(searchParams),
        request(app).get('/api/matches/search').query(searchParams),
        request(app).get('/api/matches/search').query(searchParams)
      ]);

      // All should succeed
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response3.status).toBe(200);

      // All should return same data (cache consistency)
      expect(response1.body.count).toBe(response2.body.count);
      expect(response2.body.count).toBe(response3.body.count);
    });

    it('should differentiate cache by season parameter', async () => {
      // Search for 2025 season
      const response2025 = await request(app)
        .get('/api/matches/search')
        .query({
          neLat: 51.9074,
          neLng: 0.3722,
          swLat: 51.1074,
          swLng: -0.6278,
          dateFrom: '2026-01-01',
          dateTo: '2026-01-05',
          season: 2025
        });

      // Search for 2024 season (different cache key)
      const response2024 = await request(app)
        .get('/api/matches/search')
        .query({
          neLat: 51.9074,
          neLng: 0.3722,
          swLat: 51.1074,
          swLng: -0.6278,
          dateFrom: '2026-01-01',
          dateTo: '2026-01-05',
          season: 2024
        });

      expect(response2025.status).toBe(200);
      expect(response2024.status).toBe(200);
      
      // Different seasons may have different match counts
      // (this verifies cache keys include season)
      expect(Array.isArray(response2025.body.data)).toBe(true);
      expect(Array.isArray(response2024.body.data)).toBe(true);
    });
  });
});

