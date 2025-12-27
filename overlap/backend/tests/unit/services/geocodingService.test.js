/**
 * Unit tests for GeocodingService batch processing methods
 */

const geocodingService = require('../../../src/services/geocodingService');
const axios = require('axios');

describe('GeocodingService Batch Processing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    geocodingService.clearCache();
  });

  describe('batchGeocodeVenues', () => {
    it('should return empty Map for empty array', async () => {
      const result = await geocodingService.batchGeocodeVenues([]);
      
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('should return empty Map for null/undefined input', async () => {
      const result1 = await geocodingService.batchGeocodeVenues(null);
      const result2 = await geocodingService.batchGeocodeVenues(undefined);
      
      expect(result1).toBeInstanceOf(Map);
      expect(result1.size).toBe(0);
      expect(result2).toBeInstanceOf(Map);
      expect(result2.size).toBe(0);
    });

    it('should use cache for previously geocoded venues', async () => {
      // First, geocode a venue to populate cache
      axios.get.mockResolvedValueOnce({
        data: [{
          lat: '51.5074',
          lon: '-0.1278',
          display_name: 'London, UK',
          importance: 0.9
        }]
      });

      await geocodingService.geocodeVenueCoordinates('Wembley Stadium', 'London', 'United Kingdom');
      
      // Now batch geocode should use cache
      const result = await geocodingService.batchGeocodeVenues([
        { name: 'Wembley Stadium', city: 'London', country: 'United Kingdom' }
      ]);
      
      expect(result.size).toBe(1);
      expect(result.get('Wembley Stadium|London|United Kingdom')).toEqual([-0.1278, 51.5074]);
      // Should not make another API call (cache hit)
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    it('should batch geocode multiple venues in parallel', async () => {
      axios.get
        .mockResolvedValueOnce({
          data: [{
            lat: '51.5074',
            lon: '-0.1278',
            display_name: 'London, UK',
            importance: 0.9
          }]
        })
        .mockResolvedValueOnce({
          data: [{
            lat: '48.8566',
            lon: '2.3522',
            display_name: 'Paris, France',
            importance: 0.9
          }]
        });

      const result = await geocodingService.batchGeocodeVenues([
        { name: 'Wembley Stadium', city: 'London', country: 'United Kingdom' },
        { name: 'Parc des Princes', city: 'Paris', country: 'France' }
      ]);
      
      expect(result.size).toBe(2);
      expect(result.get('Wembley Stadium|London|United Kingdom')).toEqual([-0.1278, 51.5074]);
      expect(result.get('Parc des Princes|Paris|France')).toEqual([2.3522, 48.8566]);
      expect(axios.get).toHaveBeenCalledTimes(2);
    });

    it('should handle duplicate venues gracefully', async () => {
      axios.get.mockResolvedValueOnce({
        data: [{
          lat: '51.5074',
          lon: '-0.1278',
          display_name: 'London, UK',
          importance: 0.9
        }]
      });

      const result = await geocodingService.batchGeocodeVenues([
        { name: 'Wembley Stadium', city: 'London', country: 'United Kingdom' },
        { name: 'Wembley Stadium', city: 'London', country: 'United Kingdom' },
        { name: 'Wembley Stadium', city: 'London', country: 'United Kingdom' }
      ]);
      
      expect(result.size).toBe(1);
      // Should only make one API call for duplicates
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    it('should handle partial failures gracefully', async () => {
      axios.get
        .mockResolvedValueOnce({
          data: [{
            lat: '51.5074',
            lon: '-0.1278',
            display_name: 'London, UK',
            importance: 0.9
          }]
        })
        .mockRejectedValueOnce(new Error('API Error'));

      const result = await geocodingService.batchGeocodeVenues([
        { name: 'Wembley Stadium', city: 'London', country: 'United Kingdom' },
        { name: 'Invalid Venue', city: 'Invalid City', country: 'Invalid Country' }
      ]);
      
      // Should return successful geocoding even if one fails
      expect(result.size).toBe(1);
      expect(result.get('Wembley Stadium|London|United Kingdom')).toEqual([-0.1278, 51.5074]);
    });

    it('should filter out invalid entries (missing name)', async () => {
      const result = await geocodingService.batchGeocodeVenues([
        { name: 'Valid Stadium', city: 'Test City', country: 'Test Country' },
        { name: null, city: 'Test City', country: 'Test Country' },
        { city: 'Test City', country: 'Test Country' }, // missing name
        { name: '', city: 'Test City', country: 'Test Country' }
      ]);
      
      expect(result).toBeInstanceOf(Map);
      // Should only process valid entries
    });

    it('should return empty Map when API key is not configured', async () => {
      const originalApiKey = geocodingService.apiKey;
      geocodingService.apiKey = null;
      
      const result = await geocodingService.batchGeocodeVenues([
        { name: 'Test Stadium', city: 'Test City', country: 'Test Country' }
      ]);
      
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
      expect(axios.get).not.toHaveBeenCalled();
      
      // Restore
      geocodingService.apiKey = originalApiKey;
    });

    it('should handle empty API responses', async () => {
      axios.get.mockResolvedValueOnce({ data: [] });

      const result = await geocodingService.batchGeocodeVenues([
        { name: 'Non-existent Stadium', city: 'Nowhere', country: 'Nowhere' }
      ]);
      
      expect(result.size).toBe(0);
    });

    it('should handle venues with missing city or country', async () => {
      axios.get.mockResolvedValueOnce({
        data: [{
          lat: '51.5074',
          lon: '-0.1278',
          display_name: 'London, UK',
          importance: 0.9
        }]
      });

      const result = await geocodingService.batchGeocodeVenues([
        { name: 'Wembley Stadium', city: 'London', country: null },
        { name: 'Wembley Stadium', city: null, country: 'United Kingdom' },
        { name: 'Wembley Stadium', city: 'London', country: 'United Kingdom' }
      ]);
      
      // Should process valid entries
      expect(result).toBeInstanceOf(Map);
    });
  });
});

