# Filtering Architecture Analysis - MapResultsScreen

## Executive Summary

This analysis examines the filtering behavior and logic after matches are returned to the map screen (`MapResultsScreen`). The system implements a multi-stage filtering pipeline with several architectural concerns around race conditions, complexity, and performance.

## Findings

### 🔴 CRITICAL: Race Condition in Filter Data Initialization

**Location**: `MapResultsScreen.js:332-352`, `FilterContext.js:28-31`

**Problem**:
- Filter data is processed asynchronously via `processMatchesForFilters` → `updateFilterData` (context state update)
- `getFilteredMatches()` depends on `filterData` from context, which may not be ready when filtering occurs
- The `useMemo` for `filteredMatches` can execute before `filterData` is populated in context

**Code Flow**:
```969:1050:flight-match-finder/mobile-app/screens/MapResultsScreen.js
  // Filter matches based on selected filters
  // FIXED: Don't filter if filterData is not ready - return all matches to prevent race condition
  const getFilteredMatches = () => {
    if (!matches) return matches;
    
    // If filterData is not ready, return all matches (prevents race condition)
    if (!filterData || !filterData.matchIds || filterData.matchIds.length === 0) {
      // Log once when filterData is not ready (for debugging)
      if (__DEV__ && matches.length > 0) {
        console.log('⚠️ [FILTER] Filter data not ready, showing all matches:', matches.length);
      }
      return matches;
    }
    
    if (!selectedFilters) return matches;
    
    const { countries, leagues, teams } = selectedFilters;
    // Normalize selected IDs to strings for consistent comparisons
    const selectedCountryIds = (countries || []).map((id) => id?.toString());
    const selectedLeagueIds = (leagues || []).map((id) => id?.toString());
    const selectedTeamIds = (teams || []).map((id) => id?.toString());
    
    // If no filters are selected, return all matches
    if (selectedCountryIds.length === 0 && selectedLeagueIds.length === 0 && selectedTeamIds.length === 0) {
      return matches;
    }
    
    // Reduced verbose logging
    
    const filtered = matches.filter(match => {
      let matched = false;
      
      // Country OR
      if (selectedCountryIds.length > 0) {
        const matchCountry =
          match.area?.code ||
          match.area?.id?.toString() ||
          (typeof match.venue?.country === 'string'
            ? match.venue.country
            : match.venue?.country?.id?.toString());
        if (selectedCountryIds.includes(matchCountry)) {
          matched = true;
        }
      }
      
      // League OR
      if (selectedLeagueIds.length > 0) {
        const matchLeague =
          match.competition?.id?.toString() ||
          match.competition?.code?.toString() ||
          (typeof match.league === 'string'
            ? match.league
            : match.league?.id?.toString() || match.league?.name);
        if (selectedLeagueIds.includes(matchLeague)) {
          matched = true;
        }
      }
      
      // Team OR
      if (selectedTeamIds.length > 0) {
        const homeTeamId = match.teams?.home?.id;
        const awayTeamId = match.teams?.away?.id;
        const homeTeamIdStr = homeTeamId?.toString();
        const awayTeamIdStr = awayTeamId?.toString();
        const homeMatch = selectedTeamIds.includes(homeTeamIdStr) || selectedTeamIds.includes(homeTeamId);
        const awayMatch = selectedTeamIds.includes(awayTeamIdStr) || selectedTeamIds.includes(awayTeamId);
        if (homeMatch || awayMatch) {
          matched = true;
        }
      }
      
      return matched;
    });
    
    return filtered;
  };

  // Get the filtered matches for display (memoized)
  // FIXED: Include filterData in dependencies to ensure re-computation when filterData is ready
  const filteredMatches = useMemo(() => {
    const result = getFilteredMatches();
    // Reduced logging - only log when filter state changes significantly
    return result;
  }, [matches, selectedFilters, filterData]);
```

**Impact**:
- On initial load with pre-selected filters, matches may be filtered incorrectly
- Filter data might not be ready when filtering occurs, causing silent failures
- The guard clause returns all matches when filterData isn't ready, which is correct but masks the underlying timing issue

