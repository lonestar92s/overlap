const {
    NL_QUERY_MAX_LENGTH,
    NL_HOURLY_LIMIT,
    NL_DAILY_LIMIT,
    MAP_SEARCH_MAX_DAYS,
    MAP_SEARCH_MISS_LIMIT,
    evaluateNlSearchAdmission,
    inclusiveUtcDayCount,
    mapSearchDateRangeError,
    resetMapSearchMissLimiter,
    consumeMapSearchMiss
} = require('../../../src/utils/searchCostLimits');

describe('search cost limits', () => {
    describe('evaluateNlSearchAdmission', () => {
        const userId = 'user-1';

        it('allows a normal query under the caps', () => {
            const result = evaluateNlSearchAdmission({
                query: 'Premier League matches in London this weekend',
                hourCount: 0,
                dayCount: 0,
                userId
            });

            expect(result.allowed).toBe(true);
            expect(result.query).toBe('Premier League matches in London this weekend');
        });

        it('rejects queries over 250 characters without treating them as a used search', () => {
            const result = evaluateNlSearchAdmission({
                query: 'a'.repeat(NL_QUERY_MAX_LENGTH + 1),
                hourCount: 0,
                dayCount: 0,
                userId
            });

            expect(result.allowed).toBe(false);
            expect(result.code).toBe('QUERY_TOO_LONG');
            expect(result.message).toContain('250');
        });

        it('rejects the 9th search in an hour', () => {
            const result = evaluateNlSearchAdmission({
                query: 'Arsenal this weekend',
                hourCount: NL_HOURLY_LIMIT,
                dayCount: NL_HOURLY_LIMIT,
                userId
            });

            expect(result.allowed).toBe(false);
            expect(result.code).toBe('HOURLY_LIMIT');
            expect(result.message).toContain('8');
        });

        it('rejects the 26th search in a day even when the hour is clear', () => {
            const result = evaluateNlSearchAdmission({
                query: 'Arsenal this weekend',
                hourCount: 0,
                dayCount: NL_DAILY_LIMIT,
                userId
            });

            expect(result.allowed).toBe(false);
            expect(result.code).toBe('DAILY_LIMIT');
            expect(result.message).toContain('25');
        });

        it('does not apply the hourly or daily cap to the eval user', () => {
            const result = evaluateNlSearchAdmission({
                query: 'Arsenal this weekend',
                hourCount: 100,
                dayCount: 100,
                userId: '507f1f77bcf86cd799439011'
            });

            expect(result.allowed).toBe(true);
        });
    });

    describe('map search date range', () => {
        it('counts March 1 through March 31 as 31 days', () => {
            expect(inclusiveUtcDayCount('2026-03-01', '2026-03-31')).toBe(31);
            expect(mapSearchDateRangeError('2026-03-01', '2026-03-31')).toBeNull();
        });

        it('rejects a range longer than 31 days', () => {
            const error = mapSearchDateRangeError('2026-03-01', '2026-04-01');
            expect(inclusiveUtcDayCount('2026-03-01', '2026-04-01')).toBe(32);
            expect(error.code).toBe('DATE_RANGE');
            expect(error.message).toContain(String(MAP_SEARCH_MAX_DAYS));
        });
    });

    describe('map search miss limiter', () => {
        beforeEach(() => {
            resetMapSearchMissLimiter();
        });

        it('allows cache-miss searches until the 15 minute cap', () => {
            for (let i = 0; i < MAP_SEARCH_MISS_LIMIT; i += 1) {
                expect(consumeMapSearchMiss('1.2.3.4', 1_000_000).allowed).toBe(true);
            }

            const blocked = consumeMapSearchMiss('1.2.3.4', 1_000_000);
            expect(blocked.allowed).toBe(false);
            expect(blocked.code).toBe('MAP_SEARCH_LIMIT');
            expect(blocked.message).toContain('Wait a few minutes');
        });

        it('does not share the cap across IP addresses', () => {
            for (let i = 0; i < MAP_SEARCH_MISS_LIMIT; i += 1) {
                consumeMapSearchMiss('1.2.3.4', 1_000_000);
            }

            expect(consumeMapSearchMiss('5.6.7.8', 1_000_000).allowed).toBe(true);
        });
    });
});
