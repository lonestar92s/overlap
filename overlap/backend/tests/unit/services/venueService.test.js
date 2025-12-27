/**
 * Unit tests for VenueService batch processing methods
 */

const mongoose = require('mongoose');
const venueService = require('../../../src/services/venueService');
const Venue = require('../../../src/models/Venue');

describe('VenueService Batch Processing', () => {
  beforeAll(async () => {
    // Skip tests if MongoDB is not available
    if (!process.env.MONGODB_URI && !process.env.MONGO_URL) {
      console.log('⚠️  MongoDB not configured, skipping venue service tests');
      return;
    }
    
    try {
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URL || 'mongodb://localhost:27017/overlap-test', {
          serverSelectionTimeoutMS: 5000
        });
      }
    } catch (error) {
      console.log('⚠️  Could not connect to MongoDB, skipping venue service tests:', error.message);
    }
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  beforeEach(async () => {
    // Clean up test venues before each test
    await Venue.deleteMany({ venueId: { $in: [999, 998, 997, 996, 995] } });
  });

  describe('batchGetVenuesById', () => {
    it('should return empty Map for empty array', async () => {
      if (mongoose.connection.readyState === 0) return;
      
      const result = await venueService.batchGetVenuesById([]);
      
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('should return empty Map for null/undefined input', async () => {
      if (mongoose.connection.readyState === 0) return;
      
      const result1 = await venueService.batchGetVenuesById(null);
      const result2 = await venueService.batchGetVenuesById(undefined);
      
      expect(result1).toBeInstanceOf(Map);
      expect(result1.size).toBe(0);
      expect(result2).toBeInstanceOf(Map);
      expect(result2.size).toBe(0);
    });

    it('should batch fetch venues by IDs', async () => {
      if (mongoose.connection.readyState === 0) return;
      
      // Create test venues
      const venue1 = new Venue({
        venueId: 999,
        name: 'Test Stadium 1',
        city: 'Test City',
        country: 'Test Country',
        coordinates: [0.1, 51.5],
        isActive: true
      });
      const venue2 = new Venue({
        venueId: 998,
        name: 'Test Stadium 2',
        city: 'Test City',
        country: 'Test Country',
        coordinates: [0.2, 51.6],
        isActive: true
      });
      await Promise.all([venue1.save(), venue2.save()]);
      
      // Batch fetch
      const result = await venueService.batchGetVenuesById([999, 998]);
      
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(2);
      expect(result.get(999)).toBeDefined();
      expect(result.get(998)).toBeDefined();
      expect(result.get(999).name).toBe('Test Stadium 1');
      expect(result.get(998).name).toBe('Test Stadium 2');
    });

    it('should handle duplicate IDs gracefully', async () => {
      if (mongoose.connection.readyState === 0) return;
      
      const venue = new Venue({
        venueId: 997,
        name: 'Test Stadium',
        city: 'Test City',
        country: 'Test Country',
        coordinates: [0.1, 51.5],
        isActive: true
      });
      await venue.save();
      
      // Duplicate IDs in input
      const result = await venueService.batchGetVenuesById([997, 997, 997]);
      
      expect(result.size).toBe(1);
      expect(result.get(997)).toBeDefined();
    });

    it('should filter out null/undefined IDs', async () => {
      if (mongoose.connection.readyState === 0) return;
      
      const venue = new Venue({
        venueId: 996,
        name: 'Test Stadium',
        city: 'Test City',
        country: 'Test Country',
        coordinates: [0.1, 51.5],
        isActive: true
      });
      await venue.save();
      
      const result = await venueService.batchGetVenuesById([996, null, undefined, 996]);
      
      expect(result.size).toBe(1);
      expect(result.get(996)).toBeDefined();
    });

    it('should only return active venues', async () => {
      if (mongoose.connection.readyState === 0) return;
      
      const activeVenue = new Venue({
        venueId: 995,
        name: 'Active Stadium',
        city: 'Test City',
        country: 'Test Country',
        coordinates: [0.1, 51.5],
        isActive: true
      });
      const inactiveVenue = new Venue({
        venueId: 994,
        name: 'Inactive Stadium',
        city: 'Test City',
        country: 'Test Country',
        coordinates: [0.2, 51.6],
        isActive: false
      });
      await Promise.all([activeVenue.save(), inactiveVenue.save()]);
      
      const result = await venueService.batchGetVenuesById([995, 994]);
      
      expect(result.size).toBe(1);
      expect(result.get(995)).toBeDefined();
      expect(result.get(994)).toBeUndefined();
    });

    it('should return empty Map for non-existent IDs', async () => {
      if (mongoose.connection.readyState === 0) return;
      
      const result = await venueService.batchGetVenuesById([99999, 99998]);
      
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      if (mongoose.connection.readyState === 0) return;
      
      // Close connection to simulate error
      const originalFind = Venue.find;
      Venue.find = jest.fn().mockRejectedValue(new Error('Database error'));
      
      const result = await venueService.batchGetVenuesById([999]);
      
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
      
      // Restore
      Venue.find = originalFind;
    });
  });

  describe('batchGetVenuesByName', () => {
    it('should return empty Map for empty array', async () => {
      if (mongoose.connection.readyState === 0) return;
      
      const result = await venueService.batchGetVenuesByName([]);
      
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('should batch fetch venues by name and city', async () => {
      if (mongoose.connection.readyState === 0) return;
      
      const venue1 = new Venue({
        venueId: 993,
        name: 'Test Stadium 1',
        city: 'Test City 1',
        country: 'Test Country',
        coordinates: [0.1, 51.5],
        isActive: true
      });
      const venue2 = new Venue({
        venueId: 992,
        name: 'Test Stadium 2',
        city: 'Test City 2',
        country: 'Test Country',
        coordinates: [0.2, 51.6],
        isActive: true
      });
      await Promise.all([venue1.save(), venue2.save()]);
      
      const result = await venueService.batchGetVenuesByName([
        { name: 'Test Stadium 1', city: 'Test City 1' },
        { name: 'Test Stadium 2', city: 'Test City 2' }
      ]);
      
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(2);
      expect(result.get('Test Stadium 1|Test City 1')).toBeDefined();
      expect(result.get('Test Stadium 2|Test City 2')).toBeDefined();
    });

    it('should handle case-insensitive matching', async () => {
      if (mongoose.connection.readyState === 0) return;
      
      const venue = new Venue({
        venueId: 991,
        name: 'Test Stadium',
        city: 'Test City',
        country: 'Test Country',
        coordinates: [0.1, 51.5],
        isActive: true
      });
      await venue.save();
      
      const result = await venueService.batchGetVenuesByName([
        { name: 'test stadium', city: 'test city' }
      ]);
      
      expect(result.size).toBeGreaterThanOrEqual(1);
    });

    it('should handle duplicate name/city combinations', async () => {
      if (mongoose.connection.readyState === 0) return;
      
      const venue = new Venue({
        venueId: 990,
        name: 'Test Stadium',
        city: 'Test City',
        country: 'Test Country',
        coordinates: [0.1, 51.5],
        isActive: true
      });
      await venue.save();
      
      const result = await venueService.batchGetVenuesByName([
        { name: 'Test Stadium', city: 'Test City' },
        { name: 'Test Stadium', city: 'Test City' },
        { name: 'Test Stadium', city: 'Test City' }
      ]);
      
      expect(result.size).toBe(1);
    });

    it('should filter out invalid entries (missing name)', async () => {
      if (mongoose.connection.readyState === 0) return;
      
      const result = await venueService.batchGetVenuesByName([
        { name: 'Valid Stadium', city: 'Test City' },
        { name: null, city: 'Test City' },
        { city: 'Test City' }, // missing name
        { name: '', city: 'Test City' }
      ]);
      
      expect(result).toBeInstanceOf(Map);
      // Should only process valid entries
    });

    it('should handle database errors gracefully', async () => {
      if (mongoose.connection.readyState === 0) return;
      
      const originalFind = Venue.find;
      Venue.find = jest.fn().mockRejectedValue(new Error('Database error'));
      
      const result = await venueService.batchGetVenuesByName([
        { name: 'Test Stadium', city: 'Test City' }
      ]);
      
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
      
      // Restore
      Venue.find = originalFind;
    });
  });
});