**Evidence of Race Condition**:
```332:352:flight-match-finder/mobile-app/screens/MapResultsScreen.js
  // Process real match data for filters
  // FIXED: Initialize filterData from initialMatches immediately on mount to prevent race condition
  useEffect(() => {
    // On mount, process initialMatches immediately if filterData is not ready
    if (initialMatches && initialMatches.length > 0) {
      const currentMatchIds = initialMatches.map(m => m.id || m.fixture?.id).filter(Boolean).sort();
      const previousMatchIds = filterData?.matchIds || [];
      
      // Only process if match IDs are different (avoid unnecessary updates)
      if (JSON.stringify(currentMatchIds) !== JSON.stringify(previousMatchIds)) {
        console.log('🔧 [INIT] Processing filterData from initialMatches:', initialMatches.length);
        processMatchesForFilters(initialMatches);
      }
    }
  }, []); // Run once on mount

  // Process matches when they change (after initial mount)
  useEffect(() => {
    // Only process filter data if we have meaningful matches and they're different from current filter data
    if (matches && matches.length > 0) {
      processMatchesForFilters(matches);
    }
  }, [matches, processMatchesForFilters]);
```

The `processMatchesForFilters` callback depends on `filterData` (line 328), creating a circular dependency that can cause stale closures.

---

### 🟡 MODERATE: Complex Multi-Stage Filter Chain

**Location**: `MapResultsScreen.js:1044-1121`

**Problem**:
The filtering logic is split across multiple memoized computations, creating a complex dependency chain that's difficult to debug and maintain:

```
matches (state)
  ↓
getFilteredMatches() → filteredMatches (useMemo)
  ↓
finalFilteredMatches (useMemo with date filtering)
  ↓
displayFilteredMatches (useMemo - redundant wrapper)
  ↓
mapMarkersMatches (useMemo - filters invalid coordinates)
  ↓
MapView markers prop
```

**Code**:
```1052:1121:flight-match-finder/mobile-app/screens/MapResultsScreen.js
  // Get the final filtered matches combining both filters and date selection
  // This is now the SINGLE SOURCE OF TRUTH for all filtered data
  const finalFilteredMatches = useMemo(() => {
    if (!selectedDateHeader) {
      return filteredMatches; // Show filter-filtered matches when no date header is selected
    }
    
    // Apply date filtering to the already filter-filtered matches
    const dateFiltered = filteredMatches.filter(match => {
      const matchDate = new Date(match.fixture?.date);
      const selectedDate = new Date(selectedDateHeader);
      
      return matchDate.toDateString() === selectedDate.toDateString();
    });
    
    return dateFiltered;
  }, [filteredMatches, selectedDateHeader]);
  
  // Get filtered matches for bottom drawer (NO viewport filtering - shows all matches from search)
  const displayFilteredMatches = useMemo(() => {
    // Bottom drawer shows all matches from the search (filtered by user filters and date only)
    // Does NOT filter by viewport - remains constant until new search
    const final = finalFilteredMatches || [];
    
    // Reduced logging - this updates frequently
    return final;
  }, [finalFilteredMatches, matches, filteredMatches, selectedDateHeader]);

  // Debounced map region state - only updates after user stops panning/zooming
  // Used for "search this area" button visibility and other UI updates
  const [debouncedMapRegion, setDebouncedMapRegion] = useState(initialRegion || mapRegion);
  
  // Debounce map region updates to prevent rapid UI updates during pan/zoom
  useEffect(() => {
    if (!mapRegion) return;
    
    const timer = setTimeout(() => {
      setDebouncedMapRegion(mapRegion);
    }, 300); // 300ms delay - update after user stops moving map
    
    return () => clearTimeout(timer);
  }, [mapRegion]);

  // Get matches for map markers - show all loaded markers
  // Native map library handles viewport culling and off-screen rendering
  const mapMarkersMatches = useMemo(() => {
    const allMarkers = displayFilteredMatches || [];
    
    // Filter out matches without valid coordinates
    const validMarkers = allMarkers.filter(match => {
      const venue = match.fixture?.venue;
      const coordinates = venue?.coordinates;
      const isValid = coordinates && Array.isArray(coordinates) && coordinates.length === 2;
      
      // Additional validation: check coordinates are numbers
      if (isValid) {
        const [lon, lat] = coordinates;
        if (typeof lon !== 'number' || typeof lat !== 'number' ||
            lon < -180 || lon > 180 || lat < -90 || lat > 90) {
          return false;
        }
      }
      
      return isValid;
    });
    
    // Reduced logging - markers update frequently during map interactions
    
    return validMarkers;
  }, [displayFilteredMatches, matches]);
```

