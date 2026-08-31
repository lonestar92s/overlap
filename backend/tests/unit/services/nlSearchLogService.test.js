const {
  buildParsedSummary,
  extractMatchIds,
  normalizeSource
} = require('../../../src/services/nlSearchLogService');

describe('nlSearchLogService', () => {
  describe('normalizeSource', () => {
    it('accepts known client sources', () => {
      expect(normalizeSource('ask_agent_modal')).toBe('ask_agent_modal');
      expect(normalizeSource('messages_screen')).toBe('messages_screen');
    });

    it('falls back to unknown for invalid values', () => {
      expect(normalizeSource('random')).toBe('unknown');
      expect(normalizeSource(null)).toBe('unknown');
    });
  });

  describe('buildParsedSummary', () => {
    it('summarizes multi-query responses', () => {
      const summary = buildParsedSummary({
        isMultiQuery: true,
        parsed: {
          primary: { teams: ['Bayern Munich'], matchType: 'home' },
          secondary: { count: 2, maxDistance: 200 }
        }
      });

      expect(summary.isMultiQuery).toBe(true);
      expect(summary.primary.teams).toEqual(['Bayern Munich']);
      expect(summary.secondary.count).toBe(2);
    });

    it('summarizes single-query responses', () => {
      const summary = buildParsedSummary({
        parsed: {
          teams: { any: [{ name: 'Arsenal' }] },
          leagues: [{ name: 'Premier League', apiId: '39' }],
          location: { city: 'London', country: 'United Kingdom' },
          dateRange: { start: '2026-03-01', end: '2026-03-31' },
          matchTypes: ['away']
        }
      });

      expect(summary.teams).toEqual(['Arsenal']);
      expect(summary.leagues).toEqual(['Premier League']);
      expect(summary.location.city).toBe('London');
    });
  });

  describe('extractMatchIds', () => {
    it('collects fixture ids from array matches', () => {
      const ids = extractMatchIds({
        matches: [{ fixture: { id: 101 } }, { fixture: { id: 202 } }]
      });
      expect(ids).toEqual(['101', '202']);
    });

    it('collects primary and secondary ids for multi-query payloads', () => {
      const ids = extractMatchIds({
        matches: {
          primary: { fixture: { id: 1 } },
          secondary: [{ fixture: { id: 2 } }, { fixture: { id: 3 } }]
        }
      });
      expect(ids).toEqual(['1', '2', '3']);
    });
  });
});
