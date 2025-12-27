import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  TouchableWithoutFeedback,
  ActivityIndicator,
  ScrollView,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { FlatList } from 'react-native';
import FilterModal from '../components/FilterModal';
import { useFilter } from '../contexts/FilterContext';
import { useItineraries } from '../contexts/ItineraryContext';
import ApiService from '../services/api';
import { calculateSearchBounds } from '../utils/adaptiveBounds';
import { processMatchesForFilterData } from '../utils/filterDataProcessor';
import * as performanceTracker from '../utils/performanceTracker';
import * as Haptics from 'expo-haptics';

import HeartButton from '../components/HeartButton';
import SearchModal from '../components/SearchModal';
import FilterIcon from '../components/FilterIcon';
import FilterChip from '../components/FilterChip';
import MatchCard from '../components/MatchCard';
import MatchMapView from '../components/MapView';
import { colors, spacing, typography, borderRadius } from '../styles/designTokens';

const MapResultsScreen = ({ navigation, route }) => {
  // Get search parameters and results from navigation
  const { searchParams, matches: initialMatches, initialRegion, hasWho, preSelectedFilters, _performanceStartTime } = route.params || {};
  
  // Track initial search end-to-end performance (if coming from LocationSearchModal)
  const initialSearchTimerRef = useRef(null);
  
  // Search state
  const [location, setLocation] = useState(searchParams?.location || null);
  const [dateFrom, setDateFrom] = useState(searchParams?.dateFrom || null);
  const [dateTo, setDateTo] = useState(searchParams?.dateTo || null);
  
  // Map and matches state
  const [matches, setMatches] = useState(() => {
    // Log venue coordinates for initial matches
    if (__DEV__ && initialMatches && initialMatches.length > 0) {
      console.log('📍 [VENUE COORDS] Initial matches venue coordinate analysis:');
      initialMatches.forEach((match, idx) => {
        const venue = match.fixture?.venue;
        if (venue) {
          const hasCoords = venue.coordinates && Array.isArray(venue.coordinates) && venue.coordinates.length === 2;
          const [lon, lat] = hasCoords ? venue.coordinates : [null, null];
          
          let source = 'UNKNOWN';
          if (hasCoords && venue.id) {
            // Has venueId and coordinates - most likely from MongoDB lookup by venueId
            source = 'MongoDB (venueId lookup)';
          } else if (hasCoords && !venue.id) {
            // Has coordinates but no venueId - could be MongoDB (by name), API-Sports, or geocoded
            // If venue has name/city, might be MongoDB by name fallback or geocoded
            source = venue.name && venue.city ? 'MongoDB (name lookup) or Geocoded' : 'API-Sports or Geocoded';
          } else if (!hasCoords && venue.id) {
            // Has venueId but no coordinates - MongoDB lookup found venue but it has no coords
            source = 'MongoDB (no coords in DB)';
          } else if (!hasCoords && !venue.id) {
            // No venueId and no coordinates - API-Sports only, no MongoDB match
            source = 'API-Sports (no MongoDB match)';
          }
          
          console.log(`  Initial Match ${idx + 1}: ${match.teams?.home?.name} vs ${match.teams?.away?.name}`, {
            venueId: venue.id || 'null',
            venueName: venue.name || 'Unknown',
            venueCity: venue.city || 'Unknown',
            coordinateSource: source,
            hasCoordinates: hasCoords,
            finalLatitude: lat !== null ? lat.toFixed(6) : 'N/A',
            finalLongitude: lon !== null ? lon.toFixed(6) : 'N/A',
            coordinates: hasCoords ? `[${lon.toFixed(6)}, ${lat.toFixed(6)}]` : 'null'
          });
        }
      });
    }
    return initialMatches || [];
  });
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [mapRegion, setMapRegion] = useState(initialRegion || null);
  
  // Date header selection state
  const [selectedDateHeader, setSelectedDateHeader] = useState(null);
  
  // Bottom sheet state
  const [sheetState, setSheetState] = useState('collapsed');
  const bottomSheetRef = useRef(null);
  const filterBottomSheetRef = useRef(null);
  
  // Snap points for bottom sheet
  const snapPoints = useMemo(() => [48, '55%', '85%'], []);
  
  // Overlay card state (Airbnb-like) - selection is by venue group
  const [selectedVenueIndex, setSelectedVenueIndex] = useState(null);
  
  // Search modal state
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  
  // Request cancellation and tracking
  const [currentRequestId, setCurrentRequestId] = useState(0);
  const currentRequestIdRef = useRef(0); // Ref for synchronous access in async callbacks
  const [isSearching, setIsSearching] = useState(false);
  const [lastSuccessfulRequestId, setLastSuccessfulRequestId] = useState(0);
  
  // Track if user has moved from initial search area
  const [hasMovedFromInitial, setHasMovedFromInitial] = useState(false);
  const [initialSearchRegion, setInitialSearchRegion] = useState(null);
  
  // Track matches excluded due to missing coordinates (for user awareness)
  const [matchesWithoutCoords, setMatchesWithoutCoords] = useState(0);
  
  // Track when we're performing a bounds search to prevent auto-fitting
  const [isPerformingBoundsSearch, setIsPerformingBoundsSearch] = useState(false);
  
  // State for smooth transitions between search results
  const [isTransitioningResults, setIsTransitioningResults] = useState(false);
  
  // Store original search bounds for filtering list view
  // List should only show matches in original viewport, not the entire buffer zone
  const [originalSearchBounds, setOriginalSearchBounds] = useState(null);
  
  // AbortController for request cancellation
  const abortControllerRef = useRef(null);

  // Track if pre-selected filters have been applied (prevent reappearance)
  const hasAppliedPreSelectedFiltersRef = useRef(false);

  
  // Refs
  const mapRef = useRef();
  const suppressNextMapPressRef = useRef(false);
  const lastMarkerPressTimeRef = useRef(0);
  
  // Get safe area insets
  const insets = useSafeAreaInsets();
  const bottomInsetValue = 0; // let the sheet sit flush with the bottom
  
    // Filter context
  const {
    updateFilterData,
    filterData,
    selectedFilters,
    updateSelectedFilters,
    filterModalVisible,
    openFilterModal,
    closeFilterModal
  } = useFilter();

  // Use the extracted filter data processor utility
  const computeFilterData = useCallback((matchesToProcess) => {
    return performanceTracker.trackSyncPerformance(
      performanceTracker.MetricType.FILTER_COMPUTATION,
      () => processMatchesForFilterData(matchesToProcess),
      { matchCount: matchesToProcess?.length || 0 }
    );
  }, []);

  // Wrapper that updates context (for use in useEffect)
  const processMatchesForFilters = useCallback((matchesToProcess) => {
    if (!matchesToProcess || matchesToProcess.length === 0) return;
    
    const currentMatchIds = matchesToProcess.map(m => m.id || m.fixture?.id).filter(Boolean).sort();
    const previousMatchIds = filterData?.matchIds || [];
    
    // Only update if match IDs are different (avoid unnecessary updates on map movement)
    if (JSON.stringify(currentMatchIds) !== JSON.stringify(previousMatchIds)) {
      const computedData = computeFilterData(matchesToProcess);
      updateFilterData(computedData);
    }
  }, [filterData, updateFilterData, computeFilterData]);

  // Process real match data for filters
  // FIXED: Process filter data from displayFilteredMatches (the filtered list) instead of all matches
  // This ensures filter options match what's actually shown in the list and map
  // Filter options will only show countries/leagues/teams from matches in the original search viewport
  useEffect(() => {
    // Filter data should be generated from the filtered list (displayFilteredMatches)
    // This ensures filter options only show countries/leagues/teams that are actually visible
    const matchesToProcess = displayFilteredMatches && displayFilteredMatches.length > 0 
      ? displayFilteredMatches 
      : (matches && matches.length > 0 ? matches : []);
    
    if (matchesToProcess.length > 0) {
      const currentMatchIds = matchesToProcess.map(m => m.id || m.fixture?.id).filter(Boolean).sort();
      const previousMatchIds = filterData?.matchIds || [];
      
      // Only process if match IDs are different (avoid unnecessary updates)
      if (JSON.stringify(currentMatchIds) !== JSON.stringify(previousMatchIds)) {
        const source = displayFilteredMatches && displayFilteredMatches.length > 0 
          ? 'displayFilteredMatches (filtered by bounds)' 
          : 'matches (all - no bounds filter yet)';
        
        if (__DEV__) {
          console.log('🔧 [FILTER] Processing filterData:', {
            source,
            filteredCount: displayFilteredMatches?.length || 0,
            totalMatches: matches.length,
            processingCount: matchesToProcess.length,
            note: 'Filter options will match visible matches only'
          });
        }
        processMatchesForFilters(matchesToProcess);
      }
    }
  }, [displayFilteredMatches, matches, originalSearchBounds, filterData, processMatchesForFilters]);

  // Validation logging: Track when filter data becomes ready
  useEffect(() => {
    if (filterData && filterData.matchIds && filterData.matchIds.length > 0) {
      if (__DEV__) {
      
      }
    }
  }, [filterData, matches.length]);

  // FIXED: Initialize filterData synchronously from initialMatches on mount
  // This prevents race condition where getFilteredMatches runs before filterData is ready
  useEffect(() => {
    if (initialMatches && initialMatches.length > 0 && (!filterData || !filterData.matchIds || filterData.matchIds.length === 0)) {
      const initialFilterData = computeFilterData(initialMatches);
      if (initialFilterData && initialFilterData.matchIds.length > 0) {
        updateFilterData(initialFilterData);
        if (__DEV__) {
          console.log('✅ [FILTER] Initialized filterData synchronously from initialMatches:', {
            countries: initialFilterData.countries?.length || 0,
            leagues: initialFilterData.leagues?.length || 0,
            teams: initialFilterData.teams?.length || 0,
            matchIds: initialFilterData.matchIds.length
          });
        }
      }
    }
  }, []); // Only run once on mount

  // Set initial search region when component mounts
  // FIXED: Only run once on mount to prevent repeated initialization
  useEffect(() => {
    if (initialRegion && !initialSearchRegion) {
      if (__DEV__) {
        console.log('🗺️ [INIT] Setting initial region:', {
          center: { lat: initialRegion.latitude.toFixed(4), lng: initialRegion.longitude.toFixed(4) },
          delta: { lat: initialRegion.latitudeDelta.toFixed(4), lng: initialRegion.longitudeDelta.toFixed(4) },
          initialMatchesCount: initialMatches?.length || 0
        });
      }
      setInitialSearchRegion(initialRegion);
      setMapRegion(initialRegion); // Also set mapRegion immediately
      
      // Set original search bounds from initialRegion for list filtering
      const boundsFromRegion = {
        northeast: {
          lat: initialRegion.latitude + (initialRegion.latitudeDelta / 2),
          lng: initialRegion.longitude + (initialRegion.longitudeDelta / 2)
        },
        southwest: {
          lat: initialRegion.latitude - (initialRegion.latitudeDelta / 2),
          lng: initialRegion.longitude - (initialRegion.longitudeDelta / 2)
        }
      };
      setOriginalSearchBounds(boundsFromRegion);
      if (__DEV__) {
        console.log('📍 [INIT] Set original search bounds from initialRegion:', boundsFromRegion);
      }
    }
  }, []); // Only run once on mount

  // Track if we've already auto-fitted for global search (prevent repeated fitting)
  const hasAutoFittedRef = useRef(false);

  // Auto-fit map to markers for global Who-based searches (no location, no initialRegion)
  // This ensures all markers from a global search are visible
  useEffect(() => {
    // Only auto-fit if:
    // 1. This is a Who-based search (hasWho is true)
    // 2. No initialRegion was provided (global search without location)
    // 3. We have matches to fit to
    // 4. Map ref is available
    // 5. We haven't already fitted (prevent repeated fitting on filter changes)
    if (hasWho && !initialRegion && matches.length > 0 && mapRef.current && !hasAutoFittedRef.current) {
      // Use a small delay to ensure map is fully rendered
      const timeoutId = setTimeout(() => {
        if (mapRef.current && mapRef.current.fitToMatches) {
          if (__DEV__) {
            console.log('🗺️ [AUTO-FIT] Fitting map to markers from global search:', {
              matchCount: matches.length,
              hasWho,
              hasInitialRegion: !!initialRegion
            });
          }
          mapRef.current.fitToMatches();
          hasAutoFittedRef.current = true; // Mark as fitted
        }
      }, 500); // Small delay to ensure map is ready

      return () => clearTimeout(timeoutId);
    }
  }, [hasWho, initialRegion, matches.length]); // Only re-run when these change

  // Apply pre-selected filters from natural language search (only once on mount)
  useEffect(() => {
    // Only apply pre-selected filters once, and only if they haven't been applied yet
    if (preSelectedFilters && filterData && !hasAppliedPreSelectedFiltersRef.current) {
      if (__DEV__) {
        console.log('🎯 Applying pre-selected filters:', preSelectedFilters);
      }
      
      // Convert pre-selected filter names to IDs by matching with filterData
      const selectedFilters = {
        countries: [],
        leagues: [],
        teams: []
      };

      // Match country
      if (preSelectedFilters.country && filterData.countries) {
        const countryMatch = filterData.countries.find(c => 
          c.name.toLowerCase() === preSelectedFilters.country.toLowerCase()
        );
        if (countryMatch) {
          selectedFilters.countries = [countryMatch.id];
          if (__DEV__) {
            console.log('🏴 Selected country:', countryMatch.name, countryMatch.id);
          }
        }
      }

      // Match leagues - preSelectedFilters.leagues can be objects {id, name} (from Who section) or strings (from natural language)
      if (preSelectedFilters.leagues && preSelectedFilters.leagues.length > 0) {
        const leagueMatches = preSelectedFilters.leagues
          .map(leagueValue => {
            // Handle object format {id, name} from Who section
            if (typeof leagueValue === 'object' && leagueValue.id) {
              // Try to find in filterData first (for proper matching)
              const match = filterData.leagues?.find(l => String(l.id) === String(leagueValue.id));
              // If found in filterData, use it; otherwise use the preSelectedFilter data
              return match || { id: leagueValue.id, name: leagueValue.name };
            }
            // Handle string format (from natural language search) - try matching by ID or name
            if (filterData.leagues) {
              let match = filterData.leagues.find(l => String(l.id) === String(leagueValue));
              if (!match) {
                match = filterData.leagues.find(l => 
                  l.name.toLowerCase() === String(leagueValue).toLowerCase()
                );
              }
              return match;
            }
            return null;
          })
          .filter(Boolean);
        
        if (leagueMatches.length > 0) {
          selectedFilters.leagues = leagueMatches.map(l => l.id);
          if (__DEV__) {
            console.log('🏆 Selected leagues:', leagueMatches.map(l => l.name), selectedFilters.leagues);
          }
        }
      }

      // Match teams - preSelectedFilters.teams can be objects {id, name} (from Who section) or strings (from natural language)
      if (preSelectedFilters.teams && preSelectedFilters.teams.length > 0) {
        const teamMatches = preSelectedFilters.teams
          .map(teamValue => {
            // Handle object format {id, name} from Who section
            if (typeof teamValue === 'object' && teamValue.id) {
              // Try to find in filterData first (for proper matching)
              const match = filterData.teams?.find(t => String(t.id) === String(teamValue.id));
              // If found in filterData, use it; otherwise use the preSelectedFilter data
              return match || { id: teamValue.id, name: teamValue.name };
            }
            // Handle string format (from natural language search) - try matching by ID or name
            if (filterData.teams) {
              let match = filterData.teams.find(t => String(t.id) === String(teamValue));
              if (!match) {
                match = filterData.teams.find(t => 
                  t.name.toLowerCase() === String(teamValue).toLowerCase()
                );
              }
              return match;
            }
            return null;
          })
          .filter(Boolean);
        
        if (teamMatches.length > 0) {
          selectedFilters.teams = teamMatches.map(t => t.id);
          if (__DEV__) {
            console.log('⚽ Selected teams:', teamMatches.map(t => t.name), selectedFilters.teams);
          }
        }
      }

      // Apply the filters if we found any matches
      const hasFilters = selectedFilters.countries.length > 0 || 
                        selectedFilters.leagues.length > 0 || 
                        selectedFilters.teams.length > 0;
      
      if (hasFilters) {
        updateSelectedFilters(selectedFilters);
        hasAppliedPreSelectedFiltersRef.current = true; // Mark as applied
        if (__DEV__) {
          console.log('✅ Applied pre-selected filters:', selectedFilters);
        }
      } else if (__DEV__) {
        console.log('⚠️ No matching filters found for pre-selected values');
      }
    }
  }, [preSelectedFilters, filterData, updateSelectedFilters]);

  // Clean up invalid filters when filterData changes after a new search
  // This ensures filters from a previous search don't persist if they're not valid for the new results
  useEffect(() => {
    if (!filterData || !filterData.matchIds || filterData.matchIds.length === 0) {
      return; // Filter data not ready yet
    }
    
    // Skip cleanup if no filters are selected
    if (!selectedFilters || 
        (selectedFilters.countries.length === 0 && 
         selectedFilters.leagues.length === 0 && 
         selectedFilters.teams.length === 0)) {
      return;
    }
    
    // Validate selected filters against new filterData
    const validCountryIds = new Set(filterData.countries.map(c => String(c.id)));
    const validLeagueIds = new Set(filterData.leagues.map(l => String(l.id)));
    const validTeamIds = new Set(filterData.teams.map(t => String(t.id)));
    
    const cleanedFilters = {
      countries: selectedFilters.countries.filter(id => validCountryIds.has(String(id))),
      leagues: selectedFilters.leagues.filter(id => validLeagueIds.has(String(id))),
      teams: selectedFilters.teams.filter(id => validTeamIds.has(String(id)))
    };
    
    // Only update if filters were actually cleaned (some were invalid)
    const wasCleaned = 
      cleanedFilters.countries.length !== selectedFilters.countries.length ||
      cleanedFilters.leagues.length !== selectedFilters.leagues.length ||
      cleanedFilters.teams.length !== selectedFilters.teams.length;
    
    if (wasCleaned) {
      if (__DEV__) {
        console.log('🧹 [FILTER] Cleaned invalid filters after new search:', {
          removed: {
            countries: selectedFilters.countries.length - cleanedFilters.countries.length,
            leagues: selectedFilters.leagues.length - cleanedFilters.leagues.length,
            teams: selectedFilters.teams.length - cleanedFilters.teams.length
          },
          remaining: {
            countries: cleanedFilters.countries.length,
            leagues: cleanedFilters.leagues.length,
            teams: cleanedFilters.teams.length
          }
        });
      }
      updateSelectedFilters(cleanedFilters);
    }
  }, [filterData, selectedFilters, updateSelectedFilters]);

  // Calculate available height for FlatList
  const calculateFlatListHeight = useCallback(() => {
    const screenHeight = Dimensions.get('window').height;
    const snapPointPercentage = sheetState === 'full' ? 0.85 : 0.55; // Reduced from 90% to 85% to avoid header overlap
    const bottomSheetHeight = screenHeight * snapPointPercentage;
    
    // Approximate header height (search summary + results header + padding)
    const headerHeight = 80; // Reduced from 120 to 80
    
    // Bottom tab navigation height
    const bottomTabHeight = 60; // Reduced from 80 to 60
    
    // Safe area bottom inset
    const safeAreaBottom = insets.bottom;
    
    // Calculate available height for FlatList
    const availableHeight = bottomSheetHeight - headerHeight - bottomTabHeight - safeAreaBottom - 50; // Increased padding to reduce white space
    
    return Math.max(availableHeight, 200); // Minimum height of 200px
  }, [sheetState, insets.bottom]);

  // Simplified search function - viewport only
  const performBoundsSearch = async (region, requestId, timer = null) => {
    if (!dateFrom || !dateTo || !region) return;
    
    // Cancel previous request if it exists
    if (abortControllerRef.current) {
      if (__DEV__) {
        console.log('🛑 [SEARCH] Cancelling previous request');
      }
      abortControllerRef.current.abort();
    }
    
    // Create new AbortController for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    setIsSearching(true);
    
    // Start API call phase
    const stopApiPhase = timer ? timer.startPhase('API_CALL') : null;
    
    try {
      // FIXED: Use actual viewport dimensions instead of fixed size increments
      // The previous approach used fixed sizes (0.1°, 0.2°, etc.) which didn't match the actual zoom
      // Now we use the actual map viewport dimensions that the user sees
      
      // Calculate bounds from the ACTUAL visible viewport
      // latitudeDelta and longitudeDelta represent the actual span of what's visible on screen
      const viewportLatSpan = region.latitudeDelta;
      const viewportLngSpan = region.longitudeDelta;
      
      // Use exact viewport bounds for search (no buffer)
      // Client-side viewport filtering will ensure only visible matches are displayed
      // This ensures search bounds match what the user sees
      const bounds = {
        northeast: {
          lat: region.latitude + (region.latitudeDelta / 2),
          lng: region.longitude + (region.longitudeDelta / 2),
        },
        southwest: {
          lat: region.latitude - (region.latitudeDelta / 2),
          lng: region.longitude - (region.longitudeDelta / 2),
        },
      };
      
      // Store pending bounds - we'll confirm them when response is received
      // This prevents flickering if the request fails or returns different bounds
      const pendingBounds = bounds;
      if (__DEV__) {
        console.log('📍 [SEARCH] Pending search bounds (awaiting confirmation):', pendingBounds);
        console.log('🔍 [SEARCH] Starting bounds search:', {
        requestId,
        currentRequestId,
        region: {
          center: { lat: region.latitude.toFixed(4), lng: region.longitude.toFixed(4) },
          delta: { lat: region.latitudeDelta.toFixed(4), lng: region.longitudeDelta.toFixed(4) }
        },
        bounds: {
          ne: { lat: bounds.northeast.lat.toFixed(4), lng: bounds.northeast.lng.toFixed(4) },
          sw: { lat: bounds.southwest.lat.toFixed(4), lng: bounds.southwest.lng.toFixed(4) }
        },
        dateRange: { from: dateFrom, to: dateTo }
        });
      }

      const response = await ApiService.searchMatchesByBounds({
        bounds,
        dateFrom,
        dateTo,
        competitions: [], // Explicitly no filters - search all matches
        teams: [],        // Explicitly no filters - search all matches
        signal: abortController.signal, // Pass AbortSignal for cancellation
      });

      // Stop API call phase
      if (stopApiPhase) {
        stopApiPhase({ matchCount: response.data?.length || 0, success: response.success });
      }

      // Start data processing phase
      const stopProcessingPhase = timer ? timer.startPhase('DATA_PROCESSING') : null;

      // Check if this request is stale (replaced by a newer request)
      // STRICTER CHECK: Reject ALL older requests, not just those 2+ versions behind
      // This prevents race conditions where rapid clicks cause old results to overwrite new ones
      // Use ref for synchronous comparison since state updates are async
      const latestRequestId = currentRequestIdRef.current;
      const isStale = requestId < latestRequestId;
      
      if (isStale) {
        if (__DEV__) {
          console.log('⏭️ [SEARCH] REJECTED - Stale request:', {
            requestId,
            latestRequestId,
            isStale: true,
            reason: 'Replaced by newer request (strict rejection)'
          });
        }
        return;
      }

      if (response.success) {
        // Update the last successful request ID
        setLastSuccessfulRequestId(requestId);
        
        // Update original search bounds to the new search area
        // This ensures the list filters by the current search area
        const confirmedBounds = response.bounds || pendingBounds;
        setOriginalSearchBounds(confirmedBounds);
        
        // Ensure response.data is an array (defensive check)
        const newMatches = Array.isArray(response.data) ? response.data : [];
        const previousMatchCount = matches.length;
        
        if (__DEV__) {
          console.log('📍 [SEARCH] Updated search bounds:', {
            previous: originalSearchBounds,
            new: confirmedBounds,
            fromBackend: !!response.bounds,
            totalMatchesBeforeMerge: matches.length,
            newMatchesFromSearch: newMatches.length
          });
        }
        
        if (__DEV__) {
          console.log('✅ [SEARCH] Results received:', {
            requestId,
            latestRequestId,
            newMatchCount: newMatches.length,
            previousMatchCount,
            willUpdate: !isStale,
            bounds: {
              center: { lat: region.latitude.toFixed(4), lng: region.longitude.toFixed(4) },
              delta: { lat: region.latitudeDelta.toFixed(4), lng: region.longitudeDelta.toFixed(4) }
            }
          });
        }
        
        // Log venue coordinate sources and final coordinates (only in dev, and only for first few matches to avoid spam)
        if (__DEV__ && newMatches.length > 0 && newMatches.length <= 10) {
          console.log('📍 [VENUE COORDS] Venue coordinate analysis (first 10 matches):');
          newMatches.slice(0, 10).forEach((match, idx) => {
            const venue = match.fixture?.venue;
            if (venue) {
              const hasCoords = venue.coordinates && Array.isArray(venue.coordinates) && venue.coordinates.length === 2;
              const [lon, lat] = hasCoords ? venue.coordinates : [null, null];
              
              // Determine coordinate source based on available data
              // Backend priority: MongoDB (by venueId) > MongoDB (by name) > API-Sports > Team.venue > Geocoded
              let source = 'UNKNOWN';
              if (hasCoords && venue.id) {
                // Has venueId and coordinates - most likely from MongoDB lookup by venueId
                source = 'MongoDB (venueId lookup)';
              } else if (hasCoords && !venue.id) {
                // Has coordinates but no venueId - could be MongoDB (by name), API-Sports, or geocoded
                // If venue has name/city, might be MongoDB by name fallback or geocoded
                source = venue.name && venue.city ? 'MongoDB (name lookup) or Geocoded' : 'API-Sports or Geocoded';
              } else if (!hasCoords && venue.id) {
                // Has venueId but no coordinates - MongoDB lookup found venue but it has no coords
                source = 'MongoDB (no coords in DB)';
              } else if (!hasCoords && !venue.id) {
                // No venueId and no coordinates - API-Sports only, no MongoDB match
                source = 'API-Sports (no MongoDB match)';
              }
              
              console.log(`  Match ${idx + 1}: ${match.teams?.home?.name} vs ${match.teams?.away?.name}`, {
                venueId: venue.id || 'null',
                venueName: venue.name || 'Unknown',
                venueCity: venue.city || 'Unknown',
                coordinateSource: source,
                hasCoordinates: hasCoords,
                finalLatitude: lat !== null ? lat.toFixed(6) : 'N/A',
                finalLongitude: lon !== null ? lon.toFixed(6) : 'N/A',
                coordinates: hasCoords ? `[${lon.toFixed(6)}, ${lat.toFixed(6)}]` : 'null'
              });
            }
          });
        }
        
        // Start filter computation phase
        const stopFilterPhase = timer ? timer.startPhase('FILTER_COMPUTATION') : null;
        
        // Update matches efficiently - all markers will be displayed
        updateMatchesEfficiently(newMatches);
        
        // Stop filter computation phase
        if (stopFilterPhase) {
          stopFilterPhase({ matchCount: newMatches.length });
        }
        
        // Start state update phase (before setState calls)
        const stopStatePhase = timer ? timer.startPhase('STATE_UPDATE') : null;
        
        // Track matches excluded due to missing coordinates
        const excludedCount = response.debug?.withoutCoordinates || 0;
        setMatchesWithoutCoords(excludedCount);
        if (__DEV__ && excludedCount > 0) {
          console.log(`⚠️ [SEARCH] ${excludedCount} matches excluded due to missing coordinates`);
        }
        
        // Stop state update phase (state updates are synchronous, so we stop immediately after)
        if (stopStatePhase) {
          stopStatePhase({ matchCount: newMatches.length });
        }
        
        // Stop data processing phase
        if (stopProcessingPhase) {
          stopProcessingPhase({ matchCount: newMatches.length });
        }
        
        // Show user feedback if no results
        if (__DEV__ && newMatches.length === 0) {
          console.log('⚠️ [SEARCH] No results found for this area');
        }
      } else {
        if (__DEV__) {
          console.error('❌ [SEARCH] API error:', {
            requestId,
            error: response.error,
            bounds
          });
        }
        Alert.alert('Search Error', response.error || 'Failed to search matches');
      }
    } catch (error) {
      // Don't show error if request was cancelled
      if (error.message === 'Request was cancelled' || error.name === 'AbortError') {
        if (__DEV__) {
          console.log('⏭️ [SEARCH] Request cancelled:', { requestId, currentRequestId });
        }
        return; // Silently return if cancelled
      }
      
      if (__DEV__) {
        console.error('❌ [SEARCH] Error:', {
          requestId,
          currentRequestId,
          error: error.message,
          isRecentRequest: requestId >= (currentRequestId - 1)
        });
      }
      // Only show error if this is still a recent request
      if (requestId >= (currentRequestId - 1)) {
        Alert.alert('Error', 'Failed to search matches');
      }
    } finally {
      // Only clear searching if this is still a recent request
      const isRecentRequest = requestId >= (currentRequestId - 1);
      if (isRecentRequest) {
        if (__DEV__) {
          console.log('✅ [SEARCH] Completed:', { requestId, currentRequestId });
        }
        setIsSearching(false);
        // Clear abort controller if this was the active request
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
        }
      } else if (__DEV__) {
        console.log('⏭️ [SEARCH] Skipping cleanup for stale request:', { requestId, currentRequestId });
      }
    }
  };

  // Merge matches from multiple searches instead of replacing
  const updateMatchesEfficiently = (newMatches) => {
    // Create a Map to dedupe by match ID
    const matchesMap = new Map();
    
    // Add existing matches first
    matches.forEach(match => {
      const matchId = match.fixture?.id || match.id;
      if (matchId) {
        matchesMap.set(matchId, match);
      }
    });
    
    // Add new matches (will overwrite duplicates, keeping the latest version)
    newMatches.forEach(match => {
      const matchId = match.fixture?.id || match.id;
      if (matchId) {
        matchesMap.set(matchId, match);
      }
    });
    
    // Convert back to array
    const mergedMatches = Array.from(matchesMap.values());
    
    const previousCount = matches.length;
    const newCount = newMatches.length;
    const mergedCount = mergedMatches.length;
    const matchIdsBefore = matches.map(m => m.fixture?.id || m.id).filter(Boolean).sort();
    const matchIdsAfter = mergedMatches.map(m => m.fixture?.id || m.id).filter(Boolean).sort();
    const matchesRemoved = matchIdsBefore.filter(id => !matchIdsAfter.includes(id));
    const matchesAdded = matchIdsAfter.filter(id => !matchIdsBefore.includes(id));
    
    if (__DEV__) {
      console.log('🔄 [MATCHES] Merging:', {
        previousCount,
        newCount,
        mergedCount,
        difference: mergedCount - previousCount,
        matchesRemoved: matchesRemoved.length,
        matchesAdded: matchesAdded.length,
        removedIds: matchesRemoved.slice(0, 5),
        addedIds: matchesAdded.slice(0, 5)
      });
    }
    
    // Update with merged matches
    setMatches(mergedMatches);
  };

  // Center map on markers and update mapRegion state immediately
  const centerMapOnMarkers = (markers) => {
    if (!markers || markers.length === 0) {
      if (__DEV__) {
        console.log('No markers to center on');
      }
      return; // Don't move map if no results
    }
    
    if (!mapRef.current) {
      if (__DEV__) {
        console.log('Map ref not available');
      }
      return;
    }
    
    // Filter valid markers with coordinates
    const validMarkers = markers.filter(match => {
      const venue = match.fixture?.venue;
      return venue?.coordinates && venue.coordinates.length === 2;
    });
    
    if (validMarkers.length === 0) {
      if (__DEV__) {
        console.log('No valid markers with coordinates');
      }
      return;
    }
    
    // Calculate center point of all markers
    const coordinates = validMarkers.map(match => ({
      latitude: match.fixture.venue.coordinates[1],  // GeoJSON: [lon, lat]
      longitude: match.fixture.venue.coordinates[0], // So lat is index 1, lon is index 0
    }));
    
    const lats = coordinates.map(c => c.latitude);
    const lngs = coordinates.map(c => c.longitude);
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    
    // Calculate bounds to fit all markers with padding
    const latSpan = Math.max(...lats) - Math.min(...lats);
    const lngSpan = Math.max(...lngs) - Math.min(...lngs);
    const padding = 0.1; // 10% padding
    const newLatDelta = Math.max(latSpan * (1 + padding), 0.1); // Minimum 0.1 degree
    const newLngDelta = Math.max(lngSpan * (1 + padding), 0.1); // Minimum 0.1 degree
    
    const newRegion = {
      latitude: centerLat,
      longitude: centerLng,
      latitudeDelta: newLatDelta,
      longitudeDelta: newLngDelta,
    };
    
    if (__DEV__) {
      console.log('🎯 Centering map on markers:', {
        markerCount: validMarkers.length,
        center: { lat: centerLat, lng: centerLng },
        newRegion,
        previousZoom: mapRegion?.latitudeDelta || 0.5
      });
    }
    
    // Update mapRegion state IMMEDIATELY so viewport filtering uses correct bounds
    setMapRegion(newRegion);
    
    // Also update debouncedMapRegion immediately (don't wait for debounce)
    // This ensures viewport filtering works correctly right away
    setDebouncedMapRegion(newRegion);
    
    // Animate map to new region
    mapRef.current.animateToRegion(newRegion, 1000); // 1 second smooth animation
  };


  // Helper function to check if coordinates are within the current viewport
  const isWithinViewport = (coordinates, region) => {
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
      return false;
    }
    if (!region || !region.latitude || !region.longitude || !region.latitudeDelta || !region.longitudeDelta) {
      return true; // If no region, show all matches (fallback)
    }
    
    const [lon, lat] = coordinates; // GeoJSON format: [longitude, latitude]
    
    // Calculate viewport bounds
    const halfLatDelta = region.latitudeDelta / 2;
    const halfLngDelta = region.longitudeDelta / 2;
    
    const northeast = {
      lat: region.latitude + halfLatDelta,
      lng: region.longitude + halfLngDelta
    };
    const southwest = {
      lat: region.latitude - halfLatDelta,
      lng: region.longitude - halfLngDelta
    };
    
    // Check if coordinates are within viewport bounds
    const withinBounds = lat >= southwest.lat && lat <= northeast.lat &&
                         lon >= southwest.lng && lon <= northeast.lng;
    
    return withinBounds;
  };

  // Handle map region change (when user pans/zooms)
  // FIXED: Always allow "Search this area" - removed movement threshold requirement
  // FIXED: Wrapped in useCallback to prevent infinite render loops
  // Empty deps: setMapRegion and setHasMovedFromInitial are stable state setters
  const handleMapRegionChange = useCallback((region, bounds) => {
    setMapRegion(region);
    
    // Always show "Search this area" button - user should be able to re-search current viewport
    setHasMovedFromInitial(true);
    
    // Reduced logging - only log significant changes
    // (Removed verbose logging on every pan/zoom)
  }, []); // Empty deps: setMapRegion and setHasMovedFromInitial are stable

  // Handle marker press: show overlay, hide bottom sheet, and center map
  const getVenueGroupKey = useCallback((match) => {
    const venue = match?.fixture?.venue;
    if (!venue) return null;
    // Prioritize coordinates for physical location matching (handles shared stadiums with different venue IDs)
    // Round coordinates to 6 decimal places (~0.1m precision) to handle floating point differences
    if (venue.coordinates && venue.coordinates.length === 2) {
      const [lon, lat] = venue.coordinates;
      const roundedLon = Math.round(lon * 1000000) / 1000000;
      const roundedLat = Math.round(lat * 1000000) / 1000000;
      return `geo:${roundedLon},${roundedLat}`;
    }
    // Fallback to venue ID if no coordinates available
    if (venue.id != null) return `id:${venue.id}`;
    return null;
  }, []);

  const handleMarkerPress = useCallback((match) => {
    // Defensive checks - validate match data
    if (!match) {
      if (__DEV__) {
        console.warn('MapResultsScreen: handleMarkerPress called with null/undefined match');
      }
      return;
    }
    
    if (!match.fixture) {
      if (__DEV__) {
        console.warn('MapResultsScreen: handleMarkerPress called with match missing fixture');
      }
      return;
    }
    
    // Debounce rapid successive marker presses (prevent double-taps)
    const now = Date.now();
    const timeSinceLastPress = now - lastMarkerPressTimeRef.current;
    if (timeSinceLastPress < 300) {
      // Ignore presses within 300ms of the last press
      return;
    }
    lastMarkerPressTimeRef.current = now;
    
    // Prevent immediate map-press from closing the overlay
    // Increased timeout from 250ms to 350ms to ensure marker press completes
    suppressNextMapPressRef.current = true;
    const suppressTimeout = setTimeout(() => { 
      suppressNextMapPressRef.current = false; 
    }, 350);
    
    try {
      // Map marker selects the venue group containing this match
      const key = getVenueGroupKey(match);
      
      // CRITICAL: Check if venueGroups is ready and has data
      if (!venueGroups || venueGroups.length === 0) {
        if (__DEV__) {
          console.warn('MapResultsScreen: No venue groups available - markers may not be ready yet');
        }
        clearTimeout(suppressTimeout);
        suppressNextMapPressRef.current = false;
        return;
      }
      
      if (!key) {
        if (__DEV__) {
          console.warn('MapResultsScreen: Could not generate venue group key for match', match.fixture.id);
        }
        clearTimeout(suppressTimeout);
        suppressNextMapPressRef.current = false;
        return;
      }
      
      // Find the venue group by key
      const venueGroup = venueGroups.find(g => g.key === key);
      
      if (!venueGroup) {
        if (__DEV__) {
          console.warn('MapResultsScreen: Venue group not found for key', key, 'match ID:', match.fixture.id);
        }
        clearTimeout(suppressTimeout);
        suppressNextMapPressRef.current = false;
        return;
      }
      
      // Find the specific match in the venue group by fixture ID
      // This ensures we show the correct match even if the marker was created with a different "firstMatch"
      // This fixes the issue where the wrong match temporarily shows
      const matchFixtureId = match.fixture.id;
      const targetMatch = venueGroup.matches.find(m => m.fixture?.id === matchFixtureId);
      
      // If the specific match isn't found, use the first match in the group (fallback)
      // But prioritize finding the exact match to avoid showing wrong match temporarily
      const matchToShow = targetMatch || venueGroup.matches[0];
      
      if (!matchToShow) {
        if (__DEV__) {
          console.warn('MapResultsScreen: No matches found in venue group', key);
        }
        clearTimeout(suppressTimeout);
        suppressNextMapPressRef.current = false;
        return;
      }
      
      // Find the index of the venue group
      const index = venueGroups.findIndex(g => g.key === key);
      if (index < 0) {
        if (__DEV__) {
          console.warn('MapResultsScreen: Could not find venue group index for key', key);
        }
        clearTimeout(suppressTimeout);
        suppressNextMapPressRef.current = false;
        return;
      }
      
      // Set the selected venue index - the overlay will show the matches for this venue group
      // Since venueGroups is sorted chronologically, the first match in the group will be shown
      // But we've validated that the clicked match exists in this group
      setSelectedVenueIndex(index);
      
      // Close bottom sheet if open
      if (bottomSheetRef.current && typeof bottomSheetRef.current.close === 'function') {
        bottomSheetRef.current.close();
      }
      
      // Center map on venue with a slight delay to ensure marker press event completes
      const venue = match.fixture?.venue;
      if (venue?.coordinates && venue.coordinates.length === 2 && mapRef.current) {
        // Small delay before animating to ensure marker press is fully processed
        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.animateToRegion({
              latitude: venue.coordinates[1],
              longitude: venue.coordinates[0],
              latitudeDelta: mapRegion?.latitudeDelta || 0.1,
              longitudeDelta: mapRegion?.longitudeDelta || 0.1,
            }, 1000);
          }
        }, 50); // Small delay to ensure event completes
      }
    } catch (error) {
      if (__DEV__) {
        console.error('MapResultsScreen: Error in handleMarkerPress', error);
      }
      clearTimeout(suppressTimeout);
      suppressNextMapPressRef.current = false;
    }
  }, [venueGroups, mapRegion, getVenueGroupKey]);

  const handleMapPress = useCallback(() => {
    // Check if we should suppress this map press (e.g., immediately after marker press)
    if (suppressNextMapPressRef.current) {
      suppressNextMapPressRef.current = false;
      return;
    }
    handleOverlayClose();
  }, [handleOverlayClose]);

  const centerMapOnVenueByIndex = (index) => {
    const group = venueGroups?.[index];
    const venue = group?.venue;
    if (venue?.coordinates && venue.coordinates.length === 2 && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: venue.coordinates[1],
        longitude: venue.coordinates[0],
        latitudeDelta: mapRegion?.latitudeDelta || 0.1,
        longitudeDelta: mapRegion?.longitudeDelta || 0.1,
      }, 600);
    }
  };

  const handleOverlayClose = useCallback(() => {
    setSelectedVenueIndex(null);
    if (bottomSheetRef.current && typeof bottomSheetRef.current.snapToIndex === 'function') {
      bottomSheetRef.current.snapToIndex(0);
    }
  }, []);

  const handleOverlayPrev = () => {
    if (selectedVenueIndex === null || selectedVenueIndex <= 0) return;
    const newIndex = selectedVenueIndex - 1;
    setSelectedVenueIndex(newIndex);
    centerMapOnVenueByIndex(newIndex);
  };

  const handleOverlayNext = () => {
    if (selectedVenueIndex === null) return;
    const lastIndex = (venueGroups?.length || 0) - 1;
    if (selectedVenueIndex >= lastIndex) return;
    const newIndex = selectedVenueIndex + 1;
    setSelectedVenueIndex(newIndex);
    centerMapOnVenueByIndex(newIndex);
  };

  // Handle match item press in list
  const handleMatchPress = (match) => {
    // Center map on venue
    const venue = match.fixture?.venue;
    if (venue?.coordinates && venue.coordinates.length === 2 && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: venue.coordinates[1],  // GeoJSON: [lon, lat] - so lat is index 1
        longitude: venue.coordinates[0], // GeoJSON: [lon, lat] - so lon is index 0
        latitudeDelta: mapRegion?.latitudeDelta || 0.1,
        longitudeDelta: mapRegion?.longitudeDelta || 0.1,
      }, 1000);
    }
  };

  // Format date for display
  const formatDisplayDate = (dateString) => {
    if (!dateString) return 'N/A';
    // Parse the date string safely without timezone conversion
    // This prevents the off-by-one-day issue when dates are interpreted as UTC
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Handle search modal
  const handleSearchModalOpen = () => {
    setSearchModalVisible(true);
  };

  const handleSearchModalClose = () => {
    setSearchModalVisible(false);
  };

  const handleSearchUpdate = async (newSearchParams) => {
    setSearchLoading(true);
    setSearchModalVisible(false);
    
    try {
      const bounds = {
        northeast: {
          lat: newSearchParams.location.lat + 0.25,
          lng: newSearchParams.location.lon + 0.25,
        },
        southwest: {
          lat: newSearchParams.location.lat - 0.25,
          lng: newSearchParams.location.lon - 0.25,
        }
      };
      
      const response = await ApiService.searchMatchesByBounds({
        bounds,
        dateFrom: newSearchParams.dateFrom,
        dateTo: newSearchParams.dateTo
      });
      
      const newMatches = response.data || [];
      
      // Update state with new search results
      setMatches(newMatches);
      
      // Update map region to new location
      const newRegion = {
        latitude: newSearchParams.location.lat,
        longitude: newSearchParams.location.lon,
        latitudeDelta: 0.5,
        longitudeDelta: 0.5,
      };
      setMapRegion(newRegion);
      
      // Update search parameters
      route.params.searchParams = newSearchParams;
      
    } catch (error) {
      if (__DEV__) {
        console.error('MapResultsScreen: Search update error:', error);
      }
      Alert.alert('Error', error.message || 'Failed to update search');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleFilterOpen = () => {
    if (__DEV__) {
      console.log('🔵 [FILTER] Filter button pressed');
      console.log('🔵 [FILTER] Current filterModalVisible:', filterModalVisible);
      console.log('🔵 [FILTER] Calling openFilterModal()');
    }
    // Open filter drawer - it will overlay on top of match list drawer if open
    openFilterModal();
    if (__DEV__) {
      console.log('🔵 [FILTER] openFilterModal() called');
      console.log('🔵 [FILTER] filterBottomSheetRef.current:', filterBottomSheetRef.current);
      if (filterBottomSheetRef.current) {
        console.log('🔵 [FILTER] filterBottomSheetRef methods:', {
          hasExpand: typeof filterBottomSheetRef.current.expand === 'function',
          hasClose: typeof filterBottomSheetRef.current.close === 'function',
          hasSnapToIndex: typeof filterBottomSheetRef.current.snapToIndex === 'function',
        });
      }
    }
  };

  const handleFilterClose = () => {
    closeFilterModal();
    if (filterBottomSheetRef.current && typeof filterBottomSheetRef.current.close === 'function') {
      filterBottomSheetRef.current.close();
    }
  };

  const handleApplyFilters = (filters) => {
    if (__DEV__) {
      console.log('Applying filters:', filters);
    }
    updateSelectedFilters(filters);
    // Do NOT close filter drawer - it should remain open
  };

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
  
  // Get filtered matches for bottom drawer - filter by CURRENT search bounds
  // List shows matches in the current search viewport
  // Matches from multiple searches are merged, then filtered by latest search bounds
  const displayFilteredMatches = useMemo(() => {
    const final = finalFilteredMatches || [];
    
    // Filter by original search bounds if available
    if (originalSearchBounds) {
      // Add a small exclusion buffer (5% shrink) to exclude matches right at the edge
      // This makes the filtering stricter and prevents edge cases
      const bufferPercent = 0.05; // 5% buffer
      const latSpan = originalSearchBounds.northeast.lat - originalSearchBounds.southwest.lat;
      const lngSpan = originalSearchBounds.northeast.lng - originalSearchBounds.southwest.lng;
      const latBuffer = latSpan * bufferPercent;
      const lngBuffer = lngSpan * bufferPercent;
      
      const strictBounds = {
        northeast: {
          lat: originalSearchBounds.northeast.lat - latBuffer,
          lng: originalSearchBounds.northeast.lng - lngBuffer
        },
        southwest: {
          lat: originalSearchBounds.southwest.lat + latBuffer,
          lng: originalSearchBounds.southwest.lng + lngBuffer
        }
      };
      
      const filteredByOriginalBounds = final.filter(match => {
        const venue = match.fixture?.venue;
        const coordinates = venue?.coordinates;
        
        // Validate coordinates
        if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
          return false;
        }
        
        const [lon, lat] = coordinates; // Backend returns [lng, lat]
        if (typeof lon !== 'number' || typeof lat !== 'number' ||
            lon < -180 || lon > 180 || lat < -90 || lat > 90) {
          return false;
        }
        
        // Filter by CURRENT search bounds with 5% exclusion buffer
        const inBounds = lat >= strictBounds.southwest.lat && 
                         lat <= strictBounds.northeast.lat &&
                         lon >= strictBounds.southwest.lng && 
                         lon <= strictBounds.northeast.lng;
        
        // Debug logging for first few matches
        if (__DEV__ && final.indexOf(match) < 3) {
          console.log('🔍 [FILTER DEBUG] Match bounds check:', {
            matchName: `${match.teams?.home?.name} vs ${match.teams?.away?.name}`,
            coordinates: { lon, lat },
            strictBounds,
            originalSearchBounds,
            inBounds
          });
        }
        
        return inBounds;
      });
      
      if (__DEV__) {
        console.log('📋 [LIST] Filtered by original bounds:', {
          total: final.length,
          inOriginalViewport: filteredByOriginalBounds.length,
          filteredOut: final.length - filteredByOriginalBounds.length,
          bounds: originalSearchBounds,
          strictBounds: strictBounds, // Add strict bounds for debugging
          sampleMatch: final[0] ? {
            name: `${final[0].teams?.home?.name} vs ${final[0].teams?.away?.name}`,
            venue: final[0].fixture?.venue?.name,
            coords: final[0].fixture?.venue?.coordinates,
            parsed: final[0].fixture?.venue?.coordinates ? {
              lon: final[0].fixture.venue.coordinates[0],
              lat: final[0].fixture.venue.coordinates[1]
            } : null,
            // Add bounds check result
            inBounds: final[0].fixture?.venue?.coordinates ? 
              (final[0].fixture.venue.coordinates[1] >= strictBounds.southwest.lat &&
               final[0].fixture.venue.coordinates[1] <= strictBounds.northeast.lat &&
               final[0].fixture.venue.coordinates[0] >= strictBounds.southwest.lng &&
               final[0].fixture.venue.coordinates[0] <= strictBounds.northeast.lng) : false
          } : 'none'
        });
      }
      
      return filteredByOriginalBounds;
    }
    
    // If no original bounds yet, return all (initial state)
    return final;
  }, [finalFilteredMatches, originalSearchBounds]);

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

  // Get matches for map markers - show same matches as list view (original search bounds only)
  // Map and list are now consistent: both show only matches from original search viewport
  // User must click "Search this area" to see matches in a different region
  // This matches Google Maps behavior: search "London" shows only London results, even if you zoom out
  const mapMarkersMatches = useMemo(() => {
    // Use displayFilteredMatches which is already filtered by originalSearchBounds
    // This ensures markers only show matches from the searched viewport
    const allMarkers = displayFilteredMatches || [];
    
    // Filter out matches without valid coordinates (for map display)
    // Also filter out null/undefined matches to prevent crashes
    const validMarkers = allMarkers
      .filter(match => {
        // Ensure match exists and has required structure
        if (!match || !match.fixture || !match.fixture.venue) {
          return false;
        }
        
        const venue = match.fixture.venue;
        const coordinates = venue?.coordinates;
        
        // Validate coordinates exist and are valid
        if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
          return false;
        }
        
        const [lon, lat] = coordinates;
        if (typeof lon !== 'number' || typeof lat !== 'number' ||
            isNaN(lon) || isNaN(lat) ||
            lon < -180 || lon > 180 || lat < -90 || lat > 90) {
          return false;
        }
        
        // Matches are already filtered by originalSearchBounds in displayFilteredMatches
        // So we just need to validate coordinates here
        return true;
      });
    
    if (__DEV__) {
      console.log('🗺️ [MAP MARKERS] Displaying markers:', {
        total: allMarkers.length,
        withValidCoords: validMarkers.length,
        note: 'Showing only matches from original search viewport',
        originalSearchBounds: originalSearchBounds ? {
          ne: { lat: originalSearchBounds.northeast.lat.toFixed(4), lng: originalSearchBounds.northeast.lng.toFixed(4) },
          sw: { lat: originalSearchBounds.southwest.lat.toFixed(4), lng: originalSearchBounds.southwest.lng.toFixed(4) }
        } : null
      });
    }
    
    // Ensure we always return an array, never null/undefined
    return validMarkers || [];
  }, [displayFilteredMatches, originalSearchBounds]);

  // Group matches by venue (coordinates preferred for physical location matching)
  // Only includes matches that are visible on the map (mapMarkersMatches)
  // This ensures navigation is restricted to matches that have markers on the map
  const venueGroups = useMemo(() => {
    if (!mapMarkersMatches || mapMarkersMatches.length === 0) return [];
    const groupsMap = new Map();
    mapMarkersMatches.forEach((m) => {
      const venue = m?.fixture?.venue || {};
      let key = null;
      // Prioritize coordinates for physical location matching (handles shared stadiums with different venue IDs)
      // Round coordinates to 6 decimal places (~0.1m precision) to handle floating point differences
      if (venue.coordinates && venue.coordinates.length === 2) {
        const [lon, lat] = venue.coordinates;
        const roundedLon = Math.round(lon * 1000000) / 1000000;
        const roundedLat = Math.round(lat * 1000000) / 1000000;
        key = `geo:${roundedLon},${roundedLat}`;
      } else if (venue.id != null) {
        // Fallback to venue ID if no coordinates available
        key = `id:${venue.id}`;
      }
      if (!key) return;
      if (!groupsMap.has(key)) {
        groupsMap.set(key, { key, venue, matches: [] });
      }
      groupsMap.get(key).matches.push(m);
    });
    const groups = Array.from(groupsMap.values());
    // Sort matches within each group chronologically
    groups.forEach(g => g.matches.sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date)));
    // Sort groups by earliest match date
    groups.sort((a, b) => new Date(a.matches[0].fixture.date) - new Date(b.matches[0].fixture.date));
    return groups;
  }, [mapMarkersMatches]);

  // Clamp or reset selected index if filtered results change
  useEffect(() => {
    if (selectedVenueIndex === null) return;
    const count = venueGroups?.length || 0;
    if (count === 0) {
      setSelectedVenueIndex(null);
      if (bottomSheetRef.current && typeof bottomSheetRef.current.snapToIndex === 'function') {
        bottomSheetRef.current.snapToIndex(0);
      }
      return;
    }
    if (selectedVenueIndex >= count) {
      const newIndex = Math.max(0, count - 1);
      setSelectedVenueIndex(newIndex);
    }
  }, [venueGroups, selectedVenueIndex]);

  const getActiveFilterCount = () => {
    return (selectedFilters.countries?.length || 0) + 
           (selectedFilters.leagues?.length || 0) + 
           (selectedFilters.teams?.length || 0);
  };

  // Get filter labels with metadata for chips
  // Shows chips from selectedFilters, using filterData for names when available,
  // or falling back to preSelectedFilters names if filterData isn't ready yet
  const getFilterLabels = useMemo(() => {
    const labels = [];
    
    if (!selectedFilters) return labels;
    
    // Country filters (always need filterData for countries)
    if (filterData) {
      selectedFilters.countries?.forEach(countryId => {
        const country = filterData.countries?.find(c => c.id === countryId);
        if (country) {
          labels.push({ 
            id: `country-${countryId}`, 
            label: country.name, 
            type: 'country', 
            value: countryId 
          });
        }
      });
    }
    
    // League filters - use filterData if available, otherwise fall back to preSelectedFilters
    selectedFilters.leagues?.forEach(leagueId => {
      let league = null;
      let label = null;
      
      // Try to find in filterData first
      if (filterData?.leagues) {
        league = filterData.leagues.find(l => l.id === leagueId);
        if (league) {
          label = league.name;
        }
      }
      
      // If not found in filterData, try to get name from preSelectedFilters
      if (!label && preSelectedFilters?.leagues) {
        const preSelectedLeague = preSelectedFilters.leagues.find(l => {
          const id = typeof l === 'object' ? l.id : l;
          return String(id) === String(leagueId);
        });
        if (preSelectedLeague) {
          label = typeof preSelectedLeague === 'object' ? preSelectedLeague.name : 'League';
        }
      }
      
      if (label) {
        labels.push({ 
          id: `league-${leagueId}`, 
          label: label, 
          type: 'league', 
          value: leagueId 
        });
      }
    });
    
    // Team filters - use filterData if available, otherwise fall back to preSelectedFilters
    selectedFilters.teams?.forEach(teamId => {
      let team = null;
      let label = null;
      
      // Try to find in filterData first
      if (filterData?.teams) {
        team = filterData.teams.find(t => t.id === teamId);
        if (team) {
          label = team.name;
        }
      }
      
      // If not found in filterData, try to get name from preSelectedFilters
      if (!label && preSelectedFilters?.teams) {
        const preSelectedTeam = preSelectedFilters.teams.find(t => {
          const id = typeof t === 'object' ? t.id : t;
          return String(id) === String(teamId);
        });
        if (preSelectedTeam) {
          label = typeof preSelectedTeam === 'object' ? preSelectedTeam.name : 'Team';
        }
      }
      
      if (label) {
        labels.push({ 
          id: `team-${teamId}`, 
          label: label, 
          type: 'team', 
          value: teamId 
        });
      }
    });
    
    return labels;
  }, [filterData, selectedFilters, preSelectedFilters]);

  // Perform search with current filters (used when filters are removed)
  const performSearchWithFilters = useCallback(async (filtersToUse) => {
    if (!dateFrom || !dateTo) {
      if (__DEV__) {
        console.log('❌ [FILTER SEARCH] Missing dates:', { dateFrom, dateTo });
      }
      return;
    }

    // Get current map region
    let currentRegion = mapRegion || debouncedMapRegion || initialRegion;
    if (!currentRegion) {
      if (__DEV__) {
        console.log('❌ [FILTER SEARCH] No region available');
      }
      return;
    }

    // Extract league and team IDs from filters
    const leagueIds = (filtersToUse?.leagues || []).map(id => String(id));
    const teamIds = (filtersToUse?.teams || []).map(id => String(id));
    const hasWhoFilters = leagueIds.length > 0 || teamIds.length > 0;

    // Calculate bounds from current region
    const bounds = {
      northeast: {
        lat: currentRegion.latitude + (currentRegion.latitudeDelta / 2),
        lng: currentRegion.longitude + (currentRegion.longitudeDelta / 2),
      },
      southwest: {
        lat: currentRegion.latitude - (currentRegion.latitudeDelta / 2),
        lng: currentRegion.longitude - (currentRegion.longitudeDelta / 2),
      },
    };

    setIsSearching(true);
    const requestId = currentRequestId + 1;
    setCurrentRequestId(requestId);
    currentRequestIdRef.current = requestId;

    try {
      let response;
      
      // FIXED: Only use searchAggregatedMatches if filters are actually selected
      // If filters were removed, use searchMatchesByBounds which searches all relevant leagues
      if (hasWhoFilters) {
        // Use searchAggregatedMatches when Who filters are present
        const apiParams = {
          competitions: leagueIds,
          teams: teamIds,
          dateFrom,
          dateTo,
          bounds: bounds,
        };

        if (__DEV__) {
          console.log('🔍 [FILTER SEARCH] Using searchAggregatedMatches:', apiParams);
        }

        response = await ApiService.searchAggregatedMatches(apiParams);
      } else {
        // Use searchMatchesByBounds for location-based search
        if (__DEV__) {
          console.log('🔍 [FILTER SEARCH] Using searchMatchesByBounds:', {
            bounds,
            dateFrom,
            dateTo,
            competitions: [],
            teams: []
          });
        }

        response = await ApiService.searchMatchesByBounds({
          bounds,
          dateFrom,
          dateTo,
          competitions: [],
          teams: [],
        });
      }

      // Check if request is stale
      const latestRequestId = currentRequestIdRef.current;
      if (requestId < latestRequestId) {
        if (__DEV__) {
          console.log('⏭️ [FILTER SEARCH] REJECTED - Stale request:', { requestId, latestRequestId });
        }
        return;
      }

      if (response.success) {
        const newMatches = Array.isArray(response.data) ? response.data : [];
        
        // FIXED: When filters are removed and we're doing a location-based search,
        // merge matches instead of replacing to preserve existing matches
        if (hasWhoFilters) {
          // Filters are active - replace matches (filtered search)
          setMatches(newMatches);
        } else {
          // No filters - merge matches to preserve existing results
          updateMatchesEfficiently(newMatches);
        }
        setLastSuccessfulRequestId(requestId);
        setOriginalSearchBounds(response.bounds || bounds);
        
        if (__DEV__) {
          console.log('✅ [FILTER SEARCH] Search complete:', {
            matchCount: newMatches.length,
            filters: { leagues: leagueIds, teams: teamIds }
          });
        }
      }
    } catch (error) {
      console.error('Error in filter search:', error);
      Alert.alert('Error', 'Failed to search matches. Please try again.');
    } finally {
      setIsSearching(false);
    }
  }, [dateFrom, dateTo, mapRegion, debouncedMapRegion, initialRegion, hasWho, currentRequestId]);

  // Handler to remove a filter (with cascading logic) - client-side only, no automatic search
  const handleRemoveFilter = useCallback((type, value) => {
    const newFilters = { ...selectedFilters };
    
    if (type === 'country') {
      // Remove country
      newFilters.countries = newFilters.countries.filter(id => id !== value);
      
      // Also remove related leagues
      const countryLeagues = filterData.leagues
        .filter(l => l.countryId === value)
        .map(l => l.id);
      newFilters.leagues = newFilters.leagues.filter(id => !countryLeagues.includes(id));
      
      // Also remove related teams
      const countryTeams = filterData.teams
        .filter(t => {
          const teamLeague = filterData.leagues.find(l => l.id === t.leagueId);
          return teamLeague?.countryId === value;
        })
        .map(t => t.id);
      newFilters.teams = newFilters.teams.filter(id => !countryTeams.includes(id));
    } else if (type === 'league') {
      // Remove league
      newFilters.leagues = newFilters.leagues.filter(id => id !== value);
      
      // Also remove related teams
      const leagueTeams = filterData.teams
        .filter(t => t.leagueId === value)
        .map(t => t.id);
      newFilters.teams = newFilters.teams.filter(id => !leagueTeams.includes(id));
    } else if (type === 'team') {
      // Remove team only
      newFilters.teams = newFilters.teams.filter(id => id !== value);
    }
    
    updateSelectedFilters(newFilters);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // No automatic search - filters only affect client-side filtering
    // User must explicitly tap "Search this area" to fetch new data
  }, [selectedFilters, filterData, updateSelectedFilters]);

  // Animated height for filter chips container
  const filterChipsHeight = useRef(new Animated.Value(0)).current;
  const filterChipsContentRef = useRef(null);
  const [filterChipsMeasuredHeight, setFilterChipsMeasuredHeight] = useState(null); // null until measured
  const hasMeasuredRef = useRef(false);

  // Measure filter chips content height when filters change
  const onFilterChipsContentLayout = useCallback((event) => {
    const { height } = event.nativeEvent.layout;
    if (height > 0 && getFilterLabels.length > 0) {
      const measuredHeight = height + (spacing.sm * 2); // Add padding to measured height
      setFilterChipsMeasuredHeight(measuredHeight);
      hasMeasuredRef.current = true;
      // Update height with measured value
      filterChipsHeight.setValue(measuredHeight);
    }
  }, [getFilterLabels.length, filterChipsHeight]);

  // Animate filter chips container when filters change
  useEffect(() => {
    const hasFilters = getFilterLabels.length > 0;
    
    if (hasFilters) {
      // Use measured height or fallback to a reasonable default (60px minimum)
      const targetHeight = filterChipsMeasuredHeight || 60;
      // If we haven't measured yet, set immediately to default so container is visible for measurement
      if (!hasMeasuredRef.current) {
        filterChipsHeight.setValue(targetHeight);
      } else {
        // We have a measurement, animate smoothly
        Animated.timing(filterChipsHeight, {
          toValue: targetHeight,
          duration: 250,
          useNativeDriver: false, // height animation doesn't support native driver
        }).start();
      }
    } else {
      // Reset measurement flag when filters are cleared
      hasMeasuredRef.current = false;
      setFilterChipsMeasuredHeight(null);
      // Animate to 0
      Animated.timing(filterChipsHeight, {
        toValue: 0,
        duration: 250,
        useNativeDriver: false,
      }).start();
    }
  }, [getFilterLabels.length, filterChipsMeasuredHeight, filterChipsHeight]);

  // Animated search button position based on filter chips height
  const searchButtonTopAnimated = useRef(new Animated.Value(160)).current;
  
  // Calculate dynamic search button position based on filter chips visibility
  useEffect(() => {
    const headerHeight = 120; // Approximate header height (60 paddingTop + 16 paddingBottom + content)
    const filterChipsHeightValue = getFilterLabels.length > 0 ? filterChipsMeasuredHeight || 50 : 0;
    const buttonSpacing = spacing.lg; // 24px spacing for better visual separation
    const targetTop = headerHeight + filterChipsHeightValue + buttonSpacing;
    
    Animated.timing(searchButtonTopAnimated, {
      toValue: targetTop,
      duration: 250,
      useNativeDriver: false, // position animation doesn't support native driver
    }).start();
  }, [getFilterLabels.length, filterChipsMeasuredHeight, searchButtonTopAnimated]);

  // Render search summary
  const renderSearchSummary = () => (
    <TouchableOpacity 
      style={styles.searchSummary}
      onPress={handleSearchModalOpen}
      activeOpacity={0.7}
    >
      <View style={styles.searchSummaryContent}>
        <Text style={styles.searchLocation}>
          📍 {location?.city}, {location?.country}
        </Text>
        <Text style={styles.searchDates}>
          📅 {formatDisplayDate(dateFrom)} - {formatDisplayDate(dateTo)}
        </Text>
      </View>
      <Text style={styles.editIcon}>✏️</Text>
    </TouchableOpacity>
  );

  // Group matches by date for better organization
  const groupMatchesByDate = (matches) => {
    if (!matches || matches.length === 0) return {};
    
    const grouped = matches.reduce((acc, match) => {
      const matchDate = new Date(match.fixture?.date);
      const dateKey = matchDate.toDateString();
      
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(match);
      return acc;
    }, {});
    
    // Sort dates and sort matches within each date
    const sortedGrouped = {};
    Object.keys(grouped)
      .sort((a, b) => {
        const dateA = new Date(a);
        const dateB = new Date(b);
        return dateA.getTime() - dateB.getTime();
      })
      .forEach(dateKey => {
        sortedGrouped[dateKey] = grouped[dateKey].sort((a, b) => 
          new Date(a.fixture?.date) - new Date(b.fixture?.date)
        );
      });
    
    return sortedGrouped;
  };

  // Handle date header selection
  const handleDateHeaderPress = useCallback((dateHeader) => {
    if (selectedDateHeader && selectedDateHeader.toDateString() === dateHeader.toDateString()) {
      // Deselect if same header is pressed
      setSelectedDateHeader(null);
    } else {
      // Select new header
      setSelectedDateHeader(dateHeader);
    }
    
    // Provide haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [selectedDateHeader]);

  // Format date for display
  const formatDateHeader = (date) => {
    if (!date) return 'Unknown Date';
    const d = typeof date === 'string' ? new Date(date) : date;
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const matchDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    
    if (matchDate.getTime() === today.getTime()) {
      return 'Today';
    } else if (matchDate.getTime() === tomorrow.getTime()) {
      return 'Tomorrow';
    } else {
      return d.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      });
    }
  };

  // Create flat list data with date headers and matches
  const createFlatListData = useCallback(() => {
    if (!displayFilteredMatches || displayFilteredMatches.length === 0) {
      return [];
    }

    const grouped = groupMatchesByDate(displayFilteredMatches);
    const data = [];

    Object.entries(grouped).forEach(([dateKey, matches]) => {
      const headerDate = new Date(dateKey);
      data.push({ type: 'header', dateHeader: headerDate, matches });
      matches.forEach(match => {
        data.push({ type: 'match', ...match });
      });
    });

    return data;
  }, [displayFilteredMatches]);

  // Render items (headers and matches) - memoized for performance
  const renderItem = useCallback(({ item }) => {
    if (item.type === 'header') {
      const isSelected = selectedDateHeader && selectedDateHeader.toDateString() === item.dateHeader.toDateString();
      
      return (
        <TouchableWithoutFeedback 
          onPress={() => handleDateHeaderPress(item.dateHeader)}
          delayPressIn={0}
          delayLongPress={0}
        >
          <View 
            style={[
              styles.dateHeader,
              isSelected && styles.dateHeaderSelected
            ]}
          >
            <Text style={[
              styles.dateHeaderText,
              isSelected && styles.dateHeaderTextSelected
            ]}>
              {formatDateHeader(item.dateHeader)}
            </Text>
            {isSelected && (
              <Text style={styles.dateHeaderCheckmark}>✓</Text>
            )}
          </View>
        </TouchableWithoutFeedback>
      );
    } else {
      // Debug: Check if this match has league data like popular matches do
      const matchWithLeague = {
        ...item,
        league: item.league || item.competition || { name: 'Unknown League' }
      };

      // If we have competition data with emblem, merge it into league
      if (item.competition?.emblem && matchWithLeague.league) {
        matchWithLeague.league = {
          ...matchWithLeague.league,
          emblem: item.competition.emblem
        };
      }

      // Debug: Show league data info
      if (!item.league && !item.competition) {
        if (__DEV__) {
          console.log('⚠️ Match missing league data:', {
            id: item.id,
            hasLeague: !!item.league,
            hasCompetition: !!item.competition,
            competitionName: item.competition?.name,
            leagueName: item.league?.name
          });
        }
      }


      
      return (
        <MatchCard
          match={matchWithLeague}
          onPress={() => handleMatchPress(item)}
          variant="default"
          showHeart={true}
        />
      );
    }
  }, [selectedDateHeader, handleDateHeaderPress, handleMatchPress]);

  // Render bottom sheet content (FlatList as direct child of sheet)
  const renderBottomSheetContent = () => {
    const flatListData = createFlatListData();
    
    // Calculate responsive bottom padding based on content length
    const bottomPadding = Math.max(20, Math.min(100, 120 - (displayFilteredMatches?.length || 0) * 3));
    
    return (
      <BottomSheetFlatList
        data={flatListData}
        renderItem={renderItem}
        keyExtractor={(item, index) => {
          if (item.type === 'header') {
            const key = item.dateHeader instanceof Date ? item.dateHeader.toISOString() : `${item.dateHeader}`;
            return `header-${key}`;
          }
          const matchId = item?.fixture?.id || item?.id;
          return `match-${matchId ?? index}`.toString();
        }}
        extraData={displayFilteredMatches}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.bottomSheetContent,
          { paddingBottom: bottomPadding + (insets?.bottom || 0) + 8 }
        ]}
        removeClippedSubviews={false}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={10}
        scrollEnabled={true}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={true}
        overScrollMode="never"
        bounces={false}
        alwaysBounceVertical={false}
        scrollEventThrottle={16}
        directionalLockEnabled={true}
        showsHorizontalScrollIndicator={false}
        updateCellsBatchingPeriod={50}
        disableVirtualization={false}
      />
    );
  };

  // Ref to store the performance timer stop function for end-to-end tracking
  const searchTimerRef = useRef(null);

  // Track when search completes and matches are rendered
  useEffect(() => {
    // When search completes (isSearching goes from true to false) and we have matches
    if (!isSearching && searchTimerRef.current && matches.length > 0) {
      // Start rendering phase
      const stopRenderingPhase = searchTimerRef.current.startPhase ? searchTimerRef.current.startPhase('RENDERING') : null;
      
      // Use requestAnimationFrame to ensure rendering is complete (map + list)
      requestAnimationFrame(() => {
        // Use another frame to ensure both map and list have rendered
        requestAnimationFrame(() => {
          if (searchTimerRef.current) {
            // Stop rendering phase
            if (stopRenderingPhase) {
              stopRenderingPhase({ matchCount: matches.length });
            }
            
            // Stop state update phase if it was started
            // (State updates happen synchronously, so we stop it here)
            
            // Stop the main timer
            const duration = searchTimerRef.current.stop(true);
            searchTimerRef.current = null;
            if (__DEV__) {
              console.log(`⏱️ [PERF] End-to-end search complete: ${duration.toFixed(2)}ms (button press → rendered)`);
            }
          }
        });
      });
    }
  }, [isSearching, matches.length]);

  // Track initial search end-to-end performance (from LocationSearchModal)
  useEffect(() => {
    if (_performanceStartTime && initialMatches && initialMatches.length > 0 && !initialSearchTimerRef.current) {
      const startTime = _performanceStartTime;
      initialSearchTimerRef.current = true; // Mark as tracking
      
      // Use requestAnimationFrame to ensure rendering is complete
      requestAnimationFrame(() => {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        // Store the metric using the performance tracker
        const metric = {
          type: performanceTracker.MetricType.SEARCH_INITIAL,
          duration,
          timestamp: new Date().toISOString(),
          success: true,
          metadata: {
            location: searchParams?.location,
            dateRange: { from: searchParams?.dateFrom, to: searchParams?.dateTo },
            matchCount: initialMatches.length,
            startTime,
            endTime,
          },
        };
        
        // Store metric (using internal function - we'll need to export it or use AsyncStorage directly)
        import('@react-native-async-storage/async-storage').then(({ default: AsyncStorage }) => {
          AsyncStorage.getItem('@performance_metrics').then(existing => {
            const metrics = existing ? JSON.parse(existing) : [];
            metrics.push(metric);
            // Keep only last 100
            if (metrics.length > 100) {
              metrics.splice(0, metrics.length - 100);
            }
            AsyncStorage.setItem('@performance_metrics', JSON.stringify(metrics));
          });
        });
        
        if (__DEV__) {
          console.log(`⏱️ [PERF] End-to-end initial search complete: ${duration.toFixed(2)}ms (button press → rendered)`);
        }
      });
    }
  }, [_performanceStartTime, initialMatches, searchParams]);

  // Manual search function
  // FIXED: Always allow search even if region hasn't changed - user should be able to re-search
  const handleSearchThisArea = async () => {
    if (__DEV__) {
      console.log('🔘 [SEARCH THIS AREA] Button clicked');
    }
    
    if (!dateFrom || !dateTo) {
      if (__DEV__) {
        console.log('❌ [SEARCH THIS AREA] Missing dates:', { dateFrom, dateTo });
      }
      Alert.alert('Error', 'Please select your travel dates');
      return;
    }
    
    // Get the current map region - prefer mapRegion (most current), then debouncedMapRegion, then initialRegion
    let currentRegion = mapRegion || debouncedMapRegion || initialRegion;
    
    if (__DEV__) {
      console.log('🔍 [SEARCH THIS AREA] Region state:', {
        hasMapRegion: !!mapRegion,
        hasDebouncedMapRegion: !!debouncedMapRegion,
        hasInitialRegion: !!initialRegion,
        source: mapRegion ? 'mapRegion (current)' : debouncedMapRegion ? 'debouncedMapRegion' : 'initialRegion',
        currentRegion: currentRegion ? {
          center: { lat: currentRegion.latitude.toFixed(4), lng: currentRegion.longitude.toFixed(4) },
          delta: { lat: currentRegion.latitudeDelta.toFixed(4), lng: currentRegion.longitudeDelta.toFixed(4) }
        } : null,
        isSearching,
        currentRequestId,
        lastSuccessfulRequestId,
        hasFilters: !!(selectedFilters.leagues.length > 0 || selectedFilters.teams.length > 0)
      });
    }
    
    if (!currentRegion) {
      if (__DEV__) {
        console.log('❌ [SEARCH THIS AREA] No region available');
      }
      Alert.alert('Error', 'Unable to determine current map location. Please try again.');
      return;
    }
    
    // Check if we have Who-based filters (leagues/teams) - if so, use searchAggregatedMatches
    const leagueIds = (selectedFilters?.leagues || []).map(id => String(id));
    const teamIds = (selectedFilters?.teams || []).map(id => String(id));
    const hasWhoFilters = leagueIds.length > 0 || teamIds.length > 0;
    
    // FIXED: Only use performSearchWithFilters if filters are actually selected
    // If filters were removed, use performBoundsSearch which will search all relevant leagues
    // and merge results with existing matches
    if (hasWhoFilters) {
      // Use performSearchWithFilters which handles Who-based searches
      await performSearchWithFilters(selectedFilters);
    } else {
      // Use traditional bounds-based search
      const requestId = currentRequestId + 1;
      if (__DEV__) {
        console.log('🚀 [SEARCH THIS AREA] Starting bounds search:', {
          requestId,
          previousRequestId: currentRequestId,
          region: {
            center: { lat: currentRegion.latitude.toFixed(4), lng: currentRegion.longitude.toFixed(4) },
            delta: { lat: currentRegion.latitudeDelta.toFixed(4), lng: currentRegion.longitudeDelta.toFixed(4) }
          }
        });
      }
      
      // Start end-to-end performance timer with phase tracking (from button press to rendered)
      const timer = performanceTracker.startTimerWithPhases(
        performanceTracker.MetricType.SEARCH_THIS_AREA,
        {
          bounds: {
            center: { lat: currentRegion.latitude, lng: currentRegion.longitude },
            delta: { lat: currentRegion.latitudeDelta, lng: currentRegion.longitudeDelta }
          },
          dateRange: { from: dateFrom, to: dateTo },
          requestId
        }
      );
      searchTimerRef.current = timer;
      
      setCurrentRequestId(requestId);
      currentRequestIdRef.current = requestId; // Update ref for synchronous access
      setIsSearching(true);
      await performBoundsSearch(currentRegion, requestId, timer);
    }
  };

  // Calculate initial region based on searched location
  const getInitialRegion = () => {
    if (initialRegion) {
      return initialRegion;
    } else if (location && location.lat && location.lon) {
      return {
        latitude: location.lat,
        longitude: location.lon,
        latitudeDelta: 0.5,
        longitudeDelta: 0.5,
      };
    } else if (hasWho && matches.length > 0) {
      // For Who-based searches without location, try to calculate from matches
      const coordinates = [];
      matches.forEach((match) => {
        const venue = match?.fixture?.venue;
        if (venue?.coordinates && Array.isArray(venue.coordinates) && venue.coordinates.length === 2) {
          const [lon, lat] = venue.coordinates;
          if (typeof lat === 'number' && typeof lon === 'number' &&
              lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
            coordinates.push({ lat, lng: lon });
          }
        }
      });
      
      if (coordinates.length > 0) {
        const lats = coordinates.map(coord => coord.lat);
        const lngs = coordinates.map(coord => coord.lng);
        
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        
        const centerLat = (minLat + maxLat) / 2;
        const centerLng = (minLng + maxLng) / 2;
        
        const latSpan = maxLat - minLat;
        const lngSpan = maxLng - minLng;
        
        // Clamp deltas to valid ranges to prevent MapKit crashes
        const MAX_LAT_DELTA = 50.0;
        const MAX_LNG_DELTA = 50.0;
        const MIN_DELTA = 0.1;
        const PADDING_MULTIPLIER = 2.5;
        
        let latitudeDelta = Math.max(MIN_DELTA, latSpan * PADDING_MULTIPLIER);
        let longitudeDelta = Math.max(MIN_DELTA, lngSpan * PADDING_MULTIPLIER);
        
        // Clamp to maximum values
        latitudeDelta = Math.min(latitudeDelta, MAX_LAT_DELTA);
        longitudeDelta = Math.min(longitudeDelta, MAX_LNG_DELTA);
        
        // Validate before returning
        if (!isNaN(centerLat) && !isNaN(centerLng) && 
            centerLat >= -90 && centerLat <= 90 && 
            centerLng >= -180 && centerLng <= 180 &&
            !isNaN(latitudeDelta) && !isNaN(longitudeDelta) &&
            latitudeDelta > 0 && longitudeDelta > 0 &&
            latitudeDelta <= MAX_LAT_DELTA && longitudeDelta <= MAX_LNG_DELTA) {
          return {
            latitude: centerLat,
            longitude: centerLng,
            latitudeDelta,
            longitudeDelta,
          };
        }
      }
    }
    
    // Fallback to London default only if we have no other option
    return {
      latitude: 51.5074, // London default
      longitude: -0.1278,
      latitudeDelta: 0.5,
      longitudeDelta: 0.5,
    };
  };

  return (
    <View style={styles.container}>
      {/* Header Navigation */}
      <View style={styles.headerNav}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        
        <View 
          style={styles.headerCenter}
        >
          <Text style={styles.headerTitle}>
            Matches in {location?.city}
          </Text>
          <Text style={styles.headerSubtitle}>
            {formatDisplayDate(dateFrom)} - {formatDisplayDate(dateTo)}
          </Text>
          {selectedDateHeader && (
            <View style={styles.dateFilterIndicator}>
              <Text style={styles.dateFilterText}>
                📅 Filtered to {formatDateHeader(selectedDateHeader)}
              </Text>
              <TouchableOpacity 
                style={styles.clearDateFilterButton}
                onPress={() => {
                  setSelectedDateHeader(null);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Text style={styles.clearDateFilterText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        
        <View style={styles.headerRight}>
          <FilterIcon
            onPress={handleFilterOpen}
            filterCount={getActiveFilterCount()}
          />

        </View>
      </View>

      {/* Filter Chips Section - Animated */}
      {getFilterLabels.length > 0 && (
        <Animated.View 
          style={[
            styles.filterChipsContainer,
            {
              height: filterChipsHeight,
              overflow: 'hidden',
            }
          ]}
        >
          <View
            ref={filterChipsContentRef}
            onLayout={onFilterChipsContentLayout}
            style={{ minHeight: 60 }} // Ensure minimum height for measurement
          >
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChipsContent}
            >
              {getFilterLabels.map(filter => (
                <FilterChip
                  key={filter.id}
                  label={filter.label}
                  onRemove={() => handleRemoveFilter(filter.type, filter.value)}
                  type={filter.type}
                />
              ))}
            </ScrollView>
          </View>
        </Animated.View>
      )}

      {/* Map Layer */}
      <MatchMapView
        ref={mapRef}
        matches={mapMarkersMatches}
        initialRegion={mapRegion || getInitialRegion()}

        onRegionChange={handleMapRegionChange}
        onMarkerPress={handleMarkerPress}
        onMapPress={handleMapPress}
        selectedMatchId={
          selectedVenueIndex !== null
            ? venueGroups?.[selectedVenueIndex]?.matches?.[0]?.fixture?.id
            : null
        }
        style={styles.map}
      />
      
      {/* Floating Search Button - Always visible like Google Maps */}
      {/* User can re-search current area or trigger search after panning to new region */}
      {/* Small pans use buffer zone data (no backend call), large pans trigger new search */}
      {/* Dynamic positioning based on filter chips visibility - animated */}
      <Animated.View
        style={[
          styles.floatingSearchButton,
          { top: searchButtonTopAnimated }
        ]}
      >
        <TouchableOpacity
          onPress={handleSearchThisArea}
          disabled={isSearching}
          style={styles.floatingSearchButtonInner}
        >
          {isSearching ? (
            <>
              <ActivityIndicator size="small" color="#000" style={{ marginRight: 8 }} />
              <Text style={styles.floatingSearchText}>Loading more matches...</Text>
            </>
          ) : (
            <>
              <Text style={styles.floatingSearchText}>Search this area</Text>
            </>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Bottom Sheet (hidden while overlay is open) */}
      <BottomSheet
        ref={bottomSheetRef}
        snapPoints={snapPoints}
        onChange={(index) => {
          const states = ['collapsed', 'half', 'full'];
          if (index === -1) {
            setSheetState('closed');
          } else {
            setSheetState(states[index]);
            // Filter drawer can remain open on top - no need to close it
          }
        }}
        enablePanDownToClose={false}
        enableContentPanningGesture={true}
        enableHandlePanningGesture={true}
        keyboardBehavior="interactive"
        bottomInset={bottomInsetValue}
        backgroundStyle={styles.bottomSheetBackground}
        handleComponent={() => (
          <View style={styles.customHandle}>
            <View style={styles.customHandleBar} />
            <View style={styles.customHandleTextContainer}>
              <Text style={styles.customHandleText}>{displayFilteredMatches?.length || 0} results</Text>
              {matchesWithoutCoords > 0 && (
                <Text style={styles.missingCoordsText}>
                  ({matchesWithoutCoords} not shown - missing location)
                </Text>
              )}
            </View>
          </View>
        )}
      >
        {renderBottomSheetContent()}
      </BottomSheet>

      {/* Overlay Match Card (compact) with navigation */}
      {selectedVenueIndex !== null && venueGroups?.[selectedVenueIndex] && (
        <View style={styles.overlayCardContainer}>
          {/* Venue header */}
          <View style={styles.venueHeader}>
            <Text style={styles.venueHeaderTitle}>{venueGroups[selectedVenueIndex]?.venue?.name || 'Venue'}</Text>
            {venueGroups[selectedVenueIndex]?.venue?.city && (
              <Text style={styles.venueHeaderSubtitle}>{venueGroups[selectedVenueIndex]?.venue?.city}</Text>
            )}
          </View>
          {/* Stacked upcoming matches at this venue */}
          <ScrollView style={styles.venueMatchesList} showsVerticalScrollIndicator={false}>
            {venueGroups[selectedVenueIndex].matches.map((m, idx) => (
              <MatchCard
                key={`venue-match-${m.fixture?.id || idx}`}
                match={{
                  ...m,
                  league: (() => {
                    const baseLeague = m.league || m.competition || { name: 'Unknown League' };
                    // If we have competition data with emblem, merge it into league
                    if (m.competition?.emblem && baseLeague) {
                      return {
                        ...baseLeague,
                        emblem: m.competition.emblem
                      };
                    }
                    return baseLeague;
                  })()
                }}
                onPress={() => handleMatchPress(m)}
                variant="overlay"
                showHeart={true}
              />
            ))}
          </ScrollView>
          <View style={styles.overlayControls}>
            <TouchableOpacity
              onPress={handleOverlayPrev}
              disabled={selectedVenueIndex <= 0}
              style={[styles.navButton, selectedVenueIndex <= 0 && styles.navButtonDisabled]}
            >
              <Text style={[styles.navButtonText, selectedVenueIndex <= 0 && styles.navButtonTextDisabled]}>Previous</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleOverlayClose} style={styles.closeOverlayButton}>
              <Text style={styles.closeOverlayText}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleOverlayNext}
              disabled={selectedVenueIndex >= (venueGroups.length - 1)}
              style={[styles.navButton, selectedVenueIndex >= (venueGroups.length - 1) && styles.navButtonDisabled]}
            >
              <Text style={[styles.navButtonText, selectedVenueIndex >= (venueGroups.length - 1) && styles.navButtonTextDisabled]}>Next</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Search Modal */}
      <SearchModal
        visible={searchModalVisible}
        onClose={handleSearchModalClose}
        onSearch={handleSearchUpdate}
        initialLocation={location}
        initialDateFrom={dateFrom}
        initialDateTo={dateTo}
        loading={searchLoading}
      />

      {/* Filter Bottom Sheet */}
      <FilterModal
        ref={filterBottomSheetRef}
        visible={filterModalVisible}
        onClose={handleFilterClose}
        filterData={filterData}
        selectedFilters={selectedFilters}
        onFiltersChange={handleApplyFilters}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerNav: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60, // Increased from 50 to 60 for more top padding
    paddingBottom: 16, // Increased from 12 to 16 for more bottom padding
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 20,
    color: '#000',
    fontWeight: '600',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
    maxWidth: '60%', // Limit the width to prevent overlap
    marginRight: 8, // Add margin to create separation from filter icon
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  headerRight: {
    padding: 8,
    minWidth: 50, // Ensure minimum width for filter icon
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterIcon: {
    fontSize: 18,
  },
  map: {
    flex: 1,
  },
  overlayCardContainer: {
    position: 'absolute',
    bottom: 90,
    left: 16,
    right: 16,
  },
  venueHeader: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#e0e0e0',
  },
  venueHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  venueHeaderSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: '#666',
  },
  venueMatchesList: {
    maxHeight: 260,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingTop: 8,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#e0e0e0',
  },
  overlayControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#e0e0e0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  navButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1976d2',
  },
  navButtonDisabled: {
    backgroundColor: '#f0f0f0',
  },
  navButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  navButtonTextDisabled: {
    color: '#999',
  },
  closeOverlayButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  closeOverlayText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  floatingSearchButton: {
    position: 'absolute',
    // top is now set dynamically via animated value based on filter chips visibility
    left: '50%',
    transform: [{ translateX: -100 }],
    width: 200,
  },
  floatingSearchButtonInner: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    minHeight: 44, // Ensure consistent height for loading state
  },
  floatingSearchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  floatingSearchText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  searchSummary: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  searchSummaryContent: {
    flex: 1,
  },
  editIcon: {
    fontSize: 16,
    color: '#007AFF',
    marginLeft: 8,
  },
  searchLocation: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  searchDates: {
    fontSize: 14,
    color: '#666',
  },
  bottomSheetContent: {
    // Do not force flex here; let content grow naturally
    padding: 16,
  },
  fullContentContainer: {
    flex: 1,
  },
  hiddenContent: {
    opacity: 0,
    pointerEvents: 'none',
  },
  bottomSheetHeader: {
    // Fixed header section
  },
  bottomSheetScrollView: {
    flex: 1,
  },
  bottomSheetBackground: {
    backgroundColor: '#fff',
  },
  customHandle: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 14,
    paddingBottom: 4,
    backgroundColor: '#fff',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  customHandleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    marginBottom: 6,
  },
  customHandleText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  customHandleTextContainer: {
    alignItems: 'center',
  },
  missingCoordsText: {
    fontSize: 10,
    color: '#F59E0B',
    fontWeight: '500',
    marginTop: 2,
  },
  collapsedIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    height: '100%',
  },
  collapsedMatchCount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  loadingText: {
    marginLeft: 8,
    color: '#666',
  },
  resultsHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  subtleHeader: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    minHeight: 28,
  },
  subtleHeaderHidden: {
    opacity: 0,
  },
  subtleHeaderSpacer: {
    height: 12,
  },
  matchListContent: {
    paddingBottom: 12,
  },

  selectedMatchCard: {
    backgroundColor: '#e3f2fd',
    borderColor: '#1976d2',
    borderWidth: 2,
  },
  
  // Detail view styles
  detailContent: {
    flex: 1,
    padding: 16,
  },
  detailHeader: {
    marginBottom: 20,
  },
  backButton: {
    paddingVertical: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#1976d2',
    fontWeight: '500',
  },
  detailCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  detailDateSection: {
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailDate: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  detailTime: {
    fontSize: 16,
    color: '#666',
  },
  detailTeamsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailTeamContainer: {
    flex: 1,
    alignItems: 'center',
  },
  detailTeamLogo: {
    marginBottom: 8,
  },
  detailTeamName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  detailVsContainer: {
    paddingHorizontal: 20,
  },
  detailVsText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
  },
  detailVenueSection: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailVenueTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  detailVenueName: {
    fontSize: 18,
    fontWeight: '500',
    color: '#1976d2',
    marginBottom: 4,
  },
  detailVenueLocation: {
    fontSize: 14,
    color: '#666',
  },
  detailLeagueSection: {
    marginBottom: 20,
  },
  detailLeagueTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  detailLeagueName: {
    fontSize: 16,
    color: '#1976d2',
    fontWeight: '500',
  },
  dateHeader: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginBottom: 8,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: 44, // Ensure minimum touch target size
  },
  dateHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textTransform: 'capitalize',
  },
  dateHeaderSelected: {
    backgroundColor: '#e3f2fd',
    borderColor: '#1976d2',
    borderWidth: 2,
  },
  dateHeaderTextSelected: {
    color: '#1976d2',
  },
  dateHeaderCheckmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    fontSize: 16,
    color: '#1976d2',
    fontWeight: 'bold',
  },
  dateFilterIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#1976d2',
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  dateFilterText: {
    fontSize: 13,
    color: '#1976d2',
    fontWeight: '600',
    marginRight: 8,
  },
  clearDateFilterButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#1976d2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearDateFilterText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: 'bold',
  },
  filterChipsContainer: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  filterChipsContent: {
    paddingRight: spacing.md,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  loadingText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
});

export default MapResultsScreen; 