**Issues**:
1. **Redundant Wrapper**: `displayFilteredMatches` is just a pass-through of `finalFilteredMatches` with unnecessary dependencies
2. **Multiple Filtering Passes**: Each stage re-filters the array, potentially inefficient for large datasets
3. **Dependency Confusion**: `displayFilteredMatches` includes `matches` and `filteredMatches` in dependencies even though it only uses `finalFilteredMatches`
4. **Hard to Debug**: If filtering fails at any stage, it's difficult to identify which stage is the problem

**Impact**:
- Performance: Multiple array iterations for large match sets
- Maintainability: Changes to filtering logic require understanding the entire chain
- Debugging: Silent failures are hard to trace through the chain

---

### 🟡 MODERATE: Inconsistent ID Type Handling

**Location**: `MapResultsScreen.js:996-1039`

**Problem**:
The filtering logic attempts to normalize IDs to strings, but the normalization is inconsistent and incomplete:

```996:1039:flight-match-finder/mobile-app/screens/MapResultsScreen.js
    const filtered = matches.filter(match => {
      let matched = false;
      
      // Country OR
      if (selectedCountryIds.length > 0) {
        const matchCountry =
          match.area?.code ||
          match.area?.id?.toString() ||
          (typeof match.venue?.country === 'string'
            ? match.venue.country
            : match.venue?.country?.id?.toString());
        if (selectedCountryIds.includes(matchCountry)) {
          matched = true;
        }
      }
      
      // League OR
      if (selectedLeagueIds.length > 0) {
        const matchLeague =
          match.competition?.id?.toString() ||
          match.competition?.code?.toString() ||
          (typeof match.league === 'string'
            ? match.league
            : match.league?.id?.toString() || match.league?.name);
        if (selectedLeagueIds.includes(matchLeague)) {
          matched = true;
        }
      }
      
      // Team OR
      if (selectedTeamIds.length > 0) {
        const homeTeamId = match.teams?.home?.id;
        const awayTeamId = match.teams?.away?.id;
        const homeTeamIdStr = homeTeamId?.toString();
        const awayTeamIdStr = awayTeamId?.toString();
        const homeMatch = selectedTeamIds.includes(homeTeamIdStr) || selectedTeamIds.includes(homeTeamId);
        const awayMatch = selectedTeamIds.includes(awayTeamIdStr) || selectedTeamIds.includes(awayTeamId);
        if (homeMatch || awayMatch) {
          matched = true;
        }
      }
      
      return matched;
    });
```

**Issues**:
1. **Country**: Uses fallback chain but doesn't normalize `matchCountry` to string before comparison
2. **League**: Uses `match.league?.name` as fallback, which may not match IDs
3. **Team**: Checks both string and original ID, but `selectedTeamIds` are already normalized to strings, so the original ID check is redundant
4. **Type Mismatches**: If backend returns numeric IDs but filterData has string IDs (or vice versa), filtering will fail silently

**Impact**:
- Matches may not be filtered correctly when ID types don't match
- Silent failures when IDs are semantically the same but different types
- Difficult to debug why certain matches don't appear after filtering

---

### 🟡 MODERATE: Heavy UI Logic in Filter Processing

**Location**: `MapResultsScreen.js:101-328`

**Problem**:
The `processMatchesForFilters` function contains 227 lines of complex data transformation logic directly in the component file. This includes:
- Multiple fallback strategies for extracting country/league/team data
- Complex nested data structure traversal
- Fallback data generation when no structured data is found

