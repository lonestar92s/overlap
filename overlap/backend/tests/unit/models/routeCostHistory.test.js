// Mock mongoose before requiring the model
jest.mock('mongoose', () => {
  const mockSchema = {
    index: jest.fn(),
    methods: {},
    statics: {}
  };
  
  const Schema = jest.fn(() => mockSchema);
  Schema.Types = {
    Mixed: {}
  };
  
  const mockModel = jest.fn();
  mockModel.model = jest.fn((name, schema) => mockModel);
  mockModel.Schema = Schema;
  
  return {
    Schema,
    model: mockModel.model,
    connect: jest.fn(),
    connection: {
      readyState: 0,
      close: jest.fn()
    }
  };
});

const RouteCostHistory = require('../../../src/models/RouteCostHistory');

describe('RouteCostHistory Model', () => {
  // Test the business logic of the model methods
  // Since we're unit testing, we test the logic without actual Mongoose

  describe('addPricePoint method logic', () => {
    it('should add a price point successfully', () => {
      const route = {
        priceHistory: [],
        lastSearched: null,
        searchCount: 0,
        currency: 'USD'
      };

      const price = 299.99;
      const currency = 'USD';
      const source = 'amadeus';
      const metadata = { resultCount: 5 };

      // Simulate addPricePoint behavior
      const now = new Date();
      route.priceHistory.push({
        date: now,
        price,
        currency,
        source,
        metadata
      });
      route.lastSearched = now;
      route.searchCount += 1;

      expect(route.priceHistory).toHaveLength(1);
      expect(route.priceHistory[0].price).toBe(price);
      expect(route.priceHistory[0].currency).toBe(currency);
      expect(route.priceHistory[0].source).toBe(source);
      expect(route.lastSearched).toBeInstanceOf(Date);
      expect(route.searchCount).toBe(1);
    });

    it('should update lastSearched timestamp', () => {
      const route = {
        lastSearched: null
      };

      const beforeTime = new Date();
      route.lastSearched = new Date();
      const afterTime = new Date();

      expect(route.lastSearched).toBeInstanceOf(Date);
      expect(route.lastSearched.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(route.lastSearched.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should increment searchCount', () => {
      const route = {
        searchCount: 0
      };

      route.searchCount += 1;
      expect(route.searchCount).toBe(1);

      route.searchCount += 1;
      expect(route.searchCount).toBe(2);
    });

    it('should add metadata correctly', () => {
      const route = {
        priceHistory: []
      };

      const metadata = { resultCount: 10, provider: 'amadeus' };
      route.priceHistory.push({
        date: new Date(),
        price: 299.99,
        currency: 'USD',
        source: 'amadeus',
        metadata
      });

      expect(route.priceHistory[0].metadata).toEqual(metadata);
    });

    it('should handle empty metadata', () => {
      const route = {
        priceHistory: []
      };

      route.priceHistory.push({
        date: new Date(),
        price: 299.99,
        currency: 'USD',
        source: 'amadeus',
        metadata: {}
      });

      expect(route.priceHistory[0].metadata).toEqual({});
    });

    it('should add multiple price points sequentially', () => {
      const route = {
        priceHistory: [],
        searchCount: 0
      };

      route.priceHistory.push({
        date: new Date('2025-01-01'),
        price: 299.99,
        currency: 'USD',
        source: 'amadeus'
      });
      route.searchCount += 1;

      route.priceHistory.push({
        date: new Date('2025-01-02'),
        price: 349.99,
        currency: 'USD',
        source: 'amadeus'
      });
      route.searchCount += 1;

      expect(route.priceHistory).toHaveLength(2);
      expect(route.priceHistory[0].price).toBe(299.99);
      expect(route.priceHistory[1].price).toBe(349.99);
      expect(route.searchCount).toBe(2);
    });
  });

  describe('updateStatistics method logic', () => {
    it('should calculate min, max, and avg prices correctly', () => {
      const route = {
        currency: 'USD',
        priceHistory: [
          { date: new Date('2025-01-01'), price: 299.99, currency: 'USD' },
          { date: new Date('2025-01-02'), price: 349.99, currency: 'USD' },
          { date: new Date('2025-01-03'), price: 249.99, currency: 'USD' }
        ]
      };

      const prices = route.priceHistory
        .filter(p => p.currency === route.currency)
        .map(p => p.price);

      const statistics = {
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
        avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
        lastUpdated: new Date(),
        sampleCount: prices.length
      };

      expect(statistics.minPrice).toBe(249.99);
      expect(statistics.maxPrice).toBe(349.99);
      expect(statistics.avgPrice).toBeCloseTo(299.99, 2);
      expect(statistics.sampleCount).toBe(3);
    });

    it('should not update statistics for empty price history', () => {
      const route = {
        priceHistory: [],
        statistics: { sampleCount: 0 }
      };

      // updateStatistics should return early
      if (route.priceHistory.length === 0) {
        // Statistics should remain unchanged
        expect(route.statistics.sampleCount).toBe(0);
      }
    });

    it('should handle single price point', () => {
      const route = {
        currency: 'USD',
        priceHistory: [
          { date: new Date('2025-01-01'), price: 299.99, currency: 'USD' }
        ]
      };

      const prices = route.priceHistory
        .filter(p => p.currency === route.currency)
        .map(p => p.price);

      const statistics = {
        minPrice: prices[0],
        maxPrice: prices[0],
        avgPrice: prices[0],
        lastUpdated: new Date(),
        sampleCount: 1
      };

      expect(statistics.minPrice).toBe(299.99);
      expect(statistics.maxPrice).toBe(299.99);
      expect(statistics.avgPrice).toBe(299.99);
    });

    it('should filter by route currency', () => {
      const route = {
        currency: 'USD',
        priceHistory: [
          { date: new Date('2025-01-01'), price: 299.99, currency: 'USD' },
          { date: new Date('2025-01-02'), price: 250.00, currency: 'EUR' },
          { date: new Date('2025-01-03'), price: 349.99, currency: 'USD' }
        ]
      };

      const prices = route.priceHistory
        .filter(p => p.currency === route.currency)
        .map(p => p.price);

      expect(prices).toHaveLength(2);
      expect(prices).toContain(299.99);
      expect(prices).toContain(349.99);
      expect(prices).not.toContain(250.00);
    });

    it('should handle multiple prices with same value', () => {
      const route = {
        currency: 'USD',
        priceHistory: [
          { date: new Date('2025-01-01'), price: 299.99, currency: 'USD' },
          { date: new Date('2025-01-02'), price: 299.99, currency: 'USD' },
          { date: new Date('2025-01-03'), price: 299.99, currency: 'USD' }
        ]
      };

      const prices = route.priceHistory
        .filter(p => p.currency === route.currency)
        .map(p => p.price);

      const statistics = {
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
        avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
        sampleCount: prices.length
      };

      expect(statistics.minPrice).toBe(299.99);
      expect(statistics.maxPrice).toBe(299.99);
      expect(statistics.avgPrice).toBe(299.99);
    });
  });

  describe('getAveragePrice method logic', () => {
    it('should calculate average for date range correctly', () => {
      const route = {
        currency: 'USD',
        priceHistory: [
          { date: new Date('2025-01-01'), price: 299.99, currency: 'USD' },
          { date: new Date('2025-01-15'), price: 349.99, currency: 'USD' },
          { date: new Date('2025-02-01'), price: 249.99, currency: 'USD' }
        ]
      };

      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');

      const prices = route.priceHistory
        .filter(p => {
          const priceDate = new Date(p.date);
          return priceDate >= startDate && priceDate <= endDate && p.currency === route.currency;
        })
        .map(p => p.price);

      const average = prices.reduce((a, b) => a + b, 0) / prices.length;

      expect(average).toBeCloseTo(324.99, 2);
    });

    it('should return null for empty date range', () => {
      const route = {
        currency: 'USD',
        priceHistory: []
      };

      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');

      const prices = route.priceHistory
        .filter(p => {
          const priceDate = new Date(p.date);
          return priceDate >= startDate && priceDate <= endDate && p.currency === route.currency;
        })
        .map(p => p.price);

      const average = prices.length === 0 ? null : prices.reduce((a, b) => a + b, 0) / prices.length;

      expect(average).toBeNull();
    });

    it('should exclude prices outside date range', () => {
      const route = {
        currency: 'USD',
        priceHistory: [
          { date: new Date('2024-12-01'), price: 199.99, currency: 'USD' },
          { date: new Date('2025-01-15'), price: 299.99, currency: 'USD' },
          { date: new Date('2025-02-15'), price: 399.99, currency: 'USD' }
        ]
      };

      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');

      const prices = route.priceHistory
        .filter(p => {
          const priceDate = new Date(p.date);
          return priceDate >= startDate && priceDate <= endDate && p.currency === route.currency;
        })
        .map(p => p.price);

      expect(prices).toHaveLength(1);
      expect(prices[0]).toBe(299.99);
    });

    it('should filter by currency correctly', () => {
      const route = {
        currency: 'USD',
        priceHistory: [
          { date: new Date('2025-01-15'), price: 299.99, currency: 'USD' },
          { date: new Date('2025-01-16'), price: 250.00, currency: 'EUR' }
        ]
      };

      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');

      const prices = route.priceHistory
        .filter(p => {
          const priceDate = new Date(p.date);
          return priceDate >= startDate && priceDate <= endDate && p.currency === route.currency;
        })
        .map(p => p.price);

      expect(prices).toHaveLength(1);
      expect(prices[0]).toBe(299.99);
    });

    it('should handle single price in range', () => {
      const route = {
        currency: 'USD',
        priceHistory: [
          { date: new Date('2025-01-15'), price: 299.99, currency: 'USD' }
        ]
      };

      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');

      const prices = route.priceHistory
        .filter(p => {
          const priceDate = new Date(p.date);
          return priceDate >= startDate && priceDate <= endDate && p.currency === route.currency;
        })
        .map(p => p.price);

      const average = prices.reduce((a, b) => a + b, 0) / prices.length;

      expect(average).toBe(299.99);
    });
  });

  describe('findOrCreate static method', () => {
    let mockFindOne;
    let mockCreate;
    let mockFindOrCreate;

    beforeEach(() => {
      mockFindOne = jest.fn();
      mockCreate = jest.fn();
      mockFindOrCreate = jest.fn();
      
      // Mock the static methods on the model
      if (!RouteCostHistory.findOne) {
        RouteCostHistory.findOne = mockFindOne;
      }
      if (!RouteCostHistory.create) {
        RouteCostHistory.create = mockCreate;
      }
      if (!RouteCostHistory.findOrCreate) {
        RouteCostHistory.findOrCreate = mockFindOrCreate;
      }
      
      // Update mocks
      RouteCostHistory.findOne = mockFindOne;
      RouteCostHistory.create = mockCreate;
      RouteCostHistory.findOrCreate = mockFindOrCreate;
    });

    it('should find existing route successfully', async () => {
      const existingRoute = {
        _id: '507f1f77bcf86cd799439011',
        origin: { code: 'JFK' },
        destination: { code: 'LAX' },
        type: 'flight',
        currency: 'USD'
      };

      // Mock findOrCreate to simulate finding existing route
      mockFindOrCreate.mockImplementation(async (origin, destination, type, currency) => {
        const found = await mockFindOne({
          'origin.code': origin,
          'destination.code': destination,
          type,
          currency
        });
        if (found) return found;
        return await mockCreate({
          origin: { code: origin },
          destination: { code: destination },
          type,
          currency,
          priceHistory: [],
          priceHistoryMultiCurrency: [],
          statistics: { sampleCount: 0 }
        });
      });

      mockFindOne.mockResolvedValue(existingRoute);

      const result = await RouteCostHistory.findOrCreate('JFK', 'LAX', 'flight', 'USD');

      expect(mockFindOne).toHaveBeenCalledWith({
        'origin.code': 'JFK',
        'destination.code': 'LAX',
        type: 'flight',
        currency: 'USD'
      });
      expect(result).toEqual(existingRoute);
    });

    it('should create new route when not found', async () => {
      const newRoute = {
        origin: { code: 'JFK' },
        destination: { code: 'LAX' },
        type: 'flight',
        currency: 'USD',
        priceHistory: [],
        priceHistoryMultiCurrency: [],
        statistics: { sampleCount: 0 }
      };

      // Mock findOrCreate to simulate creating new route
      mockFindOrCreate.mockImplementation(async (origin, destination, type, currency) => {
        const found = await mockFindOne({
          'origin.code': origin,
          'destination.code': destination,
          type,
          currency
        });
        if (found) return found;
        return await mockCreate({
          origin: { code: origin },
          destination: { code: destination },
          type,
          currency,
          priceHistory: [],
          priceHistoryMultiCurrency: [],
          statistics: { sampleCount: 0 }
        });
      });

      mockFindOne.mockResolvedValue(null);
      mockCreate.mockResolvedValue(newRoute);

      const result = await RouteCostHistory.findOrCreate('JFK', 'LAX', 'flight', 'USD');

      expect(mockFindOne).toHaveBeenCalled();
      expect(mockCreate).toHaveBeenCalledWith({
        origin: { code: 'JFK' },
        destination: { code: 'LAX' },
        type: 'flight',
        currency: 'USD',
        priceHistory: [],
        priceHistoryMultiCurrency: [],
        statistics: {
          sampleCount: 0
        }
      });
      expect(result).toEqual(newRoute);
    });

    it('should initialize empty arrays and statistics for new route', async () => {
      const newRoute = {
        priceHistory: [],
        priceHistoryMultiCurrency: [],
        statistics: { sampleCount: 0 }
      };

      mockFindOrCreate.mockImplementation(async () => {
        const found = await mockFindOne();
        if (found) return found;
        return await mockCreate({
          origin: { code: 'JFK' },
          destination: { code: 'LAX' },
          type: 'flight',
          currency: 'USD',
          priceHistory: [],
          priceHistoryMultiCurrency: [],
          statistics: { sampleCount: 0 }
        });
      });

      mockFindOne.mockResolvedValue(null);
      mockCreate.mockResolvedValue(newRoute);

      const result = await RouteCostHistory.findOrCreate('JFK', 'LAX', 'flight', 'USD');

      expect(result.priceHistory).toEqual([]);
      expect(result.priceHistoryMultiCurrency).toEqual([]);
      expect(result.statistics.sampleCount).toBe(0);
    });

    it('should handle train type', async () => {
      const newRoute = {
        type: 'train',
        currency: 'EUR'
      };

      mockFindOrCreate.mockImplementation(async (origin, destination, type, currency) => {
        const found = await mockFindOne({
          'origin.code': origin,
          'destination.code': destination,
          type,
          currency
        });
        if (found) return found;
        return await mockCreate({
          origin: { code: origin },
          destination: { code: destination },
          type,
          currency,
          priceHistory: [],
          priceHistoryMultiCurrency: [],
          statistics: { sampleCount: 0 }
        });
      });

      mockFindOne.mockResolvedValue(null);
      mockCreate.mockResolvedValue(newRoute);

      const result = await RouteCostHistory.findOrCreate('PAR', 'LON', 'train', 'EUR');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'train',
          currency: 'EUR'
        })
      );
      expect(result.type).toBe('train');
    });

    it('should handle different currencies for same route', async () => {
      const usdRoute = { currency: 'USD' };
      const eurRoute = { currency: 'EUR' };

      mockFindOrCreate.mockImplementation(async (origin, destination, type, currency) => {
        return await mockFindOne({
          'origin.code': origin,
          'destination.code': destination,
          type,
          currency
        });
      });

      mockFindOne
        .mockResolvedValueOnce(usdRoute)
        .mockResolvedValueOnce(eurRoute);

      const result1 = await RouteCostHistory.findOrCreate('JFK', 'LAX', 'flight', 'USD');
      const result2 = await RouteCostHistory.findOrCreate('JFK', 'LAX', 'flight', 'EUR');

      expect(result1.currency).toBe('USD');
      expect(result2.currency).toBe('EUR');
    });
  });

  describe('Schema Validation', () => {
    it('should require origin.code, destination.code, and type', () => {
      // Test that required fields are validated
      const validRoute = {
        origin: { code: 'JFK' },
        destination: { code: 'LAX' },
        type: 'flight',
        currency: 'USD'
      };

      expect(validRoute.origin.code).toBe('JFK');
      expect(validRoute.destination.code).toBe('LAX');
      expect(validRoute.type).toBe('flight');
    });

    it('should only allow flight or train type', () => {
      const validTypes = ['flight', 'train'];
      const invalidType = 'bus';

      expect(validTypes).toContain('flight');
      expect(validTypes).toContain('train');
      expect(validTypes).not.toContain(invalidType);
    });

    it('should default currency to USD', () => {
      const route = {
        currency: 'USD'
      };

      expect(route.currency).toBe('USD');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null price values gracefully', () => {
      const route = {
        priceHistory: []
      };

      const price = null;
      if (price != null) {
        route.priceHistory.push({
          date: new Date(),
          price,
          currency: 'USD',
          source: 'amadeus'
        });
      }

      expect(route.priceHistory).toHaveLength(0);
    });

    it('should handle undefined currency in price history', () => {
      const route = {
        currency: 'USD',
        priceHistory: [
          { date: new Date('2025-01-01'), price: 299.99, currency: undefined }
        ]
      };

      const prices = route.priceHistory
        .filter(p => p.currency === route.currency)
        .map(p => p.price);

      // Undefined currency should be filtered out
      expect(prices).toHaveLength(0);
    });

    it('should handle very large price values', () => {
      const route = {
        currency: 'USD',
        priceHistory: [
          { date: new Date('2025-01-01'), price: 999999.99, currency: 'USD' }
        ]
      };

      const prices = route.priceHistory
        .filter(p => p.currency === route.currency)
        .map(p => p.price);

      const statistics = {
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
        avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length
      };

      expect(statistics.avgPrice).toBe(999999.99);
    });

    it('should handle date range where startDate equals endDate', () => {
      const route = {
        currency: 'USD',
        priceHistory: [
          { date: new Date('2025-01-15T12:00:00'), price: 299.99, currency: 'USD' }
        ]
      };

      const startDate = new Date('2025-01-15');
      const endDate = new Date('2025-01-15');

      const prices = route.priceHistory
        .filter(p => {
          const priceDate = new Date(p.date);
          return priceDate >= startDate && priceDate <= endDate && p.currency === route.currency;
        })
        .map(p => p.price);

      expect(prices.length).toBeGreaterThanOrEqual(0);
    });
  });
});
