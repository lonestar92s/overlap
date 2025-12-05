import React, { useState, useRef, useEffect, useCallback, useMemo, useImperativeHandle, forwardRef } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity, Text, Platform } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { debounce } from 'lodash';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { calculateAdaptiveBounds } from '../utils/adaptiveBounds';

const MatchMapView = forwardRef(({
  matches = [],
  recommendedMatches = [],
  homeBases = [],
  initialRegion = null,
  onRegionChange = () => {},
  onMarkerPress = () => {},
  onRecommendedMatchPress = () => {},
  onHomeBasePress = () => {},
  selectedMatchId = null,
  travelTimes = {},
  style = {},
  showLocationButton = true,
  onMapPress = () => {},
}, ref) => {
  const mapRef = useRef();
  
  const defaultRegion = {
    latitude: 51.5074, // London default
    longitude: -0.1278,
    latitudeDelta: 0.5,
    longitudeDelta: 0.5,
  };
  
  const [region, setRegion] = useState(initialRegion || defaultRegion);
  const [userLocation, setUserLocation] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const isAnimatingRef = useRef(false);

  // Update region when initialRegion prop changes
  useEffect(() => {
    if (initialRegion) {
      setRegion(initialRegion);
    }
  }, [initialRegion]);

  // Request location permission and get user location
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          return;
        }

        const location = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      } catch (error) {
      }
    })();
  }, []);

  // Debounced region change handler to prevent rapid updates
  const debouncedRegionChange = useCallback(
    debounce((newRegion) => {
      // Calculate bounds from region
      const bounds = {
        northeast: {
          lat: newRegion.latitude + (newRegion.latitudeDelta / 2),
          lng: newRegion.longitude + (newRegion.longitudeDelta / 2),
        },
        southwest: {
          lat: newRegion.latitude - (newRegion.latitudeDelta / 2),
          lng: newRegion.longitude - (newRegion.longitudeDelta / 2),
        }
      };

      onRegionChange(newRegion, bounds);
    }, 100), // Reduced from 500ms to 100ms for more responsive updates
    [onRegionChange]
  );

  // Handle region change (map movement)
  const handleRegionChangeComplete = (newRegion) => {
    setRegion(newRegion);
    
    // Use debounced callback to prevent excessive API calls
    // The debounce delay (100ms) is short enough for responsive updates
    // while preventing rapid-fire requests during pan/zoom gestures
    debouncedRegionChange(newRegion);
  };

  // Handle map ready
  const handleMapReady = () => {
    setMapReady(true);
  };

  // Handle marker press
  const handleMarkerPress = useCallback((match) => {
    // Prevent marker presses during map animations
    if (isAnimatingRef.current) {
      return;
    }
    
    // Validate match data
    if (!match || !match.fixture) {
      if (__DEV__) {
        console.warn('MapView: Invalid match data in handleMarkerPress');
      }
      return;
    }
    
    onMarkerPress(match);
  }, [onMarkerPress]);

  // Handle map press (close overlays, etc.)
  const handleMapPress = useCallback((event) => {
    // Improved marker press detection - check multiple event properties
    const nativeEvent = event?.nativeEvent;
    if (!nativeEvent) {
      onMapPress();
      return;
    }
    
    // Check for marker press indicators
    const action = nativeEvent.action;
    const coordinate = nativeEvent.coordinate;
    
    // If action is explicitly marker-press, ignore
    if (action === 'marker-press') {
      return;
    }
    
    // If coordinate exists but no action, it might be a marker press
    // (marker presses sometimes don't have the action set correctly)
    // Only proceed with map press if we're sure it's not a marker
    onMapPress();
  }, [onMapPress]);

  // Center map on specific location
  const centerMap = useCallback((latitude, longitude, animated = true) => {
    const newRegion = {
      latitude,
      longitude,
      latitudeDelta: region.latitudeDelta,
      longitudeDelta: region.longitudeDelta,
    };

    if (mapRef.current) {
      if (animated) {
        isAnimatingRef.current = true;
        mapRef.current.animateToRegion(newRegion, 1000);
        // Reset animation flag after animation completes
        setTimeout(() => {
          isAnimatingRef.current = false;
        }, 1100); // Slightly longer than animation duration
      } else {
        mapRef.current.setRegion(newRegion);
      }
    }
  }, [region.latitudeDelta, region.longitudeDelta]);

  // Fit map to show all matches and home bases using adaptive bounds
  const fitToMatches = useCallback(() => {
    if (!mapRef.current) return;

    // Collect coordinates from matches
    const matchCoordinates = (matches || [])
      .filter(match => {
        const venue = match.fixture?.venue;
        return venue?.coordinates && venue.coordinates.length === 2;
      })
      .map(match => ({
        latitude: match.fixture.venue.coordinates[1],  // GeoJSON: [lon, lat]
        longitude: match.fixture.venue.coordinates[0], // So lat is index 1, lon is index 0
      }));

    // Collect coordinates from home bases
    const homeBaseCoordinates = (homeBases || [])
      .filter(homeBase => {
        const coords = homeBase.coordinates;
        return coords && typeof coords.lat === 'number' && typeof coords.lng === 'number';
      })
      .map(homeBase => ({
        latitude: homeBase.coordinates.lat,
        longitude: homeBase.coordinates.lng,
      }));

    // Combine all coordinates
    const allCoordinates = [...matchCoordinates, ...homeBaseCoordinates];

    if (allCoordinates.length === 0) return;

    // Use adaptive bounds calculation for better coverage
    const adaptiveRegion = calculateAdaptiveBounds(allCoordinates, {
      minSpan: 0.1,
      maxSpan: 5.0,
      basePadding: 2.0,
      urbanPadding: 3.0,
      ruralPadding: 1.8,
    });
    
    isAnimatingRef.current = true;
    mapRef.current.animateToRegion(adaptiveRegion, 600);
    // Reset animation flag after animation completes
    setTimeout(() => {
      isAnimatingRef.current = false;
    }, 700); // Slightly longer than animation duration
  }, [matches, homeBases]);

  // Expose methods via ref for parent components
  useImperativeHandle(ref, () => ({
    centerMap,
    fitToMatches,
    getMapRef: () => mapRef.current,
    // Pass-through methods for direct MapView access
    animateToRegion: (region, duration = 1000) => {
      if (mapRef.current) {
        isAnimatingRef.current = true;
        mapRef.current.animateToRegion(region, duration);
        // Reset animation flag after animation completes
        setTimeout(() => {
          isAnimatingRef.current = false;
        }, duration + 100); // Slightly longer than animation duration
      }
    },
    setRegion: (region) => {
      if (mapRef.current) {
        mapRef.current.setRegion(region);
      }
    },
  }), [centerMap, fitToMatches]);

  // Handle home base press
  const handleHomeBasePress = useCallback((homeBase) => {
    // Prevent presses during map animations
    if (isAnimatingRef.current) {
      return;
    }
    
    onHomeBasePress(homeBase);
  }, [onHomeBasePress]);

  // Handle recommended match marker press
  const handleRecommendedMatchPress = useCallback((match) => {
    // Prevent marker presses during map animations
    if (isAnimatingRef.current) {
      return;
    }
    onRecommendedMatchPress(match);
  }, [onRecommendedMatchPress]);

  // Helper function to generate venue group key (prioritizes coordinates for physical location matching)
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

  // Render match markers with memoization - grouped by venue
  const markers = useMemo(() => {
    if (!matches || matches.length === 0) {
      if (__DEV__) {
        console.log('MapView: No matches, clearing all markers');
      }
      return null;
    }
    
    const validMatches = matches.filter(match => {
      const venue = match.fixture?.venue;
      if (!venue || !venue.coordinates || !Array.isArray(venue.coordinates)) {
        return false;
      }
      
      // Ensure coordinates are valid numbers and within reasonable bounds
      const [lon, lat] = venue.coordinates;
      if (typeof lon !== 'number' || typeof lat !== 'number') {
        return false;
      }
      
      // Check if coordinates are within reasonable world bounds
      if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
        return false;
      }
      
      return true;
    });

    // Group matches by venue (same logic as MapResultsScreen)
    const venueGroupsMap = new Map();
    validMatches.forEach((match) => {
      const key = getVenueGroupKey(match);
      if (!key) return;
      
      if (!venueGroupsMap.has(key)) {
        venueGroupsMap.set(key, {
          key,
          venue: match.fixture.venue,
          matches: []
        });
      }
      venueGroupsMap.get(key).matches.push(match);
    });

    // Create one marker per venue group
    return Array.from(venueGroupsMap.values()).map((venueGroup) => {
      // Use the first match from the venue group for marker display and selection check
      const firstMatch = venueGroup.matches[0];
      const venue = firstMatch.fixture.venue;
      const isSelected = venueGroup.matches.some(m => m.fixture.id === selectedMatchId);
      const coordinate = {
        latitude: venue.coordinates[1],  // GeoJSON: [lon, lat]
        longitude: venue.coordinates[0], // So lat is index 1, lon is index 0
      };
      
      // Use venue key for marker identifier
      const markerKey = `venue-${venueGroup.key}`;
      
      return (
        <Marker
          key={markerKey}
          coordinate={coordinate}
          onPress={() => handleMarkerPress(firstMatch)}
          pinColor={isSelected ? '#FF6B6B' : '#1976d2'}
          tracksViewChanges={false}
          identifier={markerKey}
        />
      );
    });
  }, [matches, selectedMatchId, handleMarkerPress, getVenueGroupKey]);

  // Render recommended match markers with memoization (yellow pins)
  const recommendedMarkers = useMemo(() => {
    if (!recommendedMatches || recommendedMatches.length === 0) {
      return null;
    }
    
    const validRecommendedMatches = recommendedMatches.filter(match => {
      const venue = match.fixture?.venue;
      if (!venue || !venue.coordinates || !Array.isArray(venue.coordinates)) {
        return false;
      }
      
      // Ensure coordinates are valid numbers and within reasonable bounds
      const [lon, lat] = venue.coordinates;
      if (typeof lon !== 'number' || typeof lat !== 'number') {
        return false;
      }
      
      // Check if coordinates are within reasonable world bounds
      if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
        return false;
      }
      
      return true;
    });
    
    return validRecommendedMatches.map(match => {
      const venue = match.fixture.venue;
      const coordinate = {
        latitude: venue.coordinates[1],  // GeoJSON: [lon, lat]
        longitude: venue.coordinates[0], // So lat is index 1, lon is index 0
      };
      
      const markerKey = `recommended-${String(match.fixture.id)}`;
      
      return (
        <Marker
          key={markerKey}
          coordinate={coordinate}
          onPress={() => handleRecommendedMatchPress(match)}
          pinColor="#FFD700" // Yellow color for recommended matches (using design token: colors.markers.recommended)
          tracksViewChanges={false}
          identifier={markerKey}
        />
      );
    });
  }, [recommendedMatches, handleRecommendedMatchPress]);

  // Render home base markers with memoization
  const homeBaseMarkers = useMemo(() => {
    if (!homeBases || homeBases.length === 0) {
      return null;
    }
    
    const validHomeBases = homeBases.filter(homeBase => {
      const coords = homeBase.coordinates;
      if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number') {
        return false;
      }
      
      // Check if coordinates are within reasonable world bounds
      if (coords.lng < -180 || coords.lng > 180 || coords.lat < -90 || coords.lat > 90) {
        return false;
      }
      
      return true;
    });
    
    return validHomeBases.map(homeBase => {
      const coordinate = {
        latitude: homeBase.coordinates.lat,
        longitude: homeBase.coordinates.lng,
      };
      
      const markerKey = `homebase-${String(homeBase._id || homeBase.id || homeBase.name)}`;
      
      return (
        <Marker
          key={markerKey}
          coordinate={coordinate}
          onPress={() => handleHomeBasePress(homeBase)}
          pinColor="#4CAF50" // Green color for home bases
          tracksViewChanges={false}
          identifier={markerKey}
        />
      );
    });
  }, [homeBases, handleHomeBasePress]);

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : MapView.PROVIDER_DEFAULT}
        initialRegion={region}
        onRegionChangeComplete={handleRegionChangeComplete}
        onMapReady={handleMapReady}
        onPress={handleMapPress}
        showsUserLocation={!!userLocation}
        showsMyLocationButton={false} // Disable built-in button to use custom one
        showsCompass={false}
        toolbarEnabled={false}
        loadingEnabled={true}
        mapType="standard"
        moveOnMarkerPress={false} // Prevent map movement when pressing markers
      >
        {markers}
        {recommendedMarkers}
        {homeBaseMarkers}
      </MapView>
      
      {/* Custom Location Button */}
      {showLocationButton && (
        <TouchableOpacity
          style={[
            styles.locationButton,
            !userLocation && styles.locationButtonInactive
          ]}
          onPress={() => {
            if (userLocation) {
              centerMap(userLocation.latitude, userLocation.longitude, true);
            } else {
              // Request location permission and get current location
              (async () => {
                try {
                  const { status } = await Location.requestForegroundPermissionsAsync();
                  if (status === 'granted') {
                    const location = await Location.getCurrentPositionAsync({});
                    const newUserLocation = {
                      latitude: location.coords.latitude,
                      longitude: location.coords.longitude,
                    };
                    setUserLocation(newUserLocation);
                    centerMap(newUserLocation.latitude, newUserLocation.longitude, true);
                  } else {
                    Alert.alert('Permission Denied', 'Location permission is required to use this feature.');
                  }
                } catch (error) {
                  Alert.alert('Error', 'Failed to get your current location.');
                }
              })();
            }
          }}
        >
          <Icon 
            name="navigation" 
            size={24} 
            color={userLocation ? '#1976d2' : '#999'} 
          />
        </TouchableOpacity>
      )}
    </View>
  );
});

MatchMapView.displayName = 'MatchMapView';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  locationButton: {
    position: 'absolute',
    bottom: 120, // Moved up to be above the bottom sheet
    right: 12, // Moved closer to the right edge (was 20)
    width: 44,
    height: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  locationButtonInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
});

export default MatchMapView;
 