**Code**:
```101:328:flight-match-finder/mobile-app/screens/MapResultsScreen.js
  // Process matches for filter data (extracted to reusable function)
  // FIXED: Moved before useEffect to fix function definition order
  const processMatchesForFilters = useCallback((matchesToProcess) => {
    if (!matchesToProcess || matchesToProcess.length === 0) return;
    
    const currentMatchIds = matchesToProcess.map(m => m.id || m.fixture?.id).filter(Boolean).sort();
    const previousMatchIds = filterData?.matchIds || [];
    
    // Only update if match IDs are different (avoid unnecessary updates on map movement)
    if (JSON.stringify(currentMatchIds) !== JSON.stringify(previousMatchIds)) {
        // Extract unique countries, leagues, and teams from matches
        const countriesMap = new Map();
        const leaguesMap = new Map();
        const teamsMap = new Map();

        matchesToProcess.forEach((match) => {
          // Process country from area.name
          let countryId = null;
          let countryName = null;
          
          if (match.area?.name) {
            countryId = match.area.code || match.area.id?.toString();
            countryName = match.area.name;
          }
          
          // Fallback: try to extract from league.country (backend returns this)
          if (!countryId && match.league && match.league.country) {
            countryId = match.league.country;
            countryName = match.league.country;
          }
          
          // Fallback: try to extract from venue or other fields
          if (!countryId && match.venue && match.venue.country) {
            if (typeof match.venue.country === 'string') {
              countryId = match.venue.country;
              countryName = match.venue.country;
            } else if (match.venue.country.id) {
              countryId = match.venue.country.id;
              countryName = match.venue.country.name;
            }
          }

          if (countryId) {
            if (!countriesMap.has(countryId)) {
              countriesMap.set(countryId, {
                id: countryId,
                name: countryName,
                count: 1
              });
            } else {
              countriesMap.get(countryId).count++;
            }
          }

          // Process league from competition.name
          let leagueId = null;
          let leagueName = null;
          
          if (match.competition?.name) {
            leagueId = match.competition.id || match.competition.code;
            leagueName = match.competition.name;
          }
          
          // Fallback: try match.league if competition doesn't exist
          if (!leagueId && match.league) {
            if (typeof match.league === 'string') {
              leagueId = match.league;
              leagueName = match.league;
            } else if (match.league.id) {
              leagueId = match.league.id;
              leagueName = match.league.name;
            } else if (match.league.name) {
              leagueId = match.league.name;
              leagueName = match.league.name;
            }
          }

          if (leagueId) {
            if (!leaguesMap.has(leagueId)) {
              leaguesMap.set(leagueId, {
                id: leagueId,
                name: leagueName,
                countryId: countryId || 'unknown',
                count: 1
              });
            } else {
              leaguesMap.get(leagueId).count++;
            }
          }

          // Process teams from teams.home and teams.away
          const processTeam = (team, teamType) => {
            let teamId = null;
            let teamName = null;
            
            if (team) {
              if (typeof team === 'string') {
                teamId = team;
                teamName = team;
              } else if (team.id) {
                teamId = team.id;
                teamName = team.name;
              } else if (team.name) {
                teamId = team.name;
                teamName = team.name;
              }
            }

            if (teamId) {
              if (!teamsMap.has(teamId)) {
                teamsMap.set(teamId, {
                  id: teamId,
                  name: teamName,
                  countryId: countryId || 'unknown',
                  leagueId: leagueId || 'unknown',
                  count: 1
                });
              } else {
                teamsMap.get(teamId).count++;
              }
            }
          };

          // Process home team from teams.home
          if (match.teams?.home) {
            processTeam(match.teams.home, 'home');
          }
          
          // Process away team from teams.away
          if (match.teams?.away) {
            processTeam(match.teams.away, 'away');
          }
        });

        const filterData = {
          countries: Array.from(countriesMap.values()),
          leagues: Array.from(leaguesMap.values()),
          teams: Array.from(teamsMap.values()),
          matchIds: currentMatchIds // Add match IDs to track changes
        };

        // If we still don't have any data, create some basic fallback data
        if (filterData.countries.length === 0 && filterData.leagues.length === 0 && filterData.teams.length === 0) {
          if (__DEV__) {
            console.log('No structured data found, creating fallback data');
          }
          
          // Try to create some basic data from the first match
          const firstMatch = matches[0];
          let fallbackData = {
            countries: [],
            leagues: [],
            teams: [],
            matchIds: currentMatchIds
          };
          
          // Try to extract basic info from the first match
          if (firstMatch) {
            if (firstMatch.area?.name) {
              fallbackData.countries.push({
                id: firstMatch.area.code || firstMatch.area.id?.toString() || 'unknown',
                name: firstMatch.area.name,
                count: matches.length
              });
            }
            
            if (firstMatch.competition?.name) {
              fallbackData.leagues.push({
                id: firstMatch.competition.id || firstMatch.competition.code || 'unknown',
                name: firstMatch.competition.name,
                countryId: firstMatch.area?.code || firstMatch.area?.id?.toString() || 'unknown',
                count: matches.length
              });
            }
            
            if (firstMatch.teams?.home?.name) {
              fallbackData.teams.push({
                id: firstMatch.teams.home.id || firstMatch.teams.home.name,
                name: firstMatch.teams.home.name,
                countryId: firstMatch.area?.code || firstMatch.area?.id?.toString() || 'unknown',
                leagueId: firstMatch.competition?.id || firstMatch.competition?.code || 'unknown',
                count: 1
              });
            }
            
            if (firstMatch.teams?.away?.name) {
              fallbackData.teams.push({
                id: firstMatch.teams.away.id || firstMatch.teams.away.name,
                name: firstMatch.teams.away.name,
                countryId: firstMatch.area?.code || firstMatch.area?.id?.toString() || 'unknown',
                leagueId: firstMatch.competition?.id || firstMatch.competition?.code || 'unknown',
                count: 1
              });
            }
          }
          
          // If we still don't have data, use generic fallback
          if (fallbackData.countries.length === 0) {
            fallbackData.countries.push({
              id: 'unknown', 
              name: 'Unknown Country', 
              count: matches.length
            });
          }
          
          if (fallbackData.leagues.length === 0) {
            fallbackData.leagues.push({
              id: 'unknown', 
              name: 'Unknown League', 
              countryId: fallbackData.countries[0].id, 
              count: matches.length
            });
          }
          
          if (fallbackData.teams.length === 0) {
            fallbackData.teams.push({
              id: 'unknown', 
              name: 'Unknown Team', 
              countryId: fallbackData.countries[0].id, 
              leagueId: fallbackData.leagues[0].id, 
              count: matches.length
            });
          }
          
          updateFilterData(fallbackData);
        } else {
          updateFilterData(filterData);
        }
    }
  }, [filterData, updateFilterData]);
```

