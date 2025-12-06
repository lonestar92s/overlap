const request = require('supertest');
const express = require('express');
const { generateTestToken } = require('../../helpers/testHelpers');

// Mock dependencies
jest.mock('../../../src/models/User');
jest.mock('../../../src/services/recommendationService');
jest.mock('../../../src/middleware/auth', () => ({
  authenticateToken: async (req, res, next) => {
    // Mock authentication - set req.user from token
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only');
        const User = require('../../../src/models/User');
        const user = await User.findOne({ _id: decoded.userId });
        if (user) {
          req.user = { id: user._id.toString() };
        } else {
          req.user = null;
        }
      } catch (error) {
        req.user = null;
      }
    } else {
      req.user = null;
    }
    next();
  },
  auth: async (req, res, next) => {
    // Mock auth middleware (required for /history route)
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only');
        const User = require('../../../src/models/User');
        const user = await User.findOne({ _id: decoded.userId });
        if (user) {
          req.user = { id: user._id.toString() };
          next();
        } else {
          res.status(401).json({ error: 'Please authenticate.' });
        }
      } catch (error) {
        res.status(401).json({ error: 'Please authenticate.' });
      }
    } else {
      res.status(401).json({ error: 'Please authenticate.' });
    }
  }
}));

const User = require('../../../src/models/User');
const RecommendationService = require('../../../src/services/recommendationService');

// Create a test app
const app = express();
app.use(express.json());

const recommendationsRoutes = require('../../../src/routes/recommendations');
app.use('/api/recommendations', recommendationsRoutes);

