# Phase 1: Enhanced Multi-Query Parsing - Technical Specifications

## Overview

Extend the natural language parsing system to support multi-query structures where users can specify a primary match and secondary matches with different criteria.

**Target**: Enable parsing of queries like:
- *"I want to see Bayern Munich play at home, but would also like to see 2 other matches within 200 miles over a 10 day period. The other matches can be bundesliga 2 or austrian bundesliga"*

---

## Current Implementation

### File Location
`overlap/backend/src/routes/search.js` (lines 1386-1668)

### Current Structure
```javascript
{
  location: null,
  date: null,
  dateRange: null,
  teams: { home: null, away: null, any: [] },
  leagues: [],
  distance: null,
  matchType: null,
  confidence: 0,
  errorMessage: null
}
```

### Current OpenAI System Prompt
- Single query focus
- Returns flat structure
- No multi-query examples
- No count constraint parsing

---

## Target Structure

### New Parse Result Structure

```javascript
{
  // Single query mode (backward compatible)
  isMultiQuery: false,  // NEW: Flag to indicate multi-query
  
  // Primary match criteria (always present)
  primary: {
    teams: [],           // Array of team names/IDs
    matchType: null,     // 'home', 'away', or null
    leagues: [],         // Optional - defaults to team's league
    dateRange: null      // Optional - inherited from relationship.dateRange
  },
  
  // Secondary match criteria (only if isMultiQuery = true)
  secondary: {
    count: null,         // NEW: Number of matches requested (e.g., 2)
    leagues: [],         // Different from primary
    maxDistance: null,   // Distance from primary venue (miles)
    excludePrimary: true // NEW: Exclude primary match from results
  },
  
  // Relationship constraints (only if isMultiQuery = true)
  relationship: {
    distanceFrom: 'primary',  // NEW: 'primary' or 'location'
    dateRange: {               // Shared date range
      start: 'YYYY-MM-DD',
      end: 'YYYY-MM-DD'
    }
  },
  
  // Legacy fields (for backward compatibility)
  location: null,        // Keep for single queries
  dateRange: null,       // Keep for single queries
  teams: { home: null, away: null, any: [] },
  leagues: [],
  distance: null,
  matchType: null,
  
  // Metadata
  confidence: 0,
  errorMessage: null,
  suggestions: []
}
```

---

## Implementation Details

### 1. Multi-Query Detection

**Location**: `parseNaturalLanguage()` function

**Detection Logic**:
```javascript
function detectMultiQuery(query) {
  const lowerQuery = query.toLowerCase();
  
  // Indicators of secondary criteria
  const secondaryIndicators = [
    'but would also like',
    'but also',
    'also want',
    'plus',
    'and also',
    'would also like',
    'other matches',
    'additional matches'
  ];
  
  // Indicators of count constraints
  const countIndicators = [
    /\d+\s+other\s+matches?/i,
    /\d+\s+additional\s+matches?/i,
    /\d+\s+more\s+matches?/i,
    /a few\s+matches?/i,
    /several\s+matches?/i,
    /some\s+matches?/i
  ];
  
  // Indicators of distance from primary
  const distanceFromPrimaryIndicators = [
    /within\s+\d+\s+miles/i,
    /within\s+\d+\s+km/i,
    /\d+\s+miles\s+away/i,
    /\d+\s+km\s+away/i
  ];
  
  const hasSecondary = secondaryIndicators.some(indicator => 
    lowerQuery.includes(indicator)
  );
  
  const hasCount = countIndicators.some(pattern => pattern.test(query));
  
  const hasDistanceFromPrimary = distanceFromPrimaryIndicators.some(pattern => 
    pattern.test(query)
  );
  
  return hasSecondary || (hasCount && hasDistanceFromPrimary);
}
```

**Integration Point**: Add at start of `parseNaturalLanguage()`:
```javascript
const isMultiQuery = detectMultiQuery(query);
```

---

### 2. Enhanced OpenAI System Prompt

**Location**: Lines 1429-1550 in `search.js`

**New System Prompt Structure**:

```javascript
const systemPrompt = `You are a football match search assistant. Parse natural language queries into structured search parameters.
The current date is ${formatDate(now)}. 

MULTI-QUERY DETECTION:
- If query contains phrases like "but would also like", "but also", "plus", "other matches", "additional matches", parse as multi-query
- Multi-query structure: primary match + secondary matches with different criteria
- Set isMultiQuery: true when secondary criteria detected

