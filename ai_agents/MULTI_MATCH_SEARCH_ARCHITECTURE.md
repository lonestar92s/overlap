# Multi-Match Search Architecture Analysis

## Executive Summary

The current natural language search system supports **single-query searches** with filters (teams, leagues, location, dates, distance). To support complex queries like *"I want to see Bayern Munich play at home, but would also like to see 2 other matches within 200 miles over a 10 day period. The other matches can be bundesliga 2 or austrian bundesliga"*, we need to introduce **multi-query parsing** and **relationship-based filtering**.

---

## Current Architecture Analysis

### 1. Natural Language Processing Flow

**Location**: `overlap/backend/src/routes/search.js`

**Current Flow**:
```
User Query → parseNaturalLanguage() → buildSearchParameters() → performSearch() → Results
```

**Current Parsing Structure** (`parseNaturalLanguage`):
- Single query context
- Extracts: teams, leagues, location, dateRange, distance, matchType
- Returns flat structure with one set of criteria

**Current Search Parameters** (`buildSearchParameters`):
```javascript
{
  teams: [...],           // Single array
  leagues: [...],         // Single array  
  location: {...},        // Single location
  dateRange: {...},       // Single range
  maxDistance: number,    // Single distance
  matchType: string       // Single type
}
```

**Limitations**:
- ❌ Cannot parse multiple distinct match criteria
- ❌ Cannot handle "primary match + secondary matches" relationships
- ❌ Cannot apply different league filters to different match sets
- ❌ Cannot enforce match count constraints ("2 other matches")
- ❌ Distance is always relative to a single location, not a match venue

---

### 2. Search Execution

**Location**: `overlap/backend/src/routes/search.js` → `performSearch()`

**Current Behavior**:
- Executes **one search** with combined filters
- Returns flat array of matches
- No concept of "primary" vs "secondary" matches
- No post-processing to enforce count constraints

**Example Query**: *"Bayern Munich home matches"*
- ✅ Works: Finds Bayern Munich home matches
- ✅ Returns: Array of matches

**Complex Query**: *"Bayern Munich home + 2 other matches within 200 miles"*
- ❌ Fails: Cannot distinguish primary from secondary matches
- ❌ Fails: Cannot enforce "2 other matches" constraint
- ❌ Fails: Cannot calculate distance from Bayern Munich's venue

---

### 3. Data Model

**Match Structure** (from API):
```javascript
{
  fixture: {
    id, date, venue: { coordinates, name, city }
  },
  teams: { home: {...}, away: {...} },
  league: { id, name, country }
}
```

**Available Information**:
- ✅ Venue coordinates for distance calculations
- ✅ Team information for filtering
- ✅ League information for filtering
- ✅ Date information for time windows

**Missing for Multi-Query**:
- ❌ No grouping mechanism for "primary" vs "secondary" matches
- ❌ No relationship tracking between matches

---

## Requirements Analysis

### User Query Breakdown

**Query**: *"I want to see Bayern Munich play at home, but would also like to see 2 other matches within 200 miles over a 10 day period. The other matches can be bundesliga 2 or austrian bundesliga"*

**Parsed Requirements**:

1. **Primary Match Criteria**:
   - Team: Bayern Munich
   - Match Type: Home
   - No league restriction (defaults to Bundesliga)

2. **Secondary Match Criteria**:
   - Count: Exactly 2 matches
   - League Filter: Bundesliga 2 (ID: 79) OR Austrian Bundesliga (ID: 218)
   - Distance Constraint: Within 200 miles of Bayern Munich's home venue
   - Time Constraint: Same 10-day period as primary match

3. **Relationship Constraints**:
   - Distance calculated from primary match venue
   - All matches within same date range
   - Secondary matches exclude the primary match

---

## Architectural Challenges

### Challenge 1: Multi-Query Parsing

**Problem**: Current `parseNaturalLanguage()` returns a single flat structure. Need to parse:
- Primary match criteria
- Secondary match criteria (with different filters)
- Relationship constraints (distance from primary, count limits)

