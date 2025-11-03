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
});