PRIMARY MATCH CRITERIA:
- Extract team name(s) for primary match
- Extract match type: "at home" → matchType: "home", "away" → matchType: "away"
- Primary match leagues are optional (defaults to team's league)

SECONDARY MATCH CRITERIA:
- Extract count constraint: "2 other matches" → count: 2, "a few matches" → count: 3, "several matches" → count: 5
- Extract league filters: "bundesliga 2 or austrian bundesliga" → leagues: [79, 218]
- Extract distance constraint: "within 200 miles" → maxDistance: 200
- Always set excludePrimary: true for secondary matches

RELATIONSHIP CONSTRAINTS:
- Extract shared date range: "over a 10 day period" → calculate dateRange
- Distance is relative to primary match venue: distanceFrom: "primary"
- If no date range specified, infer from primary match date

COUNT CONSTRAINT PARSING:
- "2 other matches" → count: 2
- "a few matches" → count: 3 (default)
- "several matches" → count: 5 (default)
- "some matches" → count: 3 (default)
- "other matches" (no number) → count: 3 (default)

DISTANCE PARSING:
- "within 200 miles" → maxDistance: 200
- "within 200 km" → maxDistance: 124 (convert km to miles)
- "200 miles away" → maxDistance: 200
- If distance mentioned without "from" or "of", assume relative to primary venue

DATE RANGE PARSING:
- "over a 10 day period" → Calculate 10-day range from today or specified date
- "over 10 days" → Same as above
- If primary match date specified, use that as start date
- If no date specified, use current date as start

Available leagues (use these exact IDs):
- 39 (Premier League)
- 40 (Championship)
- 78 (Bundesliga)
- 79 (Bundesliga 2)
- 140 (La Liga)
- 218 (Austrian Bundesliga)
- 61 (Ligue 1)
- 62 (Ligue 2)
- 88 (Eredivisie)
- 94 (Primeira Liga)

EXAMPLE 1 - Multi-Query:
Query: "I want to see Bayern Munich play at home, but would also like to see 2 other matches within 200 miles over a 10 day period. The other matches can be bundesliga 2 or austrian bundesliga"

Response:
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
  "errorMessage": null,
  "suggestions": []
}

EXAMPLE 2 - Single Query (backward compatible):
Query: "Arsenal matches in London next month"

Response:
{
  "isMultiQuery": false,
  "location": {
    "city": "London",
    "country": "United Kingdom",
    "coordinates": [-0.118092, 51.509865]
  },
  "dateRange": {
    "start": "2025-03-01",
    "end": "2025-03-31"
  },
  "teams": ["Arsenal FC"],
  "leagues": [],
  "maxDistance": 50,
  "errorMessage": null,
  "suggestions": []
}

Return only a JSON object matching the structure above.`;
```

---

### 3. Response Mapping

**Location**: Lines 1560-1600 in `search.js`

**Current Mapping**:
```javascript
result.location = parsedResponse.location;
result.dateRange = parsedResponse.dateRange;
result.distance = parsedResponse.maxDistance;
result.matchType = parsedResponse.matchTypes?.[0] || null;
```

**New Mapping**:
```javascript
// Check if multi-query
if (parsedResponse.isMultiQuery) {
  result.isMultiQuery = true;
  
  // Map primary criteria
  result.primary = {
    teams: parsedResponse.primary?.teams || [],
    matchType: parsedResponse.primary?.matchType || null,
    leagues: parsedResponse.primary?.leagues || []
  };
  
  // Map secondary criteria
  result.secondary = {
    count: parsedResponse.secondary?.count || null,
    leagues: parsedResponse.secondary?.leagues || [],
    maxDistance: parsedResponse.secondary?.maxDistance || null,
    excludePrimary: parsedResponse.secondary?.excludePrimary !== false
  };
  
  // Map relationship
  result.relationship = {
    distanceFrom: parsedResponse.relationship?.distanceFrom || 'primary',
    dateRange: parsedResponse.relationship?.dateRange || parsedResponse.dateRange
  };
  
  // Populate legacy fields for backward compatibility
  result.dateRange = result.relationship.dateRange;
  result.teams.any = result.primary.teams.map(name => ({ name }));
  result.matchType = result.primary.matchType;
  result.leagues = result.primary.leagues;
  
} else {
  // Single query mode (existing logic)
  result.isMultiQuery = false;
  result.location = parsedResponse.location;
  result.dateRange = parsedResponse.dateRange;
  result.distance = parsedResponse.maxDistance;
  result.matchType = parsedResponse.matchTypes?.[0] || null;
  
  // Map to primary structure for consistency
  result.primary = {
    teams: parsedResponse.teams || [],
    matchType: result.matchType,
    leagues: parsedResponse.leagues || []
  };
}
```

---

### 4. Count Constraint Extraction

**New Helper Function**:

