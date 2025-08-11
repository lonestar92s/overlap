// Filter Types and Data Structures

// Basic filter option structure
export const FilterOption = {
  id: String,           // Unique identifier
  name: String,         // Display name
  count: Number,        // Number of matches for this option
  isSelected: Boolean,  // Whether this option is currently selected
};

// Country filter structure
export const CountryFilter = {
  id: String,           // Country code (e.g., 'GB', 'DE', 'FR')
  name: String,         // Country name (e.g., 'United Kingdom', 'Germany')
  count: Number,        // Total matches in this country
  isSelected: Boolean,  // Whether country is selected
  leagues: Array,       // Array of LeagueFilter objects
  isExpanded: Boolean,  // Whether leagues section is expanded
};

// League filter structure
export const LeagueFilter = {
  id: String,           // League ID from API
  name: String,         // League name (e.g., 'Premier League', 'Bundesliga')
  country: String,      // Country this league belongs to
  count: Number,        // Number of matches in this league
  isSelected: Boolean,  // Whether league is selected
  teams: Array,         // Array of TeamFilter objects
  isExpanded: Boolean,  // Whether teams section is expanded
  type: String,         // 'domestic' or 'continental' (for Champions League, etc.)
};

// Team filter structure
export const TeamFilter = {
  id: String,           // Team ID from API
  name: String,         // Team name
  league: String,       // League this team belongs to
  country: String,      // Country this team belongs to
  count: Number,        // Number of matches for this team
  isSelected: Boolean,  // Whether team is selected
  logo: String,         // Team logo URL
};

// Filter state structure
export const FilterState = {
  // Selected filters
  selectedCountries: Array,  // Array of country IDs
  selectedLeagues: Array,    // Array of league IDs
  selectedTeams: Array,      // Array of team IDs
  
  // Filter data
  countries: Array,          // Array of CountryFilter objects
  leagues: Array,           // Array of LeagueFilter objects
  teams: Array,             // Array of TeamFilter objects
  
  // UI state
  isFilterModalOpen: Boolean,
  activeFilterLevel: String, // 'country', 'league', or 'team'
  
  // Validation
  totalSelectedFilters: Number, // Should not exceed 10
  isValid: Boolean,            // Whether current filter combination is valid
};

// Filter actions
export const FilterActionTypes = {
  // Selection actions
  SELECT_COUNTRY: 'SELECT_COUNTRY',
  DESELECT_COUNTRY: 'DESELECT_COUNTRY',
  SELECT_LEAGUE: 'SELECT_LEAGUE',
  DESELECT_LEAGUE: 'DESELECT_LEAGUE',
  SELECT_TEAM: 'SELECT_TEAM',
  DESELECT_TEAM: 'DESELECT_TEAM',
  
  // UI actions
  TOGGLE_FILTER_MODAL: 'TOGGLE_FILTER_MODAL',
  SET_ACTIVE_FILTER_LEVEL: 'SET_ACTIVE_FILTER_LEVEL',
  EXPAND_FILTER_SECTION: 'EXPAND_FILTER_SECTION',
  COLLAPSE_FILTER_SECTION: 'COLLAPSE_FILTER_SECTION',
  
  // Data actions
  SET_FILTER_DATA: 'SET_FILTER_DATA',
  UPDATE_FILTER_COUNTS: 'UPDATE_FILTER_COUNTS',
  CLEAR_ALL_FILTERS: 'CLEAR_ALL_FILTERS',
  RESET_FILTERS: 'RESET_FILTERS',
  
  // Validation actions
  VALIDATE_FILTERS: 'VALIDATE_FILTERS',
};

// Example data structure for Champions League handling
export const ContinentalLeagueExample = {
  id: 'champions-league',
  name: 'UEFA Champions League',
  country: 'international', // Special identifier for continental leagues
  count: 45,
  isSelected: false,
  teams: [], // Teams from multiple countries
  isExpanded: false,
  type: 'continental',
  // Additional properties for continental leagues
  participatingCountries: ['GB', 'DE', 'FR', 'ES', 'IT'], // Countries with teams in this league
};
