/**
 * Unit tests for /api/matches/recommended endpoint
 * Tests the transformation logic for trip recommendations with various data structures
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../../src/app');
const User = require('../../../src/models/User');
const Team = require('../../../src/models/Team');
const Venue = require('../../../src/models/Venue');
const { generateTestToken } = require('../../helpers/testHelpers');

// Mock dependencies
jest.mock('../../../src/models/User');
jest.mock('../../../src/models/Team');
jest.mock('../../../src/models/Venue');
jest.mock('../../../src/services/venueService', () => ({
  getVenueByApiId: jest.fn()
}));

describe('GET /api/matches/recommended', () => {
  let mockUser;
  let mockTrip;
  let authToken;
  let venueService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Get mocked venue service
    venueService = require('../../../src/services/venueService');

    // Create mock user with trip recommendations
    mockUser = {
      _id: new mongoose.Types.ObjectId(),
      email: 'test@example.com',
      preferences: {
        favoriteLeagues: [],
        favoriteTeams: [],
        favoriteVenues: []
      },
      trips: [],
      savedMatches: [],
      recommendationHistory: [],
      visitedStadiums: []
    };

    // Mock User.findById
    User.findById = jest.fn().mockResolvedValue(mockUser);

    // Mock User.findOne for authentication
    User.findOne = jest.fn().mockResolvedValue(mockUser);

    // Generate auth token
    authToken = generateTestToken(mockUser._id.toString());
  });

  describe('Trip Recommendations Transformation', () => {
    it('should transform trip recommendations with complete match data structure', async () => {
      // Setup trip with complete match data
      const completeMatch = {
        id: '12345',
        fixture: {
          id: '12345',
          date: '2026-01-15T15:00:00Z',
          venue: {
            id: '556',
            name: 'Old Trafford',
            city: 'Manchester',
            country: 'England'
          },
          status: { long: 'Not Started', short: 'NS' }
        },
        teams: {
          home: {
            id: 33,
            name: 'Manchester United',
            logo: 'https://example.com/logo.png'
          },
          away: {
            id: 50,
            name: 'Manchester City',
            logo: 'https://example.com/logo2.png'
          }
        },
        league: {
          id: 39,
          name: 'Premier League',
          logo: 'https://example.com/league.png'
        }
      };

      mockTrip = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Test Trip',
        matches: [],
        recommendations: [
          {
            matchId: '12345',
            recommendedForDate: '2026-01-15',
            match: completeMatch,
            score: 150,
            reason: 'Near your match'
          }
        ],
        recommendationsVersion: 'v2',
        recommendationsGeneratedAt: new Date(),
        createdAt: new Date('2026-01-01')
      };

      mockUser.trips = [mockTrip];

      // Mock Team.findOne for ticketing URL lookup
      Team.findOne = jest.fn().mockResolvedValue({
        apiId: '33',
        ticketingUrl: 'https://tickets.example.com'
      });

      // Mock Venue service
      venueService.getVenueByApiId.mockResolvedValue({
        id: '556',
        name: 'Old Trafford',
        city: 'Manchester',
        country: 'England',
        coordinates: [-2.2914, 53.4631]
      });

      const response = await request(app)
        .get('/api/matches/recommended')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 10, days: 30 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.matches).toHaveLength(1);

      const match = response.body.matches[0];
      expect(match.id).toBe('12345');
      expect(match.fixture.date).toBe('2026-01-15T15:00:00Z');
      expect(match.fixture.venue.name).toBe('Old Trafford');
      expect(match.fixture.venue.city).toBe('Manchester');
      expect(match.teams.home.name).toBe('Manchester United');
      expect(match.teams.away.name).toBe('Manchester City');
      expect(match.league.name).toBe('Premier League');
      expect(match._isTripRecommendation).toBe(true);
    });

    it('should handle trip recommendations with missing venue data', async () => {
      // Setup trip with match missing venue data
      const matchWithoutVenue = {
        id: '12346',
        fixture: {
          id: '12346',
          date: '2026-01-16T15:00:00Z'
        },
        teams: {
          home: { id: 33, name: 'Team A' },
          away: { id: 50, name: 'Team B' }
        },
        league: { id: 39, name: 'Premier League' }
      };

      mockTrip = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Test Trip',
        matches: [],
        recommendations: [
          {
            matchId: '12346',
            recommendedForDate: '2026-01-16',
            match: matchWithoutVenue,
            score: 120,
            reason: 'Near your match'
          }
        ],
        recommendationsVersion: 'v2',
        recommendationsGeneratedAt: new Date(),
        createdAt: new Date('2026-01-01')
      };

      mockUser.trips = [mockTrip];

      // Mock Team.findOne
      Team.findOne = jest.fn().mockResolvedValue(null);

      // Mock Venue service to return null (no venue data)
      venueService.getVenueByApiId.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/matches/recommended')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 10, days: 30 });

      expect(response.status).toBe(200);
      const match = response.body.matches[0];
      // Should fallback to 'Unknown Venue' when no venue data available
      expect(match.fixture.venue.name).toBe('Unknown Venue');
      expect(match.teams.home.name).toBe('Team A');
      expect(match.teams.away.name).toBe('Team B');
    });

    it('should handle trip recommendations with alternative data structures', async () => {
      // Setup trip with match using alternative field names
      const alternativeMatch = {
        id: '12347',
        date: '2026-01-17T15:00:00Z', // date at root level
        venue: 'Stadium Name', // venue as string
        homeTeam: 'Home Team Name', // homeTeam as string
        awayTeam: 'Away Team Name', // awayTeam as string
        leagueName: 'League Name', // leagueName at root
        leagueId: 39
      };

      mockTrip = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Test Trip',
        matches: [],
        recommendations: [
          {
            matchId: '12347',
            recommendedForDate: '2026-01-17',
            match: alternativeMatch,
            score: 110,
            reason: 'Near your match'
          }
        ],
        recommendationsVersion: 'v2',
        recommendationsGeneratedAt: new Date(),
        createdAt: new Date('2026-01-01')
      };

      mockUser.trips = [mockTrip];

      // Mock Team.findOne
      Team.findOne = jest.fn().mockResolvedValue(null);

      // Mock Venue service
      venueService.getVenueByApiId.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/matches/recommended')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 10, days: 30 });

      expect(response.status).toBe(200);
      const match = response.body.matches[0];
      // Should use alternative field names
      expect(match.fixture.date).toBe('2026-01-17T15:00:00Z');
      expect(match.fixture.venue.name).toBe('Stadium Name');
      expect(match.teams.home.name).toBe('Home Team Name');
      expect(match.teams.away.name).toBe('Away Team Name');
      expect(match.league.name).toBe('League Name');
    });

    it('should handle trip recommendations with missing team names', async () => {
      // Setup trip with match missing team names
      const matchWithoutTeamNames = {
        id: '12348',
        fixture: {
          id: '12348',
          date: '2026-01-18T15:00:00Z',
          venue: {
            id: '556',
            name: 'Old Trafford'
          }
        },
        teams: {
          home: { id: 33 }, // missing name
          away: { id: 50 }  // missing name
        },
        league: { id: 39, name: 'Premier League' }
      };

      mockTrip = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Test Trip',
        matches: [],
        recommendations: [
          {
            matchId: '12348',
            recommendedForDate: '2026-01-18',
            match: matchWithoutTeamNames,
            score: 100,
            reason: 'Near your match'
          }
        ],
        recommendationsVersion: 'v2',
        recommendationsGeneratedAt: new Date(),
        createdAt: new Date('2026-01-01')
      };

      mockUser.trips = [mockTrip];

      // Mock Team.findOne to return team with name
      Team.findOne = jest.fn().mockImplementation((query) => {
        if (query.apiId === '33') {
          return Promise.resolve({ apiId: '33', name: 'Manchester United' });
        }
        if (query.apiId === '50') {
          return Promise.resolve({ apiId: '50', name: 'Manchester City' });
        }
        return Promise.resolve(null);
      });

      // Mock Venue service
      venueService.getVenueByApiId.mockResolvedValue({
        id: '556',
        name: 'Old Trafford',
        city: 'Manchester'
      });

      const response = await request(app)
        .get('/api/matches/recommended')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 10, days: 30 });

      expect(response.status).toBe(200);
      const match = response.body.matches[0];
      // Should fallback to 'TBD' when team names are missing
      expect(match.teams.home.name).toBe('TBD');
      expect(match.teams.away.name).toBe('TBD');
    });

    it('should handle trip recommendations with missing date', async () => {
      // Setup trip with match missing date
      const matchWithoutDate = {
        id: '12349',
        fixture: {
          id: '12349'
          // missing date
        },
        teams: {
          home: { id: 33, name: 'Team A' },
          away: { id: 50, name: 'Team B' }
        },
        league: { id: 39, name: 'Premier League' },
        venue: {
          id: '556',
          name: 'Old Trafford'
        }
      };

      mockTrip = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Test Trip',
        matches: [],
        recommendations: [
          {
            matchId: '12349',
            recommendedForDate: '2026-01-19',
            match: matchWithoutDate,
            score: 90,
            reason: 'Near your match'
          }
        ],
        recommendationsVersion: 'v2',
        recommendationsGeneratedAt: new Date(),
        createdAt: new Date('2026-01-01')
      };

      mockUser.trips = [mockTrip];

      // Mock Team.findOne
      Team.findOne = jest.fn().mockResolvedValue(null);

      // Mock Venue service
      venueService.getVenueByApiId.mockResolvedValue({
        id: '556',
        name: 'Old Trafford',
        city: 'Manchester'
      });

      const response = await request(app)
        .get('/api/matches/recommended')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 10, days: 30 });

      expect(response.status).toBe(200);
      const match = response.body.matches[0];
      // Should handle missing date gracefully (null is acceptable)
      expect(match.fixture.date).toBeNull();
      expect(match.fixture.venue.name).toBe('Old Trafford');
    });

    it('should handle trip recommendations with teams as strings', async () => {
      // Setup trip with match where teams are strings
      const matchWithStringTeams = {
        id: '12350',
        fixture: {
          id: '12350',
          date: '2026-01-20T15:00:00Z',
          venue: {
            id: '556',
            name: 'Old Trafford'
          }
        },
        teams: {
          home: 'Home Team String', // team as string
          away: 'Away Team String'  // team as string
        },
        league: { id: 39, name: 'Premier League' }
      };

      mockTrip = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Test Trip',
        matches: [],
        recommendations: [
          {
            matchId: '12350',
            recommendedForDate: '2026-01-20',
            match: matchWithStringTeams,
            score: 80,
            reason: 'Near your match'
          }
        ],
        recommendationsVersion: 'v2',
        recommendationsGeneratedAt: new Date(),
        createdAt: new Date('2026-01-01')
      };

      mockUser.trips = [mockTrip];

      // Mock Team.findOne
      Team.findOne = jest.fn().mockResolvedValue(null);

      // Mock Venue service
      venueService.getVenueByApiId.mockResolvedValue({
        id: '556',
        name: 'Old Trafford',
        city: 'Manchester'
      });

      const response = await request(app)
        .get('/api/matches/recommended')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 10, days: 30 });

      expect(response.status).toBe(200);
      const match = response.body.matches[0];
      // Should handle teams as strings
      expect(match.teams.home.name).toBe('Home Team String');
      expect(match.teams.away.name).toBe('Away Team String');
    });

    it('should handle multiple trip recommendations and transform all correctly', async () => {
      // Setup trip with multiple recommendations
      mockTrip = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Test Trip',
        matches: [],
        recommendations: [
          {
            matchId: '12351',
            recommendedForDate: '2026-01-21',
            match: {
              id: '12351',
              fixture: {
                id: '12351',
                date: '2026-01-21T15:00:00Z',
                venue: { id: '556', name: 'Venue 1' }
              },
              teams: {
                home: { id: 33, name: 'Team A' },
                away: { id: 50, name: 'Team B' }
              },
              league: { id: 39, name: 'League 1' }
            },
            score: 150,
            reason: 'Reason 1'
          },
          {
            matchId: '12352',
            recommendedForDate: '2026-01-22',
            match: {
              id: '12352',
              date: '2026-01-22T15:00:00Z', // alternative structure
              venue: 'Venue 2', // string venue
              homeTeam: 'Team C', // alternative structure
              awayTeam: 'Team D',
              leagueName: 'League 2'
            },
            score: 140,
            reason: 'Reason 2'
          }
        ],
        recommendationsVersion: 'v2',
        recommendationsGeneratedAt: new Date(),
        createdAt: new Date('2026-01-01')
      };

      mockUser.trips = [mockTrip];

      // Mock Team.findOne
      Team.findOne = jest.fn().mockResolvedValue(null);

      // Mock Venue service
      venueService.getVenueByApiId.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/matches/recommended')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 10, days: 30 });

      expect(response.status).toBe(200);
      expect(response.body.matches).toHaveLength(2);
      
      // First match should use standard structure
      expect(response.body.matches[0].id).toBe('12351');
      expect(response.body.matches[0].fixture.venue.name).toBe('Venue 1');
      expect(response.body.matches[0].teams.home.name).toBe('Team A');
      
      // Second match should use alternative structure
      expect(response.body.matches[1].id).toBe('12352');
      expect(response.body.matches[1].fixture.venue.name).toBe('Venue 2');
      expect(response.body.matches[1].teams.home.name).toBe('Team C');
      expect(response.body.matches[1].league.name).toBe('League 2');
    });

    it('should handle errors gracefully when transforming recommendations', async () => {
      // Setup trip with invalid match data that will cause an error
      mockTrip = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Test Trip',
        matches: [],
        recommendations: [
          {
            matchId: 'invalid',
            recommendedForDate: '2026-01-23',
            match: null, // null match will cause issues
            score: 70,
            reason: 'Reason'
          }
        ],
        recommendationsVersion: 'v2',
        recommendationsGeneratedAt: new Date(),
        createdAt: new Date('2026-01-01')
      };

      mockUser.trips = [mockTrip];

      // Mock Team.findOne
      Team.findOne = jest.fn().mockResolvedValue(null);

      // Mock Venue service
      venueService.getVenueByApiId.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/matches/recommended')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 10, days: 30 });

      // Should still return 200, but with empty or filtered matches
      expect(response.status).toBe(200);
      // The invalid recommendation should be skipped
      expect(response.body.matches.length).toBeLessThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/matches/recommended')
        .query({ limit: 10, days: 30 });

      expect(response.status).toBe(401);
    });

    it('should return 404 when user not found', async () => {
      User.findById = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .get('/api/matches/recommended')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 10, days: 30 });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', 'User not found');
    });
  });
});

