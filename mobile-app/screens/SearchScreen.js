import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { CommonActions } from '@react-navigation/native';
import * as Location from 'expo-location';
import PopularMatches from '../components/PopularMatches';
import PopularMatchModal from '../components/PopularMatchModal';
import LocationSearchModal from '../components/LocationSearchModal';
import TripCountdownWidget from '../components/TripCountdownWidget';
import MatchMapView from '../components/MapView';
import MatchCard from '../components/MatchCard';
import ApiService from '../services/api';
import { FEATURE_FLAGS } from '../utils/featureFlags';
import { getMatchStatus } from '../utils/matchStatus';
import { colors, spacing, typography, borderRadius, shadows } from '../styles/designTokens';

// Default to London if location permissions denied
const DEFAULT_LOCATION = {
  latitude: 51.5074,
  longitude: -0.1278,
  city: 'London',
};

// Popular destinations data
const popularDestinations = [
  { 
    id: '1', 
    city: 'Madrid',
    country: 'Spain',
    lat: 40.4168,
    lon: -3.7038,
    image: 'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=400&h=300&fit=crop'
  },
  { 
    id: '2', 
    city: 'Rome',
    country: 'Italy',
    lat: 41.9028,
    lon: 12.4964,
    image: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=400&h=300&fit=crop'
  },
  { 
    id: '3', 
    city: 'Berlin',
    country: 'Germany',
    lat: 52.5200,
    lon: 13.4050,
    image: 'https://images.unsplash.com/photo-1560969184-10fe8719e047?w=400&h=300&fit=crop'
  },
  { 
    id: '4', 
    city: 'Milan',
    country: 'Italy',
    lat: 45.4642,
    lon: 9.1900,
    image: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=400&h=300&fit=crop'
  },
  { 
    id: '5', 
    city: 'Dortmund',
    country: 'Germany',
    lat: 51.5136,
    lon: 7.4653,
    image: 'https://images.unsplash.com/photo-1560969184-10fe8719e047?w=400&h=300&fit=crop'
  },
];

const SearchScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  
  // Map-based home screen state (only used if flag is enabled)
  const [userLocation, setUserLocation] = useState(null);
  const [userCity, setUserCity] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mapRegion, setMapRegion] = useState(null);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const matchesCacheRef = useRef(null);
  const hasSearchedRef = useRef(false);

  // Original home screen state (only used if flag is disabled)
  const [showLocationSearchModal, setShowLocationSearchModal] = useState(false);
  const [initialLocation, setInitialLocation] = useState(null);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [selectedMatchIndex, setSelectedMatchIndex] = useState(0);
  const [popularMatches, setPopularMatches] = useState([]);

  // Map-based home screen: Get user location and search for matches
  useEffect(() => {
    if (!FEATURE_FLAGS.enableMapHomeScreen) {
      setLoading(false);
      return;
    }

    if (hasSearchedRef.current) {
      return; // Already searched this session
    }

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        let locationObj = DEFAULT_LOCATION;
        let city = DEFAULT_LOCATION.city;

        if (status === 'granted') {
          try {
            const location = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });

            const { latitude, longitude } = location.coords;
            locationObj = { latitude, longitude };

            // Reverse geocode to get city
            try {
              const reverseGeocode = await Location.reverseGeocodeAsync({
                latitude,
                longitude,
              });

              if (reverseGeocode && reverseGeocode.length > 0) {
                const address = reverseGeocode[0];
                city = address.city || address.subAdministrativeArea || address.administrativeArea || DEFAULT_LOCATION.city;
              }
            } catch (error) {
              console.error('Reverse geocoding error:', error);
            }
          } catch (error) {
            console.error('Location error:', error);
          }
        }

        setUserLocation(locationObj);
        setUserCity(city);

        // Set initial map region
        setMapRegion({
          latitude: locationObj.latitude,
          longitude: locationObj.longitude,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        });

        // Search for matches within 3 days (cached for session)
        await searchMatchesInCity(locationObj.latitude, locationObj.longitude, city);
        hasSearchedRef.current = true;
      } catch (error) {
        console.error('Error initializing location:', error);
        setUserLocation(DEFAULT_LOCATION);
        setUserCity(DEFAULT_LOCATION.city);
        setMapRegion({
          latitude: DEFAULT_LOCATION.latitude,
          longitude: DEFAULT_LOCATION.longitude,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        });
        await searchMatchesInCity(DEFAULT_LOCATION.latitude, DEFAULT_LOCATION.longitude, DEFAULT_LOCATION.city);
        hasSearchedRef.current = true;
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const searchMatchesInCity = async (lat, lon, city) => {
    try {
      // Check cache first
      if (matchesCacheRef.current) {
        setMatches(matchesCacheRef.current);
        return;
      }

      // Calculate date range: today only (same day for both start and end)
      const today = new Date();
      const dateFrom = today.toISOString().split('T')[0];
      const dateTo = today.toISOString().split('T')[0];

      // Create bounds around location (small radius for city-level search)
      const bounds = {
        northeast: {
          lat: lat + 0.1, // ~10km radius
          lng: lon + 0.1,
        },
        southwest: {
          lat: lat - 0.1,
          lng: lon - 0.1,
        },
      };

      const response = await ApiService.searchMatchesByBounds({
        bounds,
        dateFrom,
        dateTo,
      });

      if (response.success && response.data) {
        // Filter matches to only those in the user's city
        let filteredMatches = response.data;
        
        if (city) {
          filteredMatches = response.data.filter(match => {
            const matchCity = match.fixture?.venue?.city;
            return matchCity && 
                   matchCity.toLowerCase().includes(city.toLowerCase());
          });
        }

        // Cache the results for the session
        matchesCacheRef.current = filteredMatches;
        setMatches(filteredMatches);
      } else {
        matchesCacheRef.current = [];
        setMatches([]);
      }
    } catch (error) {
      console.error('Error searching matches:', error);
      matchesCacheRef.current = [];
      setMatches([]);
    }
  };

  const handleDestinationPress = (destination) => {
    // Convert destination to location object format expected by LocationSearchModal
    const location = {
      city: destination.city,
      country: destination.country,
      lat: destination.lat,
      lon: destination.lon,
      place_id: `${destination.city.toLowerCase()}-${destination.country.toLowerCase()}`,
    };
    setInitialLocation(location);
    setShowLocationSearchModal(true);
  };

  const handleLocationModalClose = () => {
    setShowLocationSearchModal(false);
    // Clear initial location after a brief delay to allow modal to process it
    setTimeout(() => {
      setInitialLocation(null);
    }, 100);
  };

  const renderDestinationCard = ({ item }) => (
    <TouchableOpacity 
      style={styles.destinationCard}
      onPress={() => handleDestinationPress(item)}
      activeOpacity={0.7}
    >
      <Image 
        source={{ uri: item.image }} 
        style={styles.cardImage}
        resizeMode="cover"
      />
      <View style={styles.cardContent}>
        <Text style={styles.cardCity}>{item.city}</Text>
        <Text style={styles.cardCountry}>{item.country}</Text>
      </View>
    </TouchableOpacity>
  );

  const handleMatchPress = (match) => {
    // Find the index of the selected match in the popularMatches array
    const matchIndex = popularMatches.findIndex(m => 
      (m.fixture?.id && match.fixture?.id && m.fixture.id === match.fixture.id) ||
      (m.id && match.id && m.id === match.id)
    );
    
    if (matchIndex !== -1 && popularMatches.length > 0) {
      setSelectedMatchIndex(matchIndex);
      setShowMatchModal(true);
    } else {
      // Fallback: if match not found in array, navigate to MapResults
      navigation.navigate('SearchTab', {
        screen: 'MapResults',
        params: {
          matches: [match],
          initialRegion: match.fixture?.venue?.coordinates ? {
            latitude: match.fixture.venue.coordinates[1],
            longitude: match.fixture.venue.coordinates[0],
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          } : null,
        }
      });
    }
  };

  const handleMatchesLoaded = (matches) => {
    setPopularMatches(matches);
  };

  const handleModalClose = () => {
    setShowMatchModal(false);
  };

  const handleModalNavigate = (newIndex) => {
    if (newIndex >= 0 && newIndex < popularMatches.length) {
      setSelectedMatchIndex(newIndex);
    }
  };

  const handleMarkerPress = (match) => {
    setSelectedMatch(match);
  };

  const handleCloseMatchCard = () => {
    setSelectedMatch(null);
  };

  const handleTripPress = (trip) => {
    // Navigate to trip overview screen in TripsTab, ensuring TripsList is in the stack
    // so the back button goes to TripsList instead of SearchScreen
    // First navigate to TripsTab (which shows TripsList by default)
    navigation.navigate('TripsTab');
    // Then use requestAnimationFrame to ensure the tab switch completes
    // before navigating to TripOverview, which will push it on top of TripsList
    requestAnimationFrame(() => {
      navigation.navigate('TripsTab', {
        screen: 'TripOverview',
        params: { itineraryId: trip.id || trip._id }
      });
    });
  };

  // Render map-based home screen
  if (FEATURE_FLAGS.enableMapHomeScreen) {
    if (loading) {
      return (
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.mapContainer}>
          {mapRegion && (
            <MatchMapView
              matches={matches}
              initialRegion={mapRegion}
              onMarkerPress={handleMarkerPress}
              showLocationButton={true}
              style={styles.map}
            />
          )}
        </View>

        <View style={[styles.mapOverlay, { paddingTop: insets.top + spacing.md }]}>
          <TouchableOpacity
            style={[styles.startLapButton, styles.startLapButtonOverlay]}
            onPress={() => setShowLocationSearchModal(true)}
            activeOpacity={0.7}
          >
            <MaterialIcons name="search" size={25} color="rgba(0, 0, 0, 0.5)" />
            <Text style={styles.startLapButtonText}>Start your lap</Text>
          </TouchableOpacity>
        </View>

        <TripCountdownWidget onTripPress={handleTripPress} />

        {/* Match Card Overlay - shows when a pin is tapped (centered to avoid blocking countdown) */}
        {selectedMatch && (() => {
          const matchStatus = getMatchStatus(selectedMatch);
          const isCompleted = matchStatus.type === 'completed';
          
          // Debug: Check if match has score data
          if (__DEV__ && isCompleted) {
            console.log('🔍 Match score data:', {
              hasScore: !!selectedMatch.score,
              score: selectedMatch.score,
              fullTime: selectedMatch.score?.fullTime,
              goals: selectedMatch.goals,
              fixture: selectedMatch.fixture
            });
          }
          
          return (
            <>
              {/* Backdrop - tap outside to close */}
              <TouchableOpacity 
                style={styles.matchCardBackdrop}
                activeOpacity={1}
                onPress={handleCloseMatchCard}
              />
              {/* Match Card */}
              <View style={[styles.matchCardOverlay, { 
                top: insets.top + spacing.xl + 60, // Position below search button, above countdown
              }]}>
                <MatchCard
                  match={selectedMatch}
                  onPress={() => {}} // Don't close on card tap
                  variant="default"
                  showHeart={!isCompleted} // Only show heart for non-completed matches
                  showResults={isCompleted} // Show score for completed matches
                />
              </View>
            </>
          );
        })()}

        <LocationSearchModal
          visible={showLocationSearchModal}
          onClose={handleLocationModalClose}
          navigation={navigation}
          initialLocation={initialLocation}
        />
      </SafeAreaView>
    );
  }

  // Render original home screen
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.startLapButton}
          onPress={() => setShowLocationSearchModal(true)}
          activeOpacity={0.7}
        >
          <MaterialIcons name="search" size={25} color="rgba(0, 0, 0, 0.5)" />
          <Text style={styles.startLapButtonText}>Start your lap</Text>
        </TouchableOpacity>

        <TripCountdownWidget onTripPress={handleTripPress} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Popular Destinations</Text>
          <FlatList
            data={popularDestinations}
            renderItem={renderDestinationCard}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          />
        </View>

        <View style={styles.section}>
          <PopularMatches 
            onMatchPress={handleMatchPress}
            onMatchesLoaded={handleMatchesLoaded}
          />
        </View>
      </ScrollView>

      <LocationSearchModal
        visible={showLocationSearchModal}
        onClose={handleLocationModalClose}
        navigation={navigation}
        initialLocation={initialLocation}
      />

      <PopularMatchModal
        visible={showMatchModal}
        matches={popularMatches}
        currentMatchIndex={selectedMatchIndex}
        onClose={handleModalClose}
        onNavigate={handleModalNavigate}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  mapOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    paddingHorizontal: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  startLapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 1,
    borderColor: colors.text.primary,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    height: 49,
    gap: spacing.sm,
  },
  startLapButtonText: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
  },
  startLapButtonOverlay: {
    marginHorizontal: 0,
    marginBottom: 0,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.h2,
    fontWeight: '600',
    marginBottom: spacing.md,
    marginLeft: spacing.lg,
    color: colors.text.primary,
  },
  horizontalList: {
    paddingHorizontal: spacing.lg,
  },
  destinationCard: {
    width: 150,
    marginRight: spacing.md,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    ...shadows.sm,
  },
  cardImage: {
    width: '100%',
    height: 120,
  },
  cardContent: {
    padding: spacing.md,
  },
  cardCity: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  cardCountry: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  matchCardBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    zIndex: 1,
  },
  matchCardOverlay: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    // No backgroundColor - MatchCard has its own background
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    ...shadows.lg,
    maxWidth: '100%',
    alignSelf: 'center',
    zIndex: 2,
  },
});

export default SearchScreen;