**Issues**:
1. **Component Bloat**: 227 lines of data processing logic in a UI component
2. **Testability**: Difficult to unit test this logic in isolation
3. **Reusability**: Logic is tightly coupled to component state
4. **Maintainability**: Changes to data structure require modifying component code

**Note**: There's a `filterDataProcessor.js` utility file that appears to be an alternative implementation, but it's not being used.

**Impact**:
- Component file is 2160 lines (too large)
- Logic is harder to test and maintain
- Duplication risk if other screens need similar processing

---

### 🟢 MINOR: Redundant Dependencies in useMemo

**Location**: `MapResultsScreen.js:1071-1078`

**Problem**:
`displayFilteredMatches` includes unnecessary dependencies:

```1071:1078:flight-match-finder/mobile-app/screens/MapResultsScreen.js
  // Get filtered matches for bottom drawer (NO viewport filtering - shows all matches from search)
  const displayFilteredMatches = useMemo(() => {
    // Bottom drawer shows all matches from the search (filtered by user filters and date only)
    // Does NOT filter by viewport - remains constant until new search
    const final = finalFilteredMatches || [];
    
    // Reduced logging - this updates frequently
    return final;
  }, [finalFilteredMatches, matches, filteredMatches, selectedDateHeader]);
```

**Issues**:
- `matches` and `filteredMatches` are in dependencies but not used in the computation
- `selectedDateHeader` is in dependencies but not used (date filtering is already in `finalFilteredMatches`)
- This causes unnecessary re-computations when these values change

**Impact**:
- Performance: Unnecessary memo recalculations
- Confusion: Makes it unclear what actually drives this computation

---

### 🟢 MINOR: Missing Filter State Validation

**Location**: `MapResultsScreen.js:969-1042`

**Problem**:
The `getFilteredMatches` function doesn't validate that selected filter IDs actually exist in `filterData`. This can lead to:
- Filters being applied that don't match any matches (wasteful computation)
- Silent failures when filter IDs are invalid
- No user feedback when filters are stale (e.g., after new search with different matches)

**Impact**:
- Performance: Filtering with invalid IDs still iterates through all matches
- UX: No feedback when filters don't match current dataset

---

## Recommendations

### Priority 1: Fix Race Condition with Synchronous Filter Data Processing

**Problem**: Filter data updates are async, causing race conditions.

**Solution**: Make `processMatchesForFilters` return data synchronously instead of updating context directly.

