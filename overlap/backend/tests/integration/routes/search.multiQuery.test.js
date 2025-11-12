/**
 * Integration tests for multi-query natural language search API endpoint
 * 
 * Tests the full API endpoint with database and external API mocks
 */

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');

// Mock OpenAI
jest.mock('openai', () => {
  return {
    OpenAI: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{
              message: {
                content: JSON.stringify({
                  isMultiQuery: true,
                  primary: {
                    teams: ["Bayern Munich"],
                    matchType: "home",
                    leagues: []
                  },
                  secondary: {
                    count: 2,
                    leagues: [79, 218],
                    maxDistance: 200,
                    excludePrimary: true
                  },
                  relationship: {
                    distanceFrom: "primary",
                    dateRange: {
                      start: "2025-03-01",
                      end: "2025-03-10"
                    }
                  },
                  errorMessage: null,
                  suggestions: []
                })
              }
            }]
          })
        }
      }
    }))
  };
});

// Mock external APIs
jest.mock('axios');
const axios = require('axios');

// Create test app
const app = express();
app.use(express.json());

// Import search routes
const searchRoutes = require('../../../src/routes/search');
app.use('/api/search', searchRoutes);

describe('Multi-Query Search API - Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('POST /api/search/natural-language', () => {
    describe('TC-EXEC-001: Successful Multi-Query', () => {
      it('should return multi-query response structure', async () => {
        // Mock match data
        const mockMatches = [
          {
            fixture: {
              id: 12345,
              date: "2025-03-05T18:30:00Z",
              venue: {
                id: 192,
                name: "Allianz Arena",
                city: "Munich",
                coordinates: [11.6247, 48.2188]
              }
            },
            teams: {
              home: { id: 157, name: "Bayern Munich" },
              away: { id: 165, name: "Borussia Dortmund" }
            },
            league: { id: 78, name: "Bundesliga" }
          },
          {
            fixture: {
              id: 12346,
              date: "2025-03-06T17:30:00Z",
              venue: {
                id: 201,
                name: "Max-Morlock-Stadion",
                city: "Nuremberg",
                coordinates: [11.1245, 49.4267]
              }
            },
            teams: {
              home: { id: 170, name: "1. FC Nürnberg" },
              away: { id: 171, name: "FC St. Pauli" }
            },
            league: { id: 79, name: "Bundesliga 2" }
          }
        ];
        
        // Mock axios for API calls
        axios.get = jest.fn().mockResolvedValue({
          data: {
            response: mockMatches
          }
        });
        
        const response = await request(app)
          .post('/api/search/natural-language')
          .send({
            query: "I want to see Bayern Munich play at home, but would also like to see 2 other matches within 200 miles over a 10 day period. The other matches can be bundesliga 2 or austrian bundesliga"
          });
        
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('isMultiQuery');
        
        if (response.body.isMultiQuery) {
          expect(response.body.matches).toHaveProperty('primary');
          expect(response.body.matches).toHaveProperty('secondary');
          expect(Array.isArray(response.body.matches.secondary)).toBe(true);
        }
      });
    });
    
    describe('TC-BACK-001: Single Query Backward Compatibility', () => {
      it('should return single-query response for non-multi queries', async () => {
        // Mock OpenAI for single query
        const { OpenAI } = require('openai');
        OpenAI.mockImplementation(() => ({
          chat: {
            completions: {
              create: jest.fn().mockResolvedValue({
                choices: [{
                  message: {
                    content: JSON.stringify({
                      isMultiQuery: false,
                      location: {
                        city: "London",
                        country: "United Kingdom",
                        coordinates: [-0.118092, 51.509865]
                      },
                      dateRange: {
                        start: "2025-03-01",
                        end: "2025-03-31"
                      },
                      teams: ["Arsenal FC"],
                      leagues: [39],
                      maxDistance: 50,
                      errorMessage: null
                    })
                  }
                }]
              })
            }
          }
        }));
        
        const response = await request(app)
          .post('/api/search/natural-language')
          .send({
            query: "Arsenal matches in London next month"
          });
        
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.isMultiQuery).toBe(false);
        expect(Array.isArray(response.body.matches)).toBe(true);
      });
    });
    
    describe('TC-ERROR-001: Parsing Failure', () => {
      it('should return error response for invalid query', async () => {
        // Mock OpenAI to return error
        const { OpenAI } = require('openai');
        OpenAI.mockImplementation(() => ({
          chat: {
            completions: {
              create: jest.fn().mockResolvedValue({
                choices: [{
                  message: {
                    content: JSON.stringify({
                      errorMessage: "I couldn't understand your query",
                      confidence: 0,
                      suggestions: [
                        "Try mentioning specific team names",
                        "Include a league name"
                      ]
                    })
                  }
                }]
              })
            }
          }
        }));
        
        const response = await request(app)
          .post('/api/search/natural-language')
          .send({
            query: "asdfghjkl random text"
          });
        
        expect(response.status).toBe(200); // API returns 200 with error in body
        expect(response.body.success).toBe(false);
        expect(response.body).toHaveProperty('message');
        expect(response.body).toHaveProperty('suggestions');
      });
    });
    
    describe('TC-ERROR-002: Missing Query', () => {
      it('should return 400 for missing query', async () => {
        const response = await request(app)
          .post('/api/search/natural-language')
          .send({});
        
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
      });
    });
  });
});

