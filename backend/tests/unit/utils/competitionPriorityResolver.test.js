const { describe, it, expect } = require('@jest/globals');
const { buildPrioritizedCompetitionIds } = require('../../../src/utils/competitionPriorityResolver');

describe('competitionPriorityResolver', () => {
    it('keeps primary league first and appends domestic + continental competitions', () => {
        const ids = buildPrioritizedCompetitionIds({
            primaryLeagueIds: ['39'],
            country: 'England',
            maxCompetitions: 6
        });

        expect(ids[0]).toBe('39');
        expect(ids).toContain('45');
        expect(ids).toContain('2');
    });

    it('deduplicates ids when policy contains overlapping values', () => {
        const ids = buildPrioritizedCompetitionIds({
            primaryLeagueIds: ['2', '39'],
            country: 'England',
            maxCompetitions: 10
        });

        const unique = new Set(ids);
        expect(unique.size).toBe(ids.length);
        expect(ids).toContain('2');
        expect(ids).toContain('39');
    });

    it('returns only primary competitions when country is unknown', () => {
        const ids = buildPrioritizedCompetitionIds({
            primaryLeagueIds: ['253'],
            country: null,
            maxCompetitions: 6
        });

        expect(ids).toEqual(['253']);
    });
});