**Refactor**:
```javascript
// Extract to utility function (or keep in component but make it pure)
const processMatchesForFilters = (matchesToProcess, currentFilterData) => {
  if (!matchesToProcess || matchesToProcess.length === 0) {
    return currentFilterData || { countries: [], leagues: [], teams: [], matchIds: [] };
  }
  
  const currentMatchIds = matchesToProcess.map(m => m.id || m.fixture?.id).filter(Boolean).sort();
  const previousMatchIds = currentFilterData?.matchIds || [];
  
  // Only process if match IDs are different
  if (JSON.stringify(currentMatchIds) === JSON.stringify(previousMatchIds)) {
    return currentFilterData; // Return existing data
  }
  
  // ... processing logic (same as current) ...
  
  return filterData; // Return instead of updating context
};

// In component:
useEffect(() => {
  if (initialMatches && initialMatches.length > 0) {
    const newFilterData = processMatchesForFilters(initialMatches, filterData);
    if (newFilterData !== filterData) {
      updateFilterData(newFilterData);
    }
  }
}, [initialMatches]); // Remove filterData dependency

// Or use local state first, then sync to context:
const [localFilterData, setLocalFilterData] = useState(null);

useEffect(() => {
  if (initialMatches && initialMatches.length > 0) {
    const newFilterData = processMatchesForFilters(initialMatches, localFilterData);
    setLocalFilterData(newFilterData);
    updateFilterData(newFilterData); // Sync to context
  }
}, [initialMatches]);
```

**Benefits**:
- Eliminates race condition by making processing synchronous
- Easier to test (pure function)
- Clearer data flow

---

### Priority 2: Simplify Filter Chain

**Problem**: Multi-stage filter chain is complex and hard to debug.

**Solution**: Consolidate filtering into a single, well-documented function.

**Refactor**:
```javascript
// Single filtering function that handles all cases
const getFilteredMatches = useMemo(() => {
  if (!matches || matches.length === 0) return [];
  if (!filterData || !filterData.matchIds || filterData.matchIds.length === 0) {
    return matches; // Filter data not ready
  }
  
  let filtered = matches;
  
  // Apply user filters (countries, leagues, teams)
  if (selectedFilters && hasActiveFilters(selectedFilters)) {
    filtered = applyUserFilters(filtered, selectedFilters);
  }
  
  // Apply date filter
  if (selectedDateHeader) {
    filtered = applyDateFilter(filtered, selectedDateHeader);
  }
  
  return filtered;
}, [matches, filterData, selectedFilters, selectedDateHeader]);

// Remove intermediate steps:
// - Remove filteredMatches
// - Remove finalFilteredMatches  
// - Remove displayFilteredMatches
// Use getFilteredMatches directly for both map markers and bottom drawer

// For map markers, just filter invalid coordinates:
const mapMarkersMatches = useMemo(() => {
  return getFilteredMatches.filter(match => {
    const venue = match.fixture?.venue;
    const coordinates = venue?.coordinates;
    return coordinates && 
           Array.isArray(coordinates) && 
           coordinates.length === 2 &&
           typeof coordinates[0] === 'number' &&
           typeof coordinates[1] === 'number' &&
           coordinates[0] >= -180 && coordinates[0] <= 180 &&
           coordinates[1] >= -90 && coordinates[1] <= 90;
  });
}, [getFilteredMatches]);
```

**Benefits**:
- Single source of truth for filtering
- Easier to debug (one place to check)
- Better performance (fewer array iterations)
- Clearer dependencies

---

### Priority 3: Extract Filter Processing to Utility

**Problem**: 227 lines of data processing logic in component file.

**Solution**: Move `processMatchesForFilters` to `utils/filterDataProcessor.js` and use it.

**Refactor**:
```javascript
// utils/filterDataProcessor.js
export function processMatchesForFilters(matchesToProcess, currentFilterData = null) {
  // Move all processing logic here
  // Make it a pure function that returns filterData
  // Add comprehensive JSDoc comments
}

// MapResultsScreen.js
import { processMatchesForFilters } from '../utils/filterDataProcessor';

// In component:
useEffect(() => {
  if (initialMatches && initialMatches.length > 0) {
    const newFilterData = processMatchesForFilters(initialMatches, filterData);
    if (newFilterData !== filterData) {
      updateFilterData(newFilterData);
    }
  }
}, [initialMatches]);
```

**Benefits**:
- Component file is smaller and more focused
- Logic is testable in isolation
- Reusable across screens
- Better separation of concerns

---

### Priority 4: Normalize ID Types Consistently

