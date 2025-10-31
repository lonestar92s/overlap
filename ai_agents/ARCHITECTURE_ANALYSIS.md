# React Native Architecture Analysis

**Date**: 2024-12-19  
**Focus**: Structure, Scalability, Performance, Anti-patterns, Heavy UI Logic, Duplications

---

## Executive Summary

The codebase shows good foundational patterns (Context API, service layer, design tokens) but suffers from several scalability and maintainability issues. The main concerns are:

1. **Oversized Components**: Multiple screens/components exceed 500+ lines with 15+ state variables
2. **State Management Fragmentation**: Contexts use `useState` instead of `useReducer` for complex state
3. **Missing Custom Hooks**: Business logic embedded directly in components
4. **Inconsistent Design Token Usage**: Design tokens exist but aren't universally applied
5. **Duplication**: ID normalization, API error handling, and filter logic repeated across files

---

## Findings

### 🔴 Critical Issues

#### 1. Oversized Components

**Location**: `screens/SearchScreen.js` (2,394 lines), `screens/MapResultsScreen.js` (1,381 lines)

**Problem**:
- `SearchScreen.js` manages 20+ state variables directly
- Complex business logic intermixed with presentation logic
- Difficult to test, maintain, and debug

**Example**:
```12:66:flight-match-finder/mobile-app/screens/SearchScreen.js
const SearchScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [location, setLocation] = useState(null);
  const [selectedDates, setSelectedDates] = useState({});
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);
  // ... 12+ more state variables
```

**Impact**: High - Makes code reviews, debugging, and feature additions extremely difficult

---

#### 2. Context State Management Anti-pattern

**Location**: `contexts/FilterContext.js`, `contexts/ItineraryContext.js`

**Problem**:
- Using multiple `useState` calls instead of `useReducer` for related state
- No centralized action types or state transitions
- Makes state updates error-prone and difficult to reason about

**Example**:
```13:55:flight-match-finder/mobile-app/contexts/FilterContext.js
export const FilterProvider = ({ children }) => {
  const [filterData, setFilterData] = useState({
    countries: [],
    leagues: [],
    teams: []
  });

  const [selectedFilters, setSelectedFilters] = useState({
    countries: [],
    leagues: [],
    teams: []
  });

  const [filterModalVisible, setFilterModalVisible] = useState(false);
```

**Impact**: Medium - Reduces predictability and makes complex updates harder

---

#### 3. ID Normalization Duplication

**Location**: `contexts/ItineraryContext.js` (multiple places)

**Problem**:
- ID normalization logic (`id` vs `_id`) repeated in multiple functions
- Inconsistent handling across create/update/delete operations

**Example**:
```47:58:flight-match-finder/mobile-app/contexts/ItineraryContext.js
        // Ensure we have the correct ID field (MongoDB uses _id for subdocuments)
        if (!newItinerary.id && newItinerary._id) {
          newItinerary.id = newItinerary._id;
        }
```

This pattern appears 5+ times in the same file.

**Impact**: Medium - Maintenance burden and potential bugs

---

#### 4. Heavy UI Logic in Components

**Location**: `screens/MapResultsScreen.js`, `screens/TripOverviewScreen.js`

**Problem**:
- Map region calculations, bounds transformations, and data formatting embedded in components
- No separation of concerns between data transformation and presentation

**Impact**: Medium - Harder to test and reuse logic

---

### 🟡 Moderate Issues

#### 5. Missing Custom Hooks

**Problem**: Complex logic that should be extracted:
- Search state management (`useSearchState`)
- Map bounds handling (`useMapBounds`)
- Match filtering (`useMatchFilters`)
- Date range handling (`useDateRange`)

**Impact**: Medium - Code duplication and testing difficulties

---

#### 6. Inconsistent Design Token Usage

**Location**: Multiple components

**Problem**:
- `designTokens.js` exists with proper structure
- Many components still use hardcoded colors/spacing
- Mix of `StyleSheet.create` and inline styles

