# Multi-Query Search API Contract

## Overview

This document defines the API contract for multi-query natural language search responses. The contract ensures consistency between frontend and backend, maintains backward compatibility, and provides clear structure for complex query results.

---

## Endpoint

**POST** `/api/search/natural-language`

**Request Body**:
```json
{
  "query": "string",
  "conversationHistory": [
    {
      "isBot": boolean,
      "data": object
    }
  ]
}
```

---

## Response Structure

### Single Query Response (Backward Compatible)

**When**: `isMultiQuery: false` or field absent

```json
{
  "success": true,
  "query": "Arsenal matches in London next month",
  "confidence": 85,
  "message": "Found 12 matches for Arsenal in London between March 1-31, 2025",
  "isMultiQuery": false,
  "parsed": {
    "teams": [
      { "name": "Arsenal FC", "id": "42" }
    ],
    "leagues": [
      { "apiId": "39", "name": "Premier League", "country": "England" }
    ],
    "location": {
      "city": "London",
      "country": "United Kingdom",
      "coordinates": [-0.118092, 51.509865]
    },
    "dateRange": {
      "start": "2025-03-01",
      "end": "2025-03-31"
    },
    "distance": 50
  },
  "preSelectedFilters": {
    "country": "United Kingdom",
    "leagues": ["Premier League"],
    "teams": ["Arsenal FC"]
  },
  "matches": [
    {
      "fixture": {
        "id": 12345,
        "date": "2025-03-15T15:00:00Z",
        "venue": {
          "id": 214,
          "name": "Emirates Stadium",
          "city": "London",
          "coordinates": [-0.108262, 51.554888]
        }
      },
      "teams": {
        "home": {
          "id": 42,
          "name": "Arsenal FC",
          "logo": "https://..."
        },
        "away": {
          "id": 50,
          "name": "Chelsea FC",
          "logo": "https://..."
        }
      },
      "league": {
        "id": 39,
        "name": "Premier League",
        "country": "England"
      }
    }
  ],
  "count": 12
}
```

---

### Multi-Query Response (New)

**When**: `isMultiQuery: true`

```json
{
  "success": true,
  "query": "I want to see Bayern Munich play at home, but would also like to see 2 other matches within 200 miles over a 10 day period. The other matches can be bundesliga 2 or austrian bundesliga",
  "confidence": 90,
  "message": "Found Bayern Munich home match on March 5, 2025, and 2 additional matches within 200 miles: 1. FC Nürnberg (45 miles) and RB Salzburg (187 miles)",
  "isMultiQuery": true,
  "parsed": {
    "primary": {
      "teams": [
        { "name": "Bayern Munich", "id": "157" }
      ],
      "matchType": "home",
      "leagues": []
    },
    "secondary": {
      "count": 2,
      "leagues": [
        { "apiId": "79", "name": "Bundesliga 2", "country": "Germany" },
        { "apiId": "218", "name": "Austrian Bundesliga", "country": "Austria" }
      ],
      "maxDistance": 200,
      "excludePrimary": true
    },
    "relationship": {
      "distanceFrom": "primary",
      "dateRange": {
        "start": "2025-03-01",
        "end": "2025-03-10"
      }
    }
  },
  "matches": {
    "primary": {
      "fixture": {
        "id": 12345,
        "date": "2025-03-05T18:30:00Z",
        "venue": {
          "id": 192,
          "name": "Allianz Arena",
          "city": "Munich",
          "coordinates": [11.6247, 48.2188]
        }
      },
      "teams": {
        "home": {
          "id": 157,
          "name": "Bayern Munich",
          "logo": "https://..."
        },
        "away": {
          "id": 165,
          "name": "Borussia Dortmund",
          "logo": "https://..."
        }
      },
      "league": {
        "id": 78,
        "name": "Bundesliga",
        "country": "Germany"
      }
    },
    "secondary": [
      {
        "fixture": {
          "id": 12346,
          "date": "2025-03-06T17:30:00Z",
          "venue": {
            "id": 201,
            "name": "Max-Morlock-Stadion",
            "city": "Nuremberg",
            "coordinates": [11.1245, 49.4267]
          }
        },
        "teams": {
          "home": {
            "id": 170,
            "name": "1. FC Nürnberg",
            "logo": "https://..."
          },
          "away": {
            "id": 171,
            "name": "FC St. Pauli",
            "logo": "https://..."
          }
        },
        "league": {
          "id": 79,
          "name": "Bundesliga 2",
          "country": "Germany"
        },
        "distanceFromPrimary": 45.2,
        "distanceUnit": "miles"
      },
      {
        "fixture": {
          "id": 12347,
          "date": "2025-03-07T19:00:00Z",
          "venue": {
            "id": 215,
            "name": "Red Bull Arena",
            "city": "Salzburg",
            "coordinates": [13.0450, 47.8200]
          }
        },
        "teams": {
          "home": {
            "id": 571,
            "name": "RB Salzburg",
            "logo": "https://..."
          },
          "away": {
            "id": 572,
            "name": "Rapid Vienna",
            "logo": "https://..."
          }
        },
        "league": {
          "id": 218,
          "name": "Austrian Bundesliga",
          "country": "Austria"
        },
        "distanceFromPrimary": 187.3,
        "distanceUnit": "miles"
      }
    ]
  },
  "relationship": {
    "dateRange": {
      "start": "2025-03-01",
      "end": "2025-03-10"
    },
    "primaryVenue": {
      "id": 192,
      "name": "Allianz Arena",
      "city": "Munich",
      "coordinates": [11.6247, 48.2188]
    },
    "distances": [
      {
        "matchId": 12346,
        "distance": 45.2,
        "unit": "miles"
      },
      {
        "matchId": 12347,
        "distance": 187.3,
        "unit": "miles"
      }
    ]
  },
  "count": 3,
  "preSelectedFilters": {
    "country": "Germany",
    "leagues": ["Bundesliga", "Bundesliga 2", "Austrian Bundesliga"],
    "teams": ["Bayern Munich"]
  }
}
```

