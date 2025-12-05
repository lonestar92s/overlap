import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
  Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { debounce } from 'lodash';
import ApiService from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FlightSearchTab from './FlightSearchTab';
import FilterChip from './FilterChip';
import { colors, spacing, typography, borderRadius, shadows } from '../styles/designTokens';

const RECENT_SEARCHES_KEY = 'searchRecentLocations';
const MAX_RECENT_SEARCHES = 5;

const LocationSearchModal = ({ visible, onClose, navigation, initialLocation = null }) => {
  const [activeTab, setActiveTab] = useState('matches'); // 'matches' or 'flights'
  const [location, setLocation] = useState(null);
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  const [selectedDates, setSelectedDates] = useState({});
  const [loading, setLoading] = useState(false);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  
  // Location search results
  const [locationResults, setLocationResults] = useState([]);
  const [locationSearchLoading, setLocationSearchLoading] = useState(false);
  
  // Collapsible states
  const [whereExpanded, setWhereExpanded] = useState(true);
  const [whenExpanded, setWhenExpanded] = useState(false);
  const [whoExpanded, setWhoExpanded] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  
  // Calendar month state - controls which month is displayed
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().split('T')[0]);
  
  // Recent searches
  const [recentSearches, setRecentSearches] = useState([]);
  
  // Who section state
  const [selectedLeagues, setSelectedLeagues] = useState([]); // Array of league objects with {id, name, badge, type: 'league'}
  const [selectedTeams, setSelectedTeams] = useState([]); // Array of team objects with {id, name, badge, type: 'team'}
  const [whoSearchQuery, setWhoSearchQuery] = useState('');
  const [whoSearchResults, setWhoSearchResults] = useState({ leagues: [], teams: [] });
  const [whoSearchLoading, setWhoSearchLoading] = useState(false);
  
  // Ref for location search TextInput
  const locationInputRef = useRef(null);
  
  // Ref for who search TextInput
  const whoInputRef = useRef(null);
  
  // Ref to track if we're in the middle of selecting a location (prevents double API calls)
  const isSelectingLocationRef = useRef(false);
  
  // Ref to store the debounced search function so we can cancel it
  const debouncedSearchRef = useRef(null);
  
  // Ref to store the debounced unified search function
  const debouncedWhoSearchRef = useRef(null);
  
  // Ref to track if a search has been completed (to prevent showing "No locations found" too early)
  const hasCompletedSearchRef = useRef(false);
  
  // Ref to track if a unified search has been completed
  const hasCompletedWhoSearchRef = useRef(false);

  // Load recent searches
  useEffect(() => {
    if (visible) {
      loadRecentSearches();
    }
  }, [visible]);

  // Handle initialLocation prop - pre-populate location when modal opens with initial location
  useEffect(() => {
    if (visible && initialLocation) {
      if (__DEV__) {
        console.log('[LocationSearchModal] Pre-populating with initial location:', initialLocation.city, initialLocation.country);
      }
      
      // Set location state
      setLocation(initialLocation);
      
      // Pre-populate search query with city name (use description if available, otherwise simplified format)
      const displayText = initialLocation.description || `${initialLocation.city}, ${initialLocation.country}`;
      setLocationSearchQuery(displayText);
      
      // Ensure location is marked as selected (not in search mode)
      setIsSearchingLocation(false);
      setLocationResults([]);
      
      // Auto-expand the "When" section (calendar) when location is pre-populated
      setWhenExpanded(true);
      setShowCalendar(true);
      
      // Set flag to prevent search from triggering
      isSelectingLocationRef.current = true;
      
      // Clear the flag after a brief delay
      setTimeout(() => {
        isSelectingLocationRef.current = false;
      }, 500);
    } else if (!visible) {
      // Reset state when modal closes
      setLocation(null);
      setLocationSearchQuery('');
      setDateFrom(null);
      setDateTo(null);
      setSelectedDates({});
      setIsSearchingLocation(false);
      setLocationResults([]);
      setWhenExpanded(false);
      setShowCalendar(false);
      setCurrentMonth(new Date().toISOString().split('T')[0]);
      // Reset Who section
      setSelectedLeagues([]);
      setSelectedTeams([]);
      setWhoSearchQuery('');
      setWhoSearchResults({ leagues: [], teams: [] });
      setWhoExpanded(false);
    }
  }, [visible, initialLocation]);

  const loadRecentSearches = async () => {
    try {
      const stored = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Error loading recent searches:', error);
      }
    }
  };

  const saveRecentSearch = async (locationData, dateFrom, dateTo) => {
    try {
      const formatDateRange = (dateFrom, dateTo) => {
        if (!dateFrom && !dateTo) return 'Add Dates';
        if (dateFrom && !dateTo) {
          // Parse date string as local date (YYYY-MM-DD format)
          const [year, month, day] = dateFrom.split('-').map(Number);
          const date = new Date(year, month - 1, day);
          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
        if (dateFrom && dateTo) {
          // Parse date strings as local dates (YYYY-MM-DD format)
          const [startYear, startMonth, startDay] = dateFrom.split('-').map(Number);
          const [endYear, endMonth, endDay] = dateTo.split('-').map(Number);
          const start = new Date(startYear, startMonth - 1, startDay);
          const end = new Date(endYear, endMonth - 1, endDay);
          return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        }
        return 'Add Dates';
      };

      const newSearch = {
        id: Date.now().toString(),
        location: locationData.city || locationData.name || 'Unknown',
        city: locationData.city,
        country: locationData.country,
        lat: locationData.lat,
        lon: locationData.lon,
        dateFrom,
        dateTo,
        dateRange: formatDateRange(dateFrom, dateTo),
      };
      
      const updated = [newSearch, ...recentSearches.filter(s => 
        s.city !== newSearch.city || 
        s.country !== newSearch.country || 
        s.dateFrom !== newSearch.dateFrom || 
        s.dateTo !== newSearch.dateTo
      )].slice(0, MAX_RECENT_SEARCHES);
      setRecentSearches(updated);
      await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch (error) {
      if (__DEV__) {
        console.error('Error saving recent search:', error);
      }
    }
  };

  const clearRecentSearches = async () => {
    try {
      setRecentSearches([]);
      await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch (error) {
      if (__DEV__) {
        console.error('Error clearing recent searches:', error);
      }
    }
  };

  // Location search function (not debounced)
  const performLocationSearch = useCallback(async (query) => {
    if (!query || query.trim().length < 2) {
      setLocationResults([]);
      setLocationSearchLoading(false);
      hasCompletedSearchRef.current = false;
      return;
    }
    setLocationSearchLoading(true);
    hasCompletedSearchRef.current = false; // Reset flag when starting new search
    try {
      const response = await ApiService.searchLocations(query.trim(), 5);
      if (response.success && response.suggestions) {
        setLocationResults(response.suggestions);
      } else {
        setLocationResults([]);
      }
      // Mark that search has completed
      hasCompletedSearchRef.current = true;
    } catch (error) {
      if (__DEV__) {
        console.error('Error searching locations:', error);
      }
      setLocationResults([]);
      // Mark that search has completed (even if it failed)
      hasCompletedSearchRef.current = true;
    } finally {
      setLocationSearchLoading(false);
    }
  }, []);

  // Unified search function for Who section (leagues and teams only)
  const performWhoSearch = useCallback(async (query) => {
    if (!query || query.trim().length < 2) {
      setWhoSearchResults({ leagues: [], teams: [] });
      setWhoSearchLoading(false);
      hasCompletedWhoSearchRef.current = false;
      return;
    }
    setWhoSearchLoading(true);
    hasCompletedWhoSearchRef.current = false; // Reset flag when starting new search
    try {
      const response = await ApiService.searchUnified(query.trim());
      if (response.success && response.results) {
        // Filter out venues - only show leagues and teams
        setWhoSearchResults({
          leagues: response.results.leagues || [],
          teams: response.results.teams || [],
        });
      } else {
        setWhoSearchResults({ leagues: [], teams: [] });
      }
      // Mark that search has completed
      hasCompletedWhoSearchRef.current = true;
    } catch (error) {
      if (__DEV__) {
        console.error('Error searching unified:', error);
      }
      setWhoSearchResults({ leagues: [], teams: [] });
      // Mark that search has completed (even if it failed)
      hasCompletedWhoSearchRef.current = true;
    } finally {
      setWhoSearchLoading(false);
    }
  }, []);

  // Create debounced search function and store in ref
  useEffect(() => {
    // Cancel previous debounced function if it exists
    if (debouncedSearchRef.current) {
      debouncedSearchRef.current.cancel();
    }
    
    // Create new debounced function
    debouncedSearchRef.current = debounce(performLocationSearch, 350);
    
    // Cleanup on unmount or when performLocationSearch changes
    return () => {
      if (debouncedSearchRef.current) {
        debouncedSearchRef.current.cancel();
      }
    };
  }, [performLocationSearch]);

  // Create debounced unified search function and store in ref
  useEffect(() => {
    // Cancel previous debounced function if it exists
    if (debouncedWhoSearchRef.current) {
      debouncedWhoSearchRef.current.cancel();
    }
    
    // Create new debounced function
    debouncedWhoSearchRef.current = debounce(performWhoSearch, 350);
    
    // Cleanup on unmount or when performWhoSearch changes
    return () => {
      if (debouncedWhoSearchRef.current) {
        debouncedWhoSearchRef.current.cancel();
      }
    };
  }, [performWhoSearch]);

  useEffect(() => {
    // Don't trigger search if we're in the middle of selecting a location
    if (isSelectingLocationRef.current) {
      if (__DEV__) {
        console.log('[LocationSearchModal] Skipping search - location selection in progress');
      }
      return;
    }
    
    // Don't trigger search if we already have a location selected
    if (location) {
      if (__DEV__) {
        console.log('[LocationSearchModal] Skipping search - location already selected');
      }
      return;
    }
    
    if (isSearchingLocation && locationSearchQuery.trim().length >= 2) {
      if (__DEV__) {
      
      }
      // Use the debounced function from ref
      if (debouncedSearchRef.current) {
        debouncedSearchRef.current(locationSearchQuery);
      }
    } else {
      setLocationResults([]);
      setLocationSearchLoading(false);
      // Reset search completion flag when query is too short or not searching
      hasCompletedSearchRef.current = false;
    }
  }, [locationSearchQuery, isSearchingLocation, location]);

  // Handle unified search for Who section
  useEffect(() => {
    if (whoSearchQuery.trim().length >= 2) {
      // Use the debounced function from ref
      if (debouncedWhoSearchRef.current) {
        debouncedWhoSearchRef.current(whoSearchQuery);
      }
    } else {
      setWhoSearchResults({ leagues: [], teams: [] });
      setWhoSearchLoading(false);
      // Reset search completion flag when query is too short
      hasCompletedWhoSearchRef.current = false;
    }
  }, [whoSearchQuery]);

  const handleLocationSelect = (selectedLocation) => {
    if (__DEV__) {
      console.log('[LocationSearchModal] Location selected:', selectedLocation?.city, selectedLocation?.country);
    }
    
    // Set flag to prevent useEffect from triggering another search during selection
    isSelectingLocationRef.current = true;
    
    // Cancel any pending debounced searches
    if (debouncedSearchRef.current) {
      if (__DEV__) {
        console.log('[LocationSearchModal] Cancelling pending debounced search');
      }
      debouncedSearchRef.current.cancel();
    }
    
    // Use description if available (handles disambiguation), otherwise simplified format
    const displayText = selectedLocation.description || `${selectedLocation.city}, ${selectedLocation.country}`;
    
    // IMPORTANT: Update the search query FIRST so the TextInput shows the selected location
    // This must happen before other state updates to ensure the input displays correctly
    setLocationSearchQuery(displayText);
    
    // IMPORTANT: Set location FIRST, then isSearchingLocation to false, to prevent race conditions
    // This ensures the UI knows a location is selected before we hide the search results
    setLocation(selectedLocation);
    
    // Set isSearchingLocation to false to hide search results UI
    setIsSearchingLocation(false);
    
    // Clear results after we've hidden the search UI to prevent showing "No locations found"
    setLocationResults([]);
    
    // Clear the flag after a brief delay to allow state updates to complete
    // Use a longer delay (500ms) to ensure debounced calls have time to be cancelled
    setTimeout(() => {
      isSelectingLocationRef.current = false;
      if (__DEV__) {
        console.log('[LocationSearchModal] Location selection complete, flag cleared');
      }
    }, 500);
    
    // Don't save to recent searches here - only save after successful search with dates
    
    // Blur the TextInput after a short delay to ensure the value update is visible
    // This prevents the input from refocusing and triggering search again
    setTimeout(() => {
      if (locationInputRef.current) {
        if (__DEV__) {
          console.log('[LocationSearchModal] Blurring location input');
        }
        locationInputRef.current.blur();
      }
      
      // Dismiss keyboard after location selection
      if (__DEV__) {
        console.log('[LocationSearchModal] Dismissing keyboard');
      }
      Keyboard.dismiss();
    }, 100);
    
    // Auto-open the "When" section (calendar) after location is selected
    if (__DEV__) {
      console.log('[LocationSearchModal] Auto-opening When section');
    }
    setWhenExpanded(true);
    setShowCalendar(true);
  };

  const handleRecentSearchSelect = (search) => {
    const locationData = {
      city: search.city,
      country: search.country,
      lat: search.lat,
      lon: search.lon,
      name: search.location,
    };
    setLocation(locationData);
    setLocationSearchQuery(search.location);
    
    // Restore dates if they exist
    if (search.dateFrom) {
      setDateFrom(search.dateFrom);
    }
    if (search.dateTo) {
      setDateTo(search.dateTo);
      
      // Restore selected dates for calendar display
      if (search.dateFrom && search.dateTo) {
        const range = {};
        const start = new Date(search.dateFrom);
        const end = new Date(search.dateTo);
        const current = new Date(start);
        
        while (current <= end) {
          const dateStr = current.toISOString().split('T')[0];
          if (dateStr === search.dateFrom) {
            range[dateStr] = { selected: true, startingDay: true, color: colors.primary, textColor: colors.onPrimary };
          } else if (dateStr === search.dateTo) {
            range[dateStr] = { selected: true, endingDay: true, color: colors.primary, textColor: colors.onPrimary };
          } else {
            range[dateStr] = { selected: true, color: colors.primary + '40', textColor: colors.text.primary };
          }
          current.setDate(current.getDate() + 1);
        }
        setSelectedDates(range);
      }
    }
  };

  const formatDateRange = () => {
    if (!dateFrom && !dateTo) return 'Add Dates';
    if (dateFrom && !dateTo) {
      // Parse date string as local date (YYYY-MM-DD format)
      const [year, month, day] = dateFrom.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    if (dateFrom && dateTo) {
      // Parse date strings as local dates (YYYY-MM-DD format)
      const [startYear, startMonth, startDay] = dateFrom.split('-').map(Number);
      const [endYear, endMonth, endDay] = dateTo.split('-').map(Number);
      const start = new Date(startYear, startMonth - 1, startDay);
      const end = new Date(endYear, endMonth - 1, endDay);
      return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
    return 'Add Dates';
  };

  const formatWhoValue = () => {
    const totalSelected = selectedLeagues.length + selectedTeams.length;
    if (totalSelected === 0) return 'Add who';
    if (totalSelected === 1) {
      const item = selectedLeagues[0] || selectedTeams[0];
      return item.name;
    }
    if (totalSelected === 2) {
      const items = [...selectedLeagues, ...selectedTeams];
      return `${items[0].name}, ${items[1].name}`;
    }
    return `${totalSelected} selected`;
  };

  const handleLeagueSelect = (league) => {
    // Check if already selected
    if (selectedLeagues.some(l => l.id === league.id)) {
      return;
    }
    setSelectedLeagues([...selectedLeagues, { ...league, type: 'league' }]);
    // Clear search query and results after selection
    setWhoSearchQuery('');
    setWhoSearchResults({ leagues: [], teams: [] });
    // Blur input
    if (whoInputRef.current) {
      whoInputRef.current.blur();
    }
    Keyboard.dismiss();
  };

  const handleTeamSelect = (team) => {
    // Check if already selected
    if (selectedTeams.some(t => t.id === team.id)) {
      return;
    }
    setSelectedTeams([...selectedTeams, { ...team, type: 'team' }]);
    // Clear search query and results after selection
    setWhoSearchQuery('');
    setWhoSearchResults({ leagues: [], teams: [] });
    // Blur input
    if (whoInputRef.current) {
      whoInputRef.current.blur();
    }
    Keyboard.dismiss();
  };

  const handleRemoveLeague = (leagueId) => {
    setSelectedLeagues(selectedLeagues.filter(l => l.id !== leagueId));
  };

  const handleRemoveTeam = (teamId) => {
    setSelectedTeams(selectedTeams.filter(t => t.id !== teamId));
  };

  // Search validation logic
  const canSearch = () => {
    const hasLocation = !!location;
    const hasDates = !!(dateFrom && dateTo);
    const hasWho = (selectedLeagues.length + selectedTeams.length) > 0;
    
    // Traditional search: location + dates required
    if (!hasWho) {
      return hasLocation && hasDates;
    }
    
    // Who-based search: dates required, location optional
    return hasDates;
  };

  // Calculate initial region from match coordinates (for Who-based searches without location)
  const calculateRegionFromMatches = (matches) => {
    if (!matches || matches.length === 0) {
      return null;
    }

    // Extract all valid venue coordinates from matches
    const coordinates = [];
    matches.forEach((match) => {
      const venue = match?.fixture?.venue;
      if (venue?.coordinates && Array.isArray(venue.coordinates) && venue.coordinates.length === 2) {
        const [lon, lat] = venue.coordinates;
        // Validate coordinates
        if (typeof lat === 'number' && typeof lon === 'number' &&
            lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
          coordinates.push({ lat, lng: lon });
        }
      }
    });

    if (coordinates.length === 0) {
      return null;
    }

    // Calculate bounds
    const lats = coordinates.map(coord => coord.lat);
    const lngs = coordinates.map(coord => coord.lng);
    
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    // Calculate center
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;

    // Calculate spans with padding
    const latSpan = maxLat - minLat;
    const lngSpan = maxLng - minLng;

    // Clamp deltas to valid ranges to prevent MapKit crashes
    // MapKit requires: latitudeDelta: 0-180, longitudeDelta: 0-360
    // Practical limits for map views: max ~50 degrees
    const MAX_LAT_DELTA = 50.0;
    const MAX_LNG_DELTA = 50.0;
    const MIN_DELTA = 0.1;
    const PADDING_MULTIPLIER = 2.5;

    let latitudeDelta = Math.max(MIN_DELTA, latSpan * PADDING_MULTIPLIER);
    let longitudeDelta = Math.max(MIN_DELTA, lngSpan * PADDING_MULTIPLIER);

    // Clamp to maximum values
    latitudeDelta = Math.min(latitudeDelta, MAX_LAT_DELTA);
    longitudeDelta = Math.min(longitudeDelta, MAX_LNG_DELTA);

    // Validate center coordinates
    if (isNaN(centerLat) || isNaN(centerLng) || 
        centerLat < -90 || centerLat > 90 || 
        centerLng < -180 || centerLng > 180) {
      if (__DEV__) {
        console.warn('⚠️ Invalid center coordinates calculated from matches:', { centerLat, centerLng });
      }
      return null;
    }

    // Validate deltas
    if (isNaN(latitudeDelta) || isNaN(longitudeDelta) || 
        latitudeDelta <= 0 || longitudeDelta <= 0 ||
        latitudeDelta > MAX_LAT_DELTA || longitudeDelta > MAX_LNG_DELTA) {
      if (__DEV__) {
        console.warn('⚠️ Invalid deltas calculated from matches:', { latitudeDelta, longitudeDelta });
      }
      return null;
    }

    const region = {
      latitude: centerLat,
      longitude: centerLng,
      latitudeDelta,
      longitudeDelta,
    };

    if (__DEV__) {
      console.log('🗺️ Calculated region from matches (validated):', {
        matchCount: matches.length,
        coordinateCount: coordinates.length,
        region,
        spans: { lat: latSpan, lng: lngSpan }
      });
    }

    return region;
  };

  const onDayPress = (day) => {
    const dateString = day.dateString;
    
    if (!dateFrom || (dateFrom && dateTo)) {
      setDateFrom(dateString);
      setDateTo(null);
      setSelectedDates({
        [dateString]: {
          selected: true,
          startingDay: true,
          color: colors.primary,
          textColor: colors.onPrimary
        }
      });
    } else if (dateFrom && !dateTo) {
      if (dateString < dateFrom) {
        setDateFrom(dateString);
        setDateTo(null);
        setSelectedDates({
          [dateString]: {
            selected: true,
            startingDay: true,
            color: colors.primary,
            textColor: colors.onPrimary
          }
        });
      } else {
        setDateTo(dateString);
        const range = {};
        const start = new Date(dateFrom);
        const end = new Date(dateString);
        const current = new Date(start);
        
        while (current <= end) {
          const dateStr = current.toISOString().split('T')[0];
          if (dateStr === dateFrom) {
            range[dateStr] = { selected: true, startingDay: true, color: colors.primary, textColor: colors.onPrimary };
          } else if (dateStr === dateString) {
            range[dateStr] = { selected: true, endingDay: true, color: colors.primary, textColor: colors.onPrimary };
          } else {
            range[dateStr] = { selected: true, color: colors.primary + '40', textColor: colors.text.primary };
          }
          current.setDate(current.getDate() + 1);
        }
        setSelectedDates(range);
      }
    }
  };

  const clearAll = () => {
    setLocation(null);
    setLocationSearchQuery('');
    setDateFrom(null);
    setDateTo(null);
    setSelectedDates({});
    setCurrentMonth(new Date().toISOString().split('T')[0]);
    // Clear Who section
    setSelectedLeagues([]);
    setSelectedTeams([]);
    setWhoSearchQuery('');
    setWhoSearchResults({ leagues: [], teams: [] });
    setWhoExpanded(false);
    clearRecentSearches();
  };

  const handleSearch = async () => {
    const hasLocation = !!location;
    const hasDates = !!(dateFrom && dateTo);
    const hasWho = (selectedLeagues.length + selectedTeams.length) > 0;

    // Validation: Traditional search requires location + dates
    if (!hasWho) {
      if (!hasLocation) {
        Alert.alert('Error', 'Please select a location');
        return;
      }
      if (!hasDates) {
        Alert.alert('Error', 'Please select your travel dates');
        return;
      }
    } else {
      // Who-based search: dates required, location optional
      if (!hasDates) {
        Alert.alert('Error', 'Please select your travel dates');
        return;
      }
    }

    setLoading(true);
    try {
      // Track initial search performance (end-to-end: button press → rendered)
      const searchStartTime = performance.now();
      
      let response;
      let initialRegion = null;
      let matches = [];
      let preSelectedFilters = null;

      if (hasWho) {
        // Who-based search using searchAggregatedMatches
        const apiParams = {
          competitions: selectedLeagues.map(l => String(l.id)),
          teams: selectedTeams.map(t => String(t.id)),
          dateFrom,
          dateTo,
        };

        // Add optional location bounds if location is provided
        if (hasLocation) {
          const viewportDelta = 0.5;
          apiParams.bounds = {
            northeast: {
              lat: location.lat + (viewportDelta / 2),
              lng: location.lon + (viewportDelta / 2),
            },
            southwest: {
              lat: location.lat - (viewportDelta / 2),
              lng: location.lon - (viewportDelta / 2),
            }
          };
          initialRegion = {
            latitude: location.lat,
            longitude: location.lon,
            latitudeDelta: viewportDelta,
            longitudeDelta: viewportDelta,
          };
        }

        if (__DEV__) {
          console.log('🔍 Who-based search params:', apiParams);
        }

        response = await ApiService.searchAggregatedMatches(apiParams);
        matches = response?.data || [];

        // If no location was provided, calculate initialRegion from match coordinates
        if (!hasLocation) {
          if (matches.length > 0) {
            const calculatedRegion = calculateRegionFromMatches(matches);
            if (calculatedRegion) {
              initialRegion = calculatedRegion;
              if (__DEV__) {
                console.log('🗺️ Using calculated region from matches (no location provided):', initialRegion);
              }
            }
            // If no valid coordinates found in matches, leave initialRegion as null
            // MapResultsScreen will handle it appropriately
          }
          // If no matches found, leave initialRegion as null
          // This allows MapResultsScreen to show appropriate state
          // User can then use "Search this area" to search in a specific region
        }

        // Prepare preSelectedFilters for MapResultsScreen
        // Include both IDs and names so chips can display even if filterData isn't ready
        preSelectedFilters = {
          leagues: selectedLeagues.map(l => ({
            id: String(l.id),
            name: l.name
          })),
          teams: selectedTeams.map(t => ({
            id: String(t.id),
            name: t.name
          })),
        };
      } else {
        // Traditional bounds-based search
        const viewportDelta = 0.5;
        const bounds = {
          northeast: {
            lat: location.lat + (viewportDelta / 2),
            lng: location.lon + (viewportDelta / 2),
          },
          southwest: {
            lat: location.lat - (viewportDelta / 2),
            lng: location.lon - (viewportDelta / 2),
          }
        };

        if (__DEV__) {
          console.log('🔍 Initial search bounds (unified):', {
            center: { lat: location.lat, lng: location.lon },
            viewportDelta,
            bounds
          });
        }

        response = await ApiService.searchMatchesByBounds({
          bounds,
          dateFrom,
          dateTo,
        });
        matches = response?.data || [];
        initialRegion = {
          latitude: location.lat,
          longitude: location.lon,
          latitudeDelta: viewportDelta,
          longitudeDelta: viewportDelta,
        };
      }

      if (response.success) {
        // Save to recent searches after successful search (only if location is selected)
        if (hasLocation) {
          await saveRecentSearch(location, dateFrom, dateTo);
        }
        
        onClose(); // Close modal before navigating
        navigation.navigate('MapResults', {
          searchParams: {
            location: hasLocation ? location : null,
            dateFrom,
            dateTo,
          },
          matches,
          initialRegion,
          hasWho,
          preSelectedFilters,
          _performanceStartTime: searchStartTime,
        });
      } else {
        Alert.alert('Error', 'Failed to search matches');
      }
      setLoading(false);
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Error', error.message || 'Failed to search matches');
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header with close button */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            accessibilityLabel="Close search modal"
            accessibilityRole="button"
          >
            <MaterialIcons name="close" size={15} color={colors.text.primary} />
          </TouchableOpacity>
        </View>

               {/* Tab Navigation */}
               {/* Flights tab commented out - no booking capability yet */}
               {/* <View style={styles.tabContainer}>
                 <TouchableOpacity
                   style={[styles.tab, activeTab === 'matches' && styles.activeTab]}
                   onPress={() => setActiveTab('matches')}
                   activeOpacity={0.7}
                   accessibilityLabel="Search matches"
                   accessibilityRole="tab"
                   accessibilityState={{ selected: activeTab === 'matches' }}
                 >
                   <Text style={[
                     styles.tabText,
                     activeTab === 'matches' && styles.activeTabText
                   ]}>
                     Matches
                   </Text>
                 </TouchableOpacity>
                 
                 <TouchableOpacity
                   style={[styles.tab, activeTab === 'flights' && styles.activeTab]}
                   onPress={() => setActiveTab('flights')}
                   activeOpacity={0.7}
                   accessibilityLabel="Search flights"
                   accessibilityRole="tab"
                   accessibilityState={{ selected: activeTab === 'flights' }}
                 >
                   <Text style={[
                     styles.tabText,
                     activeTab === 'flights' && styles.activeTabText
                   ]}>
                     Flights
                   </Text>
                 </TouchableOpacity>
               </View> */}

               {/* Tab Content */}
               {/* Flights tab content commented out */}
               {/* {activeTab === 'matches' ? ( */}
                 <KeyboardAvoidingView
                   behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                   style={styles.keyboardAvoidingView}
                 >
                   <ScrollView
                     style={styles.scrollView}
                     contentContainerStyle={styles.scrollContent}
                     showsVerticalScrollIndicator={false}
                     keyboardShouldPersistTaps="handled"
                   >
          {/* Where Card - Collapsible */}
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.cardHeader}
              onPress={() => setWhereExpanded(!whereExpanded)}
              activeOpacity={0.7}
            >
              <Text style={styles.cardTitle}>Where?</Text>
              <MaterialIcons
                name={whereExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                size={24}
                color={colors.text.primary}
              />
            </TouchableOpacity>

            {whereExpanded && (
              <View style={styles.cardContent}>
                {/* Location Search Input */}
                <View style={styles.searchInputContainer}>
                  <MaterialIcons name="search" size={25} color="rgba(0, 0, 0, 0.5)" />
                  <TextInput
                    ref={locationInputRef}
                    style={styles.searchInput}
                    placeholder="Search by location"
                    placeholderTextColor="rgba(0, 0, 0, 0.5)"
                    value={locationSearchQuery}
                    onChangeText={(text) => {
                      // Capitalize first letter if starting fresh (previous input was empty)
                      let processedText = text;
                      if (locationSearchQuery.length === 0 && text.length > 0) {
                        processedText = text.charAt(0).toUpperCase() + text.slice(1);
                      }
                      setLocationSearchQuery(processedText);
                      setIsSearchingLocation(processedText.trim().length > 0);
                      // Reset search completion flag when user types
                      if (processedText.trim().length < 2) {
                        hasCompletedSearchRef.current = false;
                      }
                    }}
                    onFocus={() => {
                      // Only set searching to true if we don't have a location selected
                      // This prevents re-triggering search after selection
                      if (!location) {
                        setIsSearchingLocation(true);
                      }
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {locationSearchQuery.length > 0 && (
                    <TouchableOpacity
                      onPress={() => {
                        setLocationSearchQuery('');
                        setIsSearchingLocation(false);
                        setLocationResults([]);
                        setLocation(null);
                      }}
                      style={styles.clearSearchButton}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <MaterialIcons name="close" size={20} color="rgba(0, 0, 0, 0.5)" />
                    </TouchableOpacity>
                  )}
                  {locationSearchLoading && locationSearchQuery.length === 0 && (
                    <ActivityIndicator size="small" color="rgba(0, 0, 0, 0.5)" style={styles.searchLoadingIndicator} />
                  )}
                </View>
                
                {/* Location Search Results */}
                {isSearchingLocation && locationSearchQuery.trim().length >= 2 && !location && (
                  <View style={styles.locationResultsContainer}>
                    {locationSearchLoading && locationResults.length === 0 && (
                      <View style={styles.locationLoadingContainer}>
                        <ActivityIndicator size="small" color={colors.primary} />
                      </View>
                    )}
                    {!locationSearchLoading && locationResults.length === 0 && locationSearchQuery.trim().length >= 2 && hasCompletedSearchRef.current && (
                      <View style={styles.locationEmptyContainer}>
                        <Text style={styles.locationEmptyText}>No locations found</Text>
                      </View>
                    )}
                    {locationResults.map((result) => (
                      <TouchableOpacity
                        key={result.place_id}
                        style={styles.locationResultItem}
                        onPress={() => handleLocationSelect(result)}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons name="location-on" size={40} color={colors.text.primary} />
                        <View style={styles.locationResultText}>
                          <Text style={styles.locationResultTitle}>{result.city}</Text>
                          <Text style={styles.locationResultSubtitle}>
                            {result.displayRegion ? `${result.displayRegion}, ${result.country}` : result.country}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Recent Searches - Show when not actively searching OR when location is selected */}
                {(!isSearchingLocation || location) && recentSearches.length > 0 && (
                  <View style={styles.recentSection}>
                    <Text style={styles.sectionLabel}>Recent searches</Text>
                    {recentSearches.map((search) => (
                      <TouchableOpacity
                        key={search.id}
                        style={styles.recentItem}
                        onPress={() => handleRecentSearchSelect(search)}
                      >
                        <MaterialIcons name="location-on" size={40} color={colors.text.primary} />
                        <View style={styles.recentItemText}>
                          <Text style={styles.recentItemTitle}>{search.location}</Text>
                          <Text style={styles.recentItemSubtitle}>{search.dateRange || 'Add Dates'}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>

          {/* When Card - Collapsible */}
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.cardHeader}
              onPress={() => {
                setWhenExpanded(!whenExpanded);
                if (!whenExpanded) {
                  setShowCalendar(true);
                }
              }}
              activeOpacity={0.7}
            >
              <View>
                <Text style={styles.cardLabel}>When</Text>
                <Text style={styles.cardValue}>{formatDateRange()}</Text>
              </View>
              <MaterialIcons
                name={whenExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                size={24}
                color={colors.text.primary}
              />
            </TouchableOpacity>

            {whenExpanded && showCalendar && (
              <View style={styles.calendarContainer}>
                <Calendar
                  onDayPress={onDayPress}
                  onMonthChange={(month) => {
                    // Update currentMonth state when user navigates months
                    const monthString = `${month.year}-${String(month.month).padStart(2, '0')}-01`;
                    setCurrentMonth(monthString);
                  }}
                  markedDates={selectedDates}
                  minDate={new Date().toISOString().split('T')[0]}
                  current={currentMonth}
                  theme={{
                    backgroundColor: colors.card,
                    calendarBackground: colors.card,
                    textSectionTitleColor: colors.text.secondary,
                    selectedDayBackgroundColor: colors.primary,
                    selectedDayTextColor: colors.onPrimary,
                    todayTextColor: colors.primary,
                    dayTextColor: colors.text.primary,
                    textDisabledColor: colors.text.light,
                    dotColor: colors.primary,
                    selectedDotColor: colors.onPrimary,
                    arrowColor: colors.primary,
                    monthTextColor: colors.text.primary,
                    textDayFontFamily: typography.fontFamily,
                    textMonthFontFamily: typography.fontFamily,
                    textDayHeaderFontFamily: typography.fontFamily,
                    textDayFontSize: 14,
                    textMonthFontSize: 16,
                    textDayHeaderFontSize: 12,
                  }}
                />
              </View>
            )}
          </View>

          {/* Who Card - Collapsible */}
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.cardHeader}
              onPress={() => setWhoExpanded(!whoExpanded)}
              activeOpacity={0.7}
            >
              <View>
                <Text style={styles.cardLabel}>Who</Text>
                <Text style={styles.cardValue}>{formatWhoValue()}</Text>
              </View>
              <MaterialIcons
                name={whoExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                size={24}
                color={colors.text.primary}
              />
            </TouchableOpacity>

            {whoExpanded && (
              <View style={styles.cardContent}>
                {/* Who Search Input */}
                <View style={styles.searchInputContainer}>
                  <MaterialIcons name="search" size={25} color="rgba(0, 0, 0, 0.5)" />
                  <TextInput
                    ref={whoInputRef}
                    style={styles.searchInput}
                    placeholder="Search leagues or teams"
                    placeholderTextColor="rgba(0, 0, 0, 0.5)"
                    value={whoSearchQuery}
                    onChangeText={(text) => {
                      // Capitalize first letter if starting fresh
                      let processedText = text;
                      if (whoSearchQuery.length === 0 && text.length > 0) {
                        processedText = text.charAt(0).toUpperCase() + text.slice(1);
                      }
                      setWhoSearchQuery(processedText);
                      // Reset search completion flag when user types
                      if (processedText.trim().length < 2) {
                        hasCompletedWhoSearchRef.current = false;
                      }
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {whoSearchQuery.length > 0 && (
                    <TouchableOpacity
                      onPress={() => {
                        setWhoSearchQuery('');
                        setWhoSearchResults({ leagues: [], teams: [] });
                      }}
                      style={styles.clearSearchButton}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <MaterialIcons name="close" size={20} color="rgba(0, 0, 0, 0.5)" />
                    </TouchableOpacity>
                  )}
                  {whoSearchLoading && whoSearchQuery.length === 0 && (
                    <ActivityIndicator size="small" color="rgba(0, 0, 0, 0.5)" style={styles.searchLoadingIndicator} />
                  )}
                </View>

                {/* Selected Items as Chips */}
                {(selectedLeagues.length > 0 || selectedTeams.length > 0) && (
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false} 
                    style={styles.chipsContainer}
                    contentContainerStyle={styles.chipsContent}
                  >
                    {selectedLeagues.map(league => (
                      <FilterChip
                        key={`league-${league.id}`}
                        label={league.name}
                        onRemove={() => handleRemoveLeague(league.id)}
                        type="league"
                      />
                    ))}
                    {selectedTeams.map(team => (
                      <FilterChip
                        key={`team-${team.id}`}
                        label={team.name}
                        onRemove={() => handleRemoveTeam(team.id)}
                        type="team"
                      />
                    ))}
                  </ScrollView>
                )}

                {/* Who Search Results */}
                {whoSearchQuery.trim().length >= 2 && (
                  <View style={styles.locationResultsContainer}>
                    {whoSearchLoading && whoSearchResults.leagues.length === 0 && whoSearchResults.teams.length === 0 && (
                      <View style={styles.locationLoadingContainer}>
                        <ActivityIndicator size="small" color={colors.primary} />
                      </View>
                    )}
                    {!whoSearchLoading && whoSearchResults.leagues.length === 0 && whoSearchResults.teams.length === 0 && whoSearchQuery.trim().length >= 2 && hasCompletedWhoSearchRef.current && (
                      <View style={styles.locationEmptyContainer}>
                        <Text style={styles.locationEmptyText}>No leagues or teams found</Text>
                      </View>
                    )}
                    {/* League Results */}
                    {whoSearchResults.leagues.map((league) => (
                      <TouchableOpacity
                        key={`league-${league.id}`}
                        style={styles.locationResultItem}
                        onPress={() => handleLeagueSelect(league)}
                        activeOpacity={0.7}
                      >
                        {league.badge ? (
                          <Image source={{ uri: league.badge }} style={styles.resultIcon} />
                        ) : (
                          <MaterialIcons name="emoji-events" size={40} color={colors.text.primary} />
                        )}
                        <View style={styles.locationResultText}>
                          <Text style={styles.locationResultTitle}>{league.name}</Text>
                          <Text style={styles.locationResultSubtitle}>
                            {league.country || 'League'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                    {/* Team Results */}
                    {whoSearchResults.teams.map((team) => (
                      <TouchableOpacity
                        key={`team-${team.id}`}
                        style={styles.locationResultItem}
                        onPress={() => handleTeamSelect(team)}
                        activeOpacity={0.7}
                      >
                        {team.badge ? (
                          <Image source={{ uri: team.badge }} style={styles.resultIcon} />
                        ) : (
                          <MaterialIcons name="sports-soccer" size={40} color={colors.text.primary} />
                        )}
                        <View style={styles.locationResultText}>
                          <Text style={styles.locationResultTitle}>{team.name}</Text>
                          <Text style={styles.locationResultSubtitle}>
                            {team.city ? `${team.city}, ${team.country || ''}` : team.country || 'Team'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
          </ScrollView>
                 </KeyboardAvoidingView>
        {/* ) : (
          <FlightSearchTab
            onClose={onClose}
            dateFrom={dateFrom}
            dateTo={dateTo}
          />
        )} */}

        {/* Bottom Action Buttons - Only show for Matches tab */}
        {/* {activeTab === 'matches' && ( */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.clearButton}
              onPress={clearAll}
              accessibilityLabel="Clear all search filters"
              accessibilityRole="button"
            >
              <Text style={styles.clearButtonText}>Clear All</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.enterButton, (!canSearch()) && styles.enterButtonDisabled]}
              onPress={handleSearch}
              disabled={loading || !canSearch()}
              accessibilityLabel="Search for matches"
              accessibilityRole="button"
            >
              {loading ? (
                <ActivityIndicator size="small" color="rgba(0, 0, 0, 0.5)" />
              ) : (
                <Text style={styles.enterButtonText}>Search</Text>
              )}
            </TouchableOpacity>
          </View>
        {/* )} */}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#D9E8F2', // Light blue background from Figma
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  closeButton: {
    padding: spacing.xs,
    width: 25,
    height: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.cardGrey,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 48,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.xs,
    alignItems: 'center',
    marginHorizontal: spacing.xs,
  },
  activeTab: {
    backgroundColor: colors.card,
  },
  tabText: {
    ...typography.body,
    color: colors.text.secondary,
    fontWeight: '500',
    fontSize: 16,
  },
  activeTabText: {
    color: colors.text.primary,
    fontWeight: '600',
    fontSize: 16,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl + spacing.lg,
    gap: spacing.lg,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.text.primary,
    borderRadius: borderRadius.card, // 14px from design tokens
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  cardTitle: {
    ...typography.h1,
    fontWeight: '500',
    fontSize: 24,
    color: colors.text.primary,
  },
  cardLabel: {
    ...typography.caption,
    color: 'rgba(0, 0, 0, 0.5)',
  },
  cardValue: {
    ...typography.caption,
    fontWeight: '500',
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  cardContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    gap: spacing.md + spacing.xs,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 1,
    borderColor: colors.text.primary,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    height: 49,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text.primary,
    padding: 0,
    margin: 0,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  clearSearchButton: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
  searchLoadingIndicator: {
    marginLeft: spacing.xs,
  },
  locationResultsContainer: {
    marginTop: spacing.sm,
    maxHeight: 200,
  },
  locationLoadingContainer: {
    padding: spacing.md,
    alignItems: 'center',
  },
  locationEmptyContainer: {
    padding: spacing.md,
    alignItems: 'center',
  },
  locationEmptyText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  locationResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.card,
    gap: spacing.xl + spacing.sm,
    marginBottom: spacing.xs,
  },
  locationResultText: {
    flex: 1,
    gap: 7,
  },
  locationResultTitle: {
    ...typography.caption,
    color: colors.text.primary,
  },
  locationResultSubtitle: {
    ...typography.caption,
    color: 'rgba(0, 0, 0, 0.5)',
  },
  recentSection: {
    gap: spacing.sm + spacing.xs + 3,
  },
  sectionLabel: {
    ...typography.caption,
    color: 'rgba(0, 0, 0, 0.5)',
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.card,
    gap: spacing.xl + spacing.sm, // 36px gap from Figma
  },
  recentItemText: {
    flex: 1,
    gap: 7, // 7px gap from Figma
  },
  recentItemTitle: {
    ...typography.caption,
    color: colors.text.primary,
  },
  recentItemSubtitle: {
    ...typography.caption,
    color: 'rgba(0, 0, 0, 0.5)',
  },
  calendarContainer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg + spacing.xs + 7, // 55px from Figma
    paddingBottom: spacing.lg,
    gap: spacing.sm + spacing.xs,
  },
  clearButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.text.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    height: 49,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    maxWidth: 160,
  },
  clearButtonText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.text.primary,
  },
  enterButton: {
    backgroundColor: '#B2E4CC', // Light green from Figma
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    height: 49,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    maxWidth: 160,
  },
  enterButtonDisabled: {
    opacity: 0.5,
  },
  enterButtonText: {
    ...typography.caption,
    fontWeight: '700',
    color: 'rgba(0, 0, 0, 0.5)',
  },
  chipsContainer: {
    marginTop: spacing.sm,
  },
  chipsContent: {
    paddingRight: spacing.md,
  },
  resultIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
  },
});

export default LocationSearchModal;