**Example** - Good:
```135:224:flight-match-finder/mobile-app/components/AttendanceModal.js
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
```

**Example** - Bad:
```385:438:flight-match-finder/mobile-app/App.js
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
```

**Impact**: Low-Medium - Visual inconsistency and maintenance overhead

---

#### 7. AccountScreen in App.js

**Location**: `App.js` lines 35-176

**Problem**:
- Screen component defined in navigation setup file
- Should be extracted to `screens/AccountScreen.js`
- Violates separation of concerns

**Impact**: Low - Organizational issue, easy to fix

---

#### 8. Missing Memoization

**Location**: Multiple screens with heavy computations

**Problem**:
- Filtered lists, transformed data computed on every render
- Missing `useMemo` for expensive calculations
- Missing `useCallback` for event handlers passed to children

**Impact**: Medium - Performance degradation with large datasets

---

#### 9. Inline Style Objects

**Problem**: Some components use inline style objects instead of `StyleSheet.create`
- Performance impact (objects recreated on each render)
- No optimization from React Native's StyleSheet

**Impact**: Low - Minor performance impact, but easy to fix

---

### 🟢 Minor Issues

#### 10. TODO Comments in Production Code

**Location**: `screens/SearchScreen.js` lines 75-101

**Problem**: Commented-out code with TODOs should be removed or implemented

**Impact**: Low - Code cleanliness

---

#### 11. Console.log Statements

**Location**: Throughout codebase

**Problem**: Many `console.log` statements left in production code
- Should use a logging utility or be removed

**Impact**: Low - Performance and debugging confusion

---

## Recommendations

### Priority 1: Immediate (Next Sprint)

#### 1. Extract AccountScreen
**File**: Create `screens/AccountScreen.js`
**Refactor**: Move `AccountScreen` component from `App.js`

**Why**: Clean separation of concerns, follows project structure

---

#### 2. Refactor FilterContext to useReducer
**File**: `contexts/FilterContext.js`

**Why**: 
- Filter state has clear actions (SELECT_COUNTRY, SELECT_LEAGUE, etc.)
- Prevents state update bugs
- Easier to add undo/redo later

---

#### 3. Create ID Normalization Utility
**File**: Create `utils/idNormalizer.js`

**Why**: 
- Single source of truth for ID handling
- Reduces duplication
- Easier to update if backend changes

---

### Priority 2: Short-term (Next 2-3 Sprints)

#### 4. Extract Custom Hooks

Create the following hooks:

**a) `hooks/useSearchState.js`**
- Manages search query, location, dates, filters
- Returns state and handlers

**b) `hooks/useMapBounds.js`**
- Handles map region calculations
- Bounds transformations
- Used by MapResultsScreen, ItineraryMapScreen

**c) `hooks/useMatchFilters.js`**
- Filter application logic
- Match filtering computations
- Memoized filtered results

**d) `hooks/useDateRange.js`**
- Date range selection
- Formatting and validation
- Used by SearchScreen, MapSearchScreen

---

#### 5. Break Down Large Components

**a) SearchScreen.js** → Extract into:
- `SearchScreen.js` (orchestration, ~200 lines)
- `components/SearchForm.js` (form UI)
- `components/SearchResults.js` (results display)
- `components/PopularMatchesSection.js` (recommended matches)
- `hooks/useSearchScreen.js` (state + logic)

**b) MapResultsScreen.js** → Extract into:
- `MapResultsScreen.js` (orchestration)
- `components/MapResultsContainer.js` (map + bottom sheet)
- `hooks/useMapResults.js` (state + logic)

---

#### 6. Standardize Design Token Usage

**Action Items**:
1. Audit all components for hardcoded values
2. Create migration script to replace common patterns
3. Add ESLint rule to warn about non-token usage
4. Update components incrementally

---

### Priority 3: Medium-term (Next Quarter)

#### 7. Performance Optimizations