describe('Recommendations Routes', () => {
  let mockUser;
  let mockTrip;
  let mockRecommendations;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRecommendations = [
      {
        matchId: '1379153',
        recommendedForDate: '2026-01-01',
        match: {
          id: 1379153,
          fixture: { id: 1379153, date: '2026-01-01T15:00:00Z' },
          teams: { home: { name: 'Team A' }, away: { name: 'Team B' } }
        },
        score: 160,
        reason: 'Near your match'
      },
      {
        matchId: '1379154',
        recommendedForDate: '2026-01-02',
        match: {
          id: 1379154,
          fixture: { id: 1379154, date: '2026-01-02T15:00:00Z' },
          teams: { home: { name: 'Team C' }, away: { name: 'Team D' } }
        },
        score: 140,
        reason: 'Near your match'
      }
    ];

    mockTrip = {
      _id: '507f1f77bcf86cd799439011',
      name: 'Test Trip',
      matches: [],
      recommendations: null,
      recommendationsVersion: null,
      recommendationsGeneratedAt: null,
      recommendationsError: null,
      save: jest.fn()
    };

    mockUser = {
      _id: '507f1f77bcf86cd799439011',
      trips: [mockTrip],
      save: jest.fn().mockResolvedValue(true),
      trips: {
        id: jest.fn().mockReturnValue(mockTrip)
      }
    };

    // Mock User.findById
    User.findById = jest.fn().mockResolvedValue(mockUser);
    
    // Mock User.findOne for authenticateToken middleware
    User.findOne = jest.fn().mockImplementation((query) => {
      if (query._id === mockUser._id) {
        return Promise.resolve(mockUser);
      }
      return Promise.resolve(null);
    });

    // Mock RecommendationService (it's exported as an instance)
    RecommendationService.getRecommendationsForTrip = jest.fn();
    RecommendationService.regenerateTripRecommendations = jest.fn();
    RecommendationService.invalidateTripCache = jest.fn();
    RecommendationService.invalidateUserCache = jest.fn();
  });

  describe('GET /api/recommendations/trips/:tripId/recommendations', () => {
    it('should return stored recommendations if they exist', async () => {
      // Setup trip with stored recommendations
      mockTrip.recommendations = mockRecommendations;
      mockTrip.recommendationsVersion = 'v2';
      mockTrip.recommendationsGeneratedAt = new Date('2026-01-01');

      const token = generateTestToken(mockUser._id);

      const response = await request(app)
        .get('/api/recommendations/trips/507f1f77bcf86cd799439011/recommendations')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('fromStorage', true);
      expect(response.body.recommendations).toHaveLength(2);
      expect(response.body.recommendations[0].matchId).toBe('1379153');
      
      // Should NOT call getRecommendationsForTrip when stored recommendations exist
      expect(RecommendationService.getRecommendationsForTrip).not.toHaveBeenCalled();
    });

    it('should generate and store recommendations when none exist', async () => {
      // Setup trip without stored recommendations
      mockTrip.recommendations = null;
      mockTrip.recommendationsVersion = null;

      // Mock getRecommendationsForTrip to return recommendations
      RecommendationService.getRecommendationsForTrip.mockResolvedValue({
        recommendations: mockRecommendations,
        cached: false,
        diagnostics: null
      });

      const token = generateTestToken(mockUser._id);

      const response = await request(app)
        .get('/api/recommendations/trips/507f1f77bcf86cd799439011/recommendations')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('fromStorage', false);
      expect(response.body.recommendations).toHaveLength(2);

      // Should call getRecommendationsForTrip
      expect(RecommendationService.getRecommendationsForTrip).toHaveBeenCalled();

      // Should store recommendations directly (not via regenerateTripRecommendations)
      expect(mockTrip.recommendations).toEqual(mockRecommendations);
      expect(mockTrip.recommendationsVersion).toBe('v2');
      expect(mockTrip.recommendationsGeneratedAt).toBeInstanceOf(Date);
      expect(mockTrip.recommendationsError).toBeNull();

      // Should save the user document
      expect(mockUser.save).toHaveBeenCalled();

      // Should NOT call regenerateTripRecommendations for initial storage
      expect(RecommendationService.regenerateTripRecommendations).not.toHaveBeenCalled();
    });

    it('should set recommendationsVersion to v2 when storing', async () => {
      mockTrip.recommendations = null;
      mockTrip.recommendationsVersion = null;

      RecommendationService.getRecommendationsForTrip.mockResolvedValue({
        recommendations: mockRecommendations,
        cached: false,
        diagnostics: null
      });

      const token = generateTestToken(mockUser._id);

      await request(app)
        .get('/api/recommendations/trips/507f1f77bcf86cd799439011/recommendations')
        .set('Authorization', `Bearer ${token}`);

      expect(mockTrip.recommendationsVersion).toBe('v2');
    });

    it('should set recommendationsGeneratedAt when storing', async () => {
      mockTrip.recommendations = null;
      mockTrip.recommendationsVersion = null;

      RecommendationService.getRecommendationsForTrip.mockResolvedValue({
        recommendations: mockRecommendations,
        cached: false,
        diagnostics: null
      });

      const token = generateTestToken(mockUser._id);

      const beforeDate = new Date();

      await request(app)
        .get('/api/recommendations/trips/507f1f77bcf86cd799439011/recommendations')
        .set('Authorization', `Bearer ${token}`);

      const afterDate = new Date();

      expect(mockTrip.recommendationsGeneratedAt).toBeInstanceOf(Date);
      expect(mockTrip.recommendationsGeneratedAt.getTime()).toBeGreaterThanOrEqual(beforeDate.getTime());
      expect(mockTrip.recommendationsGeneratedAt.getTime()).toBeLessThanOrEqual(afterDate.getTime());
    });

    it('should return stored recommendations on subsequent requests', async () => {
      // First request - generate and store
      mockTrip.recommendations = null;
      mockTrip.recommendationsVersion = null;

      RecommendationService.getRecommendationsForTrip.mockResolvedValue({
        recommendations: mockRecommendations,
        cached: false,
        diagnostics: null
      });

      const token = generateTestToken(mockUser._id);

      // First request
      const firstResponse = await request(app)
        .get('/api/recommendations/trips/507f1f77bcf86cd799439011/recommendations')
        .set('Authorization', `Bearer ${token}`);

      expect(firstResponse.status).toBe(200);
      expect(firstResponse.body.fromStorage).toBe(false);

      // Second request - should use stored
      const secondResponse = await request(app)
        .get('/api/recommendations/trips/507f1f77bcf86cd799439011/recommendations')
        .set('Authorization', `Bearer ${token}`);

      expect(secondResponse.status).toBe(200);
      expect(secondResponse.body).toHaveProperty('fromStorage', true);
      expect(secondResponse.body.recommendations).toHaveLength(2);
      
      // Should not call getRecommendationsForTrip on second request
      expect(RecommendationService.getRecommendationsForTrip).toHaveBeenCalledTimes(1);
    });

    it('should handle storage errors gracefully', async () => {
      mockTrip.recommendations = null;
      mockTrip.recommendationsVersion = null;

      RecommendationService.getRecommendationsForTrip.mockResolvedValue({
        recommendations: mockRecommendations,
        cached: false,
        diagnostics: null
      });

      // Mock save to fail
      mockUser.save.mockRejectedValueOnce(new Error('Database error'));

      const token = generateTestToken(mockUser._id);

      const response = await request(app)
        .get('/api/recommendations/trips/507f1f77bcf86cd799439011/recommendations')
        .set('Authorization', `Bearer ${token}`);

      // Should still return recommendations even if storage fails
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.recommendations).toHaveLength(2);

      // Should have attempted to store error
      expect(mockTrip.recommendationsError).toBe('Database error');
    });

    it('should force refresh when forceRefresh query param is true', async () => {
      // Setup trip with stored recommendations
      mockTrip.recommendations = mockRecommendations;
      mockTrip.recommendationsVersion = 'v2';

      const newRecommendations = [mockRecommendations[0]]; // Different set

      RecommendationService.getRecommendationsForTrip.mockResolvedValue({
        recommendations: newRecommendations,
        cached: false,
        diagnostics: null
      });

      const token = generateTestToken(mockUser._id);

      const response = await request(app)
        .get('/api/recommendations/trips/507f1f77bcf86cd799439011/recommendations?forceRefresh=true')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('fromStorage', false);
      
      // Should call getRecommendationsForTrip even with stored recommendations
      expect(RecommendationService.getRecommendationsForTrip).toHaveBeenCalled();
    });

    it('should return 404 if trip not found', async () => {
      mockUser.trips.id.mockReturnValue(null);

      const token = generateTestToken(mockUser._id);

      const response = await request(app)
        .get('/api/recommendations/trips/nonexistent/recommendations')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Trip not found');
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .get('/api/recommendations/trips/507f1f77bcf86cd799439011/recommendations');

      expect([401, 404]).toContain(response.status);
    });
  });
});

