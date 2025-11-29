import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MAP_PROVIDER } from '../utils/mapConfig';
import HeartButton from '../components/HeartButton';
import MatchCard from '../components/MatchCard';
import HomeBaseCard from '../components/HomeBaseCard';
import ApiService from '../services/api';
import { useItineraries } from '../contexts/ItineraryContext';

const ItineraryMapScreen = ({ navigation, route }) => {
  const { itineraryId } = route.params;
  const { getItineraryById, addMatchToItinerary } = useItineraries();
  const [itinerary, setItinerary] = useState(null);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [selectedRecommendation, setSelectedRecommendation] = useState(null);
  const [selectedHomeBase, setSelectedHomeBase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoFitKey, setAutoFitKey] = useState(0);
  const [venueCoordinates, setVenueCoordinates] = useState({});
  const [travelTimes, setTravelTimes] = useState({});
  const [travelTimesLoading, setTravelTimesLoading] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  
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

  // Fetch travel times when itinerary and home bases are available
  useEffect(() => {
    const fetchTravelTimes = async () => {
      if (!itinerary || !itinerary.homeBases || itinerary.homeBases.length === 0) {
        setTravelTimes({});
        return;
      }

      if (!itinerary.matches || itinerary.matches.length === 0) {
        setTravelTimes({});
        return;
      }

      try {
        setTravelTimesLoading(true);
        const times = await ApiService.getTravelTimes(itineraryId);
        setTravelTimes(times || {});
      } catch (error) {
        // Only log non-API-key errors to avoid noise in console
        if (!error.message?.includes('API key not configured')) {
          console.error('Error fetching travel times:', error);
        }
        setTravelTimes({});
      } finally {
        setTravelTimesLoading(false);
      }
    };

    fetchTravelTimes();
  }, [itineraryId, itinerary?.matches, itinerary?.homeBases]);

  // Fetch recommendations for the trip
  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!itineraryId || !itinerary) {
        return;
      }

      try {
        setRecommendationsLoading(true);
        const response = await ApiService.getRecommendations(itineraryId);
        if (response.success && response.recommendations) {
          setRecommendations(response.recommendations || []);
        }
      } catch (error) {
        console.error('Error fetching recommendations:', error);
        // Don't show error to user - recommendations are optional
      } finally {
        setRecommendationsLoading(false);
      }
    };

    fetchRecommendations();
  }, [itineraryId, itinerary]);

  // Calculate map region to fit all matches, recommended matches, and home bases
  const mapRegion = useMemo(() => {
    console.log('🗺️ ItineraryMapScreen - Calculating map region for matches, recommendations, and home bases:', itinerary?.matches, recommendations, itinerary?.homeBases);
    
    const allCoordinates = [];

    // Extract coordinates from matches - try multiple possible sources
    if (itinerary?.matches && itinerary.matches.length > 0) {
      const matchCoordinates = itinerary.matches
        .map(match => {
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
      
      allCoordinates.push(...matchCoordinates);
    }

    // Extract coordinates from recommended matches
    if (recommendations && recommendations.length > 0) {
      const recommendedMatchCoordinates = recommendations
        .map(recommendation => {
          const match = recommendation.match || recommendation;
          const coords = match.fixture?.venue?.coordinates;
          
          if (coords && Array.isArray(coords) && coords.length === 2) {
            return { lat: coords[1], lng: coords[0] };  // GeoJSON: [lon, lat]
          }
          
          return null;
        })
        .filter(coord => coord !== null);
      
      allCoordinates.push(...recommendedMatchCoordinates);
    }

    // Extract coordinates from home bases
    if (itinerary?.homeBases && itinerary.homeBases.length > 0) {
      const homeBaseCoordinates = itinerary.homeBases
        .filter(homeBase => {
          const coords = homeBase.coordinates;
          return coords && typeof coords.lat === 'number' && typeof coords.lng === 'number';
        })
        .map(homeBase => ({
          lat: homeBase.coordinates.lat,
          lng: homeBase.coordinates.lng,
        }));
      
      allCoordinates.push(...homeBaseCoordinates);
    }

    console.log('🗺️ ItineraryMapScreen - Extracted coordinates:', allCoordinates);

    // If we have coordinates, calculate bounds
    if (allCoordinates.length > 0) {
      const lats = allCoordinates.map(coord => coord.lat);
      const lngs = allCoordinates.map(coord => coord.lng);
      
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);

      const region = {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: Math.max(0.1, (maxLat - minLat) * 2.5), // Increased padding and minimum
        longitudeDelta: Math.max(0.1, (maxLng - minLng) * 2.5), // Increased padding and minimum
      };
      
      console.log('🗺️ ItineraryMapScreen - Calculated region:', region);
      return region;
    }

    // Fallback to default region
    console.log('🗺️ ItineraryMapScreen - No coordinates found, using default region');
    return {
      latitude: 51.5074, // London default
      longitude: -0.1278,
      latitudeDelta: 0.8, // More generous default zoom
      longitudeDelta: 0.8, // More generous default zoom
    };
  }, [itinerary, recommendations]);

  // Transform saved matches to the format expected by the map
  const transformMatchesForMap = (matches) => {
    return matches.map(match => {
      // Transform the saved match data back to the structure expected by MatchMapView
      let venueData = match.venueData;
      
      // If venueData doesn't have coordinates, try to create a basic venue object
      if (!venueData || !venueData.coordinates) {
        venueData = {
          name: match.venue || 'Unknown Venue',
          city: match.venueData?.city || 'Unknown City',
          country: match.venueData?.country || 'Unknown Country',
          coordinates: null // Will be filtered out by map component
        };
      }
      
      return {
        ...match,
        id: match.matchId,
        fixture: {
          id: match.matchId,
          date: match.date,
          venue: venueData
        },
        teams: {
          home: match.homeTeam,
          away: match.awayTeam
        },
        league: { name: match.league }
      };
    });
  };

  // Transform recommendations to the format expected by the map
  const transformRecommendationsForMap = (recommendations) => {
    return recommendations.map(recommendation => {
      const match = recommendation.match;
      return {
        ...match,
        id: match.id || match.matchId || match.fixture?.id,
        fixture: {
          id: match.id || match.matchId || match.fixture?.id,
          date: match.fixture?.date,
          venue: match.fixture?.venue
        },
        teams: match.teams,
        league: match.league,
        _isRecommendation: true, // Flag to identify as recommendation
        _recommendationData: recommendation // Store full recommendation data
      };
    });
  };

  // Handle marker press
  const handleMarkerPress = (match) => {
    setSelectedMatch(match);
    setSelectedRecommendation(null);
    setSelectedHomeBase(null); // Clear home base selection when match is selected
  };

  // Handle recommended match marker press
  const handleRecommendedMatchPress = (match) => {
    setSelectedRecommendation(match);
    setSelectedMatch(null);
    setSelectedHomeBase(null);
  };

  // Handle home base press
  const handleHomeBasePress = (homeBase) => {
    setSelectedHomeBase(homeBase);
    setSelectedMatch(null); // Clear match selection when home base is selected
  };

  // Handle match card close
  const handleCloseMatchCard = () => {
    setSelectedMatch(null);
  };

  // Handle recommendation card close
  const handleCloseRecommendationCard = () => {
    setSelectedRecommendation(null);
  };

  // Handle map press to close match card and home base card
  const handleMapPress = () => {
    if (selectedMatch) {
      setSelectedMatch(null);
    }
    if (selectedRecommendation) {
      setSelectedRecommendation(null);
    }
    if (selectedHomeBase) {
      setSelectedHomeBase(null);
    }
  };

  // Handle dismissing a recommendation
  const handleDismissRecommendation = async (recommendation) => {
    try {
      const recommendationData = recommendation._recommendationData || recommendation;
      const matchId = recommendationData.matchId || recommendationData.match?.id || recommendationData.match?.fixture?.id;
      
      // Track that user dismissed the recommendation
      await ApiService.trackRecommendation(
        matchId,
        'dismissed',
        itineraryId,
        recommendationData.recommendedForDate,
        recommendationData.score,
        recommendationData.reason
      );

      // Invalidate cache since user preferences have changed
      ApiService.invalidateRecommendationCache(itineraryId);

      // Remove the recommendation from the list
      setRecommendations(prev => prev.filter(rec => {
        const recMatchId = rec.matchId || rec.match?.id || rec.match?.fixture?.id;
        return String(recMatchId) !== String(matchId);
      }));

      // Close the card overlay
      setSelectedRecommendation(null);
    } catch (err) {
      console.error('Error dismissing recommendation:', err);
      Alert.alert('Error', 'Failed to dismiss recommendation');
    }
  };

  // Handle adding recommendation to trip
  const handleAddRecommendationToTrip = async (recommendation) => {
    try {
      const recommendationData = recommendation._recommendationData || recommendation;
      const match = recommendationData.match || recommendation;
      
      // Track that user saved the recommendation
      await ApiService.trackRecommendation(
        recommendationData.matchId,
        'saved',
        itineraryId,
        recommendationData.recommendedForDate,
        recommendationData.score,
        recommendationData.reason
      );

      // Invalidate cache since trip content has changed
      ApiService.invalidateRecommendationCache(itineraryId);

      // Format match data for the mobile app API
      const formattedMatchData = {
        matchId: match.id || match.matchId || match.fixture?.id,
        homeTeam: {
          name: match.teams?.home?.name,
          logo: match.teams?.home?.logo
        },
        awayTeam: {
          name: match.teams?.away?.name,
          logo: match.teams?.away?.logo
        },
        league: match.league?.name,
        venue: match.fixture?.venue?.name,
        venueData: match.fixture?.venue,
        date: match.fixture?.date
      };

      // Add match to trip
      await addMatchToItinerary(itineraryId, formattedMatchData);
      
      // Remove the recommendation from the list
      setRecommendations(prev => prev.filter(rec => {
        const recMatchId = rec.matchId || rec.match?.id || rec.match?.fixture?.id;
        const matchId = recommendationData.matchId || match.id || match.matchId || match.fixture?.id;
        return String(recMatchId) !== String(matchId);
      }));

      // Close the card overlay
      setSelectedRecommendation(null);

      // Refresh itinerary to show new match
      const updatedItinerary = getItineraryById(itineraryId);
      if (updatedItinerary) {
        setItinerary(updatedItinerary);
      }
    } catch (err) {
      console.error('Error adding recommendation to trip:', err);
      Alert.alert('Error', 'Failed to add match to trip');
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
          recommendedMatches={transformRecommendationsForMap(recommendations)}
          homeBases={itinerary.homeBases || []}
          onMarkerPress={handleMarkerPress}
          onRecommendedMatchPress={handleRecommendedMatchPress}
          onHomeBasePress={handleHomeBasePress}
          autoFitKey={autoFitKey}
          travelTimes={travelTimes}
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
            travelTime={
              selectedMatch?.matchId 
                ? travelTimes[selectedMatch.matchId] 
                : selectedMatch?.fixture?.id 
                  ? travelTimes[selectedMatch.fixture.id] 
                  : null
            }
            travelTimeLoading={travelTimesLoading}
            homeBases={itinerary?.homeBases || []}
          />
        </View>
      )}

      {/* Selected Recommendation Card Overlay */}
      {selectedRecommendation && (
        <View style={styles.recommendationCardOverlay}>
          <MatchCard
            match={selectedRecommendation}
            onPress={() => {}}
            variant="overlay"
            showHeart={true}
            style={styles.matchCardStyle}
            travelTime={
              selectedRecommendation?.matchId 
                ? travelTimes[selectedRecommendation.matchId] 
                : selectedRecommendation?.fixture?.id 
                  ? travelTimes[selectedRecommendation.fixture.id] 
                  : null
            }
            travelTimeLoading={travelTimesLoading}
            homeBases={itinerary?.homeBases || []}
          />
          {/* Recommendation Actions */}
          <View style={styles.recommendationActions}>
            <TouchableOpacity
              style={styles.addToTripButton}
              onPress={() => handleAddRecommendationToTrip(selectedRecommendation)}
            >
              <Text style={styles.addToTripButtonText}>Add to Trip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dismissRecommendationButton}
              onPress={() => handleDismissRecommendation(selectedRecommendation)}
            >
              <Text style={styles.dismissRecommendationButtonText}>Not Interested</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Selected Home Base Card Overlay */}
      {selectedHomeBase && (
        <View style={styles.homeBaseCardOverlay}>
          <HomeBaseCard
            homeBase={selectedHomeBase}
            onPress={() => {}}
            variant="overlay"
            style={styles.homeBaseCardStyle}
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
  homeBaseCardOverlay: {
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
  homeBaseCardStyle: {
    margin: 0,
  },
  recommendationCardOverlay: {
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
  recommendationActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  addToTripButton: {
    flex: 1,
    backgroundColor: '#1976d2',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  addToTripButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dismissRecommendationButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  dismissRecommendationButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ItineraryMapScreen;