**a) Add Memoization**:
- Wrap expensive computations in `useMemo`
- Wrap event handlers in `useCallback`
- Use `React.memo` for pure components

**b) FlatList Optimization**:
- Implement `getItemLayout` where possible
- Use `keyExtractor` consistently
- Consider `windowSize` and `initialNumToRender`

**c) Image Optimization**:
- Implement image caching strategy
- Use `expo-image` with proper cache settings
- Lazy load images in lists

---

#### 8. Testing Infrastructure

**Add**:
- Unit tests for custom hooks
- Component tests for complex UI
- Integration tests for critical flows
- Test utilities for common scenarios

---

## Example Refactor

### Before: FilterContext with useState

```typescript
// contexts/FilterContext.js (Current)
export const FilterProvider = ({ children }) => {
  const [filterData, setFilterData] = useState({
    countries: [],
    leagues: [],
    teams: []
  });
  const [selectedFilters, setSelectedFilters] = useState({
    countries: [],
    leagues: [],
    teams: []
  });
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const updateSelectedFilters = useCallback((filters) => {
    setSelectedFilters(filters);
  }, []);

  // ... more setters
}
```

### After: FilterContext with useReducer

```typescript
// contexts/FilterContext.js (Refactored)

const initialState = {
  filterData: { countries: [], leagues: [], teams: [] },
  selectedFilters: { countries: [], leagues: [], teams: [] },
  filterModalVisible: false,
};

const filterReducer = (state, action) => {
  switch (action.type) {
    case 'SET_FILTER_DATA':
      return { ...state, filterData: action.payload };
    
    case 'TOGGLE_COUNTRY':
      const { countryId } = action.payload;
      const countrySelected = state.selectedFilters.countries.includes(countryId);
      return {
        ...state,
        selectedFilters: {
          ...state.selectedFilters,
          countries: countrySelected
            ? state.selectedFilters.countries.filter(id => id !== countryId)
            : [...state.selectedFilters.countries, countryId],
          // Auto-deselect related leagues/teams when country deselected
          ...(countrySelected && {
            leagues: state.selectedFilters.leagues.filter(id => 
              !action.payload.relatedLeagueIds.includes(id)
            ),
            teams: state.selectedFilters.teams.filter(id =>
              !action.payload.relatedTeamIds.includes(id)
            ),
          }),
        },
      };
    
    case 'CLEAR_ALL_FILTERS':
      return {
        ...state,
        selectedFilters: { countries: [], leagues: [], teams: [] },
      };
    
    case 'OPEN_FILTER_MODAL':
      return { ...state, filterModalVisible: true };
    
    case 'CLOSE_FILTER_MODAL':
      return { ...state, filterModalVisible: false };
    
    default:
      return state;
  }
};

export const FilterProvider = ({ children }) => {
  const [state, dispatch] = useReducer(filterReducer, initialState);

  const value = {
    ...state,
    updateFilterData: useCallback((data) => {
      dispatch({ type: 'SET_FILTER_DATA', payload: data });
    }, []),
    toggleCountry: useCallback((countryId, relatedLeagueIds, relatedTeamIds) => {
      dispatch({ 
        type: 'TOGGLE_COUNTRY', 
        payload: { countryId, relatedLeagueIds, relatedTeamIds } 
      });
    }, []),
    clearAllFilters: useCallback(() => {
      dispatch({ type: 'CLEAR_ALL_FILTERS' });
    }, []),
    openFilterModal: useCallback(() => {
      dispatch({ type: 'OPEN_FILTER_MODAL' });
    }, []),
    closeFilterModal: useCallback(() => {
      dispatch({ type: 'CLOSE_FILTER_MODAL' });
    }, []),
  };

  return (
    <FilterContext.Provider value={value}>
      {children}
    </FilterContext.Provider>
  );
};
```