**Problem**: Inconsistent ID type handling causes filtering failures.

**Solution**: Create a utility function to normalize IDs consistently.

**Refactor**:
```javascript
// utils/idNormalizer.js
export function normalizeId(id) {
  if (id == null) return null;
  return String(id).trim();
}

export function normalizeIds(ids) {
  if (!Array.isArray(ids)) return [];
  return ids.map(normalizeId).filter(Boolean);
}

// In getFilteredMatches:
const selectedCountryIds = normalizeIds(selectedFilters.countries);
const selectedLeagueIds = normalizeIds(selectedFilters.leagues);
const selectedTeamIds = normalizeIds(selectedFilters.teams);

// When extracting match IDs:
const matchCountry = normalizeId(
  match.area?.code || 
  match.area?.id || 
  match.venue?.country?.id ||
  (typeof match.venue?.country === 'string' ? match.venue.country : null)
);

if (matchCountry && selectedCountryIds.includes(matchCountry)) {
  matched = true;
}
```

**Benefits**:
- Consistent ID handling throughout
- Prevents type mismatch bugs
- Easier to debug

---

### Priority 5: Add Filter Validation

**Problem**: No validation that selected filters exist in current filterData.

**Solution**: Validate filters before applying them.

**Refactor**:
```javascript
const getFilteredMatches = useMemo(() => {
  // ... existing checks ...
  
  // Validate that selected filter IDs exist in filterData
  const validFilters = validateFilters(selectedFilters, filterData);
  if (!validFilters.isValid) {
    console.warn('Invalid filters detected:', validFilters.invalidIds);
    // Optionally: Clear invalid filters or show user warning
  }
  
  // Use validated filters
  const { countries, leagues, teams } = validFilters.filters;
  
  // ... rest of filtering logic ...
}, [matches, filterData, selectedFilters]);

function validateFilters(selectedFilters, filterData) {
  const invalidIds = {
    countries: [],
    leagues: [],
    teams: []
  };
  
  const validCountryIds = new Set(filterData.countries.map(c => String(c.id)));
  const validLeagueIds = new Set(filterData.leagues.map(l => String(l.id)));
  const validTeamIds = new Set(filterData.teams.map(t => String(t.id)));
  
  const validFilters = {
    countries: selectedFilters.countries.filter(id => {
      const isValid = validCountryIds.has(String(id));
      if (!isValid) invalidIds.countries.push(id);
      return isValid;
    }),
    leagues: selectedFilters.leagues.filter(id => {
      const isValid = validLeagueIds.has(String(id));
      if (!isValid) invalidIds.leagues.push(id);
      return isValid;
    }),
    teams: selectedFilters.teams.filter(id => {
      const isValid = validTeamIds.has(String(id));
      if (!isValid) invalidIds.teams.push(id);
      return isValid;
    })
  };
  
  const hasInvalid = invalidIds.countries.length > 0 || 
                     invalidIds.leagues.length > 0 || 
                     invalidIds.teams.length > 0;
  
  return {
    filters: validFilters,
    isValid: !hasInvalid,
    invalidIds
  };
}
```

**Benefits**:
- Prevents filtering with invalid IDs
- Better debugging (know which filters are invalid)
- Can provide user feedback

---

## Example Refactor

Here's a simplified version showing the key improvements:

