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
import ApiService from '../services/api';

const MapResultsScreen = ({ navigation, route }) => {
  // Get search parameters from navigation
  const { searchParams } = route.params || {};
  
  console.log('MapResults: Received route params:', route.params);
  console.log('MapResults: Search params:', searchParams);
  
  // Search state
  const [location] = useState(searchParams?.location || null);
  const [dateFrom] = useState(searchParams?.dateFrom || null);
  const [dateTo] = useState(searchParams?.dateTo || null);
  const [loading, setLoading] = useState(false);
  
  // Map and matches state
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [mapRegion, setMapRegion] = useState(null);
  
  // Bottom sheet state
  const [sheetState, setSheetState] = useState('collapsed');
  
  // Refs
  const mapRef = useRef();

  // Initial search when component mounts
  useEffect(() => {
    if (location && dateFrom && dateTo) {
      console.log('MapResults: Initializing with location:', location);
      console.log('MapResults: Date range:', dateFrom, 'to', dateTo);
      
      const initialRegion = getInitialRegion();
      console.log('MapResults: Initial region:', initialRegion);
      
      // Perform initial search with a small delay to ensure map is ready
      setTimeout(() => {
        performBoundsSearch(initialRegion);
      }, 1000);
    }
  }, [location, dateFrom, dateTo]);

  // Perform search based on map bounds
  const performBoundsSearch = async (region) => {
    if (!dateFrom || !dateTo || !region) return;
    
    setLoading(true);
    try {
      // Calculate bounds from region with safety checks
      if (!region.latitude || !region.longitude || !region.latitudeDelta || !region.longitudeDelta) {
        console.error('Invalid region data:', region);
        setLoading(false);
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

      const response = await ApiService.searchMatchesByBounds({
        bounds,
        dateFrom,
        dateTo,
      });

      if (response.success) {
        setMatches(response.data);
        console.log(`🏟️ Found ${response.data.length} matches in current map area`);
      } else {
        Alert.alert('Search Error', response.error || 'Failed to search matches');
      }
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Error', 'Failed to search matches');
    } finally {
      setLoading(false);
    }
  };

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (region) => {
      performBoundsSearch(region);
    }, 800),
    [dateFrom, dateTo]
  );

  // Handle map region change (when user pans/zooms)
  const handleMapRegionChange = (region, bounds) => {
    setMapRegion(region);
    debouncedSearch(region);
  };

  // Handle marker press
  const handleMarkerPress = (match) => {
    setSelectedMatch(match);
    // Auto-expand bottom sheet to show match details
    if (sheetState === 'collapsed') {
      setSheetState('half');
    }
  };

  // Handle match item press in list
  const handleMatchPress = (match) => {
    setSelectedMatch(match);
    
    // Center map on venue
    const venue = match.fixture?.venue;
    if (venue?.coordinates && venue.coordinates.length === 2 && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: venue.coordinates[0],
        longitude: venue.coordinates[1],
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
    const isSelected = selectedMatch?.fixture.id === item.fixture.id;
    const venue = item.fixture?.venue;
    
    return (
      <TouchableOpacity
        style={[styles.matchCard, isSelected && styles.selectedMatchCard]}
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
    if (sheetState === 'collapsed') {
      return (
        <View style={styles.collapsedContent}>
          {renderSearchSummary()}
          <Text style={styles.matchCount}>
            {matches.length} matches found
          </Text>
          {matches.slice(0, 2).map(match => (
            <TouchableOpacity
              key={match.fixture.id}
              style={styles.quickMatchItem}
              onPress={() => handleMatchPress(match)}
            >
              <Text style={styles.quickMatchText}>
                {match.teams.home.name} vs {match.teams.away.name}
              </Text>
              <Text style={styles.quickMatchDate}>
                {new Date(match.fixture.date).toLocaleDateString()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    }

    return (
      <View style={styles.expandedContent}>
        {renderSearchSummary()}
        
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#1976d2" />
            <Text style={styles.loadingText}>Searching matches...</Text>
          </View>
        )}

        <Text style={styles.resultsHeader}>
          {matches.length} matches found
        </Text>

        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.matchList}
          contentContainerStyle={styles.matchListContent}
        >
          {matches.map((match) => (
            <View key={match.fixture.id.toString()}>
              {renderMatchItem({ item: match })}
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  // Calculate initial region based on searched location
  const getInitialRegion = () => {
    if (location && location.lat && location.lon) {
      console.log('MapResults: Using search location for initial region:', location);
      return {
        latitude: location.lat,
        longitude: location.lon,
        latitudeDelta: 0.5,
        longitudeDelta: 0.5,
      };
    }
    console.log('MapResults: No valid location, using London default');
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
        selectedMatchId={selectedMatch?.fixture.id}
        style={styles.map}
      />

      {/* Bottom Sheet */}
      <BottomSheet
        onStateChange={setSheetState}
        initialState="collapsed"
      >
        {renderBottomSheetContent()}
      </BottomSheet>
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
});

export default MapResultsScreen; 