---

## Field Definitions

### Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `success` | boolean | Yes | Whether the query was successfully parsed and executed |
| `query` | string | Yes | The original user query |
| `confidence` | number | Yes | Confidence score (0-100) |
| `message` | string | Yes | Human-readable response message |
| `isMultiQuery` | boolean | Yes | Whether this is a multi-query response |
| `parsed` | object | Yes | Parsed query structure (see below) |
| `matches` | object/array | Yes | Match results (structure depends on `isMultiQuery`) |
| `count` | number | Yes | Total number of matches returned |
| `preSelectedFilters` | object | No | Filters to pre-select in UI |
| `suggestions` | array | No | Suggestions for refining search |

---

### Parsed Structure (Single Query)

```typescript
{
  teams: Array<{ name: string, id: string }>,
  leagues: Array<{ apiId: string, name: string, country: string }>,
  location: {
    city: string,
    country: string,
    coordinates: [number, number] // [longitude, latitude]
  },
  dateRange: {
    start: string, // YYYY-MM-DD
    end: string    // YYYY-MM-DD
  },
  distance: number // miles
}
```

---

### Parsed Structure (Multi-Query)

```typescript
{
  primary: {
    teams: Array<{ name: string, id: string }>,
    matchType: "home" | "away" | null,
    leagues: Array<{ apiId: string, name: string, country: string }>
  },
  secondary: {
    count: number,
    leagues: Array<{ apiId: string, name: string, country: string }>,
    maxDistance: number, // miles
    excludePrimary: boolean
  },
  relationship: {
    distanceFrom: "primary" | "location",
    dateRange: {
      start: string, // YYYY-MM-DD
      end: string    // YYYY-MM-DD
    }
  }
}
```

---

### Matches Structure (Single Query)

**Type**: `Array<Match>`

Standard array of match objects (existing structure).

---

### Matches Structure (Multi-Query)

**Type**: `{ primary: Match, secondary: Array<Match> }`

```typescript
{
  primary: Match,
  secondary: Array<Match & {
    distanceFromPrimary: number,
    distanceUnit: "miles" | "km"
  }>
}
```

**Primary Match**: Single match object (standard structure)

**Secondary Matches**: Array of match objects with additional fields:
- `distanceFromPrimary`: Distance from primary match venue (number)
- `distanceUnit`: Unit of distance measurement ("miles" or "km")

---

### Relationship Object (Multi-Query Only)

```typescript
{
  dateRange: {
    start: string, // YYYY-MM-DD
    end: string    // YYYY-MM-DD
  },
  primaryVenue: {
    id: number,
    name: string,
    city: string,
    coordinates: [number, number] // [longitude, latitude]
  },
  distances: Array<{
    matchId: number,
    distance: number,
    unit: "miles" | "km"
  }>
}
```

---

## Error Responses

### Parsing Error

```json
{
  "success": false,
  "query": "some invalid query",
  "confidence": 0,
  "message": "I couldn't understand your query. Please try being more specific!",
  "error": "PARSE_ERROR",
  "suggestions": [
    "Try mentioning specific team names",
    "Include a league name (e.g., Premier League, La Liga)",
    "Add a location or city name",
    "Specify a date range"
  ]
}
```

### No Primary Match Found

```json
{
  "success": false,
  "query": "Bayern Munich home matches",
  "confidence": 85,
  "message": "I couldn't find any Bayern Munich home matches in the specified date range. Would you like to search for away matches or a different date range?",
  "error": "NO_PRIMARY_MATCH",
  "parsed": {
    "primary": {
      "teams": [{ "name": "Bayern Munich", "id": "157" }],
      "matchType": "home"
    }
  },
  "suggestions": [
    "Try searching for away matches",
    "Expand the date range",
    "Search for matches in a different league"
  ]
}
```

