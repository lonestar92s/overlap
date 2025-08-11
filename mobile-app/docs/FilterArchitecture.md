# Filter System Architecture

## Overview
The filter system provides hierarchical filtering capabilities for matches by Country → League → Team, with multi-selection support and a maximum of 10 total filters.

## Architecture Components

### 1. Data Layer
```
FilterContext (React Context + useReducer)
├── Filter State Management
├── Filter Actions (select/deselect, expand/collapse)
├── Filter Validation (10-item limit)
└── Filtered Match Computation
```

### 2. Data Processing Layer
```
filterDataProcessor.js
├── processMatchDataForFilters() - Extract filter options from matches
├── generateFilterCounts() - Update counts based on current data
└── validateFilterCombination() - Validate filter selections
```

### 3. Component Hierarchy
```
FilterModal (Main Container)
├── FilterHeader
│   ├── Title
│   ├── Selected Filters Count
│   └── Clear All Button
├── FilterContent
│   ├── CountrySection
│   │   ├── CountryHeader (with expand/collapse)
│   │   └── CountryOptions (Checkboxes with counts)
│   ├── LeagueSection
│   │   ├── LeagueHeader (with expand/collapse)
│   │   └── LeagueOptions (Checkboxes with counts)
│   └── TeamSection
│       ├── TeamHeader (with expand/collapse)
│       └── TeamOptions (Checkboxes with counts)
└── FilterFooter
    ├── Apply Filters Button
    ├── Reset Filters Button
    └── Close Button
```

### 4. Data Flow

#### Initialization
1. **Match Data** → `processMatchDataForFilters()` → **Filter Options**
2. **Filter Options** → `setFilterData()` → **Filter State**
3. **Filter State** → **UI Components**

#### User Interaction
1. **User Selection** → **Filter Action** → **State Update**
2. **State Update** → **UI Re-render** → **Filter Display Update**
3. **Filter Display** → **Selected Filters** → **Filtered Matches**

#### Filter Application
1. **Selected Filters** → `getFilteredMatches()` → **Filtered Results**
2. **Filtered Results** → **Match Display Components**

## Key Features

### 1. Hierarchical Selection
- **Country Selection**: Affects available leagues and teams
- **League Selection**: Affects available teams
- **Team Selection**: Independent selection within leagues

### 2. Smart State Management
- **Auto-selection**: Single country is auto-selected
- **Cascade Updates**: Deselecting country removes related leagues/teams
- **Validation**: Enforces 10-filter maximum

### 3. Performance Optimizations
- **Lazy Loading**: Only load relevant leagues/teams for search area
- **Memoization**: React.memo for filter components
- **Efficient Updates**: useCallback for action functions

### 4. Accessibility Features
- **Screen Reader Support**: Proper labels and announcements
- **Touch Targets**: 44px minimum for mobile
- **High Contrast**: Theme-based color support

## Data Structures

### Filter State
```javascript
{
  selectedCountries: ['GB', 'DE'],
  selectedLeagues: ['premier-league', 'bundesliga'],
  selectedTeams: ['man-utd', 'bayern'],
  countries: [...],
  leagues: [...],
  teams: [...],
  isFilterModalOpen: false,
  activeFilterLevel: 'country',
  totalSelectedFilters: 4,
  isValid: true
}
```

### Filter Option
```javascript
{
  id: 'GB',
  name: 'United Kingdom',
  count: 45,
  isSelected: true,
  isExpanded: false,
  leagues: [...]
}
```

## Integration Points

### 1. Search Results
- **Input**: Raw match data from API
- **Output**: Filtered matches based on selections
- **Update**: Real-time filter counts

### 2. Map Results
- **Input**: Filtered matches
- **Output**: Map markers and clusters
- **Update**: Filter state persistence

### 3. Saved Matches
- **Input**: User's saved match preferences
- **Output**: Filter suggestions
- **Update**: Filter state based on saved data

## Champions League Handling

### Continental League Structure
```javascript
{
  id: 'champions-league',
  name: 'UEFA Champions League',
  country: 'international',
  type: 'continental',
  participatingCountries: ['GB', 'DE', 'FR', 'ES', 'IT'],
  count: 45,
  isSelected: false,
  isExpanded: false
}
```

### Special Logic
- **Multi-country Display**: Shows in relevant country sections
- **Team Categorization**: Teams grouped by their domestic country
- **Filter Behavior**: Selecting continental league affects multiple countries

## Future Enhancements

### 1. Filter Persistence
- **Session Storage**: Persist filters during app session
- **User Preferences**: Save common filter combinations
- **Search History**: Link filters to recent searches

### 2. Advanced Filtering
- **Date Range**: Filter by match dates
- **Venue Type**: Stadium vs. training ground
- **Match Status**: Live, scheduled, completed

### 3. Performance Improvements
- **Virtual Scrolling**: For large team lists (100+ teams)
- **Filter Caching**: Cache processed filter data
- **Background Processing**: Process filters in worker threads

## Testing Strategy

### 1. Unit Tests
- **Filter Logic**: Selection/deselection logic
- **Validation**: 10-filter limit enforcement
- **Data Processing**: Match data extraction

### 2. Integration Tests
- **Filter State**: Context integration
- **Component Communication**: Filter modal interactions
- **Data Flow**: End-to-end filtering

### 3. Performance Tests
- **Large Datasets**: 1000+ matches
- **Filter Updates**: Real-time count updates
- **Memory Usage**: Filter state memory consumption

## Error Handling

### 1. Data Validation
- **Invalid Match Data**: Graceful fallbacks
- **Missing Properties**: Default values
- **API Errors**: Error boundaries

### 2. User Experience
- **No Results**: Helpful empty states
- **Filter Conflicts**: Clear error messages
- **Performance Issues**: Loading states

## Security Considerations

### 1. Input Sanitization
- **Filter IDs**: Validate against allowed values
- **User Input**: Sanitize search queries
- **API Responses**: Validate data structure

### 2. Rate Limiting
- **Filter Updates**: Prevent excessive API calls
- **User Actions**: Throttle rapid selections
- **Data Processing**: Limit processing time