```javascript
function extractCountConstraint(query) {
  const patterns = [
    { pattern: /(\d+)\s+other\s+matches?/i, extract: (match) => parseInt(match[1]) },
    { pattern: /(\d+)\s+additional\s+matches?/i, extract: (match) => parseInt(match[1]) },
    { pattern: /(\d+)\s+more\s+matches?/i, extract: (match) => parseInt(match[1]) },
    { pattern: /a\s+few\s+matches?/i, extract: () => 3 },
    { pattern: /several\s+matches?/i, extract: () => 5 },
    { pattern: /some\s+matches?/i, extract: () => 3 },
    { pattern: /other\s+matches?/i, extract: () => 3 } // Default
  ];
  
  for (const { pattern, extract } of patterns) {
    const match = query.match(pattern);
    if (match) {
      return extract(match);
    }
  }
  
  return null; // No count constraint found
}
```

**Integration**: Add to OpenAI prompt examples and use as fallback if OpenAI doesn't extract count.

---

### 5. Distance Parsing Enhancement

**New Helper Function**:

```javascript
function extractDistanceConstraint(query) {
  // Pattern: "within X miles" or "within X km"
  const milePattern = /within\s+(\d+)\s+miles?/i;
  const kmPattern = /within\s+(\d+)\s+km/i;
  const awayPattern = /(\d+)\s+miles?\s+away/i;
  
  const mileMatch = query.match(milePattern);
  if (mileMatch) {
    return parseInt(mileMatch[1]);
  }
  
  const kmMatch = query.match(kmPattern);
  if (kmMatch) {
    return Math.round(parseInt(kmMatch[1]) * 0.621371); // Convert km to miles
  }
  
  const awayMatch = query.match(awayPattern);
  if (awayMatch) {
    return parseInt(awayMatch[1]);
  }
  
  return null;
}
```

**Integration**: Use in both OpenAI prompt and as fallback.

---

### 6. Date Range Calculation for Periods

**New Helper Function**:

```javascript
function calculatePeriodDateRange(query, referenceDate = new Date()) {
  // Pattern: "over a X day period" or "over X days"
  const periodPattern = /over\s+(?:a\s+)?(\d+)\s+day\s+period/i;
  const daysPattern = /over\s+(\d+)\s+days?/i;
  
  const periodMatch = query.match(periodPattern) || query.match(daysPattern);
  if (periodMatch) {
    const days = parseInt(periodMatch[1]);
    const start = new Date(referenceDate);
    const end = new Date(referenceDate);
    end.setDate(end.getDate() + days - 1);
    
    return {
      start: formatDate(start),
      end: formatDate(end)
    };
  }
  
  return null;
}
```

**Integration**: Use in OpenAI prompt and as fallback.

---

## Testing Requirements

### Unit Tests