### Insufficient Secondary Matches

```json
{
  "success": true,
  "query": "...",
  "confidence": 90,
  "message": "Found Bayern Munich home match, but only 1 additional match within 200 miles (requested 2). Showing available matches.",
  "isMultiQuery": true,
  "matches": {
    "primary": { /* ... */ },
    "secondary": [
      { /* ... */ }
    ]
  },
  "count": 2,
  "warning": "INSUFFICIENT_SECONDARY_MATCHES",
  "requestedCount": 2,
  "foundCount": 1
}
```

---

## Backward Compatibility

### Detection Logic

Frontend should check for `isMultiQuery` field:

```javascript
if (response.isMultiQuery) {
  // Handle multi-query structure
  const primaryMatch = response.matches.primary;
  const secondaryMatches = response.matches.secondary;
} else {
  // Handle single-query structure (existing logic)
  const matches = response.matches; // Array
}
```

### Fallback Behavior

If `isMultiQuery` is absent or `false`:
- Treat as single query
- `matches` is an array
- Use existing UI components

---

## Frontend Integration

### React Native Example

```javascript
const handleSearchResponse = (response) => {
  if (response.isMultiQuery) {
    // Multi-query UI
    return (
      <View>
        <PrimaryMatchCard match={response.matches.primary} />
        <Text>Additional Matches ({response.matches.secondary.length})</Text>
        {response.matches.secondary.map((match, index) => (
          <SecondaryMatchCard 
            key={match.fixture.id}
            match={match}
            distance={match.distanceFromPrimary}
          />
        ))}
      </View>
    );
  } else {
    // Single-query UI (existing)
    return (
      <View>
        {response.matches.map((match) => (
          <MatchCard key={match.fixture.id} match={match} />
        ))}
      </View>
    );
  }
};
```

---

## Validation Rules

### Required Fields (Multi-Query)

- `matches.primary` must exist and be a valid match object
- `matches.secondary` must be an array (can be empty)
- `relationship.dateRange` must exist
- `relationship.primaryVenue` must exist
- `relationship.distances` must exist and match secondary matches

### Validation Checks

1. **Primary Match**: Must have valid `fixture.id`, `teams`, `league`
2. **Secondary Matches**: Each must have `distanceFromPrimary` field
3. **Distance Consistency**: `relationship.distances` must match `matches.secondary` array
4. **Count Consistency**: `matches.secondary.length` should match `parsed.secondary.count` (when possible)
5. **Date Range**: All matches must fall within `relationship.dateRange`

---

## Versioning

### Current Version

**v1.0** - Initial multi-query support

### Future Versions

**v1.1** (Planned):
- Support for multiple primary matches
- Support for multiple distance constraints
- Support for date range per match set

---

## Testing Checklist

- [ ] Single query response (backward compatible)
- [ ] Multi-query response with primary + secondary matches
- [ ] Multi-query response with no secondary matches found
- [ ] Multi-query response with insufficient secondary matches
- [ ] Error response (parsing failure)
- [ ] Error response (no primary match)
- [ ] Response with missing optional fields
- [ ] Response validation (all required fields present)
- [ ] Distance calculation accuracy
- [ ] Date range consistency

---

## Examples

### Example 1: Successful Multi-Query

**Query**: "I want to see Bayern Munich play at home, but would also like to see 2 other matches within 200 miles over a 10 day period. The other matches can be bundesliga 2 or austrian bundesliga"

**Response**: See "Multi-Query Response" section above

### Example 2: Single Query (Backward Compatible)

**Query**: "Arsenal matches in London next month"

**Response**: See "Single Query Response" section above

### Example 3: Partial Success

**Query**: "Bayern Munich home + 5 other matches within 50 miles"

**Response**: 
```json
{
  "success": true,
  "message": "Found Bayern Munich home match, but only 2 additional matches within 50 miles (requested 5). Showing available matches.",
  "matches": {
    "primary": { /* ... */ },
    "secondary": [ /* 2 matches */ ]
  },
  "count": 3,
  "warning": "INSUFFICIENT_SECONDARY_MATCHES",
  "requestedCount": 5,
  "foundCount": 2
}
```

---

## Notes

1. **Distance Units**: Always use miles for consistency. Frontend can convert to km if needed.
2. **Date Format**: Always use ISO 8601 date format (YYYY-MM-DD) for dates.
3. **Coordinates**: Always use [longitude, latitude] format (GeoJSON standard).
4. **Match IDs**: Use fixture.id from API as unique identifier.
5. **Empty Arrays**: Use empty arrays `[]` instead of `null` for missing secondary matches.

