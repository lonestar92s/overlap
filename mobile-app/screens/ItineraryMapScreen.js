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
import { useFocusEffect } from '@react-navigation/native';
import { MAP_PROVIDER } from '../utils/mapConfig';
import HeartButton from '../components/HeartButton';
import MatchCard from '../components/MatchCard';
import HomeBaseCard from '../components/HomeBaseCard';
import ApiService from '../services/api';
import { useItineraries } from '../contexts/ItineraryContext';
import { useRecommendations } from '../hooks/useRecommendations';
import { transformRecommendationsForMap, transformMatchesForMap } from '../utils/recommendationTransformers';

const ItineraryMapScreen = ({ navigation, route }) => {
  const { itineraryId } = route.params;
  const { getItineraryById, addMatchToItinerary, itineraries } = useItineraries();
  const [itinerary, setItinerary] = useState(null);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [selectedRecommendation, setSelectedRecommendation] = useState(null);
  const [selectedHomeBase, setSelectedHomeBase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoFitKey, setAutoFitKey] = useState(0);
  const [venueCoordinates, setVenueCoordinates] = useState({});
  const [travelTimes, setTravelTimes] = useState({});
  const [travelTimesLoading, setTravelTimesLoading] = useState(false);
  const [addingMatch, setAddingMatch] = useState(false);
  const addingMatchRef = useRef(false);
  
  // Use recommendations hook
  const { 
    recommendations, 
    loading: recommendationsLoading, 
    error: recommendationsError,
    refetch: refetchRecommendations,
    dismiss: dismissRecommendation,
    addToTrip: addRecommendationToTrip
  } = useRecommendations(itineraryId, itinerary, { autoFetch: !!itineraryId });
  
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
          } else if (response.error) {
            // Only log non-rate-limit errors to avoid noise
            if (!response.error.includes('429') && !response.error.includes('rate limit')) {
              console.warn('⚠️ Failed to load itinerary from API:', response.error);
            }
          }
        }
      } catch (error) {
        // Only log if it's not a network error that might be transient
        if (error.message && !error.message.includes('Network request failed')) {
          console.error('Error loading itinerary:', error);
        }
      } finally {
        setLoading(false);
      }
    };

    loadItinerary();
  }, [itineraryId, getItineraryById]);

  // Sync local itinerary state when context updates (e.g., when match is added)
  useEffect(() => {
    const updatedItinerary = getItineraryById(itineraryId);
    if (!updatedItinerary) {
      return;
    }
    
    // If we don't have a local itinerary yet, set it
    if (!itinerary) {
      setItinerary(updatedItinerary);
      return;
    }
    
    // Compare matches to detect if itinerary actually changed
    const currentMatchesCount = itinerary.matches?.length || 0;
    const updatedMatchesCount = updatedItinerary.matches?.length || 0;
    const currentMatchIds = new Set(
      (itinerary.matches || []).map(m => String(m.matchId || m.fixture?.id || m.id)).filter(Boolean)
    );
    const updatedMatchIds = new Set(
      (updatedItinerary.matches || []).map(m => String(m.matchId || m.fixture?.id || m.id)).filter(Boolean)
    );
    
    // Check if matches changed (count or IDs)
    const matchesChanged = 
      updatedMatchesCount !== currentMatchesCount ||
      currentMatchIds.size !== updatedMatchIds.size ||
      [...updatedMatchIds].some(id => !currentMatchIds.has(id));
    
    if (matchesChanged) {
      console.log('🗺️ ItineraryMapScreen - Syncing itinerary from context update:', {
        currentMatches: currentMatchesCount,
        updatedMatches: updatedMatchesCount
      });
      setItinerary(updatedItinerary);
    }
  }, [itineraries, itineraryId, getItineraryById, itinerary]);

  // Fetch travel times when itinerary and home bases are available
  // Also recalculate when home bases change (added, updated, or deleted)
  // Uses caching to avoid unnecessary API calls
  const lastTravelTimesHash = useRef(null);
  
  useEffect(() => {
    const fetchTravelTimes = async () => {
      if (!itinerary || !itinerary.homeBases || itinerary.homeBases.length === 0) {
        // Clear travel times when no home bases are available
        setTravelTimes({});
        lastTravelTimesHash.current = null;
        return;
      }

      if (!itinerary.matches || itinerary.matches.length === 0) {
        setTravelTimes({});
        lastTravelTimesHash.current = null;
        return;
      }

      // Create a hash of matches and home bases to detect if we need to refetch
      const matchIds = (itinerary.matches || [])
        .map(m => String(m.matchId || m.fixture?.id || m.id))
        .sort()
        .join(',');
      const homeBaseIds = (itinerary.homeBases || [])
        .map(hb => `${hb._id || hb.id}-${hb.coordinates?.lat}-${hb.coordinates?.lng}`)
        .sort()
        .join(',');
      const currentHash = `${matchIds}|${homeBaseIds}`;
      
      // Only fetch if hash changed (matches or home bases changed)
      if (lastTravelTimesHash.current === currentHash) {
        // Check cache first - API service will return cached if available
        const cached = ApiService.getCachedTravelTimes(itineraryId);
        if (cached && Object.keys(cached).length > 0) {
          // Use cached data, but still filter for valid home bases
          const validHomeBaseIds = new Set(
            (itinerary.homeBases || []).map(hb => String(hb._id || hb.id))
          );
          
          const filteredTimes = {};
          Object.keys(cached).forEach(matchId => {
            const travelTime = cached[matchId];
            if (travelTime && travelTime.homeBaseId) {
              const homeBaseId = String(travelTime.homeBaseId);
              if (validHomeBaseIds.has(homeBaseId)) {
                const match = itinerary.matches?.find(m => 
                  String(m.matchId) === matchId || 
                  String(m.fixture?.id) === matchId
                );
                if (match?.planning?.homeBaseId && 
                    String(match.planning.homeBaseId) === homeBaseId) {
                  filteredTimes[matchId] = travelTime;
                }
              }
            }
          });
          setTravelTimes(filteredTimes);
          return; // Use cached data, no API call needed
        }
        return; // Hash unchanged and no cache - keep existing travel times
      }
      
      // Hash changed or no cache - fetch from API
      lastTravelTimesHash.current = currentHash;

      try {
        setTravelTimesLoading(true);
        // Don't force refresh - use cache if available
        const times = await ApiService.getTravelTimes(itineraryId, null, false);
        // Only set travel times for matches that have valid home bases
        // Filter out any travel times that reference deleted home bases
        const validHomeBaseIds = new Set(
          (itinerary.homeBases || []).map(hb => String(hb._id || hb.id))
        );
        
        const filteredTimes = {};
        if (times) {
          Object.keys(times).forEach(matchId => {
            const travelTime = times[matchId];
            // Only include travel time if:
            // 1. It has a homeBaseId (explicitly assigned)
            // 2. The home base still exists in the trip
            // 3. The match has planning.homeBaseId set (double-check)
            if (travelTime && travelTime.homeBaseId) {
              const homeBaseId = String(travelTime.homeBaseId);
              if (validHomeBaseIds.has(homeBaseId)) {
                // Verify the match has this home base assigned
                const match = itinerary.matches?.find(m => 
                  String(m.matchId) === matchId || 
                  String(m.fixture?.id) === matchId
                );
                if (match?.planning?.homeBaseId && 
                    String(match.planning.homeBaseId) === homeBaseId) {
                  filteredTimes[matchId] = travelTime;
                }
              }
            }
            // If no homeBaseId, don't include it (matches without assigned home bases)
          });
        }
        
        setTravelTimes(filteredTimes);
      } catch (error) {
        // Only log non-API-key and non-rate-limit errors to avoid noise in console
        if (!error.message?.includes('API key not configured') && 
            !error.message?.includes('429') && 
            !error.message?.includes('rate limit') &&
            !error.message?.includes('Too many requests')) {
          console.error('Error fetching travel times:', error);
        }
        // Try to use cached data on error
        const cached = ApiService.getCachedTravelTimes(itineraryId);
        if (cached && Object.keys(cached).length > 0) {
          const validHomeBaseIds = new Set(
            (itinerary.homeBases || []).map(hb => String(hb._id || hb.id))
          );
          
          const filteredTimes = {};
          Object.keys(cached).forEach(matchId => {
            const travelTime = cached[matchId];
            if (travelTime && travelTime.homeBaseId) {
              const homeBaseId = String(travelTime.homeBaseId);
              if (validHomeBaseIds.has(homeBaseId)) {
                const match = itinerary.matches?.find(m => 
                  String(m.matchId) === matchId || 
                  String(m.fixture?.id) === matchId
                );
                if (match?.planning?.homeBaseId && 
                    String(match.planning.homeBaseId) === homeBaseId) {
                  filteredTimes[matchId] = travelTime;
                }
              }
            }
          });
          setTravelTimes(filteredTimes);
        } else {
          setTravelTimes({});
        }
      } finally {
        setTravelTimesLoading(false);
      }
    };

    fetchTravelTimes();
  }, [
    itineraryId, 
    itinerary?.matches, 
    // Use a stringified version of home base IDs to detect changes
    // This ensures we recalculate when home bases are added, updated, or deleted
    itinerary?.homeBases?.map(hb => `${hb._id || hb.id}-${hb.coordinates?.lat}-${hb.coordinates?.lng}`).join(',')
  ]);

  // Recommendations are automatically fetched by useRecommendations hook

  // Refetch recommendations when screen comes into focus (to sync with other screens)
  // Use a ref to track if this is the initial mount to avoid double-fetching
  const isInitialMount = React.useRef(true);
  const lastRefreshTime = React.useRef(null);
  
  useFocusEffect(
    React.useCallback(() => {
      // Skip the first focus (initial mount) - recommendations are already fetched in useEffect
      if (isInitialMount.current) {
        isInitialMount.current = false;
        lastRefreshTime.current = Date.now();
        return;
      }
      
      // Only refetch if we have an itinerary loaded and we're coming back to the screen
      if (itineraryId && itinerary) {
        // Only refresh if data is stale (older than 5 minutes)
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000;
        const isStale = !lastRefreshTime.current || (now - lastRefreshTime.current) > fiveMinutes;
        
        if (isStale) {
          // Use cached data if available, don't force refresh
          refetchRecommendations(false);
          lastRefreshTime.current = now;
        } else {
          // Data is fresh, use cached recommendations
          // The hook will use cached data automatically
        }
      }
    }, [itineraryId, itinerary, refetchRecommendations])
  );

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
  const transformedMatches = useMemo(() => {
    return transformMatchesForMap(itinerary?.matches || []);
  }, [itinerary?.matches]);

  // Transform recommendations to the format expected by the map
  // Filter out recommendations that are already in the itinerary (as matches)
  // Memoize to ensure map updates when recommendations or itinerary changes
  const transformedRecommendations = useMemo(() => {
    if (!recommendations || recommendations.length === 0) {
      return [];
    }
    
    // Get match IDs that are already in the itinerary
    const existingMatchIds = new Set();
    if (itinerary?.matches && itinerary.matches.length > 0) {
      itinerary.matches.forEach(match => {
        const matchId = match.matchId || match.fixture?.id || match.id;
        if (matchId) {
          existingMatchIds.add(String(matchId));
        }
      });
    }
    
    // Filter out recommendations that are already in the itinerary
    const filteredRecommendations = recommendations.filter(rec => {
      const recMatchId = rec.matchId || rec.match?.id || rec.match?.fixture?.id;
      if (!recMatchId) {
        return true; // Keep if we can't determine match ID
      }
      return !existingMatchIds.has(String(recMatchId));
    });
    
    return transformRecommendationsForMap(filteredRecommendations);
  }, [recommendations, itinerary?.matches]);

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
      await dismissRecommendation(recommendation);
      // Close the card overlay
      setSelectedRecommendation(null);
    } catch (err) {
      console.error('Error dismissing recommendation:', err);
      Alert.alert('Error', 'Failed to dismiss recommendation');
    }
  };

  // Handle adding recommendation to trip
  const handleAddRecommendationToTrip = async (recommendation) => {
    // Prevent multiple concurrent calls
    if (addingMatchRef.current) {
      console.log('⚠️ Add match operation already in progress, ignoring duplicate call');
      return;
    }

    try {
      addingMatchRef.current = true;
      setAddingMatch(true);
      
      await addRecommendationToTrip(recommendation, addMatchToItinerary);
      
      // Close the card overlay
      setSelectedRecommendation(null);

      // The itinerary context is automatically updated by addMatchToItinerary
      // The useEffect above will sync the local state when context updates
      // The recommendations list is already updated by the hook (removed from list)
      // The transformedRecommendations memo will automatically filter it out
      // Trigger map auto-fit to show the new match
      setAutoFitKey(prev => prev + 1);
    } catch (err) {
      console.error('Error adding recommendation to trip:', err);
      Alert.alert('Error', 'Failed to add match to trip');
    } finally {
      addingMatchRef.current = false;
      setAddingMatch(false);
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
          matches={transformedMatches}
          recommendedMatches={transformedRecommendations}
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
              style={[
                styles.addToTripButton,
                addingMatch && styles.addToTripButtonDisabled
              ]}
              onPress={() => handleAddRecommendationToTrip(selectedRecommendation)}
              disabled={addingMatch}
            >
              <Text style={styles.addToTripButtonText}>
                {addingMatch ? 'Adding...' : 'Add to Trip'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.dismissRecommendationButton,
                addingMatch && styles.dismissRecommendationButtonDisabled
              ]}
              onPress={() => handleDismissRecommendation(selectedRecommendation)}
              disabled={addingMatch}
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
  addToTripButtonDisabled: {
    backgroundColor: '#9e9e9e',
    opacity: 0.6,
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
  dismissRecommendationButtonDisabled: {
    backgroundColor: '#e0e0e0',
    opacity: 0.6,
  },
  dismissRecommendationButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ItineraryMapScreen;
