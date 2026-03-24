const { describe, it, expect, beforeEach } = require('@jest/globals');

jest.mock('openai', () => {
  const MockOpenAI = jest.fn().mockImplementation(() => ({
    chat: { completions: { create: jest.fn() } }
  }));
  MockOpenAI.OpenAI = MockOpenAI;
  MockOpenAI.default = MockOpenAI;
  return MockOpenAI;
});

jest.mock('../../../src/models/Team');
jest.mock('../../../src/models/League');
jest.mock('../../../src/models/Venue');
jest.mock('../../../src/services/teamService', () => ({
  searchTeams: jest.fn()
}));

const teamService = require('../../../src/services/teamService');
const {
  inferLeagueIdsFromTeamDocs,
  resolveLeagueIdsFromTeams,
  determineSeasonForCompetitions
} = require('../../../src/routes/search');

describe('search league and season inference', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('infers league ids directly from team document leagues', () => {
    const ids = inferLeagueIdsFromTeamDocs({
      any: [
        { name: 'Chicago Fire', leagues: [{ leagueId: '253' }] },
        { name: 'Inter Miami', leagues: [{ leagueId: '253' }] }
      ]
    });
    expect(ids).toEqual(['253']);
  });

  it('resolves league ids via teamService when parsed team has no leagues', async () => {
    teamService.searchTeams.mockResolvedValue([
      { name: 'Chicago Fire', leagues: [{ leagueId: '253' }] }
    ]);
    const ids = await resolveLeagueIdsFromTeams({
      any: [{ name: 'Chicago Fire' }]
    });
    expect(teamService.searchTeams).toHaveBeenCalled();
    expect(ids).toContain('253');
  });

  it('uses calendar season year for MLS', () => {
    const season = determineSeasonForCompetitions('2026-04-01', ['253']);
    expect(season).toBe(2026);
  });

  it('uses split-season logic for Premier League in April', () => {
    const season = determineSeasonForCompetitions('2026-04-01', ['39']);
    expect(season).toBe(2025);
  });
});
