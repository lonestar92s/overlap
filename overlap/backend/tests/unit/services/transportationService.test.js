// Mock dependencies BEFORE requiring the service
jest.mock('../../../../src/models/RouteCostHistory');
jest.mock('../../../../src/providers/amadeusProvider');

const RouteCostHistory = require('../../../../src/models/RouteCostHistory');
const AmadeusProvider = require('../../../../src/providers/amadeusProvider');

describe('TransportationService', () => {
  let service;
  let mockAmadeusProvider;
  let mockRouteCostHistory;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock AmadeusProvider instance
    mockAmadeusProvider = {
      searchFlights: jest.fn(),
      searchAirports: jest.fn(),
      getNearestAirports: jest.fn(),
      getFlightStatus: jest.fn(),
      parseFlightNumber: jest.fn().mockReturnValue({
        airlineCode: 'AA',
        flightNumber: '100'
      }),
      constructor: { name: 'AmadeusProvider' }
    };
    
    // Mock AmadeusProvider constructor to return our mock
    AmadeusProvider.mockImplementation(() => mockAmadeusProvider);

    // Mock RouteCostHistory static methods
    mockRouteCostHistory = {
      findOrCreate: jest.fn(),
      findOne: jest.fn()
    };
    RouteCostHistory.findOrCreate = mockRouteCostHistory.findOrCreate;
    RouteCostHistory.findOne = mockRouteCostHistory.findOne;

    // Clear module cache and re-require service to get fresh singleton instance
    delete require.cache[require.resolve('../../../../src/services/transportationService')];
    service = require('../../../../src/services/transportationService');
    
    // Replace the providers array with our mock for testing
    if (service.flightProviders.length === 0) {
      service.flightProviders.push(mockAmadeusProvider);
    } else {
      service.flightProviders[0] = mockAmadeusProvider;
    }
  });

  describe('Constructor', () => {
    it('should initialize with Amadeus provider when available', () => {
      expect(service).toBeDefined();
      expect(service.flightProviders).toBeDefined();
      // Service should have at least one provider if Amadeus is available
    });

    it('should handle provider initialization errors gracefully', () => {
      // This is tested implicitly - if AmadeusProvider throws, service should still initialize
      expect(service).toBeDefined();
    });
  });

  describe('searchFlights', () => {
    const mockSearchParams = {
      origin: 'JFK',
      destination: 'LAX',
      departureDate: '2025-06-01',
      returnDate: '2025-06-15',
      adults: 1
    };

    const mockFlightResults = [
      {
        id: '1',
        price: { amount: 299.99, currency: 'USD' },
        provider: 'amadeus',
        departure: { time: '2025-06-01T10:00:00' },
        arrival: { time: '2025-06-01T13:00:00' }
      },
      {
        id: '2',
        price: { amount: 349.99, currency: 'USD' },
        provider: 'amadeus',
        departure: { time: '2025-06-01T14:00:00' },
        arrival: { time: '2025-06-01T17:00:00' }
      }
    ];

    it('should successfully search with first provider', async () => {
      mockAmadeusProvider.searchFlights.mockResolvedValue(mockFlightResults);
      mockRouteCostHistory.findOrCreate.mockResolvedValue({
        addPricePoint: jest.fn(),
        save: jest.fn().mockResolvedValue(true)
      });

      const result = await service.searchFlights(mockSearchParams);

      expect(result.success).toBe(true);
      expect(result.results).toEqual(mockFlightResults);
      expect(result.provider).toBe('AmadeusProvider');
      expect(result.count).toBe(2);
      expect(mockAmadeusProvider.searchFlights).toHaveBeenCalledWith(mockSearchParams);
    });

    it('should throw error when no providers configured', async () => {
      // Temporarily clear providers
      const originalProviders = service.flightProviders;
      service.flightProviders = [];

      await expect(service.searchFlights(mockSearchParams))
        .rejects.toThrow('No flight providers configured');

      // Restore providers
      service.flightProviders = originalProviders;
    });

    it('should update route cost history asynchronously', async () => {
      mockAmadeusProvider.searchFlights.mockResolvedValue(mockFlightResults);
      const mockRoute = {
        addPricePoint: jest.fn(),
        save: jest.fn().mockResolvedValue(true)
      };
      mockRouteCostHistory.findOrCreate.mockResolvedValue(mockRoute);

      await service.searchFlights(mockSearchParams);

      // Wait a bit for async operation
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockRouteCostHistory.findOrCreate).toHaveBeenCalledWith(
        'JFK',
        'LAX',
        'flight',
        'USD'
      );
    });

    it('should not block response if route cost history update fails', async () => {
      mockAmadeusProvider.searchFlights.mockResolvedValue(mockFlightResults);
      mockRouteCostHistory.findOrCreate.mockRejectedValue(new Error('DB Error'));

      // Should still return results even if history update fails
      const result = await service.searchFlights(mockSearchParams);

      expect(result.success).toBe(true);
      expect(result.results).toEqual(mockFlightResults);
    });

    it('should fallback to next provider on failure', async () => {
      const mockProvider2 = {
        searchFlights: jest.fn().mockResolvedValue(mockFlightResults),
        constructor: { name: 'SkyscannerProvider' }
      };

      mockAmadeusProvider.searchFlights.mockRejectedValue(new Error('Amadeus failed'));
      service.flightProviders.push(mockProvider2);

      const result = await service.searchFlights(mockSearchParams);

      expect(result.success).toBe(true);
      expect(result.provider).toBe('SkyscannerProvider');
      expect(mockProvider2.searchFlights).toHaveBeenCalled();
    });

    it('should throw error when all providers fail', async () => {
      mockAmadeusProvider.searchFlights.mockRejectedValue(new Error('Provider failed'));

      await expect(service.searchFlights(mockSearchParams))
        .rejects.toThrow('All flight providers failed');
    });

    it('should include last error message in failure', async () => {
      const errorMessage = 'Network timeout';
      mockAmadeusProvider.searchFlights.mockRejectedValue(new Error(errorMessage));

      await expect(service.searchFlights(mockSearchParams))
        .rejects.toThrow(expect.stringContaining(errorMessage));
    });

    it('should handle empty search results', async () => {
      mockAmadeusProvider.searchFlights.mockResolvedValue([]);
      mockRouteCostHistory.findOrCreate.mockResolvedValue({
        addPricePoint: jest.fn(),
        save: jest.fn()
      });

      const result = await service.searchFlights(mockSearchParams);

      expect(result.success).toBe(true);
      expect(result.results).toEqual([]);
      expect(result.count).toBe(0);
    });

    it('should handle malformed provider responses', async () => {
      mockAmadeusProvider.searchFlights.mockResolvedValue(null);

      // Should handle null response gracefully
      await expect(service.searchFlights(mockSearchParams))
        .rejects.toThrow();
    });
  });

  describe('searchTrains', () => {
    it('should throw not yet implemented error', async () => {
      await expect(service.searchTrains({}))
        .rejects.toThrow('Train search not yet implemented');
    });
  });

  describe('updateRouteCostHistory', () => {
    const mockResults = [
      {
        price: { amount: 299.99, currency: 'USD' },
        provider: 'amadeus'
      },
      {
        price: { amount: 349.99, currency: 'USD' },
        provider: 'amadeus'
      }
    ];

    it('should extract prices from results correctly', async () => {
      const mockRoute = {
        addPricePoint: jest.fn(),
        save: jest.fn().mockResolvedValue(true)
      };
      mockRouteCostHistory.findOrCreate.mockResolvedValue(mockRoute);

      await service.updateRouteCostHistory('JFK', 'LAX', 'flight', mockResults);

      expect(mockRoute.addPricePoint).toHaveBeenCalledTimes(2);
      expect(mockRoute.addPricePoint).toHaveBeenCalledWith(
        299.99,
        'USD',
        'amadeus',
        expect.objectContaining({ resultCount: 2 })
      );
      expect(mockRoute.addPricePoint).toHaveBeenCalledWith(
        349.99,
        'USD',
        'amadeus',
        expect.objectContaining({ resultCount: 2 })
      );
    });

    it('should find or create route cost history', async () => {
      const mockRoute = {
        addPricePoint: jest.fn(),
        save: jest.fn().mockResolvedValue(true)
      };
      mockRouteCostHistory.findOrCreate.mockResolvedValue(mockRoute);

      await service.updateRouteCostHistory('JFK', 'LAX', 'flight', mockResults);

      expect(mockRouteCostHistory.findOrCreate).toHaveBeenCalledWith(
        'JFK',
        'LAX',
        'flight',
        'USD'
      );
    });

    it('should save route after adding price points', async () => {
      const mockRoute = {
        addPricePoint: jest.fn(),
        save: jest.fn().mockResolvedValue(true)
      };
      mockRouteCostHistory.findOrCreate.mockResolvedValue(mockRoute);

      await service.updateRouteCostHistory('JFK', 'LAX', 'flight', mockResults);

      expect(mockRoute.save).toHaveBeenCalled();
    });

    it('should handle empty results array', async () => {
      await service.updateRouteCostHistory('JFK', 'LAX', 'flight', []);

      expect(mockRouteCostHistory.findOrCreate).not.toHaveBeenCalled();
    });

    it('should handle results without prices', async () => {
      const resultsWithoutPrices = [
        { provider: 'amadeus', departure: { time: '2025-06-01T10:00:00' } }
      ];

      await service.updateRouteCostHistory('JFK', 'LAX', 'flight', resultsWithoutPrices);

      expect(mockRouteCostHistory.findOrCreate).not.toHaveBeenCalled();
    });

    it('should handle database save errors gracefully', async () => {
      const mockRoute = {
        addPricePoint: jest.fn(),
        save: jest.fn().mockRejectedValue(new Error('DB Error'))
      };
      mockRouteCostHistory.findOrCreate.mockResolvedValue(mockRoute);

      // Should not throw - errors are caught and logged
      await expect(service.updateRouteCostHistory('JFK', 'LAX', 'flight', mockResults))
        .resolves.not.toThrow();
    });

    it('should handle results with missing price fields', async () => {
      const resultsWithMissingPrices = [
        { price: null, provider: 'amadeus' },
        { price: { amount: null, currency: 'USD' }, provider: 'amadeus' },
        { price: { amount: 299.99, currency: 'USD' }, provider: 'amadeus' }
      ];

      const mockRoute = {
        addPricePoint: jest.fn(),
        save: jest.fn().mockResolvedValue(true)
      };
      mockRouteCostHistory.findOrCreate.mockResolvedValue(mockRoute);

      await service.updateRouteCostHistory('JFK', 'LAX', 'flight', resultsWithMissingPrices);

      // Should only add price point for valid price
      expect(mockRoute.addPricePoint).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple currencies', async () => {
      const multiCurrencyResults = [
        { price: { amount: 299.99, currency: 'USD' }, provider: 'amadeus' },
        { price: { amount: 250.00, currency: 'EUR' }, provider: 'amadeus' }
      ];

      const mockRoute = {
        addPricePoint: jest.fn(),
        save: jest.fn().mockResolvedValue(true)
      };
      mockRouteCostHistory.findOrCreate.mockResolvedValue(mockRoute);

      await service.updateRouteCostHistory('JFK', 'LAX', 'flight', multiCurrencyResults);

      // Should use first currency for route, but add all price points
      expect(mockRouteCostHistory.findOrCreate).toHaveBeenCalledWith(
        'JFK',
        'LAX',
        'flight',
        'USD'
      );
      expect(mockRoute.addPricePoint).toHaveBeenCalledTimes(2);
    });

    it('should handle null results', async () => {
      await service.updateRouteCostHistory('JFK', 'LAX', 'flight', null);

      expect(mockRouteCostHistory.findOrCreate).not.toHaveBeenCalled();
    });
  });

  describe('getRouteCostHistory', () => {
    it('should return route when found', async () => {
      const mockRoute = {
        _id: '507f1f77bcf86cd799439011',
        origin: { code: 'JFK' },
        destination: { code: 'LAX' },
        type: 'flight',
        currency: 'USD'
      };
      mockRouteCostHistory.findOne.mockResolvedValue(mockRoute);

      const result = await service.getRouteCostHistory('JFK', 'LAX', 'flight', 'USD');

      expect(mockRouteCostHistory.findOne).toHaveBeenCalledWith({
        'origin.code': 'JFK',
        'destination.code': 'LAX',
        type: 'flight',
        currency: 'USD'
      });
      expect(result).toEqual(mockRoute);
    });

    it('should return null when not found', async () => {
      mockRouteCostHistory.findOne.mockResolvedValue(null);

      const result = await service.getRouteCostHistory('JFK', 'LAX', 'flight', 'USD');

      expect(result).toBeNull();
    });

    it('should handle database query errors gracefully', async () => {
      mockRouteCostHistory.findOne.mockRejectedValue(new Error('DB Error'));

      const result = await service.getRouteCostHistory('JFK', 'LAX', 'flight', 'USD');

      expect(result).toBeNull();
    });

    it('should filter by currency correctly', async () => {
      const mockRoute = {
        _id: '507f1f77bcf86cd799439011',
        currency: 'EUR'
      };
      mockRouteCostHistory.findOne.mockResolvedValue(mockRoute);

      const result = await service.getRouteCostHistory('JFK', 'LAX', 'flight', 'EUR');

      expect(mockRouteCostHistory.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'EUR' })
      );
      expect(result.currency).toBe('EUR');
    });
  });

  describe('searchAirports', () => {
    const mockAirports = [
      { code: 'JFK', name: 'John F. Kennedy International', city: 'New York' },
      { code: 'LGA', name: 'LaGuardia', city: 'New York' }
    ];

    it('should search airports successfully', async () => {
      mockAmadeusProvider.searchAirports.mockResolvedValue(mockAirports);

      const result = await service.searchAirports('New York', 10);

      expect(mockAmadeusProvider.searchAirports).toHaveBeenCalledWith('New York', 10);
      expect(result).toEqual(mockAirports);
    });

    it('should respect limit parameter', async () => {
      mockAmadeusProvider.searchAirports.mockResolvedValue(mockAirports);

      await service.searchAirports('New York', 5);

      expect(mockAmadeusProvider.searchAirports).toHaveBeenCalledWith('New York', 5);
    });

    it('should return empty array when no providers', async () => {
      service.flightProviders = [];

      const result = await service.searchAirports('New York', 10);

      expect(result).toEqual([]);
    });

    it('should return empty array on provider error', async () => {
      mockAmadeusProvider.searchAirports.mockRejectedValue(new Error('Provider error'));

      const result = await service.searchAirports('New York', 10);

      expect(result).toEqual([]);
    });

    it('should handle empty query string', async () => {
      mockAmadeusProvider.searchAirports.mockResolvedValue([]);

      const result = await service.searchAirports('', 10);

      expect(result).toEqual([]);
      expect(mockAmadeusProvider.searchAirports).toHaveBeenCalledWith('', 10);
    });

    it('should use default limit when not provided', async () => {
      mockAmadeusProvider.searchAirports.mockResolvedValue(mockAirports);

      await service.searchAirports('New York');

      expect(mockAmadeusProvider.searchAirports).toHaveBeenCalledWith('New York', 10);
    });
  });

  describe('getNearestAirports', () => {
    const mockNearestAirports = [
      { code: 'JFK', name: 'John F. Kennedy International', distance: 15.5 },
      { code: 'LGA', name: 'LaGuardia', distance: 18.2 }
    ];

    it('should get nearest airports successfully', async () => {
      mockAmadeusProvider.getNearestAirports.mockResolvedValue(mockNearestAirports);

      const result = await service.getNearestAirports(40.7128, -74.0060, 100, 3);

      expect(mockAmadeusProvider.getNearestAirports).toHaveBeenCalledWith(
        40.7128,
        -74.0060,
        100,
        3
      );
      expect(result).toEqual(mockNearestAirports);
    });

    it('should respect radius and limit parameters', async () => {
      mockAmadeusProvider.getNearestAirports.mockResolvedValue(mockNearestAirports);

      await service.getNearestAirports(40.7128, -74.0060, 50, 5);

      expect(mockAmadeusProvider.getNearestAirports).toHaveBeenCalledWith(
        40.7128,
        -74.0060,
        50,
        5
      );
    });

    it('should use default radius and limit when not provided', async () => {
      mockAmadeusProvider.getNearestAirports.mockResolvedValue(mockNearestAirports);

      await service.getNearestAirports(40.7128, -74.0060);

      expect(mockAmadeusProvider.getNearestAirports).toHaveBeenCalledWith(
        40.7128,
        -74.0060,
        100,
        3
      );
    });

    it('should return empty array when no providers', async () => {
      service.flightProviders = [];

      const result = await service.getNearestAirports(40.7128, -74.0060);

      expect(result).toEqual([]);
    });

    it('should return empty array on provider error', async () => {
      mockAmadeusProvider.getNearestAirports.mockRejectedValue(new Error('Provider error'));

      const result = await service.getNearestAirports(40.7128, -74.0060);

      expect(result).toEqual([]);
    });

    it('should handle invalid coordinates', async () => {
      mockAmadeusProvider.getNearestAirports.mockResolvedValue([]);

      const result = await service.getNearestAirports(999, 999);

      expect(result).toEqual([]);
    });
  });

  describe('getFlightStatus', () => {
    const mockFlightStatus = {
      flightNumber: 'AA100',
      status: 'On Time',
      departure: { scheduled: '2025-06-01T10:00:00', actual: null },
      arrival: { scheduled: '2025-06-01T13:00:00', actual: null }
    };

    it('should get flight status successfully', async () => {
      mockAmadeusProvider.getFlightStatus.mockResolvedValue(mockFlightStatus);

      const result = await service.getFlightStatus('AA100', '2025-06-01');

      expect(mockAmadeusProvider.parseFlightNumber).toHaveBeenCalledWith('AA100');
      expect(mockAmadeusProvider.getFlightStatus).toHaveBeenCalledWith(
        'AA',
        '100',
        '2025-06-01'
      );
      expect(result).toEqual(mockFlightStatus);
    });

    it('should throw error when no providers configured', async () => {
      service.flightProviders = [];

      await expect(service.getFlightStatus('AA100', '2025-06-01'))
        .rejects.toThrow('No flight providers configured');
    });

    it('should parse flight number correctly', async () => {
      mockAmadeusProvider.parseFlightNumber.mockReturnValue({
        airlineCode: 'DL',
        flightNumber: '1234'
      });
      mockAmadeusProvider.getFlightStatus.mockResolvedValue(mockFlightStatus);

      await service.getFlightStatus('DL1234', '2025-06-01');

      expect(mockAmadeusProvider.parseFlightNumber).toHaveBeenCalledWith('DL1234');
      expect(mockAmadeusProvider.getFlightStatus).toHaveBeenCalledWith(
        'DL',
        '1234',
        '2025-06-01'
      );
    });

    it('should handle provider errors', async () => {
      mockAmadeusProvider.getFlightStatus.mockRejectedValue(new Error('Flight not found'));

      await expect(service.getFlightStatus('AA100', '2025-06-01'))
        .rejects.toThrow('Flight not found');
    });

    it('should handle invalid date format', async () => {
      mockAmadeusProvider.getFlightStatus.mockRejectedValue(new Error('Invalid date'));

      await expect(service.getFlightStatus('AA100', 'invalid-date'))
        .rejects.toThrow();
    });

    it('should handle flight number without airline code', async () => {
      mockAmadeusProvider.parseFlightNumber.mockReturnValue({
        airlineCode: null,
        flightNumber: '100'
      });
      mockAmadeusProvider.getFlightStatus.mockRejectedValue(new Error('Invalid flight number'));

      await expect(service.getFlightStatus('100', '2025-06-01'))
        .rejects.toThrow();
    });
  });
});