**Complexity**: 
- Natural language understanding of "but would also like" indicates secondary criteria
- "2 other matches" requires count constraint parsing
- "within 200 miles" needs to be relative to primary match venue, not a location

**Current System Prompt** (lines 1430-1550):
- Single query focus
- No multi-query examples
- No relationship parsing

---

### Challenge 2: Search Execution Strategy

**Problem**: Need to execute **two related searches**:
1. Find primary match (Bayern Munich home)
2. Find secondary matches (Bundesliga 2/Austrian Bundesliga within 200 miles of primary venue)

**Options**:

**Option A: Sequential Search**
```
1. Search for primary match → Get venue coordinates
2. Search for secondary matches using primary venue as center
3. Filter secondary matches by count constraint
```

**Pros**: Simple, clear separation
**Cons**: Two API calls, potential performance hit

**Option B: Single Search with Post-Processing**
```
1. Search for all matches (primary + secondary criteria combined)
2. Identify primary match
3. Calculate distances from primary venue
4. Filter and limit secondary matches
```

**Pros**: Single API call
**Cons**: May return too many matches, complex filtering logic

**Option C: Hybrid Approach**
```
1. Search for primary match → Get venue
2. Search for secondary matches with distance bounds calculated from venue
3. Apply count constraint
```

**Pros**: Efficient, targeted searches
**Cons**: Requires distance calculation infrastructure

---

### Challenge 3: Distance Calculation from Venue

**Problem**: Current distance filtering uses:
- Fixed location (city coordinates)
- Bounding box approach (lines 2187-2204)

