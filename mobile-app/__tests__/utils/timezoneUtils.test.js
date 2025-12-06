    /**
 * @jest-environment node
 */

import {
  isValidTimezone,
  getVenueTimezone,
  getTimezoneFromCoordinates,
  getTimezoneFromLocation,
  formatMatchTimeInVenueTimezone,
  getTimezoneLabel,
  getTimezoneAbbreviation,
  getCityFromTimezone,
  getRelativeMatchTime
} from '../../utils/timezoneUtils';

describe('Timezone Utilities', () => {
  // Mock Date for deterministic tests
  const mockDate = new Date('2025-03-15T19:00:00Z');
  
  beforeAll(() => {
    // Mock the current date for relative time tests
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-03-15T12:00:00Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe('isValidTimezone', () => {
    it('should return true for valid timezones', () => {
      expect(isValidTimezone('Europe/London')).toBe(true);
      expect(isValidTimezone('America/New_York')).toBe(true);
      expect(isValidTimezone('Asia/Tokyo')).toBe(true);
      expect(isValidTimezone('UTC')).toBe(true);
    });

    it('should return false for invalid timezones', () => {
      expect(isValidTimezone(null)).toBe(false);
      expect(isValidTimezone(undefined)).toBe(false);
      expect(isValidTimezone('')).toBe(false);
      expect(isValidTimezone('Invalid/Timezone')).toBe(false);
      expect(isValidTimezone(123)).toBe(false);
    });
  });

  describe('getTimezoneAbbreviation', () => {
    it('should return timezone abbreviation for valid timezone', () => {
      const abbr = getTimezoneAbbreviation('Europe/London', mockDate);
      // Should be GMT or BST depending on DST
      expect(['GMT', 'BST']).toContain(abbr);
    });

    it('should return UTC for UTC timezone', () => {
      expect(getTimezoneAbbreviation('UTC', mockDate)).toBe('UTC');
    });

    it('should fallback for invalid timezone', () => {
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
    });

    it('should extract city from unknown timezone path', () => {
      expect(getCityFromTimezone('Europe/Unknown_City')).toBe('Unknown City');
    });

    it('should return UTC for UTC timezone', () => {
      expect(getCityFromTimezone('UTC')).toBe('UTC');
    });
  });

  describe('getTimezoneLabel - Abbreviation Only', () => {
    it('should return abbreviation for London timezone', () => {
      const label = getTimezoneLabel('Europe/London', mockDate);
      // Should return just "GMT" or "BST" depending on DST
      expect(['GMT', 'BST']).toContain(label);
    });

    it('should ignore venue city parameter (kept for API compatibility)', () => {
      const label = getTimezoneLabel('Europe/London', mockDate, 'Manchester');
      // Should still return just abbreviation
      expect(['GMT', 'BST']).toContain(label);
    });

    it('should return UTC for UTC timezone', () => {
      const label = getTimezoneLabel('UTC', mockDate, 'Unknown City');
      expect(label).toBe('UTC');
    });

    it('should return UTC when no venue city for UTC timezone', () => {
      const label = getTimezoneLabel('UTC', mockDate, null);
      expect(label).toBe('UTC');
    });

    it('should work for different timezones', () => {
      // Test Madrid - timezone abbreviation can vary (CET, CEST, GMT+1, etc.)
      const madridLabel = getTimezoneLabel('Europe/Madrid', mockDate);
      // Accept various formats that might be returned
      expect(madridLabel).toBeDefined();
      expect(typeof madridLabel).toBe('string');

      // Test Tokyo - timezone abbreviation can vary (JST, GMT+9, etc.)
      const tokyoLabel = getTimezoneLabel('Asia/Tokyo', mockDate);
      expect(tokyoLabel).toBeDefined();
      expect(typeof tokyoLabel).toBe('string');

      // Test New York - timezone abbreviation can vary (EST, EDT, GMT-5, etc.)
      const nyLabel = getTimezoneLabel('America/New_York', mockDate);
      expect(nyLabel).toBeDefined();
      expect(typeof nyLabel).toBe('string');
    });
  });

  describe('getVenueTimezone', () => {
    it('should return timezone from fixture timezone if valid', () => {
      const fixture = {
        timezone: 'Europe/London'
      };
      expect(getVenueTimezone(fixture)).toBe('Europe/London');
    });

    it('should fallback to coordinates when timezone is UTC', () => {
      const fixture = {
        timezone: 'UTC',
        venue: {
          coordinates: [-0.1278, 51.5074] // London coordinates
        }
      };
      const result = getVenueTimezone(fixture);
      expect(result).toBe('Europe/London');
    });

    it('should fallback to city/country when no coordinates', () => {
      const fixture = {
        timezone: 'UTC',
        venue: {
          city: 'London',
          country: 'England'
        }
      };
      expect(getVenueTimezone(fixture)).toBe('Europe/London');
    });

    it('should return UTC as last resort', () => {
      expect(getVenueTimezone(null)).toBe('UTC');
      expect(getVenueTimezone({})).toBe('UTC');
      expect(getVenueTimezone({ timezone: 'UTC' })).toBe('UTC');
    });
  });

  describe('getTimezoneFromCoordinates', () => {
    it('should return Europe/London for London coordinates', () => {
      const coords = [-0.1278, 51.5074];
      const result = getTimezoneFromCoordinates(coords);
      expect(result).toBe('Europe/London');
    });

    it('should return Europe/Madrid for Madrid coordinates', () => {
      const coords = [-3.7038, 40.4168];
      const result = getTimezoneFromCoordinates(coords);
      expect(result).toBe('Europe/Madrid');
    });

    it('should return null for invalid coordinates', () => {
      expect(getTimezoneFromCoordinates(null)).toBeNull();
      expect(getTimezoneFromCoordinates([])).toBeNull();
      expect(getTimezoneFromCoordinates([1])).toBeNull();
    });
  });

  describe('getTimezoneFromLocation', () => {
    it('should return timezone for known cities', () => {
      expect(getTimezoneFromLocation('London', 'England')).toBe('Europe/London');
      expect(getTimezoneFromLocation('Madrid', 'Spain')).toBe('Europe/Madrid');
      expect(getTimezoneFromLocation('Tokyo', 'Japan')).toBe('Asia/Tokyo');
    });

    it('should fallback to country when city not found', () => {
      expect(getTimezoneFromLocation('UnknownCity', 'England')).toBe('Europe/London');
      expect(getTimezoneFromLocation('UnknownCity', 'Spain')).toBe('Europe/Madrid');
    });

    it('should return null when neither city nor country found', () => {
      expect(getTimezoneFromLocation(null, null)).toBeNull();
      expect(getTimezoneFromLocation('Unknown', 'Unknown')).toBeNull();
    });
  });

  describe('formatMatchTimeInVenueTimezone', () => {
    const londonFixture = {
      date: '2025-03-15T19:00:00Z',
      timezone: 'UTC',
      venue: {
        city: 'London',
        country: 'England',
        coordinates: [-0.1278, 51.5074]
      }
    };

    const madridFixture = {
      date: '2025-03-15T19:00:00Z',
      timezone: 'UTC',
      venue: {
        city: 'Madrid',
        country: 'Spain',
        coordinates: [-3.7038, 40.4168]
      }
    };

    it('should format time in London timezone', () => {
      const result = formatMatchTimeInVenueTimezone(
        londonFixture.date,
        londonFixture,
        { showTimezone: true, showDate: false, timeFormat: '12hour' }
      );
      // Should include time and timezone abbreviation
      expect(result).toMatch(/\d{1,2}:\d{2} (AM|PM)/);
      expect(result).toMatch(/\((GMT|BST)\)/);
    });

    it('should format date and time with timezone abbreviation', () => {
      const result = formatMatchTimeInVenueTimezone(
        madridFixture.date,
        madridFixture,
        { showTimezone: true, showDate: true, timeFormat: '12hour' }
      );
      // Should include date, time, and timezone abbreviation
      expect(result).toContain('at');
      // Timezone abbreviation can vary (CET, CEST, GMT+1, etc.)
      expect(result).toMatch(/\([^)]+\)/); // Any timezone abbreviation in parentheses
    });

    it('should handle missing date', () => {
      const result = formatMatchTimeInVenueTimezone(null, londonFixture);
      // Function returns object { date: 'TBD', time: 'TBD' } when dateString is null
      expect(result).toEqual({ date: 'TBD', time: 'TBD' });
    });

    it('should handle missing fixture', () => {
      const result = formatMatchTimeInVenueTimezone(
        '2025-03-15T19:00:00Z',
        null,
        { showTimezone: true }
      );
      // Should fallback to UTC
      expect(result).toBeDefined();
    });

    it('should respect showTimezone option', () => {
      const withTimezone = formatMatchTimeInVenueTimezone(
        londonFixture.date,
        londonFixture,
        { showTimezone: true, showDate: false }
      );
      const withoutTimezone = formatMatchTimeInVenueTimezone(
        londonFixture.date,
        londonFixture,
        { showTimezone: false, showDate: false }
      );
      
      expect(withTimezone.length).toBeGreaterThan(withoutTimezone.length);
      expect(withoutTimezone).not.toContain('GMT');
      expect(withoutTimezone).not.toContain('BST');
    });

    it('should respect timeFormat option', () => {
      const format12 = formatMatchTimeInVenueTimezone(
        londonFixture.date,
        londonFixture,
        { showTimezone: false, showDate: false, timeFormat: '12hour' }
      );
      const format24 = formatMatchTimeInVenueTimezone(
        londonFixture.date,
        londonFixture,
        { showTimezone: false, showDate: false, timeFormat: '24hour' }
      );
      
      expect(format12).toMatch(/(AM|PM)/);
      expect(format24).not.toMatch(/(AM|PM)/);
    });
  });

  describe('getRelativeMatchTime', () => {
    const futureFixture = {
      timezone: 'Europe/London',
      venue: { city: 'London' }
    };

    it('should return relative time for future matches', () => {
      const futureDate = '2025-03-15T19:00:00Z'; // 7 hours from mock time
      const result = getRelativeMatchTime(futureDate, futureFixture);
      expect(result).toMatch(/in \d+ hour/);
    });

    it('should return relative time for past matches', () => {
      const pastDate = '2025-03-15T08:00:00Z'; // 4 hours before mock time
      const result = getRelativeMatchTime(pastDate, futureFixture);
      expect(result).toMatch(/\d+ hour.* ago/);
    });

    it('should handle null date', () => {
      const result = getRelativeMatchTime(null, futureFixture);
      expect(result).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle fixture with no venue data', () => {
      const fixture = {
        date: '2025-03-15T19:00:00Z',
        timezone: 'UTC'
      };
      const result = formatMatchTimeInVenueTimezone(
        fixture.date,
        fixture,
        { showTimezone: true }
      );
      expect(result).toBeDefined();
      expect(result).not.toBe('Time unavailable');
    });

    it('should handle invalid date string gracefully', () => {
      const fixture = {
        venue: { city: 'London' }
      };
      const result = formatMatchTimeInVenueTimezone(
        'invalid-date',
        fixture,
        { showTimezone: true }
      );
      // Should not crash, return something meaningful
      expect(result).toBeDefined();
    });

    it('should handle fixture with empty venue object', () => {
      const fixture = {
        date: '2025-03-15T19:00:00Z',
        timezone: 'UTC',
        venue: {}
      };
      const result = formatMatchTimeInVenueTimezone(
        fixture.date,
        fixture,
        { showTimezone: true }
      );
      expect(result).toBeDefined();
    });
  });
});

