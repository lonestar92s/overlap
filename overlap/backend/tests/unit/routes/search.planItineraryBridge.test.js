const {
    detectPlanItineraryFromQuery,
    weekendAnchorLocalDateFromRange,
    describePlanItineraryOutcome
} = require('../../../src/routes/search.js');

describe('plan-itinerary NL bridge helpers', () => {
    describe('detectPlanItineraryFromQuery', () => {
        it('returns false for ordinary match listing queries', () => {
            expect(detectPlanItineraryFromQuery('Arsenal matches in London next month')).toBe(false);
            expect(detectPlanItineraryFromQuery('Premier league matches in London on March 21st')).toBe(false);
        });
        it('returns true for explicit itinerary / multi-match weekend phrasing', () => {
            expect(detectPlanItineraryFromQuery('Plan an itinerary for Premier League in London next weekend')).toBe(true);
            expect(detectPlanItineraryFromQuery('Plan a football weekend in Manchester')).toBe(true);
            expect(detectPlanItineraryFromQuery('I want to see 3 games in London')).toBe(true);
        });
    });

    describe('weekendAnchorLocalDateFromRange', () => {
        it('picks first Fri–Sun date in range (Europe/London)', () => {
            expect(weekendAnchorLocalDateFromRange('2026-03-02', '2026-03-10', 'Europe/London')).toBe('2026-03-06');
            expect(weekendAnchorLocalDateFromRange('2026-03-06', '2026-03-08', 'Europe/London')).toBe('2026-03-06');
        });
        it('falls back to range start when no weekend day in range', () => {
            expect(weekendAnchorLocalDateFromRange('2026-03-02', '2026-03-04', 'Europe/London')).toBe('2026-03-02');
        });
    });

    describe('describePlanItineraryOutcome', () => {
        const base = {
            minMatches: 3,
            city: 'London',
            country: 'United Kingdom',
            bestItinerary: null
        };
        it('WEEKEND_WINDOW_PAST when window already ended', () => {
            const nowMs = Date.now();
            const out = describePlanItineraryOutcome({
                ...base,
                feasible: false,
                windowEndMs: nowMs - 86400000,
                nowMs,
                fixturesFetched: 0,
                fixturesUpcoming: 0,
                candidateFixturesInWindow: 0
            });
            expect(out.reasonCode).toBe('WEEKEND_WINDOW_PAST');
            expect(out.userMessage).toMatch(/already passed/i);
        });
        it('ALL_FIXTURES_IN_PAST when every fixture is before now', () => {
            const nowMs = Date.now();
            const out = describePlanItineraryOutcome({
                ...base,
                feasible: false,
                windowEndMs: nowMs + 86400000,
                nowMs,
                fixturesFetched: 5,
                fixturesUpcoming: 0,
                candidateFixturesInWindow: 0
            });
            expect(out.reasonCode).toBe('ALL_FIXTURES_IN_PAST');
            expect(out.userMessage).toMatch(/already kicked off/i);
        });
        it('NO_FEASIBLE_CHAIN only when there are plannable candidates', () => {
            const nowMs = Date.now();
            const out = describePlanItineraryOutcome({
                ...base,
                feasible: false,
                windowEndMs: nowMs + 86400000,
                nowMs,
                fixturesFetched: 4,
                fixturesUpcoming: 4,
                candidateFixturesInWindow: 4
            });
            expect(out.reasonCode).toBe('NO_FEASIBLE_CHAIN');
            expect(out.userMessage).toMatch(/travel and timing limits/i);
        });
        it('NO_FIXTURES_IN_SEARCH when API/bounds returned nothing', () => {
            const nowMs = Date.now();
            const out = describePlanItineraryOutcome({
                ...base,
                feasible: false,
                windowEndMs: nowMs + 86400000,
                nowMs,
                fixturesFetched: 0,
                fixturesUpcoming: 0,
                candidateFixturesInWindow: 0
            });
            expect(out.reasonCode).toBe('NO_FIXTURES_IN_SEARCH');
        });
        it('FEASIBLE when best chain meets minMatches', () => {
            const nowMs = Date.now();
            const out = describePlanItineraryOutcome({
                ...base,
                feasible: true,
                minMatches: 3,
                windowEndMs: nowMs + 86400000,
                nowMs,
                fixturesFetched: 5,
                fixturesUpcoming: 5,
                candidateFixturesInWindow: 5,
                bestItinerary: { matchCount: 3 }
            });
            expect(out.reasonCode).toBe('FEASIBLE');
            expect(out.userMessage).toMatch(/3-match/);
        });
    });
});