**Need**: 
- Calculate distance from **dynamic venue coordinates** (Bayern Munich's home)
- Filter matches within 200 miles of that venue
- Handle venue lookup for teams

**Current Code** (lines 2187-2204):
```javascript
// Uses fixed location coordinates
const [lng, lat] = searchParams.location.coordinates;
const radiusMiles = 50; // Default radius
// Creates bounding box
```

**Required Enhancement**:
- Venue lookup for teams (Bayern Munich → Allianz Arena coordinates)
- Haversine distance calculation between venues
- Filter matches by distance threshold

---

### Challenge 4: Count Constraint Enforcement

**Problem**: "2 other matches" requires:
- Finding matches that meet criteria
- Limiting results to exactly 2 (or at least 2)
- Excluding the primary match from count

**Current System**: Returns all matches, no count limits

**Required**: Post-processing to:
- Sort secondary matches (by date, relevance, distance)
- Apply count constraint
- Return structured result with primary + secondary matches

---

### Challenge 5: Response Structure

**Current Response** (lines 2251-2275):
```javascript
{
  success: true,
  matches: [...],  // Flat array
  count: number,
  parsed: {...}
}
```

**Required Structure**:
```javascript
{
  success: true,
  primaryMatch: {...},      // Single match
  secondaryMatches: [...],  // Array (max 2)
  totalMatches: number,
  relationship: {
    distanceFromPrimary: [...],  // Distance for each secondary match
    dateRange: {...}
  }
}
```

**Impact**: Frontend needs to handle new structure

---

## Recommendations

### Phase 1: Enhanced Parsing (Foundation)

**1.1 Extend Parse Structure**

Modify `parseNaturalLanguage()` to return multi-query structure:

```javascript
{
  primary: {
    teams: [...],
    matchType: 'home',
    leagues: [...]  // Optional, defaults to team's league
  },
  secondary: {
    count: 2,                    // NEW: Count constraint
    leagues: [79, 218],          // Different from primary
    maxDistance: 200,            // Relative to primary venue
    excludePrimary: true         // NEW: Exclude primary match
  },
  relationship: {
    distanceFrom: 'primary',     // NEW: Distance relative to primary
    dateRange: {...}             // Shared date range
  }
}
```

**1.2 Update System Prompt**

Add multi-query examples to OpenAI system prompt:
- "Bayern Munich home + 2 other matches within 200 miles"
- "Arsenal vs Chelsea + 3 Premier League matches in London"
- Parse "but would also like", "also", "plus" as secondary criteria indicators

**1.3 Count Constraint Parsing**

Extract numeric constraints:
- "2 other matches" → `secondary.count = 2`
- "a few matches" → `secondary.count = 3` (default)
- "several matches" → `secondary.count = 5` (default)

---

### Phase 2: Venue-Based Distance Calculation

**2.1 Venue Lookup Service**

Create utility to get team's home venue:
```javascript
async function getTeamHomeVenue(teamName) {
  // Query Team model for venue
  // Return venue coordinates
}
```

**2.2 Distance Calculation**

Implement Haversine formula for venue-to-venue distance:
```javascript
function calculateDistance(venue1, venue2) {
  // Haversine formula
  // Return distance in miles
}
```

**2.3 Bounds from Venue**

Replace fixed location bounds with venue-based bounds:
```javascript
function createBoundsFromVenue(venueCoordinates, radiusMiles) {
  // Calculate bounding box from venue
  // Similar to lines 2187-2204 but using venue coords
}
```

---

### Phase 3: Multi-Query Search Execution

**3.1 Sequential Search Strategy**

Implement Option C (Hybrid Approach):

```javascript
async function executeMultiQuerySearch(parsedQuery) {
  // Step 1: Find primary match
  const primaryMatches = await performSearch({
    teams: parsedQuery.primary.teams,
    matchType: parsedQuery.primary.matchType,
    dateRange: parsedQuery.relationship.dateRange
  });
  
  if (primaryMatches.length === 0) {
    return { error: "No primary match found" };
  }
  
  const primaryMatch = primaryMatches[0]; // Take first match
  const primaryVenue = primaryMatch.fixture.venue.coordinates;
  
  // Step 2: Get secondary matches within distance
  const bounds = createBoundsFromVenue(primaryVenue, parsedQuery.secondary.maxDistance);
  
  const allSecondaryMatches = await performSearch({
    leagues: parsedQuery.secondary.leagues,
    dateRange: parsedQuery.relationship.dateRange,
    bounds: bounds
  });
  
  // Step 3: Filter by exact distance and exclude primary
  const secondaryMatches = allSecondaryMatches
    .filter(match => {
      const distance = calculateDistance(primaryVenue, match.fixture.venue.coordinates);
      return distance <= parsedQuery.secondary.maxDistance &&
             match.fixture.id !== primaryMatch.fixture.id;
    })
    .sort((a, b) => {
      // Sort by distance, then by date
      const distA = calculateDistance(primaryVenue, a.fixture.venue.coordinates);
      const distB = calculateDistance(primaryVenue, b.fixture.venue.coordinates);
      return distA - distB;
    })
    .slice(0, parsedQuery.secondary.count);
  
  return {
    primaryMatch,
    secondaryMatches,
    distances: secondaryMatches.map(match => ({
      matchId: match.fixture.id,
      distance: calculateDistance(primaryVenue, match.fixture.venue.coordinates)
    }))
  };
}
```

**3.2 Integration Point**

Modify `/natural-language` endpoint (line 1961):
- Detect multi-query structure in parsed result
- Route to `executeMultiQuerySearch()` if secondary criteria exist
- Format response with primary/secondary structure

---

### Phase 4: Response Formatting

**4.1 Structured Response**

Update response format (lines 2251-2275):

```javascript
const response = {
  success: true,
  query: query,
  confidence: parsed.confidence,
  message: generateMultiQueryResponse({
    primaryMatch: result.primaryMatch,
    secondaryCount: result.secondaryMatches.length,
    requestedCount: parsed.secondary.count
  }),
  matches: {
    primary: result.primaryMatch,
    secondary: result.secondaryMatches
  },
  relationship: {
    dateRange: parsed.relationship.dateRange,
    distances: result.distances
  },
  count: 1 + result.secondaryMatches.length
};
```

**4.2 Frontend Compatibility**

Maintain backward compatibility:
- If no secondary criteria, return flat `matches` array
- If secondary criteria exist, return structured `matches.primary` and `matches.secondary`

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Extend `parseNaturalLanguage()` structure
- [ ] Update OpenAI system prompt with multi-query examples
- [ ] Add count constraint parsing
- [ ] Unit tests for parsing

### Phase 2: Distance Infrastructure (Week 1-2)
- [ ] Implement venue lookup utility
- [ ] Implement Haversine distance calculation
- [ ] Create bounds-from-venue function
- [ ] Unit tests for distance calculations

### Phase 3: Search Execution (Week 2)
- [ ] Implement `executeMultiQuerySearch()`
- [ ] Integrate with `/natural-language` endpoint
- [ ] Add error handling for missing primary matches
- [ ] Integration tests

### Phase 4: Response & Frontend (Week 2-3)
- [ ] Update response structure
- [ ] Maintain backward compatibility
- [ ] Update frontend to handle structured responses
- [ ] UI for displaying primary vs secondary matches

---

## Technical Considerations

### Performance
- **Venue Lookup**: Cache team → venue mappings
- **Distance Calculation**: Consider pre-calculating distances for popular venues
- **Search Optimization**: Use bounding box for initial filter, then exact distance

### Error Handling
- Primary match not found → Return error with suggestions
- Secondary matches insufficient → Return partial results with message
- Venue coordinates missing → Fallback to team's city coordinates

### Edge Cases
- Multiple primary matches found → Use first match or ask user to clarify
- Secondary matches exceed count → Return top N by distance/date
- Date range spans multiple primary matches → Use first primary match's date

---

## Example Implementation Flow

### Input Query
*"I want to see Bayern Munich play at home, but would also like to see 2 other matches within 200 miles over a 10 day period. The other matches can be bundesliga 2 or austrian bundesliga"*

### Parsed Structure
```javascript
{
  primary: {
    teams: ["Bayern Munich"],
    matchType: "home"
  },
  secondary: {
    count: 2,
    leagues: [79, 218],  // Bundesliga 2, Austrian Bundesliga
    maxDistance: 200
  },
  relationship: {
    distanceFrom: "primary",
    dateRange: { start: "2025-03-01", end: "2025-03-10" }
  }
}
```

### Execution
1. Search: Bayern Munich home matches in date range → Find match on 2025-03-05
2. Get venue: Allianz Arena (48.2188, 11.6247)
3. Search: Bundesliga 2 + Austrian Bundesliga matches in date range
4. Filter: Within 200 miles of Allianz Arena, exclude primary match
5. Sort: By distance from Allianz Arena
6. Limit: Top 2 matches

### Response
```javascript
{
  success: true,
  matches: {
    primary: {
      fixture: { id: 12345, date: "2025-03-05", venue: {...} },
      teams: { home: "Bayern Munich", away: "Borussia Dortmund" }
    },
    secondary: [
      {
        fixture: { id: 12346, date: "2025-03-06", venue: {...} },
        teams: { home: "1. FC Nürnberg", away: "..." },
        distanceFromPrimary: 45.2  // miles
      },
      {
        fixture: { id: 12347, date: "2025-03-07", venue: {...} },
        teams: { home: "RB Salzburg", away: "..." },
        distanceFromPrimary: 187.3  // miles
      }
    ]
  },
  count: 3
}
```

---

## Anti-Patterns to Avoid

1. **Don't flatten multi-query into single search** - Loses relationship context
2. **Don't hardcode distance calculations** - Use proper Haversine formula
3. **Don't ignore count constraints** - User explicitly requested "2 other matches"
4. **Don't mix primary and secondary in same array** - Frontend needs to distinguish
5. **Don't assume venue exists** - Handle missing venue coordinates gracefully

---

## Success Metrics

- ✅ Can parse "primary + secondary" queries with >90% accuracy
- ✅ Correctly identifies count constraints ("2 other matches")
- ✅ Calculates distances from primary venue accurately
- ✅ Returns exactly N secondary matches when available
- ✅ Handles edge cases (no primary match, insufficient secondary matches)
- ✅ Maintains backward compatibility with single-query searches

---

## Next Steps

1. **Review this analysis** with team
2. **Prioritize phases** based on user needs
3. **Design API contract** for multi-query responses
4. **Create detailed technical specs** for each phase
5. **Set up test cases** for complex queries
6. **Plan frontend updates** to display structured results


