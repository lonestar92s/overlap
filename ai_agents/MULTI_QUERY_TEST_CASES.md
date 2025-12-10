# Multi-Query Search Test Cases

## Overview

This document contains comprehensive test cases for multi-query natural language search functionality. Test cases cover parsing, execution, edge cases, and error handling.

---

## Test Case Categories

1. **Parsing Tests** - Verify query parsing accuracy
2. **Execution Tests** - Verify search execution and results
3. **Edge Cases** - Handle unusual inputs and scenarios
4. **Error Handling** - Verify error responses
5. **Backward Compatibility** - Ensure single queries still work
6. **Integration Tests** - End-to-end functionality

---

## 1. Parsing Tests

### TC-PARSE-001: Basic Multi-Query Detection

**Query**: "I want to see Bayern Munich play at home, but would also like to see 2 other matches within 200 miles over a 10 day period. The other matches can be bundesliga 2 or austrian bundesliga"

**Expected Parse Result**:
```json
{
  "isMultiQuery": true,
  "primary": {
    "teams": ["Bayern Munich"],
    "matchType": "home",
    "leagues": []
  },
  "secondary": {
    "count": 2,
    "leagues": [79, 218],
    "maxDistance": 200,
    "excludePrimary": true
  },
  "relationship": {
    "distanceFrom": "primary",
    "dateRange": {
      "start": "2025-03-01",
      "end": "2025-03-10"
    }
  },
  "confidence": 90
}
```

**Assertions**:
- `isMultiQuery` = true
- `primary.teams` contains "Bayern Munich"
- `primary.matchType` = "home"
- `secondary.count` = 2
- `secondary.leagues` = [79, 218]
- `secondary.maxDistance` = 200
- `relationship.distanceFrom` = "primary"
- Date range spans 10 days

---

### TC-PARSE-002: Count Constraint Variations

**Test Cases**:

| Query | Expected Count |
|-------|---------------|
| "2 other matches" | 2 |
| "a few other matches" | 3 |
| "several other matches" | 5 |
| "some other matches" | 3 |
| "other matches" (no number) | 3 (default) |
| "5 additional matches" | 5 |
| "3 more matches" | 3 |

**Assertions**:
- Count extracted correctly
- Default to 3 if no number specified

---

### TC-PARSE-003: Distance Constraint Variations

**Test Cases**:

| Query | Expected Distance (miles) |
|-------|---------------------------|
| "within 200 miles" | 200 |
| "within 200 km" | 124 (converted) |
| "200 miles away" | 200 |
| "within 50 miles" | 50 |
| "within 100 km" | 62 (converted) |

**Assertions**:
- Distance extracted correctly
- Kilometers converted to miles
- Default to 200 if not specified (for secondary matches)

---

### TC-PARSE-004: Date Range Variations

**Test Cases**:

| Query | Expected Date Range |
|-------|---------------------|
| "over a 10 day period" | 10 days from today |
| "over 10 days" | 10 days from today |
| "over a 7 day period starting March 1" | March 1-7, 2025 |
| "over 2 weeks" | 14 days from today |

**Assertions**:
- Date range calculated correctly
- Handles explicit start dates
- Handles relative dates ("from today")

---

### TC-PARSE-005: League Filter Variations

**Test Cases**:

| Query | Expected Leagues |
|-------|------------------|
| "bundesliga 2 or austrian bundesliga" | [79, 218] |
| "premier league and championship" | [39, 40] |
| "la liga or serie a" | [140, 135] |
| "championship matches" | [40] |

**Assertions**:
- Multiple leagues parsed correctly
- "or" vs "and" handled correctly
- League names mapped to correct IDs

---

### TC-PARSE-006: Match Type Variations

**Test Cases**:

| Query | Expected Match Type |
|-------|---------------------|
| "Bayern Munich at home" | "home" |
| "Bayern Munich home matches" | "home" |
| "Arsenal away matches" | "away" |
| "Liverpool play away" | "away" |
| "Manchester United matches" | null (both) |

**Assertions**:
- "at home" / "home" → "home"
- "away" → "away"
- No specification → null (both)

---

### TC-PARSE-007: Complex Multi-Query

**Query**: "I want to see Real Madrid play at home in March, but would also like to see 3 other matches within 150 miles over a 2 week period. The other matches should be from La Liga 2 or Segunda Division, and they should be on weekends only."

