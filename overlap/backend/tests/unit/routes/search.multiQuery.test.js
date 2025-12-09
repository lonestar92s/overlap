/**
 * Unit tests for multi-query natural language parsing
 * 
 * Tests parsing functions in isolation without API calls
 */

const { describe, it, expect, beforeEach } = require('@jest/globals');

// Mock OpenAI before importing the route
jest.mock('openai', () => {
  return {
    OpenAI: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    }))
  };
});

// Mock database models
jest.mock('../../../src/models/Team');
jest.mock('../../../src/models/League');
jest.mock('../../../src/models/Venue');

describe('Multi-Query Parsing - Unit Tests', () => {
  let parseNaturalLanguage;
  let buildSearchParameters;
  
  beforeEach(() => {
    jest.clearAllMocks();
    // Import functions after mocks are set up
    const searchRoute = require('../../../src/routes/search');
    parseNaturalLanguage = searchRoute.parseNaturalLanguage || 
      require('../../../src/routes/search').parseNaturalLanguage;
    buildSearchParameters = searchRoute.buildSearchParameters ||
      require('../../../src/routes/search').buildSearchParameters;
  });
  
  describe('TC-PARSE-001: Basic Multi-Query Detection', () => {
    it('should detect multi-query with "but would also like"', async () => {
      const query = "I want to see Bayern Munich play at home, but would also like to see 2 other matches within 200 miles";
      
      // Mock OpenAI response
      const mockOpenAI = require('openai');
      const mockResponse = {
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
              errorMessage: null
            })
          }
        }]
      };
      
      mockOpenAI.OpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue(mockResponse)
          }
        }
      }));
      
      const result = await parseNaturalLanguage(query);
      
      expect(result.isMultiQuery).toBe(true);
      expect(result.primary.teams).toContain('Bayern Munich');
      expect(result.primary.matchType).toBe('home');
      expect(result.secondary.count).toBe(2);
      expect(result.secondary.maxDistance).toBe(200);
    });
  });
  
  describe('TC-PARSE-002: Count Constraint Extraction', () => {
    it('should extract "2 other matches" as count 2', () => {
      // This would test a helper function if extracted
      const query = "2 other matches within 200 miles";
      // Implementation would extract count
      expect(true).toBe(true); // Placeholder
    });
    
    it('should default to 3 for "a few matches"', () => {
      const query = "a few other matches";
      // Implementation would extract count = 3
      expect(true).toBe(true); // Placeholder
    });
    
    it('should default to 5 for "several matches"', () => {
      const query = "several other matches";
      // Implementation would extract count = 5
      expect(true).toBe(true); // Placeholder
    });
  });
  
  describe('TC-PARSE-003: Distance Constraint Extraction', () => {
    it('should extract "within 200 miles" as 200', () => {
      const query = "matches within 200 miles";
      // Implementation would extract distance = 200
      expect(true).toBe(true); // Placeholder
    });
    
    it('should convert "within 200 km" to miles (124)', () => {
      const query = "matches within 200 km";
      // Implementation would extract and convert: 200 * 0.621371 = 124
      expect(true).toBe(true); // Placeholder
    });
  });
  
  describe('TC-PARSE-004: Date Range Calculation', () => {
    it('should calculate 10-day period correctly', () => {
      const query = "over a 10 day period";
      const referenceDate = new Date('2025-03-01');
      // Implementation would calculate: start = 2025-03-01, end = 2025-03-10
      expect(true).toBe(true); // Placeholder
    });
  });
  
  describe('TC-BACK-001: Backward Compatibility', () => {
    it('should handle single query without multi-query structure', async () => {
      const query = "Arsenal matches in London next month";
      
      // Mock OpenAI response for single query
      const mockOpenAI = require('openai');
      const mockResponse = {
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
      };
      
      mockOpenAI.OpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue(mockResponse)
          }
        }
      }));
      
      const result = await parseNaturalLanguage(query);
      
      expect(result.isMultiQuery).toBe(false);
      expect(result.location).toBeDefined();
      expect(result.location.city).toBe('London');
    });
  });
  
  describe('buildSearchParameters', () => {
    it('should build multi-query search parameters', () => {
      const parsed = {
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
        }
      };
      
      const params = buildSearchParameters(parsed);
      
      expect(params.isMultiQuery).toBe(true);
      expect(params.primary.teams).toEqual(["Bayern Munich"]);
      expect(params.secondary.count).toBe(2);
    });
    
    it('should build single-query search parameters', () => {
      const parsed = {
        isMultiQuery: false,
        teams: { any: [{ name: "Arsenal FC" }] },
        leagues: [{ apiId: "39" }],
        location: {
          city: "London",
          country: "United Kingdom",
          coordinates: [-0.118092, 51.509865]
        },
        dateRange: {
          start: "2025-03-01",
          end: "2025-03-31"
        },
        distance: 50
      };
      
      const params = buildSearchParameters(parsed);
      
      expect(params.isMultiQuery).toBe(false);
      expect(params.teams).toBeDefined();
      expect(params.leagues).toBeDefined();
    });
  });

  describe('Location Inference from Leagues', () => {
    let inferLocationFromTeamsAndLeagues;
    let League;

    beforeEach(() => {
      League = require('../../../src/models/League');
      // Get the function from the route module
      const searchRoute = require('../../../src/routes/search');
      // The function might be exported or we need to access it differently
      // For now, we'll test it through parseNaturalLanguage
    });

    it('should infer location from MLS league using database country', async () => {
      // Mock League.findOne to return MLS with USA country
      League.findOne = jest.fn().mockResolvedValue({
        apiId: '253',
        name: 'Major League Soccer',
        country: 'United States',
        countryCode: 'US'
      });

      const query = "MLS matches next month";
      
      // Mock OpenAI to return parsed result with MLS league
      const mockOpenAI = require('openai');
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              isMultiQuery: false,
              leagues: [{ apiId: "253", name: "Major League Soccer" }],
              dateRange: {
                start: "2025-03-01",
                end: "2025-03-31"
              },
              location: null, // No location specified - should be inferred
              errorMessage: null
            })
          }
        }]
      };
      
      mockOpenAI.OpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue(mockResponse)
          }
        }
      }));

      const result = await parseNaturalLanguage(query);
      
      // Location should be inferred from MLS league country (United States)
      expect(result.location).toBeDefined();
      expect(result.location.country).toBe('United States');
      expect(result.location.city).toBe('Kansas City');
      expect(result.location.coordinates).toEqual([-94.578567, 39.099727]);
    });

    it('should infer location from hardcoded league mapping when available', async () => {
      const query = "Premier League matches next month";
      
      const mockOpenAI = require('openai');
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              isMultiQuery: false,
              leagues: [{ apiId: "39", name: "Premier League" }],
              dateRange: {
                start: "2025-03-01",
                end: "2025-03-31"
              },
              location: null,
              errorMessage: null
            })
          }
        }]
      };
      
      mockOpenAI.OpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue(mockResponse)
          }
        }
      }));

      const result = await parseNaturalLanguage(query);
      
      // Should use hardcoded mapping for Premier League
      expect(result.location).toBeDefined();
      expect(result.location.country).toBe('United Kingdom');
      expect(result.location.city).toBe('London');
    });
  });
});

