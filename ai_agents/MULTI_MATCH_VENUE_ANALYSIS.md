# Multi-Match Venue Handling - Architectural Analysis

## Problem Statement

When multiple matches from different competitions/clubs are played at the same physical venue (e.g., Brisbane Road hosting both Leyton Orient and Tottenham Women matches), the UI is excluding one of the matches from both the map view and match list.

**Example Scenario:**
- Search: London, 1/9/26 - 1/11/26
- Leyton Orient home match: 1/10/26 at Brisbane Road
- Tottenham Women match: 1/11/26 at Brisbane Road
- **Issue**: Leyton Orient match is excluded from UI

## Root Cause Analysis

### 1. Venue ID Inconsistency

**Location**: `flight-match-finder/mobile-app/screens/MapResultsScreen.js:1127-1147`

The venue grouping logic prioritizes venue ID over coordinates:

```javascript
if (venue.id != null) key = `id:${venue.id}`;
else if (venue.coordinates && venue.coordinates.length === 2) key = `geo:${venue.coordinates[0]},${venue.coordinates[1]}`;
```

**Problem**: Different competitions/clubs may have different venue IDs for the same physical venue in the API data. When venue IDs differ:
- Matches are grouped into separate venue groups
- Both should appear, but if one venue ID is missing or null, that match gets excluded entirely (line 1135: `if (!key) return;`)

### 2. Web Map Component Venue ID Requirement

**Location**: `flight-match-finder/overlap/web/src/components/Map.js:350-353`

```javascript
if (!venue || !venue.id) {
    console.log('❌ SKIPPING VENUE: No venue or venue ID for', match.teams?.home?.name);
    return acc;
}
```

**Problem**: Matches without a venue ID are completely skipped, even if they have valid coordinates. This is too strict - coordinates should be sufficient for grouping.

### 3. Coordinate-Based Grouping Limitations

**Location**: `flight-match-finder/mobile-app/screens/MapResultsScreen.js:1134`

The coordinate-based fallback uses exact coordinate matching:
```javascript
key = `geo:${venue.coordinates[0]},${venue.coordinates[1]}`;
```

**Problems**:
- Exact coordinate matching is fragile - slight differences (rounding, precision) prevent grouping
- No tolerance for coordinate variations (e.g., 0.0001° difference)
- If one match has coordinates and another doesn't, they can't be grouped

### 4. Backend Venue Resolution Inconsistency

**Location**: `flight-match-finder/overlap/backend/src/routes/matches.js:96-234`

The venue resolution logic has multiple fallback paths:
- API venue by ID
- Database lookup by name
- Team venue fallback
- Geocoding as last resort

**Problem**: Different matches at the same venue may resolve through different paths, resulting in:
- Different venue IDs
- Different coordinate precision
- Missing venue data in some cases

### 5. Map Marker Rendering

**Location**: `flight-match-finder/mobile-app/components/MapView.js:254-309`

The map creates one marker per match (not per venue group):
```javascript
return validMatches.map(match => {
    // Creates individual marker for each match
});
```

**Observation**: This is actually correct - multiple matches at the same venue should show multiple markers (or a clustered marker). The issue is that one match is being filtered out before reaching this point.

## Findings

### Critical Issues

1. **Strict Venue ID Requirement**: Web map component skips matches without venue.id, even with valid coordinates
2. **No Venue ID Normalization**: Different venue IDs for the same physical venue are not normalized
3. **Fragile Coordinate Matching**: Exact coordinate matching fails with minor precision differences
4. **Missing Venue Data**: Some matches may not have venue.id populated, causing exclusion

### Architectural Gaps

1. **No Venue Canonicalization**: No logic to identify that different venue IDs represent the same physical location
2. **No Coordinate Tolerance**: Exact matching doesn't account for floating-point precision or slight geocoding variations
3. **Inconsistent Venue Data**: Backend venue resolution may produce inconsistent venue IDs for the same venue
4. **Missing Fallback Strategy**: When venue ID is missing, the system should rely more heavily on coordinate-based grouping with tolerance

## Recommendations

### 1. Implement Venue Canonicalization (High Priority)

