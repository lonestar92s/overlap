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
import * as Haptics from 'expo-haptics';

import HeartButton from '../components/HeartButton';
import SearchModal from '../components/SearchModal';
import FilterIcon from '../components/FilterIcon';
import MatchCard from '../components/MatchCard';
import MatchMapView from '../components/MapView';

const MapResultsScreen = ({ navigation, route }) => {
  // Get search parameters and results from navigation
  const { searchParams, matches: initialMatches, initialRegion, hasWho, preSelectedFilters } = route.params || {};
  
  // Search state
  const [location, setLocation] = useState(searchParams?.location || null);
  const [dateFrom, setDateFrom] = useState(searchParams?.dateFrom || null);
  const [dateTo, setDateTo] = useState(searchParams?.dateTo || null);
  
  // Map and matches state
  const [matches, setMatches] = useState(initialMatches || []);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [mapRegion, setMapRegion] = useState(initialRegion || null);
  
  // Date header selection state
  const [selectedDateHeader, setSelectedDateHeader] = useState(null);
  
  // Bottom sheet state
  const [sheetState, setSheetState] = useState('collapsed');
  const bottomSheetRef = useRef(null);
  
  // Snap points for bottom sheet
  const snapPoints = useMemo(() => [48, '55%', '85%'], []);
  
  // Overlay card state (Airbnb-like) - selection is by venue group
  const [selectedVenueIndex, setSelectedVenueIndex] = useState(null);
  
  // Search modal state
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  
  // Request cancellation and tracking
  const [currentRequestId, setCurrentRequestId] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [lastSuccessfulRequestId, setLastSuccessfulRequestId] = useState(0);
  
  // Track if user has moved from initial search area
  const [hasMovedFromInitial, setHasMovedFromInitial] = useState(false);
  const [initialSearchRegion, setInitialSearchRegion] = useState(null);
  
  // Track when we're performing a bounds search to prevent auto-fitting
  const [isPerformingBoundsSearch, setIsPerformingBoundsSearch] = useState(false);
  
  // State for smooth transitions between search results
  const [isTransitioningResults, setIsTransitioningResults] = useState(false);

  

  
  // Refs
  const mapRef = useRef();
  const suppressNextMapPressRef = useRef(false);
  
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

  // Process real match data for filters
  useEffect(() => {
    // Only process filter data if we have meaningful matches and they're different from current filter data
    if (matches && matches.length > 0) {
      // Check if the matches are significantly different from what we already have
      const currentMatchIds = matches.map(m => m.id || m.fixture?.id).filter(Boolean).sort();
      const previousMatchIds = filterData?.matchIds || [];
      
      // Only update if match IDs are different (avoid unnecessary updates on map movement)
      if (JSON.stringify(currentMatchIds) !== JSON.stringify(previousMatchIds)) {
        // Extract unique countries, leagues, and teams from matches
        const countriesMap = new Map();
        const leaguesMap = new Map();
        const teamsMap = new Map();

        matches.forEach((match) => {
          // Process country from area.name
          let countryId = null;
          let countryName = null;
          
          if (match.area?.name) {
            countryId = match.area.code || match.area.id?.toString();
            countryName = match.area.name;
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
          console.log('No structured data found, creating fallback data');
          
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
    }
  }, [matches, updateFilterData]);

  // Set initial search region when component mounts
  useEffect(() => {
    if (initialRegion && !initialSearchRegion) {
      setInitialSearchRegion(initialRegion);
    }
  }, [initialRegion, initialSearchRegion]);

  // Apply pre-selected filters from natural language search
  useEffect(() => {
    if (preSelectedFilters && filterData) {
      console.log('🎯 Applying pre-selected filters:', preSelectedFilters);
      
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
          console.log('🏴 Selected country:', countryMatch.name, countryMatch.id);
        }
      }

      // Match leagues
      if (preSelectedFilters.leagues && preSelectedFilters.leagues.length > 0 && filterData.leagues) {
        const leagueMatches = preSelectedFilters.leagues
          .map(leagueName => filterData.leagues.find(l => 
            l.name.toLowerCase() === leagueName.toLowerCase()
          ))
          .filter(Boolean);
        
        if (leagueMatches.length > 0) {
          selectedFilters.leagues = leagueMatches.map(l => l.id);
          console.log('🏆 Selected leagues:', leagueMatches.map(l => l.name), selectedFilters.leagues);
        }
      }

      // Match teams
      if (preSelectedFilters.teams && preSelectedFilters.teams.length > 0 && filterData.teams) {
        const teamMatches = preSelectedFilters.teams
          .map(teamName => filterData.teams.find(t => 
            t.name.toLowerCase() === teamName.toLowerCase()
          ))
          .filter(Boolean);
        
        if (teamMatches.length > 0) {
          selectedFilters.teams = teamMatches.map(t => t.id);
          console.log('⚽ Selected teams:', teamMatches.map(t => t.name), selectedFilters.teams);
        }
      }

      // Apply the filters if we found any matches
      const hasFilters = selectedFilters.countries.length > 0 || 
                        selectedFilters.leagues.length > 0 || 
                        selectedFilters.teams.length > 0;
      
      if (hasFilters) {
        updateSelectedFilters(selectedFilters);
        console.log('✅ Applied pre-selected filters:', selectedFilters);
      } else {
        console.log('⚠️ No matching filters found for pre-selected values');
      }
    }
  }, [preSelectedFilters, filterData, updateSelectedFilters]);

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
  const performBoundsSearch = async (region, requestId) => {
    if (!dateFrom || !dateTo || !region) return;
    
    setIsSearching(true);
    
    try {
      // FIXED: Use actual viewport dimensions instead of fixed size increments
      // The previous approach used fixed sizes (0.1°, 0.2°, etc.) which didn't match the actual zoom
      // Now we use the actual map viewport dimensions that the user sees
      
      // Calculate bounds from the ACTUAL visible viewport
      // latitudeDelta and longitudeDelta represent the actual span of what's visible on screen
      const viewportLatSpan = region.latitudeDelta;
      const viewportLngSpan = region.longitudeDelta;
      
      // Use adaptive search bounds calculation for better match coverage
      const bounds = calculateSearchBounds(region, {
        bufferMultiplier: 1.3, // 30% buffer around viewport
        maxSpan: 10.0,
      });
      
      console.log('🔍 Viewport-only search (RESPONSIVE):', {
        center: { lat: region.latitude, lng: region.longitude },
        viewport: {
          actualLatDelta: region.latitudeDelta,
          actualLngDelta: region.longitudeDelta,
          finalLatSpan: viewportLatSpan,
          finalLngSpan: viewportLngSpan,
          radiusKm: `${(viewportLatSpan * 111 / 2).toFixed(1)}km × ${(viewportLngSpan * 111 / 2).toFixed(1)}km`
        },
        bounds,
        // Show the zoom level and what it means
        zoomInfo: {
          latDelta: region.latitudeDelta,
          lngDelta: region.longitudeDelta,
          zoomCategory: region.latitudeDelta < 0.05 ? 'city block' : 
                       region.latitudeDelta < 0.2 ? 'neighborhood' :
                       region.latitudeDelta < 1.0 ? 'city' : 
                       region.latitudeDelta < 3.0 ? 'region' : 'country'
        },
        // Add geographic coverage info
        geographicCoverage: {
          latCoverageKm: (viewportLatSpan * 111).toFixed(0),
          lngCoverageKm: (viewportLngSpan * 111 * Math.cos(region.latitude * Math.PI / 180)).toFixed(0),
          estimatedArea: `${((viewportLatSpan * 111) * (viewportLngSpan * 111 * Math.cos(region.latitude * Math.PI / 180))).toFixed(0)} km²`
        }
      });

      const response = await ApiService.searchMatchesByBounds({
        bounds,
        dateFrom,
        dateTo,
      });

      // More intelligent response handling: accept responses that are recent enough
      // Only reject if this request is significantly older than the current one
      const isSignificantlyStale = requestId < (currentRequestId - 1);
      
      if (isSignificantlyStale) {
        return;
      }

      if (response.success) {
        // Update the last successful request ID
        setLastSuccessfulRequestId(requestId);
        
        // Update matches efficiently (render markers first)
        updateMatchesEfficiently(response.data);
        
        // Then smoothly center map on new markers (after a small delay to ensure rendering)
        setTimeout(() => {
          centerMapOnMarkers(response.data);
        }, 200); // Small delay to ensure markers are rendered
        
        // No need for complex position preservation - user keeps their view
      } else {
        console.error('❌ API returned error:', response.error);
        Alert.alert('Search Error', response.error || 'Failed to search matches');
      }
    } catch (error) {
      console.error('Search error:', error);
      // Only show error if this is still a recent request
      if (requestId >= (currentRequestId - 1)) {
        Alert.alert('Error', 'Failed to search matches');
      }
    } finally {
      // Only clear searching if this is still a recent request
      if (requestId >= (currentRequestId - 1)) {
        setIsSearching(false);
      }
    }
  };

  // Simplified marker updates
  const updateMatchesEfficiently = (newMatches) => {
    console.log('🔄 Updating matches:', {
      currentCount: matches.length,
      newCount: newMatches.length
    });
    
    // Simply update the matches state
    setMatches(newMatches);
  };

  // Center map on markers without changing zoom level
  const centerMapOnMarkers = (markers) => {
    if (!markers || markers.length === 0) {
      console.log('No markers to center on');
      return; // Don't move map if no results
    }
    
    if (!mapRef.current) {
      console.log('Map ref not available');
      return;
    }
    
    // Filter valid markers with coordinates
    const validMarkers = markers.filter(match => {
      const venue = match.fixture?.venue;
      return venue?.coordinates && venue.coordinates.length === 2;
    });
    
    if (validMarkers.length === 0) {
      console.log('No valid markers with coordinates');
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
    
    console.log('🎯 Centering map on markers:', {
      markerCount: validMarkers.length,
      center: { lat: centerLat, lng: centerLng },
      currentZoom: mapRegion?.latitudeDelta || 0.5
    });
    
    // Move map center to markers, but use more generous zoom level
    const currentZoom = mapRegion?.latitudeDelta || 0.5;
    // Use more generous bounds to ensure all matches are visible
    const generousZoom = Math.max(currentZoom, 0.8); // Minimum 0.8 degree span
    mapRef.current.animateToRegion({
      latitude: centerLat,
      longitude: centerLng,
      latitudeDelta: generousZoom,    // More generous zoom
      longitudeDelta: generousZoom    // More generous zoom
    }, 1000); // 1 second smooth animation
  };


  // Handle map region change (when user pans/zooms)
  const handleMapRegionChange = (region, bounds) => {
    setMapRegion(region);
    
    // Check if user has moved significantly from initial search area
    if (initialSearchRegion) {
      const latDiff = Math.abs(region.latitude - initialSearchRegion.latitude);
      const lngDiff = Math.abs(region.longitude - initialSearchRegion.longitude);
      const hasMoved = latDiff > 0.1 || lngDiff > 0.1; // 0.1 degree threshold
      
      // Check if user has zoomed out significantly (larger delta = more zoomed out)
      const initialLatDelta = initialSearchRegion.latitudeDelta || 0.5;
      const initialLngDelta = initialSearchRegion.longitudeDelta || 0.5;
      const hasZoomedOut = region.latitudeDelta > initialLatDelta * 1.5 || region.longitudeDelta > initialLngDelta * 1.5;
      
      setHasMovedFromInitial(hasMoved || hasZoomedOut);
    }
  };

  // Handle marker press: show overlay, hide bottom sheet, and center map
  const getVenueGroupKey = (match) => {
    const venue = match?.fixture?.venue;
    if (!venue) return null;
    if (venue.id != null) return `id:${venue.id}`;
    if (venue.coordinates && venue.coordinates.length === 2) {
      return `geo:${venue.coordinates[0]},${venue.coordinates[1]}`;
    }
    return null;
  };

  const handleMarkerPress = (match) => {
    // Prevent immediate map-press from closing the overlay
    suppressNextMapPressRef.current = true;
    setTimeout(() => { suppressNextMapPressRef.current = false; }, 250);

    // Map marker selects the venue group containing this match
    const key = getVenueGroupKey(match);
    if (!venueGroups || venueGroups.length === 0 || !key) return;
    const index = venueGroups.findIndex(g => g.key === key);
    const nextIndex = index >= 0 ? index : 0;
    setSelectedVenueIndex(nextIndex);
    if (bottomSheetRef.current && typeof bottomSheetRef.current.close === 'function') {
      bottomSheetRef.current.close();
    }
    const venue = match.fixture?.venue;
    if (venue?.coordinates && venue.coordinates.length === 2 && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: venue.coordinates[1],
        longitude: venue.coordinates[0],
        latitudeDelta: mapRegion?.latitudeDelta || 0.1,
        longitudeDelta: mapRegion?.longitudeDelta || 0.1,
      }, 1000);
    }
  };

  const handleMapPress = () => {
    if (suppressNextMapPressRef.current) {
      suppressNextMapPressRef.current = false;
      return;
    }
    handleOverlayClose();
  };

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

  const handleOverlayClose = () => {
    setSelectedVenueIndex(null);
    if (bottomSheetRef.current && typeof bottomSheetRef.current.snapToIndex === 'function') {
      bottomSheetRef.current.snapToIndex(0);
    }
  };

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
    const date = new Date(dateString);
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
      console.error('MapResultsScreen: Search update error:', error);
      Alert.alert('Error', error.message || 'Failed to update search');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleFilterOpen = () => {
    openFilterModal();
  };

  const handleFilterClose = () => {
    closeFilterModal();
  };

  const handleApplyFilters = (filters) => {
    console.log('Applying filters:', filters);
    updateSelectedFilters(filters);
    closeFilterModal();
  };

  // Filter matches based on selected filters
  const getFilteredMatches = () => {
    if (!matches || !selectedFilters) return matches;
    
    const { countries, leagues, teams } = selectedFilters;
    // Normalize selected IDs to strings for consistent comparisons
    const selectedCountryIds = (countries || []).map((id) => id?.toString());
    const selectedLeagueIds = (leagues || []).map((id) => id?.toString());
    const selectedTeamIds = (teams || []).map((id) => id?.toString());
    
    // If no filters are selected, return all matches
    if (selectedCountryIds.length === 0 && selectedLeagueIds.length === 0 && selectedTeamIds.length === 0) {

      return matches;
    }
    
    console.log('Filtering matches with (normalized):', { countries: selectedCountryIds, leagues: selectedLeagueIds, teams: selectedTeamIds });
    console.log('Total matches to filter:', matches.length);
    
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
    
    console.log('Filtered matches result:', filtered.length);
    return filtered;
  };

  // Get the filtered matches for display (memoized)
  const filteredMatches = useMemo(() => getFilteredMatches(), [matches, selectedFilters]);

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
    
    console.log('MapResultsScreen: Date filter applied, showing date-filtered matches:', dateFiltered?.length || 0);
    return dateFiltered;
  }, [filteredMatches, selectedDateHeader]);
  
  // Get filtered matches for display
  const displayFilteredMatches = useMemo(() => {
    // FIXED: Now uses the date-filtered results from finalFilteredMatches
    // This ensures both map markers and bottom sheet use the same filtered data
    
    // Debug: Log the filtering results
    console.log('MapResultsScreen: displayFilteredMatches updated:', {
      totalMatches: matches?.length || 0,
      filterFiltered: filteredMatches?.length || 0,
      dateFiltered: finalFilteredMatches?.length || 0,
      hasDateHeader: !!selectedDateHeader,
      selectedDate: selectedDateHeader ? selectedDateHeader.toDateString() : 'none'
    });
    
    return finalFilteredMatches;
  }, [finalFilteredMatches, matches, filteredMatches, selectedDateHeader]);

  // Group upcoming matches by venue (id preferred, fall back to coordinates)
  const venueGroups = useMemo(() => {
    if (!finalFilteredMatches || finalFilteredMatches.length === 0) return [];
    const groupsMap = new Map();
    finalFilteredMatches.forEach((m) => {
      const venue = m?.fixture?.venue || {};
      let key = null;
      if (venue.id != null) key = `id:${venue.id}`;
      else if (venue.coordinates && venue.coordinates.length === 2) key = `geo:${venue.coordinates[0]},${venue.coordinates[1]}`;
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
  }, [finalFilteredMatches]);

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
        console.log('⚠️ Match missing league data:', {
          id: item.id,
          hasLeague: !!item.league,
          hasCompetition: !!item.competition,
          competitionName: item.competition?.name,
          leagueName: item.league?.name
        });
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

  // Manual search function
  // FIXED: Now uses truly responsive bounds calculation based on actual map viewport
  // - Uses region.latitudeDelta/longitudeDelta directly (actual visible area)
  // - No more fixed size increments that don't match what user sees
  // - Bounds automatically adapt to zoom level: zoomed out = larger bounds, zoomed in = smaller bounds
  // - Maximum bounds capped at 5° × 5° to prevent extremely large searches
  const handleSearchThisArea = async () => {
    if (!dateFrom || !dateTo) return;
    
    // Use the current map region from state (which should be updated via onRegionChange)
    const currentRegion = mapRegion;
    
    console.log('🔍 Search this area clicked:', {
      currentRegion,
      hasCurrentRegion: !!currentRegion,
      coordinates: currentRegion ? `${currentRegion.latitude}, ${currentRegion.longitude}` : 'none',
      deltas: currentRegion ? `${currentRegion.latitudeDelta}, ${currentRegion.longitudeDelta}` : 'none'
    });
    
    if (!currentRegion) {
      console.error('❌ No current region available for search');
      return;
    }
    
    const requestId = currentRequestId + 1;
    setCurrentRequestId(requestId);
    await performBoundsSearch(currentRegion, requestId);
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
    } else {
      return {
        latitude: 51.5074, // London default
        longitude: -0.1278,
        latitudeDelta: 0.5,
        longitudeDelta: 0.5,
      };
    }
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

      {/* Map Layer */}
      <MatchMapView
        ref={mapRef}
        matches={displayFilteredMatches}
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
      
      {/* Floating Search Button */}
      {hasMovedFromInitial && (
        <TouchableOpacity
          style={styles.floatingSearchButton}
          onPress={handleSearchThisArea}
          disabled={isSearching}
        >
          {isSearching ? (
            <>
              <ActivityIndicator size="small" color="#000" style={{ marginRight: 8 }} />
              <Text style={styles.floatingSearchText}>Searching...</Text>
            </>
          ) : (
            <>
              <Text style={styles.floatingSearchText}>Search this area</Text>
            </>
          )}
        </TouchableOpacity>
      )}

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
            <Text style={styles.customHandleText}>{displayFilteredMatches?.length || 0} results</Text>
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

      {/* Filter Modal */}
      <FilterModal
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
    top: 160, // Increased padding from header (was 130, now 160 for better spacing)
    left: '50%',
    transform: [{ translateX: -100 }],
    width: 200,
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