**Expected Parse Result**:
```json
{
  "isMultiQuery": true,
  "primary": {
    "teams": ["Real Madrid"],
    "matchType": "home",
    "leagues": []
  },
  "secondary": {
    "count": 3,
    "leagues": [141, 140], // La Liga 2, Segunda Division
    "maxDistance": 150,
    "excludePrimary": true,
    "weekendOnly": true // NEW: Weekend filter
  },
  "relationship": {
    "distanceFrom": "primary",
    "dateRange": {
      "start": "2025-03-01",
      "end": "2025-03-14"
    }
  }
}
```

**Note**: Weekend filter is future enhancement, may not be in Phase 1.

---

## 2. Execution Tests

### TC-EXEC-001: Successful Multi-Query Execution

**Query**: "Bayern Munich home + 2 other matches within 200 miles over 10 days. Other matches: Bundesliga 2 or Austrian Bundesliga"

**Expected Response**:
```json
{
  "success": true,
  "isMultiQuery": true,
  "matches": {
    "primary": {
      "fixture": {
        "id": 12345,
        "date": "2025-03-05T18:30:00Z",
        "venue": {
          "name": "Allianz Arena",
          "coordinates": [11.6247, 48.2188]
        }
      },
      "teams": {
        "home": { "name": "Bayern Munich" }
      }
    },
    "secondary": [
      {
        "fixture": { "id": 12346 },
        "distanceFromPrimary": 45.2
      },
      {
        "fixture": { "id": 12347 },
        "distanceFromPrimary": 187.3
      }
    ]
  },
  "count": 3
}
```

**Assertions**:
- Primary match found
- Exactly 2 secondary matches found
- All matches within 200 miles of primary venue
- Secondary matches are from specified leagues
- Secondary matches exclude primary match
- All matches within date range

---

### TC-EXEC-002: Insufficient Secondary Matches

**Query**: "Bayern Munich home + 5 other matches within 50 miles"

**Expected Response**:
```json
{
  "success": true,
  "isMultiQuery": true,
  "matches": {
    "primary": { /* ... */ },
    "secondary": [ /* 2 matches found */ ]
  },
  "count": 3,
  "warning": "INSUFFICIENT_SECONDARY_MATCHES",
  "requestedCount": 5,
  "foundCount": 2,
  "message": "Found Bayern Munich home match, but only 2 additional matches within 50 miles (requested 5). Showing available matches."
}
```