**Approach**: Create a venue normalization service that:
- Maintains a mapping of venue IDs to canonical venue identifiers
- Uses venue name + city + coordinates (with tolerance) to identify same physical venue
- Normalizes venue data before grouping

**Implementation Points**:
- Backend: Add venue canonicalization in `transformApiSportsData` function
- Frontend: Use canonical venue ID for grouping instead of raw venue.id

### 2. Enhance Coordinate-Based Grouping (High Priority)

**Approach**: Implement coordinate-based grouping with tolerance:

```javascript
// Pseudo-code for coordinate-based grouping with tolerance
function getVenueGroupKey(match) {
    const venue = match?.fixture?.venue || {};
    
    // Prefer venue ID if available
    if (venue.id != null) {
        return `id:${venue.id}`;
    }
    
    // Use coordinates with tolerance (e.g., ~100m radius)
    if (venue.coordinates && venue.coordinates.length === 2) {
        const [lon, lat] = venue.coordinates;
        // Round to ~100m precision (0.001° ≈ 111m)
        const roundedLon = Math.round(lon * 1000) / 1000;
        const roundedLat = Math.round(lat * 1000) / 1000;
        return `geo:${roundedLon},${roundedLat}`;
    }
    
    // Fallback: venue name + city (less reliable but better than nothing)
    if (venue.name && venue.city) {
        return `name:${venue.name.toLowerCase().trim()}-${venue.city.toLowerCase().trim()}`;
    }
    
    return null;
}
```

### 3. Remove Strict Venue ID Requirement (High Priority)

**Location**: `flight-match-finder/overlap/web/src/components/Map.js:350-353`

**Change**: Allow matches with coordinates but no venue.id:

```javascript
// Current (too strict):
if (!venue || !venue.id) {
    return acc; // Skip match
}

// Recommended:
if (!venue) {
    return acc; // Only skip if no venue object at all
}

// Use venue.id if available, otherwise use coordinates
const venueKey = venue.id 
    ? `${venue.name}-${venue.id}` 
    : venue.coordinates 
        ? `geo:${venue.coordinates[0]},${venue.coordinates[1]}`
        : null;

if (!venueKey) {
    return acc; // Skip only if no way to identify venue
}
```

### 4. Backend Venue ID Consistency (Medium Priority)

**Approach**: Enhance venue resolution to prefer consistent venue IDs:

- When resolving venue, check if a venue with the same name+city already exists in the database
- Reuse existing venue ID when possible
- Create venue ID mapping table for known shared venues (e.g., Brisbane Road)

### 5. Add Venue Name + City Fallback (Medium Priority)

**Approach**: When venue ID and coordinates are unavailable, use normalized venue name + city:

```javascript
// In venue grouping logic
if (venue.id != null) {
    key = `id:${venue.id}`;
} else if (venue.coordinates && venue.coordinates.length === 2) {
    key = `geo:${venue.coordinates[0]},${venue.coordinates[1]}`;
} else if (venue.name && venue.city) {
    // Normalize name and city for matching
    const normalizedName = venue.name.toLowerCase().trim().replace(/\s+/g, ' ');
    const normalizedCity = venue.city.toLowerCase().trim();
    key = `name:${normalizedName}-${normalizedCity}`;
}
```

### 6. Debug Logging Enhancement (Low Priority)

**Approach**: Add logging to track venue grouping decisions:

```javascript
console.log('Venue grouping decision:', {
    matchId: match.fixture.id,
    venueId: venue.id,
    venueName: venue.name,
    coordinates: venue.coordinates,
    groupKey: key,
    reason: venue.id ? 'venue-id' : venue.coordinates ? 'coordinates' : 'name-city'
});
```

## Implementation Priority

1. **Immediate Fix**: Remove strict venue.id requirement in web map component
2. **Short-term**: Implement coordinate-based grouping with tolerance
3. **Medium-term**: Add venue name+city fallback grouping
4. **Long-term**: Implement venue canonicalization service

## Testing Scenarios

1. **Same Venue, Different Competitions**: Verify both matches appear when different competitions use same venue
2. **Missing Venue ID**: Verify matches with coordinates but no venue.id still appear
3. **Coordinate Precision**: Verify matches with slightly different coordinates (same venue) are grouped
4. **Missing Coordinates**: Verify matches with venue name+city but no coordinates still appear (if possible)

