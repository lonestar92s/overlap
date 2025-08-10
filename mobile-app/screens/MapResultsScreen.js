import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Button } from 'react-native-elements';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';

import { MAP_PROVIDER } from '../utils/mapConfig';
import MatchModal from '../components/MatchModal';
import HeartButton from '../components/HeartButton';
import SearchModal from '../components/SearchModal';
import MatchCard from '../components/MatchCard';
import FilterModal from '../components/FilterModal';
import FilterIcon from '../components/FilterIcon';
import ApiService from '../services/api';

const MapResultsScreen = ({ navigation, route }) => {
  // Get search parameters and results from navigation
  const { searchParams, matches: initialMatches, initialRegion } = route.params || {};
  
  // Conditional import for map component
  const MatchMapView = React.useMemo(() => {
    if (MAP_PROVIDER === 'mapbox') {
      return require('../components/MapboxMapView').default;
    } else {
      return require('../components/MapView').default;
    }
  }, []);
  
  // Search state
  const [location] = useState(searchParams?.location || null);
  const [dateFrom] = useState(searchParams?.dateFrom || null);
  const [dateTo] = useState(searchParams?.dateTo || null);
  
  // Map and matches state
  const [matches, setMatches] = useState(initialMatches || []);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [mapRegion, setMapRegion] = useState(initialRegion || null);
  
  // Bottom sheet state
  const [sheetState, setSheetState] = useState('collapsed');
  const bottomSheetRef = useRef(null);
  
  // Snap points for bottom sheet
  const snapPoints = useMemo(() => ['8%', '55%', '85%'], []);
  
  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMatchForModal, setSelectedMatchForModal] = useState(null);
  
  // Search modal state
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [activeFilters, setActiveFilters] = useState({});
  
  // Manual search state
  const [hasMovedFromOriginal, setHasMovedFromOriginal] = useState(false);
  const [originalSearchRegion, setOriginalSearchRegion] = useState(null);
  
  // Phase 1: Request cancellation and tracking
  const [currentRequestId, setCurrentRequestId] = useState(0);
  const [lastSearchBounds, setLastSearchBounds] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [lastSuccessfulRequestId, setLastSuccessfulRequestId] = useState(0);
  
  // Refs
  const mapRef = useRef();
  
  // Get safe area insets
  const insets = useSafeAreaInsets();
  
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

  // Track when matches state changes


  // Calculate smart zoom level based on result count
  const calculateSmartZoom = (matchCount) => {
    if (matchCount === 0) return 0.2;
    if (matchCount <= 2) return 0.2;
    if (matchCount <= 5) return 0.3;
    if (matchCount <= 10) return 0.4;
    return 0.5; // Cap at wide view
  };

  // Initialize original search region
  useEffect(() => {
    if (initialRegion && !originalSearchRegion) {
      setOriginalSearchRegion(initialRegion);
    }
  }, [initialRegion, originalSearchRegion]);

  // No initial search needed - matches are passed via navigation params

  // Phase 1: Improved search with request cancellation
  const performBoundsSearch = async (region, requestId) => {
    if (!dateFrom || !dateTo || !region) return;
    
    
    
    setIsSearching(true);
    try {
      // Calculate bounds from region with safety checks
      if (!region.latitude || !region.longitude || !region.latitudeDelta || !region.longitudeDelta) {
        console.error('Invalid region data:', region);
        setIsSearching(false);
        return;
      }
      
      const bounds = {
        northeast: {
          lat: region.latitude + region.latitudeDelta / 2,
          lng: region.longitude + region.longitudeDelta / 2,
        },
        southwest: {
          lat: region.latitude - region.latitudeDelta / 2,
          lng: region.longitude - region.longitudeDelta / 2,
        },
      };

      // Check if bounds have changed significantly (avoid unnecessary requests)
      if (lastSearchBounds && 
          Math.abs(bounds.northeast.lat - lastSearchBounds.northeast.lat) < 0.01 &&
          Math.abs(bounds.northeast.lng - lastSearchBounds.northeast.lng) < 0.01 &&
          Math.abs(bounds.southwest.lat - lastSearchBounds.southwest.lat) < 0.01 &&
          Math.abs(bounds.southwest.lng - lastSearchBounds.southwest.lng) < 0.01) {

        setIsSearching(false);
        return;
      }

      
      
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
        
        // Phase 1: Diff-based updates
        updateMatchesEfficiently(response.data);
        setLastSearchBounds(bounds);
        
        // Don't recenter the map - let the user keep their current view
        // The search results will appear as markers on the current map view
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

  // Phase 1: Efficient marker updates (diff-based)
  const updateMatchesEfficiently = (newMatches) => {
    
    
    setMatches(prevMatches => {
      
      
      // Create sets for efficient comparison
      const prevIds = new Set(prevMatches.map(m => m.fixture?.id));
      const newIds = new Set(newMatches.map(m => m.fixture?.id));
      
      
      
      // Find matches to add (new IDs not in previous)
      const toAdd = newMatches.filter(m => !prevIds.has(m.fixture?.id));
      
      // Find matches to remove (previous IDs not in new)
      const toRemove = prevMatches.filter(m => !newIds.has(m.fixture?.id));
      
      // Find matches to update (same ID but different data)
      const toUpdate = newMatches.filter(newMatch => {
        const prevMatch = prevMatches.find(p => p.fixture?.id === newMatch.fixture?.id);
        return prevMatch && JSON.stringify(prevMatch) !== JSON.stringify(newMatch);
      });
      
      
      
      if (toAdd.length === 0 && toRemove.length === 0 && toUpdate.length === 0) {
                    return prevMatches;
      }
      
      // Apply changes efficiently
      let updatedMatches = [...prevMatches];
      
      // Remove old matches
      toRemove.forEach(match => {
        updatedMatches = updatedMatches.filter(m => m.fixture?.id !== match.fixture?.id);
      });
      
      // Add new matches
      updatedMatches = [...updatedMatches, ...toAdd];
      
      // Update existing matches
      toUpdate.forEach(newMatch => {
        const index = updatedMatches.findIndex(m => m.fixture?.id === newMatch.fixture?.id);
        if (index !== -1) {
          updatedMatches[index] = newMatch;
        }
      });
      
      // Sort matches chronologically (perfect for travel planning)
      updatedMatches.sort((a, b) => {
        const dateA = new Date(a.fixture?.date);
        const dateB = new Date(b.fixture?.date);
        return dateA.getTime() - dateB.getTime();
      });
      

      
      return updatedMatches;
    });
  };



  // Handle map region change (when user pans/zooms)
  const handleMapRegionChange = (region, bounds) => {

    
    setMapRegion(region);
    
    // Check if user has moved or zoomed significantly from original search area
    if (originalSearchRegion) {
      const latDiff = Math.abs(region.latitude - originalSearchRegion.latitude);
      const lngDiff = Math.abs(region.longitude - originalSearchRegion.longitude);
      const hasMoved = latDiff > 0.1 || lngDiff > 0.1; // 0.1 degree threshold
      
      // Check if user has zoomed out significantly (larger delta = more zoomed out)
      const originalLatDelta = originalSearchRegion.latitudeDelta || 0.5;
      const originalLngDelta = originalSearchRegion.longitudeDelta || 0.5;
      const hasZoomedOut = region.latitudeDelta > originalLatDelta * 1.5 || region.longitudeDelta > originalLngDelta * 1.5;
      
      setHasMovedFromOriginal(hasMoved || hasZoomedOut);
    }
  };

  // Handle marker press
  const handleMarkerPress = (match) => {
    setSelectedMatchForModal(match);
    setModalVisible(true);
    
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
    setFilterModalVisible(true);
  };

  const handleFilterClose = () => {
    setFilterModalVisible(false);
  };

  const handleApplyFilters = (filters) => {
    setActiveFilters(filters);
    // Here you would apply the filters to your matches
    // For now, we'll just store them
    console.log('Applied filters:', filters);
  };

  const getActiveFilterCount = () => {
    return (activeFilters.countries?.length || 0) + 
           (activeFilters.leagues?.length || 0) + 
           (activeFilters.teams?.length || 0);
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

  // Render match item
  const renderMatchItem = ({ item }) => {
    return (
      <MatchCard
        match={item}
        onPress={() => handleMatchPress(item)}
        variant="default"
        showHeart={true}
      />
    );
  };

  // Render bottom sheet content
  const renderBottomSheetContent = () => {
    return (
      <BottomSheetView style={styles.bottomSheetContent}>
        {/* Show results count when collapsed */}
        {sheetState === 'collapsed' && (
          <View style={styles.collapsedIndicator}>
            <Text style={styles.collapsedMatchCount}>
              {matches?.length || 0} results
            </Text>
          </View>
        )}

        {/* Always render the full content, but control visibility */}
        <View style={[
          styles.fullContentContainer,
          sheetState === 'collapsed' && styles.hiddenContent
        ]}>
          <View style={styles.bottomSheetHeader}>
            {isSearching && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#1976d2" />
                <Text style={styles.loadingText}>Searching matches...</Text>
              </View>
            )}

            <Text style={styles.resultsHeader}>
              {matches?.length || 0} matches found
            </Text>
          </View>

          <FlatList
            data={matches || []}
            renderItem={renderMatchItem}
            keyExtractor={(item, index) => item.fixture?.id?.toString() || `match-${index}`}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.matchListContent}
            style={[styles.bottomSheetScrollView, { height: calculateFlatListHeight() }]}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
            maintainVisibleContentPosition={{
              minIndexForVisible: 0,
              autoscrollToTopThreshold: 10,
            }}
            removeClippedSubviews={false}
            initialNumToRender={matches?.length || 0}
            maxToRenderPerBatch={matches?.length || 0}
            windowSize={matches?.length || 0}
          />
        </View>
      </BottomSheetView>
    );
  };

  // Manual search function
  const handleSearchThisArea = async () => {
    if (!mapRegion || !dateFrom || !dateTo) return;
    
    const requestId = currentRequestId + 1;
    setCurrentRequestId(requestId);
    await performBoundsSearch(mapRegion, requestId);
  };

  // Calculate initial region based on searched location with smart zoom
  const getInitialRegion = () => {
    let baseRegion;
    
    if (initialRegion) {
      baseRegion = initialRegion;
    } else if (location && location.lat && location.lon) {
      baseRegion = {
        latitude: location.lat,
        longitude: location.lon,
        latitudeDelta: 0.5,
        longitudeDelta: 0.5,
      };
    } else {
      baseRegion = {
        latitude: 51.5074, // London default
        longitude: -0.1278,
        latitudeDelta: 0.5,
        longitudeDelta: 0.5,
      };
    }
    
    // Apply smart zoom based on initial match count
    const smartZoom = calculateSmartZoom(initialMatches?.length || 0);
    return {
      ...baseRegion,
      latitudeDelta: smartZoom,
      longitudeDelta: smartZoom,
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
        </View>
        
        <View style={styles.headerRight}>
          <FilterIcon
            onPress={handleFilterOpen}
            activeFilterCount={getActiveFilterCount()}
            size={24}
          />
        </View>
      </View>

      {/* Map Layer */}
      <MatchMapView
        ref={mapRef}
        matches={matches}
        initialRegion={getInitialRegion()}
        onRegionChange={handleMapRegionChange}
        onMarkerPress={handleMarkerPress}
        selectedMatchId={selectedMatchForModal?.fixture.id}
        style={styles.map}
      />

      {/* Floating Search Button */}
      {hasMovedFromOriginal && (
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

      {/* Bottom Sheet */}
      <BottomSheet
        ref={bottomSheetRef}
        index={0}
        snapPoints={snapPoints}
        onChange={(index) => {
          const states = ['collapsed', 'half', 'full'];
          setSheetState(states[index]);
        }}
        enablePanDownToClose={false}
        enableContentPanningGesture={false}
        keyboardBehavior="interactive"
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.bottomSheetIndicator}
      >
        {renderBottomSheetContent()}
      </BottomSheet>

      {/* Match Modal */}
      <MatchModal
        visible={modalVisible}
        match={selectedMatchForModal}
        allMatches={matches}
        onClose={() => {
          setModalVisible(false);
          setSelectedMatchForModal(null);
        }}
        onMatchChange={(newMatch) => {
          setSelectedMatchForModal(newMatch);
        }}
      />

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
        onApplyFilters={handleApplyFilters}
        currentFilters={activeFilters}
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
  floatingSearchButton: {
    position: 'absolute',
    top: 130, // Adjusted to account for increased header height
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
    flex: 1,
    padding: 16,
    paddingBottom: 60, // Extra padding to account for bottom tab navigation
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
    // Height will be set dynamically via calculateFlatListHeight()
  },
  bottomSheetBackground: {
    backgroundColor: '#fff',
  },
  bottomSheetIndicator: {
    backgroundColor: '#D1D5DB',
    width: 40,
    height: 4,
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
  matchListContent: {
    paddingBottom: 60, // Reduced padding to eliminate excessive space at bottom
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
});

export default MapResultsScreen; 