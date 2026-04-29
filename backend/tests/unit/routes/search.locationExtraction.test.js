const { describe, it, expect } = require('@jest/globals');

jest.mock('../../../src/models/Team');
jest.mock('../../../src/models/League');
jest.mock('../../../src/models/Venue');

const { extractLocation } = require('../../../src/routes/search');

describe('search.extractLocation', () => {
    it('does not treat city token in team name as explicit location', () => {
        const teams = {
            any: [{ name: 'Manchester United' }]
        };

        const out = extractLocation('Manchester United matches next month', teams);
        expect(out).toBeNull();
    });

    it('treats explicit location phrase as location even with same city team', () => {
        const teams = {
            any: [{ name: 'Manchester United' }]
        };

        const out = extractLocation('Manchester United matches in Manchester next month', teams);
        expect(out).toBeDefined();
        expect(out.city).toBe('Manchester');
    });
});
