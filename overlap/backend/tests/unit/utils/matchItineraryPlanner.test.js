const { describe, it, expect } = require('@jest/globals');
const {
    weekendRangeFromAnchor,
    findFeasibleItineraries
} = require('../../../src/utils/matchItineraryPlanner');

describe('matchItineraryPlanner', () => {
    describe('weekendRangeFromAnchor', () => {
        it('computes Fri 17:00 through Sun end for a Saturday anchor', () => {
            const { start, end, dateFrom, dateTo } = weekendRangeFromAnchor(
                'Europe/London',
                '2026-03-07'
            );
            expect(start.weekday).toBe(5);
            expect(start.hour).toBe(17);
            expect(start.minute).toBe(0);
            expect(end.weekday).toBe(7);
            expect(dateFrom).toBe('2026-03-06');
            expect(dateTo).toBe('2026-03-08');
        });

        it('uses upcoming Friday when anchor is Wednesday', () => {
            const { start } = weekendRangeFromAnchor('Europe/London', '2026-03-04');
            expect(start.weekday).toBe(5);
            expect(start.toISODate()).toBe('2026-03-06');
        });
    });

    describe('findFeasibleItineraries', () => {
        const mk = (id, iso, lat, lng) => ({
            id,
            fixture: {
                id,
                date: iso,
                venue: {
                    id,
                    name: 'Stadium',
                    city: 'X',
                    country: 'Y',
                    coordinates: [lng, lat]
                }
            },
            league: { id: 39, name: 'Test', country: 'Y' },
            teams: {
                home: { id: 1, name: 'A' },
                away: { id: 2, name: 'B' }
            }
        });

        const nowBeforeMarch2026Weekend = new Date('2026-03-05T12:00:00.000Z').getTime();

        it('finds a 3-match chain when gaps and travel allow', () => {
            const windowStart = new Date('2026-03-06T17:00:00Z').getTime();
            const windowEnd = new Date('2026-03-09T23:59:59Z').getTime();
            const matches = [
                mk(1, '2026-03-07T12:00:00.000Z', 51.5, -0.1),
                mk(2, '2026-03-07T16:00:00.000Z', 51.51, -0.11),
                mk(3, '2026-03-07T20:00:00.000Z', 51.52, -0.12)
            ];
            const { itineraries } = findFeasibleItineraries(matches, {
                ianaTimeZone: 'UTC',
                windowStartMs: windowStart,
                windowEndMs: windowEnd,
                nowMs: nowBeforeMarch2026Weekend,
                minMatches: 3,
                maxMatches: 6,
                maxTravelMinutesBetweenMatches: 90,
                fixedBufferMinutes: 10,
                minutesPerKm: 3.5,
                maxLegsPerDay: 3,
                maxItineraries: 20
            });
            expect(itineraries.length).toBeGreaterThan(0);
            expect(itineraries[0].matchCount).toBeGreaterThanOrEqual(3);
        });

        it('returns no itinerary when travel cap is exceeded', () => {
            const windowStart = new Date('2026-03-06T17:00:00Z').getTime();
            const windowEnd = new Date('2026-03-09T23:59:59Z').getTime();
            const matches = [
                mk(1, '2026-03-07T12:00:00.000Z', 51.5, -0.1),
                mk(2, '2026-03-07T14:00:00.000Z', 48.8, 2.3)
            ];
            const { itineraries } = findFeasibleItineraries(matches, {
                ianaTimeZone: 'UTC',
                windowStartMs: windowStart,
                windowEndMs: windowEnd,
                nowMs: nowBeforeMarch2026Weekend,
                minMatches: 2,
                maxTravelMinutesBetweenMatches: 5,
                fixedBufferMinutes: 5,
                minutesPerKm: 3.5,
                maxLegsPerDay: 3,
                maxItineraries: 20
            });
            expect(itineraries.length).toBe(0);
        });

        it('excludes fixtures whose kickoff is before nowMs', () => {
            const windowStart = new Date('2026-03-06T17:00:00Z').getTime();
            const windowEnd = new Date('2026-03-09T23:59:59Z').getTime();
            const matches = [
                mk(1, '2026-03-07T12:00:00.000Z', 51.5, -0.1),
                mk(2, '2026-03-07T16:00:00.000Z', 51.51, -0.11),
                mk(3, '2026-03-07T20:00:00.000Z', 51.52, -0.12)
            ];
            const afterAllKickoffs = new Date('2026-03-10T00:00:00.000Z').getTime();
            const { itineraries, candidateFixturesInWindow } = findFeasibleItineraries(matches, {
                ianaTimeZone: 'UTC',
                windowStartMs: windowStart,
                windowEndMs: windowEnd,
                nowMs: afterAllKickoffs,
                minMatches: 3,
                maxMatches: 6,
                maxTravelMinutesBetweenMatches: 90,
                fixedBufferMinutes: 10,
                minutesPerKm: 3.5,
                maxLegsPerDay: 3,
                maxItineraries: 20
            });
            expect(candidateFixturesInWindow).toBe(0);
            expect(itineraries.length).toBe(0);
        });
    });
});
