const { describe, it, expect } = require('@jest/globals');

const {
  queryHasExplicitDateIntent,
  stripInventedParsedDates,
  leaguesRequireExplicitLocation,
  hasValidSearchLocation,
} = require('../../../src/routes/search');

describe('search S5 guardrails', () => {
  describe('queryHasExplicitDateIntent', () => {
    it('returns false when query has league and city but no timeframe', () => {
      expect(queryHasExplicitDateIntent('Premier league matches in London')).toBe(false);
    });

    it('returns true for explicit single-day phrasing', () => {
      expect(queryHasExplicitDateIntent('Premier league matches on March 21st')).toBe(true);
    });

    it('returns true for relative timeframes', () => {
      expect(queryHasExplicitDateIntent('Arsenal matches in London next month')).toBe(true);
    });

    it('returns true for month and year phrasing', () => {
      expect(queryHasExplicitDateIntent('World cup 2026 matches in June')).toBe(true);
    });
  });

  describe('stripInventedParsedDates', () => {
    it('clears parser-invented dateRange when query has no date intent', () => {
      const parsed = {
        dateRange: { start: '2026-03-01', end: '2026-03-31' },
        date: '2026-03-01',
      };

      stripInventedParsedDates('Premier league matches in London', parsed);

      expect(parsed.dateRange).toBeNull();
      expect(parsed.date).toBeNull();
    });

    it('preserves dateRange when query includes explicit date intent', () => {
      const parsed = {
        dateRange: { start: '2026-03-21', end: '2026-03-21' },
      };

      stripInventedParsedDates('Premier league matches on March 21st', parsed);

      expect(parsed.dateRange).toEqual({ start: '2026-03-21', end: '2026-03-21' });
    });
  });

  describe('leaguesRequireExplicitLocation', () => {
    it('requires location for domestic leagues', () => {
      expect(leaguesRequireExplicitLocation(['39'])).toBe(true);
    });

    it('does not require location for international cup competitions only', () => {
      expect(leaguesRequireExplicitLocation(['1'])).toBe(false);
      expect(leaguesRequireExplicitLocation(['2', '3'])).toBe(false);
    });
  });

  describe('hasValidSearchLocation', () => {
    it('returns true only when city and country are present', () => {
      expect(hasValidSearchLocation({ city: 'London', country: 'United Kingdom' })).toBe(true);
      expect(hasValidSearchLocation({ city: 'London', country: null })).toBe(false);
      expect(hasValidSearchLocation(null)).toBe(false);
    });
  });
});
