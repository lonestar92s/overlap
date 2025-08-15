import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MAP_PROVIDER } from '../utils/mapConfig';
import HeartButton from '../components/HeartButton';
import MatchCard from '../components/MatchCard';
import ApiService from '../services/api';
import { useItineraries } from '../contexts/ItineraryContext';

const ItineraryMapScreen = ({ navigation, route }) => {
  const { itineraryId } = route.params;
  const { getItineraryById } = useItineraries();
  const [itinerary, setItinerary] = useState(null);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoFitKey, setAutoFitKey] = useState(0);
  const [venueCoordinates, setVenueCoordinates] = useState({});
  
  // Conditional import for map component
  const MatchMapView = React.useMemo(() => {
    if (MAP_PROVIDER === 'mapbox') {
      return require('../components/MapboxMapView').default;
    } else {
      return require('../components/MapView').default;
    }
  }, []);
  
  const insets = useSafeAreaInsets();
  const mapRef = useRef();

  // Load itinerary data
  useEffect(() => {
    const loadItinerary = async () => {
      try {
        setLoading(true);
        const loadedItinerary = getItineraryById(itineraryId);
        if (loadedItinerary) {
          console.log('🗺️ ItineraryMapScreen - Loaded from context:', loadedItinerary);
          setItinerary(loadedItinerary);
          // Trigger auto-fit when itinerary loads
          setAutoFitKey(prev => prev + 1);
        } else {
          // If not in context, try to fetch from API
          const response = await ApiService.getTripById(itineraryId);
          if (response.success) {
            console.log('🗺️ ItineraryMapScreen - Loaded from API:', response.data);
            setItinerary(response.data);
            // Trigger auto-fit when itinerary loads from API
            setAutoFitKey(prev => prev + 1);
          }
        }
      } catch (error) {
        console.error('Error loading itinerary:', error);
      } finally {
        setLoading(false);
      }
    };

    loadItinerary();
  }, [itineraryId, getItineraryById]);

  // Calculate map region to fit all matches
  const mapRegion = useMemo(() => {
    console.log('🗺️ ItineraryMapScreen - Calculating map region for matches:', itinerary?.matches);
    
    if (!itinerary?.matches || itinerary.matches.length === 0) {
      console.log('🗺️ ItineraryMapScreen - No matches, using default region');
      return {
        latitude: 51.5074, // London default
        longitude: -0.1278,
        latitudeDelta: 0.5,
        longitudeDelta: 0.5,
      };
    }

    // Extract coordinates from matches - try multiple possible sources
    const coordinates = itinerary.matches
      .map(match => {
        console.log('🗺️ ItineraryMapScreen - Processing match for coordinates:', {
          matchId: match.matchId,
          venue: match.venue,
          venueData: match.venueData,
          fixtureVenue: match.fixture?.venue
        });
        
        // Try to get coordinates from different possible locations
        // First check the new venueData field we're saving
        const coords = match.venueData?.coordinates ||
                      match.venue?.coordinates || 
                      match.fixture?.venue?.coordinates ||
                      match.venue?.lat || 
                      match.fixture?.venue?.lat ||
                      null;
        
        console.log('🗺️ ItineraryMapScreen - Found coordinates:', coords);
        
        if (coords) {
          // Handle array format [longitude, latitude] (GeoJSON)
          if (Array.isArray(coords) && coords.length === 2) {
            return { lat: coords[1], lng: coords[0] };  // GeoJSON: [lon, lat]
          }
          // Handle object format { lat, lng } or { latitude, longitude }
          else if (typeof coords === 'object') {
            if (coords.lat && coords.lng) {
              return { lat: coords.lat, lng: coords.lng };
            } else if (coords.latitude && coords.longitude) {
              return { lat: coords.latitude, lng: coords.longitude };
            }
          }
        }
        
        // If no coordinates, return null
        return null;
      })
      .filter(coord => coord !== null);

    console.log('🗺️ ItineraryMapScreen - Extracted coordinates:', coordinates);

    // If we have coordinates, calculate bounds
    if (coordinates.length > 0) {
      const lats = coordinates.map(coord => coord.lat);
      const lngs = coordinates.map(coord => coord.lng);
      
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);

      const region = {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: Math.max(0.01, (maxLat - minLat) * 1.5),
        longitudeDelta: Math.max(0.01, (maxLng - minLng) * 1.5),
      };
      
      console.log('🗺️ ItineraryMapScreen - Calculated region:', region);
      return region;
    }

    // Fallback to default region
    console.log('🗺️ ItineraryMapScreen - No coordinates found, using default region');
    return {
      latitude: 51.5074, // London default
      longitude: -0.1278,
      latitudeDelta: 0.5,
      longitudeDelta: 0.5,
    };
  }, [itinerary]);

  // Transform saved matches to the format expected by the map
  const transformMatchesForMap = (matches) => {
    return matches.map(match => {
      // Transform the saved match data back to the structure expected by MatchMapView
      return {
        ...match,
        id: match.matchId,
        fixture: {
          id: match.matchId,
          date: match.date,
          venue: match.venueData || {
            name: match.venue,
            coordinates: null
          }
        },
        teams: {
          home: match.homeTeam,
          away: match.awayTeam
        },
        league: { name: match.league }
      };
    });
  };

  // Handle marker press
  const handleMarkerPress = (match) => {
    setSelectedMatch(match);
  };

  // Handle match card close
  const handleCloseMatchCard = () => {
    setSelectedMatch(null);
  };

  // Handle map press to close match card
  const handleMapPress = () => {
    if (selectedMatch) {
      setSelectedMatch(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading itinerary map...</Text>
      </View>
    );
  }

  if (!itinerary) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Itinerary not found</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{itinerary.name}</Text>
          <Text style={styles.headerSubtitle}>
            {itinerary.matches?.length || 0} matches
          </Text>
        </View>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <MatchMapView
          ref={mapRef}
          style={styles.map}
          initialRegion={mapRegion}
          onMapPress={handleMapPress}
          matches={transformMatchesForMap(itinerary.matches || [])}
          onMarkerPress={handleMarkerPress}
          autoFitKey={autoFitKey}
        />
      </View>

      {/* Selected Match Card Overlay */}
      {selectedMatch && (
        <View style={styles.matchCardOverlay}>
          <MatchCard
            match={selectedMatch}
            onPress={() => {}}
            variant="overlay"
            showHeart={true}
            style={styles.matchCardStyle}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  header: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
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
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  matchCardOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  matchCardStyle: {
    margin: 0,
  },
});

export default ItineraryMapScreen;