```javascript
// utils/filterDataProcessor.js
export function processMatchesForFilters(matchesToProcess, currentFilterData = null) {
  if (!matchesToProcess || matchesToProcess.length === 0) {
    return currentFilterData || { countries: [], leagues: [], teams: [], matchIds: [] };
  }
  
  const currentMatchIds = matchesToProcess
    .map(m => m.id || m.fixture?.id)
    .filter(Boolean)
    .sort();
  
  const previousMatchIds = currentFilterData?.matchIds || [];
  if (JSON.stringify(currentMatchIds) === JSON.stringify(previousMatchIds)) {
    return currentFilterData; // No change
  }
  
  // ... processing logic (extracted from component) ...
  
  return {
    countries: Array.from(countriesMap.values()),
    leagues: Array.from(leaguesMap.values()),
    teams: Array.from(teamsMap.values()),
    matchIds: currentMatchIds
  };
}

// utils/filterHelpers.js
export function normalizeId(id) {
  if (id == null) return null;
  return String(id).trim();
}

export function applyUserFilters(matches, selectedFilters, filterData) {
  if (!hasActiveFilters(selectedFilters)) return matches;
  
  const selectedCountryIds = normalizeIds(selectedFilters.countries);
  const selectedLeagueIds = normalizeIds(selectedFilters.leagues);
  const selectedTeamIds = normalizeIds(selectedFilters.teams);
  
  return matches.filter(match => {
    // Country match
    if (selectedCountryIds.length > 0) {
      const matchCountry = normalizeId(
        match.area?.code || 
        match.area?.id || 
        match.venue?.country?.id ||
        (typeof match.venue?.country === 'string' ? match.venue.country : null)
      );
      if (matchCountry && selectedCountryIds.includes(matchCountry)) {
        return true;
      }
    }
    
    // League match
    if (selectedLeagueIds.length > 0) {
      const matchLeague = normalizeId(
        match.competition?.id || 
        match.competition?.code ||
        match.league?.id ||
        (typeof match.league === 'string' ? match.league : null)
      );
      if (matchLeague && selectedLeagueIds.includes(matchLeague)) {
        return true;
      }
    }
    
    // Team match
    if (selectedTeamIds.length > 0) {
      const homeTeamId = normalizeId(match.teams?.home?.id);
      const awayTeamId = normalizeId(match.teams?.away?.id);
      if ((homeTeamId && selectedTeamIds.includes(homeTeamId)) ||
          (awayTeamId && selectedTeamIds.includes(awayTeamId))) {
        return true;
      }
    }
    
    return false;
  });
}

export function applyDateFilter(matches, selectedDate) {
  if (!selectedDate) return matches;
  const selectedDateStr = new Date(selectedDate).toDateString();
  return matches.filter(match => {
    const matchDate = new Date(match.fixture?.date);
    return matchDate.toDateString() === selectedDateStr;
  });
}

// MapResultsScreen.js (simplified)
import { processMatchesForFilters } from '../utils/filterDataProcessor';
import { applyUserFilters, applyDateFilter } from '../utils/filterHelpers';

// ... component code ...

// Single filtering computation
const filteredMatches = useMemo(() => {
  if (!matches || matches.length === 0) return [];
  
  // Guard: filter data not ready
  if (!filterData || !filterData.matchIds || filterData.matchIds.length === 0) {
    return matches;
  }
  
  let result = matches;
  
  // Apply user filters
  if (selectedFilters) {
    result = applyUserFilters(result, selectedFilters, filterData);
  }
  
  // Apply date filter
  if (selectedDateHeader) {
    result = applyDateFilter(result, selectedDateHeader);
  }
  
  return result;
}, [matches, filterData, selectedFilters, selectedDateHeader]);

// Map markers (just filter invalid coordinates)
const mapMarkersMatches = useMemo(() => {
  return filteredMatches.filter(match => {
    const coords = match.fixture?.venue?.coordinates;
    return coords && 
           Array.isArray(coords) && 
           coords.length === 2 &&
           typeof coords[0] === 'number' &&
           typeof coords[1] === 'number' &&
           coords[0] >= -180 && coords[0] <= 180 &&
           coords[1] >= -90 && coords[1] <= 90;
  });
}, [filteredMatches]);

// Use filteredMatches for bottom drawer, mapMarkersMatches for map
```

**Benefits of this refactor**:
- ✅ Eliminates race condition (synchronous processing)
- ✅ Simplifies filter chain (single computation)
- ✅ Extracts heavy logic to utilities (testable, reusable)
- ✅ Consistent ID normalization
- ✅ Clearer dependencies
- ✅ Easier to debug and maintain

---

## Summary

The filtering system has several architectural concerns:

1. **Race Condition**: Filter data updates are async, causing timing issues
2. **Complex Chain**: Multi-stage filtering is hard to debug and maintain
3. **Type Inconsistency**: ID normalization is incomplete
4. **Heavy UI Logic**: 227 lines of data processing in component
5. **Redundant Dependencies**: Unnecessary memo recalculations

**Recommended Action Plan**:
1. **Immediate**: Fix race condition with synchronous processing
2. **Short-term**: Simplify filter chain to single computation
3. **Short-term**: Extract processing logic to utility
4. **Medium-term**: Normalize ID types consistently
5. **Medium-term**: Add filter validation

These changes will improve performance, maintainability, and debuggability while reducing the risk of filtering bugs.


