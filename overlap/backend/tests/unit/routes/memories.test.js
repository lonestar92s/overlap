/**
 * Unit tests for /api/memories - GET returns memories, stats, and visitedStadiums derived from memories
 */
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../../src/app');
const User = require('../../../src/models/User');
const { generateTestToken } = require('../../helpers/testHelpers');

jest.mock('../../../src/models/User');

describe('GET /api/memories', () => {
  let mockUser;
  let authToken;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = {
      _id: new mongoose.Types.ObjectId(),
      id: null,
      attendedMatches: [],
      save: jest.fn().mockResolvedValue(true)
    };
    mockUser.id = mockUser._id.toString();
    User.findById = jest.fn().mockResolvedValue(mockUser);
    User.findOne = jest.fn().mockResolvedValue(mockUser);
    authToken = generateTestToken(mockUser._id.toString());
  });

  it('returns success with data, stats, and visitedStadiums', async () => {
    mockUser.attendedMatches = [];
    const response = await request(app)
      .get('/api/memories')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('stats');
    expect(response.body).toHaveProperty('visitedStadiums');
    expect(Array.isArray(response.body.visitedStadiums)).toBe(true);
    expect(response.body.visitedStadiums).toHaveLength(0);
  });

  it('derives visitedStadiums from memories with no duplicates', async () => {
    mockUser.attendedMatches = [
      {
        _id: new mongoose.Types.ObjectId(),
        matchId: 'm1',
        matchType: 'manual',
        homeTeam: { name: 'Arsenal' },
        awayTeam: { name: 'Chelsea' },
        venue: { name: 'Emirates Stadium', city: 'London', country: 'England' },
        competition: 'Premier League',
        date: new Date('2024-01-01')
      },
      {
        _id: new mongoose.Types.ObjectId(),
        matchId: 'm2',
        matchType: 'manual',
        homeTeam: { name: 'Arsenal' },
        awayTeam: { name: 'Spurs' },
        venue: { name: 'Emirates Stadium', city: 'London', country: 'England' },
        competition: 'Premier League',
        date: new Date('2024-02-01')
      },
      {
        _id: new mongoose.Types.ObjectId(),
        matchId: 'm3',
        matchType: 'manual',
        homeTeam: { name: 'West Ham' },
        awayTeam: { name: 'Chelsea' },
        venue: { name: 'London Stadium', city: 'London', country: 'England' },
        competition: 'Premier League',
        date: new Date('2024-03-01')
      }
    ];

    const response = await request(app)
      .get('/api/memories')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.visitedStadiums).toHaveLength(2);

    const emirates = response.body.visitedStadiums.find(s => s.venueName === 'Emirates Stadium');
    const londonStadium = response.body.visitedStadiums.find(s => s.venueName === 'London Stadium');
    expect(emirates).toBeDefined();
    expect(emirates.visitCount).toBe(2);
    expect(emirates.city).toBe('London');
    expect(emirates.country).toBe('England');
    expect(londonStadium).toBeDefined();
    expect(londonStadium.visitCount).toBe(1);
  });

  it('normalizes stadium key by name+city+country (case/trim)', async () => {
    mockUser.attendedMatches = [
      {
        _id: new mongoose.Types.ObjectId(),
        matchId: 'm1',
        matchType: 'manual',
        homeTeam: { name: 'A' },
        awayTeam: { name: 'B' },
        venue: { name: '  Emirates Stadium  ', city: 'London', country: 'England' },
        date: new Date()
      },
      {
        _id: new mongoose.Types.ObjectId(),
        matchId: 'm2',
        matchType: 'manual',
        homeTeam: { name: 'A' },
        awayTeam: { name: 'B' },
        venue: { name: 'Emirates Stadium', city: ' London ', country: 'England' },
        date: new Date()
      }
    ];

    const response = await request(app)
      .get('/api/memories')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body.visitedStadiums).toHaveLength(1);
    expect(response.body.visitedStadiums[0].venueName).toBe('Emirates Stadium');
    expect(response.body.visitedStadiums[0].visitCount).toBe(2);
  });

  it('skips memories without venue name', async () => {
    mockUser.attendedMatches = [
      {
        _id: new mongoose.Types.ObjectId(),
        matchId: 'm1',
        matchType: 'manual',
        homeTeam: { name: 'A' },
        awayTeam: { name: 'B' },
        venue: { city: 'London', country: 'England' },
        date: new Date()
      }
    ];

    const response = await request(app)
      .get('/api/memories')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body.visitedStadiums).toHaveLength(0);
  });

  it('returns 401 when not authenticated', async () => {
    const response = await request(app).get('/api/memories');
    expect(response.status).toBe(401);
  });
});
