/**
 * Unit tests for naturalLanguageService (Match Planning Agent MVP)
 * - formatSearchResults: success and error (greeting/clarification) responses
 * - getSearchExamples: returns example queries
 */
import {
  processNaturalLanguageQuery,
  formatSearchResults,
  getSearchExamples,
  extractSearchParams,
} from '../../services/naturalLanguageService';

describe('naturalLanguageService - Match Planning Agent MVP', () => {
  describe('processNaturalLanguageQuery', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('returns structured failure on non-OK without throwing or echoing server body', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => ({ message: 'upstream database connection refused' }),
      });
      const out = await processNaturalLanguageQuery('Arsenal next month', []);
      expect(out.success).toBe(false);
      expect(out.code).toBe('HTTP_ERROR');
      expect(out.message).toMatch(/couldn't reach the search service/i);
      expect(out.message).not.toMatch(/database/i);
    });

    it('returns structured failure on network error without throwing', async () => {
      global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
      const out = await processNaturalLanguageQuery('test', []);
      expect(out.success).toBe(false);
      expect(out.code).toBe('NETWORK');
      expect(out.message).toMatch(/couldn't complete that search/i);
    });
  });

  describe('formatSearchResults', () => {
    it('returns success: false and message for greeting/error response', () => {
      const apiResponse = {
        success: false,
        message: "Hi! I'm here to help you find football matches. Try something like 'Premier League matches in London next month'.",
        suggestions: ['Premier League matches in London next month', 'Arsenal home games in March'],
      };
      const result = formatSearchResults(apiResponse);
      expect(result.success).toBe(false);
      expect(result.message).toBe(apiResponse.message);
      expect(result.suggestions).toEqual(apiResponse.suggestions);
    });

    it('returns success: true with matches and parsed for successful search', () => {
      const apiResponse = {
        success: true,
        query: 'Arsenal in London next month',
        confidence: 85,
        message: 'Found 2 matches in London!',
        matches: [
          { fixture: { id: 1 }, teams: { home: { name: 'Arsenal' }, away: { name: 'Chelsea' } } },
        ],
        count: 2,
        parsed: {
          teams: [{ name: 'Arsenal FC', id: '42' }],
          leagues: [{ name: 'Premier League', id: '39' }],
          location: { city: 'London', country: 'United Kingdom' },
          dateRange: { start: '2025-03-01', end: '2025-03-31' },
        },
      };
      const result = formatSearchResults(apiResponse);
      expect(result.success).toBe(true);
      expect(result.message).toBe(apiResponse.message);
      expect(result.matches).toHaveLength(1);
      expect(result.count).toBe(2);
      expect(result.parsed.teams).toHaveLength(1);
      expect(result.parsed.leagues).toHaveLength(1);
    });

    it('handles missing optional fields gracefully', () => {
      const result = formatSearchResults({ success: false });
      expect(result.success).toBe(false);
      expect(result.message).toBeUndefined();
      expect(result.suggestions).toEqual([]);
    });
  });

  describe('getSearchExamples', () => {
    it('returns non-empty array of example query strings', () => {
      const examples = getSearchExamples();
      expect(Array.isArray(examples)).toBe(true);
      expect(examples.length).toBeGreaterThan(0);
      examples.forEach((ex) => {
        expect(typeof ex).toBe('string');
        expect(ex.length).toBeGreaterThan(0);
      });
    });

    it('includes location and date-style examples', () => {
      const examples = getSearchExamples();
      const hasLocation = examples.some((s) => /London|Manchester|Birmingham|Germany|Spain/i.test(s));
      const hasDate = examples.some((s) => /month|weekend|March|April/i.test(s));
      expect(hasLocation).toBe(true);
      expect(hasDate).toBe(true);
    });
  });

  describe('extractSearchParams', () => {
    it('returns error and suggestions for low-confidence response', () => {
      const response = { success: false, confidence: 20, message: 'Need more details', suggestions: ['Add a date'] };
      const params = extractSearchParams(response);
      expect(params.error).toBe('Need more details');
      expect(params.suggestions).toEqual(['Add a date']);
      expect(params.confidence).toBe(20);
    });

    it('extracts matches and parsed from successful response', () => {
      const response = {
        success: true,
        confidence: 90,
        matches: [{ id: 1 }],
        parsed: { teams: [{ name: 'Arsenal' }], leagues: [], location: null, dateRange: null },
      };
      const params = extractSearchParams(response);
      expect(params.matches).toEqual([{ id: 1 }]);
      expect(params.parsed.teams).toHaveLength(1);
      expect(params.confidence).toBe(90);
    });
  });
});
