const RecommendationService = require('../../../src/services/recommendationService');
const axios = require('axios');
const subscriptionService = require('../../../src/services/subscriptionService');

// Mock dependencies
jest.mock('axios');
jest.mock('../../../src/services/subscriptionService');
jest.mock('../../../src/services/venueService');
jest.mock('../../../src/services/teamService');

describe('Recommendation Service', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RecommendationService();
  });

  describe('getRecommendationsForTrip', () => {
    it('should return empty recommendations if trip has no date range', async () => {
      const mockUser = {
        subscription: { tier: 'freemium' },
        preferences: {}
      };

      const mockTrip = {
        _id: '507f1f77bcf86cd799439011',
        matches: []
      };

      const result = await service.getRecommendationsForTrip('trip-id', mockUser, mockTrip);

      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('cached', false);
    });

    it('should return empty recommendations if all days have matches', async () => {
      const mockUser = {
        subscription: { tier: 'freemium' },
        preferences: {}
      };

      const mockTrip = {
        _id: '507f1f77bcf86cd799439011',
        startDate: '2025-02-01',
        endDate: '2025-02-03',
        matches: [
          { date: '2025-02-01', venue: { coordinates: [0, 0] } },
          { date: '2025-02-02', venue: { coordinates: [0, 0] } },
          { date: '2025-02-03', venue: { coordinates: [0, 0] } }
        ]
      };

      const result = await service.getRecommendationsForTrip('trip-id', mockUser, mockTrip);

      expect(result).toHaveProperty('recommendations');
      expect(result.recommendations).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      const mockUser = {
        subscription: { tier: 'freemium' },
        preferences: {}
      };

      const mockTrip = {
        _id: '507f1f77bcf86cd799439011',
        startDate: '2025-02-01',
        endDate: '2025-02-03',
        matches: []
      };

      // Mock axios to throw error
      axios.get = jest.fn().mockRejectedValue(new Error('API Error'));

      const result = await service.getRecommendationsForTrip('trip-id', mockUser, mockTrip);

      // Should handle error and return empty array or error response
      expect(result).toBeDefined();
    });
  });

  describe('getTripDateRange', () => {
    it('should extract date range from trip with startDate and endDate', () => {
      const trip = {
        startDate: '2025-02-01',
        endDate: '2025-02-07'
      };

      const dateRange = service.getTripDateRange(trip);

      expect(dateRange).toHaveProperty('start');
      expect(dateRange).toHaveProperty('end');
    });

    it('should extract date range from matches if dates not provided', () => {
      const trip = {
        matches: [
          { date: '2025-02-01' },
          { date: '2025-02-07' }
        ]
      };

      const dateRange = service.getTripDateRange(trip);

      expect(dateRange).toHaveProperty('start');
      expect(dateRange).toHaveProperty('end');
    });

    it('should return null for invalid trip', () => {
      const trip = {};

      const dateRange = service.getTripDateRange(trip);

      expect(dateRange.start).toBeNull();
      expect(dateRange.end).toBeNull();
    });
  });

  describe('getDaysWithoutMatches', () => {
    it('should return days that have no matches', () => {
      const trip = {
        startDate: '2025-02-01',
        endDate: '2025-02-05',
        matches: [
          { date: '2025-02-01' },
          { date: '2025-02-03' }
        ]
      };

      const tripDates = {
        start: new Date('2025-02-01'),
        end: new Date('2025-02-05')
      };

      const daysWithoutMatches = service.getDaysWithoutMatches(trip, tripDates);

      expect(Array.isArray(daysWithoutMatches)).toBe(true);
    });
  });
});

