import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Card, Avatar, Button } from 'react-native-elements';
import { debounce } from 'lodash';

import BottomSheet from '../components/BottomSheet';
import MatchMapView from '../components/MapView';
import MatchModal from '../components/MatchModal';
import ApiService from '../services/api';

const MapResultsScreen = ({ navigation, route }) => {
  // Get search parameters and results from navigation
  const { searchParams, matches: initialMatches, initialRegion } = route.params || {};
  
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
  
  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMatchForModal, setSelectedMatchForModal] = useState(null);
  
  // Phase 1: Request cancellation and tracking
  const [currentRequestId, setCurrentRequestId] = useState(0);
  const [lastSearchBounds, setLastSearchBounds] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [lastSuccessfulRequestId, setLastSuccessfulRequestId] = useState(0);
  
  // Refs
  const mapRef = useRef();

  // Track when matches state changes
  useEffect(() => {
    console.log('🔄 Matches state changed to:', matches.length, 'items');
    if (matches.length > 0) {
      console.log('🔄 First match in state:', {
        id: matches[0].fixture?.id,
        teams: matches[0].teams ? `${matches[0].teams.home?.name} vs ${matches[0].teams.away?.name}` : 'No teams'
      });
    }
  }, [matches]);

  // No initial search needed - matches are passed via navigation params

  // Phase 1: Improved search with request cancellation
  const performBoundsSearch = async (region, requestId) => {
    if (!dateFrom || !dateTo || !region) return;
    
    console.log('🔍 Starting search with request ID:', requestId);
    
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
        console.log('📍 Bounds unchanged, skipping search');
        setIsSearching(false);
        return;
      }

      console.log('🔍 Performing bounds search:', bounds);
      
      const response = await ApiService.searchMatchesByBounds({
        bounds,
        dateFrom,
        dateTo,
      });

      // More intelligent response handling: accept responses that are recent enough
      // Only reject if this request is significantly older than the current one
      const isSignificantlyStale = requestId < (currentRequestId - 1);
      
      if (isSignificantlyStale) {
        console.log('🔄 Significantly stale response ignored:', requestId, 'current:', currentRequestId);
        return;
      }

      console.log('✅ Search completed for request ID:', requestId);

      if (response.success) {
        console.log('📊 Received', response.data?.length || 0, 'matches from API');
        
        // Update the last successful request ID
        setLastSuccessfulRequestId(requestId);
        
        // Phase 1: Diff-based updates
        updateMatchesEfficiently(response.data);
        setLastSearchBounds(bounds);
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
    console.log('📊 Updating matches efficiently. Current count:', matches.length, 'New count:', newMatches.length);
    console.log('📊 New matches data structure:', JSON.stringify(newMatches.slice(0, 2), null, 2));
    
    setMatches(prevMatches => {
      console.log('📊 Previous matches count:', prevMatches.length);
      
      // Create sets for efficient comparison
      const prevIds = new Set(prevMatches.map(m => m.fixture?.id));
      const newIds = new Set(newMatches.map(m => m.fixture?.id));
      
      console.log('📊 Previous IDs:', Array.from(prevIds));
      console.log('📊 New IDs:', Array.from(newIds));
      
      // Find matches to add (new IDs not in previous)
      const toAdd = newMatches.filter(m => !prevIds.has(m.fixture?.id));
      
      // Find matches to remove (previous IDs not in new)
      const toRemove = prevMatches.filter(m => !newIds.has(m.fixture?.id));
      
      // Find matches to update (same ID but different data)
      const toUpdate = newMatches.filter(newMatch => {
        const prevMatch = prevMatches.find(p => p.fixture?.id === newMatch.fixture?.id);
        return prevMatch && JSON.stringify(prevMatch) !== JSON.stringify(newMatch);
      });
      
      console.log(`📊 Match diff: +${toAdd.length} -${toRemove.length} ~${toUpdate.length}`);
      
      if (toAdd.length === 0 && toRemove.length === 0 && toUpdate.length === 0) {
        console.log('✅ No changes needed');
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
      
      console.log('✅ Final match count:', updatedMatches.length);
      console.log('✅ First match in updated list:', updatedMatches[0] ? {
        id: updatedMatches[0].fixture?.id,
        teams: updatedMatches[0].teams ? `${updatedMatches[0].teams.home?.name} vs ${updatedMatches[0].teams.away?.name}` : 'No teams',
        date: updatedMatches[0].fixture?.date
      } : 'No matches');
      
      // Log when state is actually being updated
      console.log('🔄 State update: matches array will be updated to', updatedMatches.length, 'items');
      
      return updatedMatches;
    });
  };

  // Phase 1: Improved debounced search with request cancellation
  const debouncedSearch = useCallback(
    debounce(async (region) => {
      console.log('🚀 Debounced search triggered for region:', {
        lat: region.latitude,
        lng: region.longitude,
        latDelta: region.latitudeDelta,
        lngDelta: region.longitudeDelta
      });
      
      const requestId = currentRequestId + 1;
      console.log('🚀 Creating new request ID:', requestId, 'from current:', currentRequestId);
      setCurrentRequestId(requestId);
      await performBoundsSearch(region, requestId);
    }, 800),
    [dateFrom, dateTo, currentRequestId]
  );

  // Handle map region change (when user pans/zooms)
  const handleMapRegionChange = (region, bounds) => {
    console.log('🗺️ Map region changed:', {
      lat: region.latitude,
      lng: region.longitude,
      latDelta: region.latitudeDelta,
      lngDelta: region.longitudeDelta
    });
    
    setMapRegion(region);
    debouncedSearch(region);
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

  // Render search summary
  const renderSearchSummary = () => (
    <View style={styles.searchSummary}>
      <Text style={styles.searchLocation}>
        📍 {location?.city}, {location?.country}
      </Text>
      <Text style={styles.searchDates}>
        📅 {formatDisplayDate(dateFrom)} - {formatDisplayDate(dateTo)}
      </Text>
    </View>
  );

  // Render match item
  const renderMatchItem = ({ item }) => {
    const venue = item.fixture?.venue;
    
    return (
      <TouchableOpacity
        style={styles.matchCard}
        onPress={() => handleMatchPress(item)}
      >
        <View style={styles.matchHeader}>
          <Text style={styles.matchDate}>
            {new Date(item.fixture.date).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric'
            })}
          </Text>
          <Text style={styles.matchTime}>
            {new Date(item.fixture.date).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
        </View>

        <View style={styles.teamsRow}>
          <View style={styles.teamContainer}>
            <Avatar
              source={{ uri: item.teams.home.logo }}
              size={30}
              rounded
            />
            <Text style={styles.teamName}>{item.teams.home.name}</Text>
          </View>
          
          <Text style={styles.vsText}>vs</Text>
          
          <View style={styles.teamContainer}>
            <Avatar
              source={{ uri: item.teams.away.logo }}
              size={30}
              rounded
            />
            <Text style={styles.teamName}>{item.teams.away.name}</Text>
          </View>
        </View>

        <View style={styles.venueRow}>
          <Text style={styles.venueName}>{venue?.name}</Text>
          <Text style={styles.venueLocation}>
            {venue?.city}, {venue?.country}
          </Text>
        </View>

        <View style={styles.leagueRow}>
          <Avatar
            source={{ uri: item.league?.logo || item.competition?.logo }}
            size={16}
            rounded
          />
          <Text style={styles.leagueName}>
            {item.league?.name || item.competition?.name}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Render bottom sheet content
  const renderBottomSheetContent = () => {
    console.log('🎯 Rendering bottom sheet content. Matches count:', matches?.length || 0);
    console.log('🎯 Sheet state:', sheetState);
    
    if (sheetState === 'collapsed') {
      return (
        <View style={styles.collapsedContent}>
          {/* Match count - prominent display like Zillow */}
          <Text style={styles.collapsedMatchCount}>
            {matches?.length || 0} results
          </Text>
        </View>
      );
    }

    // List view (expanded state)
    return (
      <View style={styles.expandedContent}>
        {renderSearchSummary()}
        
        {isSearching && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#1976d2" />
            <Text style={styles.loadingText}>Searching matches...</Text>
          </View>
        )}

        <Text style={styles.resultsHeader}>
          {matches?.length || 0} matches found
        </Text>

        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.matchList}
          contentContainerStyle={styles.matchListContent}
        >
          {matches?.map((match, index) => {
            console.log('🎯 Rendering match:', index, match.fixture?.id, match.teams?.home?.name, 'vs', match.teams?.away?.name);
            return (
              <View key={match.fixture?.id?.toString() || `match-${index}`}>
                {renderMatchItem({ item: match })}
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  // Calculate initial region based on searched location
  const getInitialRegion = () => {
    if (initialRegion) {
      return initialRegion;
    }
    if (location && location.lat && location.lon) {
      return {
        latitude: location.lat,
        longitude: location.lon,
        latitudeDelta: 0.5,
        longitudeDelta: 0.5,
      };
    }
    return {
      latitude: 51.5074, // London default
      longitude: -0.1278,
      latitudeDelta: 0.5,
      longitudeDelta: 0.5,
    };
  };

  return (
    <View style={styles.container}>
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

      {/* Bottom Sheet */}
      <BottomSheet
        onStateChange={setSheetState}
        initialState="collapsed"
      >
        {renderBottomSheetContent()}
      </BottomSheet>

      {/* Match Modal */}
      <MatchModal
        visible={modalVisible}
        match={selectedMatchForModal}
        onClose={() => {
          setModalVisible(false);
          setSelectedMatchForModal(null);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  searchSummary: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
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
  collapsedContent: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },

  collapsedMatchCount: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#333',
  },
  matchCount: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
    color: '#333',
  },
  quickMatchItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  quickMatchText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  quickMatchDate: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  expandedContent: {
    flex: 1,
    padding: 16,
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
  matchList: {
    flex: 1,
  },
  matchListContent: {
    paddingBottom: 20,
  },
  matchCard: {
    backgroundColor: 'white',
    marginVertical: 6,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  selectedMatchCard: {
    backgroundColor: '#e3f2fd',
    borderColor: '#1976d2',
    borderWidth: 2,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  matchDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  matchTime: {
    fontSize: 14,
    color: '#666',
  },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  teamContainer: {
    alignItems: 'center',
    flex: 1,
  },
  teamName: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
    color: '#333',
  },
  vsText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
    marginHorizontal: 16,
  },
  venueRow: {
    marginBottom: 8,
  },
  venueName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  venueLocation: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  leagueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leagueName: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
    fontStyle: 'italic',
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