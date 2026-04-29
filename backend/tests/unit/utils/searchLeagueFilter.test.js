/**
 * Unit tests for league filter helpers used by performSearch
 */
const { describe, it, expect } = require('@jest/globals');
const {
    matchesLeagueFilterToken,
    shouldSkipLeagueFilter
} = require('../../../src/utils/searchLeagueFilter');

describe('searchLeagueFilter', () => {
    describe('matchesLeagueFilterToken', () => {
        it('matches Premier League by api id string', () => {
            expect(matchesLeagueFilterToken(39, 'premier league', '39')).toBe(true);
            expect(matchesLeagueFilterToken(39, 'premier league', '40')).toBe(false);
        });
        it('matches by name substring when filter is not numeric', () => {
            expect(matchesLeagueFilterToken(39, 'premier league', 'Premier')).toBe(true);
            expect(matchesLeagueFilterToken(39, 'premier league', 'La Liga')).toBe(false);
        });
    });

    describe('shouldSkipLeagueFilter', () => {
        it('returns true when filter ids equal competition ids (single league)', () => {
            expect(shouldSkipLeagueFilter(['39'], ['39'])).toBe(true);
            expect(shouldSkipLeagueFilter(['39'], [39])).toBe(true);
        });
        it('returns false when user narrows subset of fetched competitions', () => {
            expect(shouldSkipLeagueFilter(['39'], ['39', '40'])).toBe(false);
        });
        it('returns false when filter uses names', () => {
            expect(shouldSkipLeagueFilter(['Premier League'], ['39'])).toBe(false);
        });
        it('returns false for empty inputs', () => {
            expect(shouldSkipLeagueFilter([], ['39'])).toBe(false);
            expect(shouldSkipLeagueFilter(['39'], [])).toBe(false);
        });
    });
});