**Assertions**:
- Primary match found
- Only 2 secondary matches found (requested 5)
- Warning flag set
- Message explains situation
- Returns available matches (doesn't fail)

---

### TC-EXEC-003: No Secondary Matches Found

**Query**: "Bayern Munich home + 3 other matches within 10 miles"

**Expected Response**:
```json
{
  "success": true,
  "isMultiQuery": true,
  "matches": {
    "primary": { /* ... */ },
    "secondary": []
  },
  "count": 1,
  "warning": "NO_SECONDARY_MATCHES",
  "message": "Found Bayern Munich home match, but no additional matches within 10 miles. Try expanding the distance radius."
}
```

**Assertions**:
- Primary match found
- No secondary matches found
- Warning flag set
- Helpful message with suggestion

---

### TC-EXEC-004: Multiple Primary Matches

**Query**: "Bayern Munich home matches + 2 other matches"

**Scenario**: Multiple Bayern Munich home matches in date range

**Expected Behavior**:
- Use first match as primary
- Calculate distances from first match's venue
- Return first match + 2 secondary matches

**Assertions**:
- First match selected as primary
- Distances calculated from first match venue
- Secondary matches exclude all primary matches (not just first)

---

### TC-EXEC-005: Distance Calculation Accuracy

**Query**: "Bayern Munich home + 1 other match within 200 miles"

**Test**: Verify distance calculations are accurate

**Assertions**:
- Distance calculated using Haversine formula
- Distances match expected values (±1 mile tolerance)
- Coordinates format: [longitude, latitude]

**Validation**:
- Allianz Arena: [11.6247, 48.2188]
- Max-Morlock-Stadion (Nuremberg): [11.1245, 49.4267]
- Expected distance: ~45 miles
- Actual distance should be within 45 ± 1 miles

---

## 3. Edge Cases

### TC-EDGE-001: Missing Primary Match

**Query**: "Non-existent Team home + 2 other matches"

**Expected Response**:
```json
{
  "success": false,
  "error": "NO_PRIMARY_MATCH",
  "message": "I couldn't find any matches for Non-existent Team. Please check the team name and try again.",
  "suggestions": [
    "Try a different team name",
    "Search for matches in a specific league",
    "Expand the date range"
  ]
}
```

**Assertions**:
- Error returned (not success: true)
- Helpful error message
- Suggestions provided

---

### TC-EDGE-002: Ambiguous Team Name

**Query**: "United home + 2 other matches"

**Scenario**: Multiple teams named "United" (Manchester United, West Ham United, etc.)

**Expected Behavior**:
- Ask for clarification OR
- Use most popular team (Manchester United)
- Include warning in response

**Assertions**:
- Either clarification requested OR
- Most popular team selected with warning

---

### TC-EDGE-003: Invalid Date Range

**Query**: "Bayern Munich home + 2 other matches over a 100 day period"

**Expected Behavior**:
- Parse successfully
- Execute search
- May return many matches (not an error)

**Assertions**:
- Query parsed successfully
- Search executes
- Results may be large but valid

---

### TC-EDGE-004: Zero Count Constraint

**Query**: "Bayern Munich home + 0 other matches"

**Expected Behavior**:
- Parse successfully
- Return only primary match
- Secondary array empty

**Assertions**:
- `secondary.count` = 0
- `matches.secondary` = []
- `count` = 1

---

### TC-EDGE-005: Very Large Distance

**Query**: "Bayern Munich home + 2 other matches within 1000 miles"

**Expected Behavior**:
- Parse successfully
- Execute search
- May return many matches

**Assertions**:
- Query parsed successfully
- Search executes
- Results may be large but valid

---

### TC-EDGE-006: Missing Venue Coordinates

**Query**: "Team with no venue coordinates home + 2 other matches"

**Scenario**: Primary team has no venue coordinates

**Expected Behavior**:
- Fallback to team's city coordinates
- OR return error if no coordinates available

**Assertions**:
- Either fallback coordinates used OR
- Error returned with helpful message

---

### TC-EDGE-007: Overlapping Date Ranges

**Query**: "Bayern Munich home on March 5 + 2 other matches over 10 days starting March 1"

**Scenario**: Date range includes primary match date

**Expected Behavior**:
- Primary match date falls within range
- Secondary matches can be on same date as primary (if different venue)

**Assertions**:
- Primary match included in date range
- Secondary matches can overlap primary date (different venue)

---

## 4. Error Handling

### TC-ERROR-001: Parsing Failure

**Query**: "asdfghjkl random text"

**Expected Response**:
```json
{
  "success": false,
  "confidence": 0,
  "error": "PARSE_ERROR",
  "message": "I couldn't understand your query. Please try being more specific!",
  "suggestions": [
    "Try mentioning specific team names",
    "Include a league name",
    "Add a location or city name",
    "Specify a date range"
  ]
}
```

**Assertions**:
- `success` = false
- `confidence` = 0
- Error message provided
- Suggestions provided

---

### TC-ERROR-002: Missing Date Range

**Query**: "Bayern Munich home + 2 other matches"

**Scenario**: No date range specified, no conversation history

**Expected Response**:
```json
{
  "success": false,
  "confidence": 0,
  "error": "MISSING_DATE_RANGE",
  "message": "Please specify when you want to see these matches. For example: 'next month', 'in March', or 'over a 10 day period'.",
  "suggestions": [
    "Add a date range: 'over a 10 day period'",
    "Specify a month: 'in March'",
    "Use relative dates: 'next month'"
  ]
}
```

**Assertions**:
- Error returned
- Helpful message
- Suggestions provided

---

### TC-ERROR-003: Invalid League IDs

**Query**: "Bayern Munich home + 2 other matches from Invalid League"

**Scenario**: League name doesn't map to valid ID

**Expected Behavior**:
- Parse with warning
- Filter out invalid leagues
- Continue with valid leagues OR return error

**Assertions**:
- Either invalid leagues filtered out OR
- Error returned with valid league suggestions

---

### TC-ERROR-004: API Failure

**Query**: "Bayern Munich home + 2 other matches"

**Scenario**: External API fails during search

**Expected Response**:
```json
{
  "success": false,
  "error": "SEARCH_ERROR",
  "message": "I encountered an error while searching for matches. Please try again in a moment.",
  "details": "API_TIMEOUT" // Optional, for debugging
}
```

**Assertions**:
- Error returned
- User-friendly message
- Technical details optional (for debugging)

---

## 5. Backward Compatibility

### TC-BACK-001: Single Query Still Works

**Query**: "Arsenal matches in London next month"

**Expected Response**:
```json
{
  "success": true,
  "isMultiQuery": false,
  "matches": [ /* array of matches */ ],
  "count": 12
}
```

**Assertions**:
- `isMultiQuery` = false
- `matches` is an array (not object)
- Existing frontend code works without changes

---

### TC-BACK-002: Legacy Field Presence

**Query**: "Arsenal matches in London next month"

**Expected Response**: Includes legacy fields:
- `parsed.teams`
- `parsed.leagues`
- `parsed.location`
- `parsed.dateRange`

**Assertions**:
- Legacy fields present
- Frontend can use either structure

---

### TC-BACK-003: Response Size

**Query**: "Arsenal matches in London next month"

**Expected**: Response size similar to current implementation

**Assertions**:
- Response size < 50KB (reasonable limit)
- No significant performance degradation

---

## 6. Integration Tests

### TC-INT-001: End-to-End Multi-Query Flow

**Steps**:
1. Send multi-query to `/api/search/natural-language`
2. Verify parsing succeeds
3. Verify search execution succeeds
4. Verify response structure matches API contract
5. Verify all matches meet criteria

**Query**: "Bayern Munich home + 2 other matches within 200 miles over 10 days. Other matches: Bundesliga 2 or Austrian Bundesliga"

**Assertions**:
- All steps succeed
- Response matches API contract
- Primary match is Bayern Munich home
- Secondary matches are from specified leagues
- All matches within distance and date constraints

---

### TC-INT-002: Conversation History Integration

**Steps**:
1. Send query: "Bayern Munich home matches next month"
2. Send follow-up: "but also 2 other matches within 200 miles"

**Expected**: Second query inherits date range from first

**Assertions**:
- Date range inherited from conversation history
- Multi-query detected in follow-up
- Response includes both primary and secondary matches

---

### TC-INT-003: Frontend Display

**Steps**:
1. Receive multi-query response
2. Display primary match prominently
3. Display secondary matches with distances
4. Show relationship information

**Assertions**:
- UI handles multi-query structure
- Primary match displayed correctly
- Secondary matches displayed with distances
- No errors in frontend

---

## Test Data Requirements

### Required Test Data

1. **Teams**:
   - Bayern Munich (ID: 157, Venue: Allianz Arena)
   - 1. FC Nürnberg (ID: 170, Venue: Max-Morlock-Stadion)
   - RB Salzburg (ID: 571, Venue: Red Bull Arena)

2. **Leagues**:
   - Bundesliga (ID: 78)
   - Bundesliga 2 (ID: 79)
   - Austrian Bundesliga (ID: 218)

3. **Matches**:
   - Bayern Munich home matches in March 2025
   - Bundesliga 2 matches in March 2025
   - Austrian Bundesliga matches in March 2025

4. **Venues**:
   - Allianz Arena: [11.6247, 48.2188]
   - Max-Morlock-Stadion: [11.1245, 49.4267]
   - Red Bull Arena: [13.0450, 47.8200]

---

## Performance Benchmarks

### Expected Performance

| Operation | Expected Time | Max Time |
|-----------|---------------|----------|
| Parsing | 1-2 seconds | 5 seconds |
| Primary match search | 1-2 seconds | 5 seconds |
| Secondary match search | 2-3 seconds | 10 seconds |
| Distance calculations | < 1 second | 2 seconds |
| Total response time | 4-8 seconds | 20 seconds |

---

## Test Execution Plan

### Phase 1: Unit Tests
- [ ] Parsing tests (TC-PARSE-001 to TC-PARSE-007)
- [ ] Helper function tests
- [ ] Edge case parsing tests

### Phase 2: Integration Tests
- [ ] Execution tests (TC-EXEC-001 to TC-EXEC-005)
- [ ] Error handling tests (TC-ERROR-001 to TC-ERROR-004)
- [ ] Backward compatibility tests (TC-BACK-001 to TC-BACK-003)

### Phase 3: End-to-End Tests
- [ ] Full integration tests (TC-INT-001 to TC-INT-003)
- [ ] Performance tests
- [ ] Frontend integration tests

---

## Success Criteria

- ✅ All parsing tests pass (>95% accuracy)
- ✅ All execution tests pass
- ✅ All edge cases handled gracefully
- ✅ All error cases return helpful messages
- ✅ Backward compatibility maintained
- ✅ Performance within benchmarks
- ✅ API contract compliance


