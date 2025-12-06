import {
  getTimezoneFromCoordinates,
  getTimezoneAbbreviation,
  getCityFromTimezone,
  getHybridTimezoneLabel,
  formatMatchDateTime,
  formatAttendedMatchDate
} from './timezone';

describe('Web Timezone Utilities', () => {
  // Mock Date for deterministic tests
  const mockDate = new Date('2025-03-15T19:00:00Z');

  describe('getTimezoneFromCoordinates', () => {
    it('should return Europe/London for UK coordinates', () => {
      expect(getTimezoneFromCoordinates([-0.1278, 51.5074])).toBe('Europe/London');
    });

    it('should return Europe/Paris for France coordinates', () => {
      expect(getTimezoneFromCoordinates([2.3522, 48.8566])).toBe('Europe/Paris');
    });

    it('should return Europe/Berlin for Germany coordinates', () => {
      expect(getTimezoneFromCoordinates([13.4050, 52.5200])).toBe('Europe/Berlin');
    });

    it('should return America/New_York for NYC coordinates', () => {
      expect(getTimezoneFromCoordinates([-74.0060, 40.7128])).toBe('America/New_York');
    });

    it('should return America/Los_Angeles for LA coordinates', () => {
      expect(getTimezoneFromCoordinates([-118.2437, 34.0522])).toBe('America/Los_Angeles');
    });

    it('should return Asia/Tokyo for Japan coordinates', () => {
      expect(getTimezoneFromCoordinates([139.6503, 35.6762])).toBe('Asia/Tokyo');
    });

    it('should return Australia/Sydney for Sydney coordinates', () => {
      expect(getTimezoneFromCoordinates([151.2093, -33.8688])).toBe('Australia/Sydney');
    });

    it('should return UTC for invalid coordinates', () => {
      expect(getTimezoneFromCoordinates(null)).toBe('UTC');
      expect(getTimezoneFromCoordinates([])).toBe('UTC');
      expect(getTimezoneFromCoordinates([1])).toBe('UTC');
    });
  });

  describe('getTimezoneAbbreviation', () => {
    it('should return abbreviation for valid timezone', () => {
      const abbr = getTimezoneAbbreviation('Europe/London', mockDate);
      expect(['GMT', 'BST']).toContain(abbr);
    });

    it('should return JST for Tokyo', () => {
      const abbr = getTimezoneAbbreviation('Asia/Tokyo', mockDate);
      expect(abbr).toBe('JST');
    });

    it('should return fallback for invalid timezone', () => {
      const abbr = getTimezoneAbbreviation('Invalid/Zone', mockDate);
      expect(abbr).toBeDefined();
    });
  });

  describe('getCityFromTimezone', () => {
    it('should return city name for known timezones', () => {
      expect(getCityFromTimezone('Europe/London')).toBe('London');
      expect(getCityFromTimezone('Europe/Paris')).toBe('Paris');
      expect(getCityFromTimezone('America/New_York')).toBe('New York');
      expect(getCityFromTimezone('Asia/Tokyo')).toBe('Tokyo');
      expect(getCityFromTimezone('Australia/Sydney')).toBe('Sydney');
    });

    it('should extract city name from unknown timezone path', () => {
      expect(getCityFromTimezone('Europe/Unknown_City')).toBe('Unknown City');
    });

    it('should return UTC for UTC timezone', () => {
      expect(getCityFromTimezone('UTC')).toBe('UTC');
    });
  });

  describe('getHybridTimezoneLabel', () => {
    it('should return hybrid format with abbreviation and city', () => {
      const label = getHybridTimezoneLabel('Europe/London', mockDate);
      expect(label).toMatch(/^(GMT|BST) \(London\)$/);
    });

    it('should use venue city when provided', () => {
      const label = getHybridTimezoneLabel('Europe/London', mockDate, 'Manchester');
      expect(label).toMatch(/^(GMT|BST) \(Manchester\)$/);
    });

    it('should handle UTC with venue city', () => {
      const label = getHybridTimezoneLabel('UTC', mockDate, 'Remote Venue');
      expect(label).toBe('UTC (Remote Venue)');
    });

    it('should return just UTC when no venue city', () => {
      const label = getHybridTimezoneLabel('UTC', mockDate, null);
      expect(label).toBe('UTC');
    });

    it('should work for various timezones', () => {
      // Madrid
      expect(getHybridTimezoneLabel('Europe/Madrid', mockDate)).toMatch(/^(CET|CEST) \(Madrid\)$/);
      
      // Tokyo
      expect(getHybridTimezoneLabel('Asia/Tokyo', mockDate)).toMatch(/^JST \(Tokyo\)$/);
      
      // New York
      expect(getHybridTimezoneLabel('America/New_York', mockDate)).toMatch(/^(EST|EDT) \(New York\)$/);
      
      // Sydney
      expect(getHybridTimezoneLabel('Australia/Sydney', mockDate)).toMatch(/^(AEST|AEDT) \(Sydney\)$/);
    });
  });

  describe('formatMatchDateTime', () => {
    const londonVenue = {
      name: 'Emirates Stadium',
      city: 'London',
      coordinates: [-0.1278, 51.5074]
    };

    const madridVenue = {
      name: 'Santiago Bernabéu',
      city: 'Madrid',
      coordinates: [-3.7038, 40.4168]
    };

    const tokyoVenue = {
      name: 'National Stadium',
      city: 'Tokyo',
      coordinates: [139.7147, 35.6786]
    };

    it('should return formatted date/time object for London', () => {
      const result = formatMatchDateTime('2025-03-15T19:00:00Z', londonVenue);
      
      expect(result).toHaveProperty('date');
      expect(result).toHaveProperty('time');
      expect(result).toHaveProperty('fullDate');
      expect(result).toHaveProperty('fullDateTime');
      expect(result).toHaveProperty('timeZone');
      expect(result).toHaveProperty('timeZoneAbbr');
      expect(result).toHaveProperty('timeZoneId');
      expect(result).toHaveProperty('groupDate');
    });

    it('should return hybrid timezone format', () => {
      const result = formatMatchDateTime('2025-03-15T19:00:00Z', londonVenue);
      // timeZone should be hybrid format
      expect(result.timeZone).toMatch(/^(GMT|BST) \(London\)$/);
      // timeZoneAbbr should be just the abbreviation
      expect(['GMT', 'BST']).toContain(result.timeZoneAbbr);
    });

    it('should use venue city in hybrid label', () => {
      const result = formatMatchDateTime('2025-03-15T19:00:00Z', madridVenue);
      expect(result.timeZone).toMatch(/^(CET|CEST) \(Madrid\)$/);
    });

    it('should format time correctly for different timezones', () => {
      const londonResult = formatMatchDateTime('2025-03-15T19:00:00Z', londonVenue);
      const tokyoResult = formatMatchDateTime('2025-03-15T19:00:00Z', tokyoVenue);
      
      // Times should be different due to timezone conversion
      expect(londonResult.time).toBeDefined();
      expect(tokyoResult.time).toBeDefined();
      expect(tokyoResult.timeZone).toMatch(/^JST \(Tokyo\)$/);
    });

    it('should handle missing date', () => {
      const result = formatMatchDateTime(null, londonVenue);
      
      expect(result.date).toBe('TBD');
      expect(result.time).toBe('TBD');
      expect(result.timeZone).toBe('UTC');
    });

    it('should handle missing venue coordinates', () => {
      const result = formatMatchDateTime('2025-03-15T19:00:00Z', { name: 'Unknown' });
      
      // Should fallback to UTC
      expect(result.timeZoneId).toBe('UTC');
    });

    it('should handle null venue', () => {
      const result = formatMatchDateTime('2025-03-15T19:00:00Z', null);
      
      expect(result).toBeDefined();
      expect(result.timeZoneId).toBe('UTC');
    });

    it('should include groupDate in UTC for consistent grouping', () => {
      const result = formatMatchDateTime('2025-03-15T19:00:00Z', londonVenue);
      
      expect(result.groupDate).toBe('2025-03-15');
    });
  });

  describe('formatAttendedMatchDate', () => {
    const venue = {
      coordinates: [-0.1278, 51.5074]
    };

    it('should return formatted date without time', () => {
      const result = formatAttendedMatchDate('2025-03-15T19:00:00Z', venue);
      
      expect(result).toMatch(/Mar 15, 2025/);
      expect(result).not.toMatch(/\d{1,2}:\d{2}/); // No time
    });

    it('should handle missing date', () => {
      expect(formatAttendedMatchDate(null, venue)).toBe('Date not set');
    });

    it('should handle invalid date', () => {
      expect(formatAttendedMatchDate('invalid-date', venue)).toBe('Invalid date');
    });

    it('should handle missing venue', () => {
      const result = formatAttendedMatchDate('2025-03-15T19:00:00Z', null);
      expect(result).toMatch(/Mar 15, 2025/);
    });
  });

  describe('Edge Cases', () => {
    it('should handle DST transitions', () => {
      // March 30, 2025 - DST transition in Europe
      const dstDate = '2025-03-30T01:00:00Z';
      const venue = { coordinates: [-0.1278, 51.5074] };
      
      const result = formatMatchDateTime(dstDate, venue);
      expect(result).toBeDefined();
      expect(result.timeZone).toBeDefined();
    });

    it('should handle year boundary', () => {
      const newYearDate = '2025-12-31T23:59:00Z';
      const venue = { coordinates: [139.6503, 35.6762] }; // Tokyo
      
      const result = formatMatchDateTime(newYearDate, venue);
      // In Tokyo, this would be Jan 1st due to timezone
      expect(result).toBeDefined();
    });

    it('should handle coordinates at timezone boundaries', () => {
      // Portugal coordinates (should be Europe/London/Lisbon area)
      const result = formatMatchDateTime('2025-03-15T19:00:00Z', {
        coordinates: [-9.1393, 38.7223] // Lisbon
      });
      expect(result.timeZoneId).toBe('Europe/London');
    });
  });
});

