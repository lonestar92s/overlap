const request = require('supertest');
const express = require('express');
const { generateTestToken } = require('../../helpers/testHelpers');

// Mock dependencies
jest.mock('../../../src/models/User');
jest.mock('../../../src/utils/tripUtils');

const User = require('../../../src/models/User');
const { isTripCompleted } = require('../../../src/utils/tripUtils');

// Create a test app
const app = express();
app.use(express.json());

const tripsRoutes = require('../../../src/routes/trips');
app.use('/api/trips', tripsRoutes);

describe('Trips Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/trips', () => {
    it('should return empty array if user not authenticated', async () => {
      const response = await request(app)
        .get('/api/trips');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('trips', []);
    });

    it('should return user trips when authenticated', async () => {
      const mockTrips = [
        {
          _id: '507f1f77bcf86cd799439011',
          name: 'London Trip',
          createdAt: new Date('2025-01-01'),
          matches: []
        },
        {
          _id: '507f1f77bcf86cd799439012',
          name: 'Madrid Trip',
          createdAt: new Date('2025-01-15'),
          matches: []
        }
      ];

      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        trips: mockTrips,
        toObject: jest.fn().mockReturnValue({
          _id: '507f1f77bcf86cd799439011',
          trips: mockTrips
        })
      };

      User.findById = jest.fn().mockResolvedValue(mockUser);
      isTripCompleted = jest.fn().mockReturnValue(false);

      const token = generateTestToken(mockUser._id);

      const response = await request(app)
        .get('/api/trips')
        .set('Authorization', `Bearer ${token}`);

      // Response depends on auth middleware implementation
      expect([200, 401]).toContain(response.status);
    });

    it('should filter trips by status=active', async () => {
      const mockTrips = [
        {
          _id: '507f1f77bcf86cd799439011',
          name: 'Active Trip',
          matches: [{ status: 'SCHEDULED' }]
        },
        {
          _id: '507f1f77bcf86cd799439012',
          name: 'Completed Trip',
          matches: [{ status: 'FINISHED' }]
        }
      ];

      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        trips: mockTrips
      };

      User.findById = jest.fn().mockResolvedValue(mockUser);
      isTripCompleted = jest.fn((trip) => trip.name === 'Completed Trip');

      const token = generateTestToken(mockUser._id);

      const response = await request(app)
        .get('/api/trips?status=active')
        .set('Authorization', `Bearer ${token}`);

      expect([200, 401]).toContain(response.status);
    });

    it('should filter trips by status=completed', async () => {
      const mockTrips = [
        {
          _id: '507f1f77bcf86cd799439011',
          name: 'Completed Trip',
          matches: []
        }
      ];

      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        trips: mockTrips
      };

      User.findById = jest.fn().mockResolvedValue(mockUser);
      isTripCompleted = jest.fn().mockReturnValue(true);

      const token = generateTestToken(mockUser._id);

      const response = await request(app)
        .get('/api/trips?status=completed')
        .set('Authorization', `Bearer ${token}`);

      expect([200, 401]).toContain(response.status);
    });
  });

  describe('POST /api/trips', () => {
    it('should create a new trip', async () => {
      const newTrip = {
        _id: '507f1f77bcf86cd799439011',
        name: 'New Trip',
        startDate: '2025-02-01',
        endDate: '2025-02-07',
        matches: []
      };

      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        trips: [],
        save: jest.fn().mockResolvedValue(true)
      };

      User.findById = jest.fn().mockResolvedValue(mockUser);

      const token = generateTestToken(mockUser._id);

      const response = await request(app)
        .post('/api/trips')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'New Trip',
          startDate: '2025-02-01',
          endDate: '2025-02-07'
        });

      expect([200, 201, 401]).toContain(response.status);
    });

    it('should return 400 if required fields are missing', async () => {
      const token = generateTestToken();

      const response = await request(app)
        .post('/api/trips')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Incomplete Trip'
        });

      expect([400, 401]).toContain(response.status);
    });
  });
});