**Benefits**:
- ✅ Single source of truth for state updates
- ✅ Predictable state transitions
- ✅ Easier to add logging/debugging
- ✅ Can add undo/redo with history
- ✅ Better TypeScript support (with types)

---

### Before: ID Normalization Duplication

```typescript
// contexts/ItineraryContext.js (Current - repeated 5 times)
if (!newItinerary.id && newItinerary._id) {
  newItinerary.id = newItinerary._id;
}
```

### After: ID Normalization Utility

```typescript
// utils/idNormalizer.js
/**
 * Normalizes document IDs to ensure consistent `id` field
 * Handles MongoDB _id conversion and string normalization
 */
export const normalizeId = (doc) => {
  if (!doc) return null;
  
  // If already has id, ensure it's a string
  if (doc.id) {
    return { ...doc, id: String(doc.id) };
  }
  
  // Convert _id to id if present
  if (doc._id) {
    return { ...doc, id: String(doc._id) };
  }
  
  return doc;
};

/**
 * Normalizes an array of documents
 */
export const normalizeIds = (docs) => {
  if (!Array.isArray(docs)) return [];
  return docs.map(normalizeId);
};

/**
 * Gets ID from document (handles both id and _id)
 */
export const getDocumentId = (doc) => {
  if (!doc) return null;
  return String(doc.id || doc._id || '');
};

/**
 * Compares two document IDs for equality
 */
export const idsEqual = (id1, id2) => {
  return String(id1) === String(id2);
};
```

**Usage**:
```typescript
// contexts/ItineraryContext.js
import { normalizeId, getDocumentId, idsEqual } from '../utils/idNormalizer';

const createItinerary = async (name) => {
  // ...
  const newItinerary = normalizeId(response.trip);
  setItineraries(prev => [...prev, newItinerary]);
  return newItinerary;
};

const getItineraryById = (itineraryId) => {
  return itineraries.find(itinerary => 
    idsEqual(itinerary.id || itinerary._id, itineraryId)
  );
};
```

**Benefits**:
- ✅ Single source of truth
- ✅ Consistent handling
- ✅ Easier to update if backend changes
- ✅ Better testability

---

## Metrics & Success Criteria

### Before Refactoring
- Largest component: 2,394 lines
- Average component size: ~400 lines
- State variables per screen: 15-25
- Design token usage: ~60%

### Target After Refactoring
- Largest component: <500 lines
- Average component size: ~200 lines
- State variables per screen: <10 (via hooks/context)
- Design token usage: >95%

---

## Migration Strategy

### Phase 1: Foundation (Week 1-2)
1. Extract `AccountScreen` from `App.js`
2. Create `utils/idNormalizer.js` and migrate `ItineraryContext`
3. Refactor `FilterContext` to `useReducer`

### Phase 2: Hooks Extraction (Week 3-4)
1. Create `hooks/useDateRange.js`
2. Create `hooks/useMapBounds.js`
3. Extract first hook usage in `MapResultsScreen`

### Phase 3: Component Breakdown (Week 5-8)
1. Break down `SearchScreen.js` (largest impact)
2. Break down `MapResultsScreen.js`
3. Extract remaining custom hooks

### Phase 4: Polish (Week 9-10)
1. Design token migration
2. Performance optimizations (memoization)
3. Code cleanup (console.logs, TODOs)

---

## Additional Notes

- **Incremental Approach**: All refactors should be done in small, incremental PRs
- **Backward Compatibility**: Maintain existing API contracts during refactoring
- **Testing**: Add tests as you refactor, not after
- **Documentation**: Update component docs as structure changes

---

## Conclusion

The codebase has solid foundations but needs structural improvements for long-term maintainability. Focus on:

1. ✅ **Extract and decompose large components** (highest ROI)
2. ✅ **Centralize state management** (useReducer for complex state)
3. ✅ **Create reusable utilities and hooks** (reduce duplication)
4. ✅ **Standardize design tokens** (visual consistency)

These changes will make the codebase more testable, maintainable, and scalable as the team grows.

