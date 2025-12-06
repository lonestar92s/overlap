/**
 * @jest-environment node
 * 
 * Integration tests for timezone display in components
 * Tests that components correctly display venue local time, not device local time
 */

import {
  formatMatchTimeInVenueTimezone,
  getTimezoneLabel,
  getVenueTimezone
} from '../../utils/timezoneUtils';

describe('Timezone Display Integration', () => {
  // Test fixtures representing matches in different cities
  const fixtures = {
    london: {
      date: '2025-03-15T19:00:00Z',
      timezone: 'UTC',
      venue: {
        name: 'Emirates Stadium',
        city: 'London',
        country: 'England',
        coordinates: [-0.1278, 51.5074]
      }
    },
    madrid: {
      date: '2025-03-15T19:00:00Z',
      timezone: 'UTC',
      venue: {
        name: 'Santiago Bernabéu',
        city: 'Madrid',
        country: 'Spain',
        coordinates: [-3.7038, 40.4168]
      }
    },
    tokyo: {
      date: '2025-03-15T10:00:00Z', // 10am UTC = 7pm JST
      timezone: 'UTC',
      venue: {
        name: 'National Stadium',
        city: 'Tokyo',
        country: 'Japan',
        coordinates: [139.7147, 35.6786]
      }
    },
    newYork: {
      date: '2025-03-15T22:00:00Z', // 10pm UTC = 6pm EST
      timezone: 'UTC',
      venue: {
        name: 'Yankee Stadium',
        city: 'New York',
        country: 'USA',
        coordinates: [-73.9262, 40.8296]
      }
    }
  };

  describe('Venue Time Detection', () => {
    it('should detect London timezone for London venue', () => {
      const timezone = getVenueTimezone(fixtures.london);
      expect(timezone).toBe('Europe/London');
    });

    it('should detect Madrid timezone for Madrid venue', () => {
      const timezone = getVenueTimezone(fixtures.madrid);
      expect(timezone).toBe('Europe/Madrid');
    });

    it('should detect Tokyo timezone for Tokyo venue', () => {
      const timezone = getVenueTimezone(fixtures.tokyo);
      expect(timezone).toBe('Asia/Tokyo');
    });

    it('should detect New York timezone for NY venue', () => {
      const timezone = getVenueTimezone(fixtures.newYork);
      expect(timezone).toBe('America/New_York');
    });
  });

  describe('Timezone Label Format - Abbreviation Only', () => {
    it('should display GMT for London match', () => {
      const result = formatMatchTimeInVenueTimezone(
        fixtures.london.date,
        fixtures.london,
        { showTimezone: true, showDate: false }
      );
      // Should include timezone abbreviation only
      expect(result).toMatch(/\((GMT|BST)\)/);
    });

    it('should display timezone abbreviation for Madrid match', () => {
      const result = formatMatchTimeInVenueTimezone(
        fixtures.madrid.date,
        fixtures.madrid,
        { showTimezone: true, showDate: false }
      );
      // Timezone abbreviation can vary (CET, CEST, GMT+1, etc.)
      expect(result).toMatch(/\([^)]+\)/); // Any timezone abbreviation in parentheses
    });

    it('should display timezone abbreviation for Tokyo match', () => {
      const result = formatMatchTimeInVenueTimezone(
        fixtures.tokyo.date,
        fixtures.tokyo,
        { showTimezone: true, showDate: false }
      );
      // Timezone abbreviation can vary (JST, GMT+9, etc.)
      expect(result).toMatch(/\([^)]+\)/); // Any timezone abbreviation in parentheses
    });

    it('should display EST for NY match', () => {
      const result = formatMatchTimeInVenueTimezone(
        fixtures.newYork.date,
        fixtures.newYork,
        { showTimezone: true, showDate: false }
      );
      expect(result).toMatch(/\((EST|EDT)\)/);
    });
  });

  describe('Time Conversion Accuracy', () => {
    it('should show correct time for London match (19:00 UTC = 19:00 GMT in winter)', () => {
      const result = formatMatchTimeInVenueTimezone(
        fixtures.london.date,
        fixtures.london,
        { showTimezone: false, showDate: false, timeFormat: '12hour' }
      );
      // March 15 is before DST change in UK (last Sunday of March)
      // 19:00 UTC = 19:00 GMT (UTC+0 in winter)
      expect(result).toMatch(/07:00 PM/);
    });

    it('should show correct time for Madrid match (19:00 UTC = 20:00 CET in winter)', () => {
      const result = formatMatchTimeInVenueTimezone(
        fixtures.madrid.date,
        fixtures.madrid,
        { showTimezone: false, showDate: false, timeFormat: '12hour' }
      );
      // March 15 is before DST change in Europe (last Sunday of March)
      // 19:00 UTC = 20:00 CET (UTC+1 in winter)
      expect(result).toMatch(/08:00 PM/);
    });

    it('should show 7pm for Tokyo match (10:00 UTC + 9 hours JST)', () => {
      const result = formatMatchTimeInVenueTimezone(
        fixtures.tokyo.date,
        fixtures.tokyo,
        { showTimezone: false, showDate: false, timeFormat: '12hour' }
      );
      // 10:00 UTC = 19:00 JST (Japan doesn't use DST)
      expect(result).toMatch(/07:00 PM/);
    });
  });

  describe('Full Display Format', () => {
    it('should display complete date, time, and timezone for trip planning', () => {
      const result = formatMatchTimeInVenueTimezone(
        fixtures.london.date,
        fixtures.london,
        { showTimezone: true, showDate: true, showYear: true, timeFormat: '12hour' }
      );
      
      // Should include date
      expect(result).toMatch(/Mar 15/);
      // Should include year
      expect(result).toMatch(/2025/);
      // Should include time
      expect(result).toMatch(/\d{1,2}:\d{2} (AM|PM)/);
      // Should include timezone abbreviation (format may vary)
      expect(result).toMatch(/\([^)]+\)/); // Any timezone abbreviation in parentheses
    });
  });

  describe('Edge Cases for Component Display', () => {
    it('should handle fixture with only city (no coordinates)', () => {
      const fixtureWithOnlyCity = {
        date: '2025-03-15T19:00:00Z',
        timezone: 'UTC',
        venue: {
          city: 'London',
          country: 'England'
        }
      };
      
      const result = formatMatchTimeInVenueTimezone(
        fixtureWithOnlyCity.date,
        fixtureWithOnlyCity,
        { showTimezone: true }
      );
      
      expect(result).toBeDefined();
      expect(result).not.toBe('Time unavailable');
    });

    it('should handle fixture with only coordinates (no city)', () => {
      const fixtureWithOnlyCoords = {
        date: '2025-03-15T19:00:00Z',
        timezone: 'UTC',
        venue: {
          name: 'Stadium',
          coordinates: [-0.1278, 51.5074]
        }
      };
      
      const result = formatMatchTimeInVenueTimezone(
        fixtureWithOnlyCoords.date,
        fixtureWithOnlyCoords,
        { showTimezone: true }
      );
      
      expect(result).toBeDefined();
      // Should still detect London from coordinates
      expect(result).toMatch(/\((GMT|BST)/);
    });

    it('should handle fixture with no venue data gracefully', () => {
      const fixtureWithNoVenue = {
        date: '2025-03-15T19:00:00Z',
        timezone: 'UTC'
      };
      
      const result = formatMatchTimeInVenueTimezone(
        fixtureWithNoVenue.date,
        fixtureWithNoVenue,
        { showTimezone: true }
      );
      
      expect(result).toBeDefined();
      // Should fallback to UTC
      expect(result).toMatch(/UTC/);
    });

    it('should handle missing date with TBD', () => {
      const result = formatMatchTimeInVenueTimezone(
        null,
        fixtures.london,
        { showTimezone: true }
      );
      
      // Function returns object { date: 'TBD', time: 'TBD' } when dateString is null
      expect(result).toEqual({ date: 'TBD', time: 'TBD' });
    });
  });

  describe('Consistency Across Components', () => {
    // Simulate how different components would format the same match
    const londonMatch = fixtures.london;

    it('should produce consistent output for MatchCard format', () => {
      // MatchCard uses: showTimezone: true, showDate: true, showYear: true
      const result = formatMatchTimeInVenueTimezone(
        londonMatch.date,
        londonMatch,
        { showTimezone: true, showDate: true, showYear: true, timeFormat: '12hour' }
      );
      
      expect(result).toBeDefined();
      expect(result).not.toBe('Time unavailable');
      expect(result).toMatch(/2025/); // Year shown
      expect(result).toMatch(/\((GMT|BST)\)/); // Timezone abbreviation
    });

    it('should produce consistent output for Modal time-only format', () => {
      // MatchModal uses: showTimezone: false, showDate: false
      const result = formatMatchTimeInVenueTimezone(
        londonMatch.date,
        londonMatch,
        { showTimezone: false, showDate: false, timeFormat: '12hour' }
      );
      
      expect(result).toBeDefined();
      expect(result).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);
    });

    it('should produce consistent output for Modal date-only format', () => {
      // For extracting date part
      const result = formatMatchTimeInVenueTimezone(
        londonMatch.date,
        londonMatch,
        { showTimezone: false, showDate: true, showYear: false, timeFormat: '12hour' }
      );
      
      const datePart = result.split(' at ')[0];
      expect(datePart).toMatch(/[A-Za-z]{3}, [A-Za-z]{3} \d{1,2}/);
    });
  });
});