## Example Refactor

### Before (Current Logic):
```javascript
// MapResultsScreen.js:1127-1147
const venueGroups = useMemo(() => {
    if (!finalFilteredMatches || finalFilteredMatches.length === 0) return [];
    const groupsMap = new Map();
    finalFilteredMatches.forEach((m) => {
        const venue = m?.fixture?.venue || {};
        let key = null;
        if (venue.id != null) key = `id:${venue.id}`;
        else if (venue.coordinates && venue.coordinates.length === 2) 
            key = `geo:${venue.coordinates[0]},${venue.coordinates[1]}`;
        if (!key) return; // ❌ Excludes match if no key
        if (!groupsMap.has(key)) {
            groupsMap.set(key, { key, venue, matches: [] });
        }
        groupsMap.get(key).matches.push(m);
    });
    return Array.from(groupsMap.values());
}, [finalFilteredMatches]);
```

### After (Recommended Logic):
```javascript
// Helper function for venue key generation with tolerance
const getVenueGroupKey = useCallback((match) => {
    const venue = match?.fixture?.venue || {};
    
    // Priority 1: Venue ID (most reliable)
    if (venue.id != null) {
        return `id:${venue.id}`;
    }
    
    // Priority 2: Coordinates with tolerance (~100m precision)
    if (venue.coordinates && Array.isArray(venue.coordinates) && venue.coordinates.length === 2) {
        const [lon, lat] = venue.coordinates;
        if (typeof lon === 'number' && typeof lat === 'number') {
            // Round to ~100m precision (0.001° ≈ 111m)
            const roundedLon = Math.round(lon * 1000) / 1000;
            const roundedLat = Math.round(lat * 1000) / 1000;
            return `geo:${roundedLon},${roundedLat}`;
        }
    }
    
    // Priority 3: Venue name + city (normalized)
    if (venue.name && venue.city) {
        const normalizedName = venue.name.toLowerCase().trim().replace(/\s+/g, ' ');
        const normalizedCity = venue.city.toLowerCase().trim();
        return `name:${normalizedName}-${normalizedCity}`;
    }
    
    // Last resort: Use fixture ID (prevents exclusion but creates separate group)
    return `fixture:${match.fixture?.id}`;
}, []);

// Updated venue grouping
const venueGroups = useMemo(() => {
    if (!finalFilteredMatches || finalFilteredMatches.length === 0) return [];
    const groupsMap = new Map();
    finalFilteredMatches.forEach((m) => {
        const key = getVenueGroupKey(m);
        if (!key) {
            // Log but don't exclude - use fixture ID as fallback
            console.warn('Could not generate venue key for match:', m.fixture?.id);
            const fallbackKey = `fixture:${m.fixture?.id}`;
            if (!groupsMap.has(fallbackKey)) {
                groupsMap.set(fallbackKey, { 
                    key: fallbackKey, 
                    venue: m.fixture?.venue || {}, 
                    matches: [] 
                });
            }
            groupsMap.get(fallbackKey).matches.push(m);
            return;
        }
        if (!groupsMap.has(key)) {
            groupsMap.set(key, { key, venue: m.fixture?.venue || {}, matches: [] });
        }
        groupsMap.get(key).matches.push(m);
    });
    const groups = Array.from(groupsMap.values());
    // Sort matches within each group chronologically
    groups.forEach(g => g.matches.sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date)));
    // Sort groups by earliest match date
    groups.sort((a, b) => new Date(a.matches[0].fixture.date) - new Date(b.matches[0].fixture.date));
    return groups;
}, [finalFilteredMatches, getVenueGroupKey]);
```

## Summary

The core issue is that the system requires venue IDs for grouping, but different competitions may have different venue IDs for the same physical venue, or one match may be missing a venue ID entirely. The solution requires:

1. **Flexible grouping strategy** that doesn't rely solely on venue ID
2. **Coordinate tolerance** to handle precision differences
3. **Fallback mechanisms** (name+city) when IDs and coordinates are unavailable
4. **Removal of strict requirements** that exclude valid matches

This is an incremental refactor that can be implemented in small PRs, starting with the most critical fixes (removing strict venue.id requirement) and gradually adding more sophisticated grouping logic.