**File**: `overlap/backend/__tests__/routes/search.test.js` (create if doesn't exist)

**Test Cases**:

1. **Multi-Query Detection**
   ```javascript
   test('detects multi-query with "but would also like"', () => {
     const query = "Bayern Munich home but would also like 2 other matches";
     const result = detectMultiQuery(query);
     expect(result).toBe(true);
   });
   ```

2. **Count Constraint Extraction**
   ```javascript
   test('extracts count constraint "2 other matches"', () => {
     const query = "2 other matches within 200 miles";
     const count = extractCountConstraint(query);
     expect(count).toBe(2);
   });
   ```

3. **Distance Constraint Extraction**
   ```javascript
   test('extracts distance constraint "within 200 miles"', () => {
     const query = "matches within 200 miles";
     const distance = extractDistanceConstraint(query);
     expect(distance).toBe(200);
   });
   ```

4. **Period Date Range Calculation**
   ```javascript
   test('calculates 10-day period date range', () => {
     const query = "over a 10 day period";
     const dateRange = calculatePeriodDateRange(query, new Date('2025-03-01'));
     expect(dateRange.start).toBe('2025-03-01');
     expect(dateRange.end).toBe('2025-03-10');
   });
   ```

5. **Full Multi-Query Parsing**
   ```javascript
   test('parses complete multi-query', async () => {
     const query = "I want to see Bayern Munich play at home, but would also like to see 2 other matches within 200 miles over a 10 day period. The other matches can be bundesliga 2 or austrian bundesliga";
     const result = await parseNaturalLanguage(query);
     
     expect(result.isMultiQuery).toBe(true);
     expect(result.primary.teams).toContain('Bayern Munich');
     expect(result.primary.matchType).toBe('home');
     expect(result.secondary.count).toBe(2);
     expect(result.secondary.leagues).toEqual([79, 218]);
     expect(result.secondary.maxDistance).toBe(200);
     expect(result.relationship.distanceFrom).toBe('primary');
   });
   ```

6. **Backward Compatibility**
   ```javascript
   test('single query still works', async () => {
     const query = "Arsenal matches in London next month";
     const result = await parseNaturalLanguage(query);
     
     expect(result.isMultiQuery).toBe(false);
     expect(result.location.city).toBe('London');
     expect(result.teams.any.length).toBeGreaterThan(0);
   });
   ```

---

## Integration Points

### 1. `buildSearchParameters()` Function

**Location**: Lines 1671-1714

**Current**: Converts parsed result to search parameters

**Modification**: Add multi-query handling:

```javascript
const buildSearchParameters = (parsed) => {
  // If multi-query, return structure for multi-query execution
  if (parsed.isMultiQuery) {
    return {
      isMultiQuery: true,
      primary: {
        teams: parsed.primary.teams,
        matchType: parsed.primary.matchType,
        leagues: parsed.primary.leagues,
        dateRange: parsed.relationship.dateRange
      },
      secondary: {
        count: parsed.secondary.count,
        leagues: parsed.secondary.leagues,
        maxDistance: parsed.secondary.maxDistance,
        excludePrimary: parsed.secondary.excludePrimary
      },
      relationship: parsed.relationship
    };
  }
  
  // Existing single-query logic
  const params = {};
  // ... existing code ...
  return params;
};
```

### 2. `/natural-language` Endpoint

**Location**: Lines 1961-2287

**Modification**: Route to multi-query execution if `isMultiQuery = true`:

```javascript
router.post('/natural-language', async (req, res) => {
  // ... existing parsing ...
  
  const searchParams = buildSearchParameters(parsed);
  
  // Route to multi-query execution
  if (searchParams.isMultiQuery) {
    // Will be implemented in Phase 3
    // For now, return parsed structure for testing
    return res.json({
      success: true,
      isMultiQuery: true,
      parsed: parsed,
      searchParams: searchParams,
      message: "Multi-query detected. Execution will be implemented in Phase 3."
    });
  }
  
  // Existing single-query execution
  // ... existing code ...
});
```

---

## Error Handling

### 1. Missing Count Constraint

**Scenario**: Query mentions "other matches" but no count

**Handling**: Default to `count: 3`

**Response**: Include in suggestions: "I'll show you up to 3 other matches. Specify a number if you want a different amount."

### 2. Missing Distance Constraint

**Scenario**: Query mentions "other matches" but no distance

**Handling**: Default to `maxDistance: 200` (miles)

**Response**: Include in suggestions: "I'll search within 200 miles. Specify a distance if you want a different radius."

### 3. Missing Date Range

**Scenario**: Query mentions matches but no date range

**Handling**: Use conversation history or default to next 30 days

**Response**: Include in suggestions: "I'll search for matches in the next 30 days. Specify dates if you want a different period."

### 4. Invalid League IDs

**Scenario**: OpenAI returns invalid league IDs

**Handling**: Validate against known league IDs, filter invalid ones

**Response**: Log warning, continue with valid leagues

---

## Performance Considerations

### 1. OpenAI Token Usage

**Current**: ~500 max_tokens

**Impact**: Multi-query responses may be longer

**Solution**: Increase `max_tokens` to 800 for multi-query detection

### 2. Parsing Time

**Current**: ~1-2 seconds for OpenAI parsing

**Impact**: Multi-query parsing may take slightly longer

**Solution**: Add caching for common query patterns

### 3. Response Size

**Current**: ~1-2KB response

**Impact**: Multi-query responses may be larger

**Solution**: Compress response, remove unnecessary fields

---

## Migration Strategy

### Phase 1.1: Add Detection (Week 1)
- [ ] Add `detectMultiQuery()` function
- [ ] Add helper functions (count, distance, date range)
- [ ] Unit tests for detection and extraction

### Phase 1.2: Update OpenAI Prompt (Week 1)
- [ ] Update system prompt with multi-query examples
- [ ] Add multi-query detection instructions
- [ ] Test with sample queries

### Phase 1.3: Response Mapping (Week 1)
- [ ] Update response mapping logic
- [ ] Add backward compatibility checks
- [ ] Integration tests

### Phase 1.4: Integration (Week 2)
- [ ] Update `buildSearchParameters()`
- [ ] Update `/natural-language` endpoint
- [ ] End-to-end tests

---

## Success Criteria

- ✅ Can detect multi-query with >95% accuracy
- ✅ Can extract count constraints correctly
- ✅ Can extract distance constraints correctly
- ✅ Can calculate period date ranges correctly
- ✅ Maintains backward compatibility with single queries
- ✅ All unit tests pass
- ✅ Integration tests pass
- ✅ Response structure matches API contract

---

## Dependencies

- OpenAI API (existing)
- Date formatting utilities (existing)
- League ID mapping (existing)

---

## Next Steps

After Phase 1 completion:
1. Review parsed structures with sample queries
2. Validate against API contract
3. Proceed to Phase 2 (Distance Infrastructure)
4. Proceed to Phase 3 (Multi-Query Execution)

