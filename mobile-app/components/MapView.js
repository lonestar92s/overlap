import React, { useState, useRef, useEffect, useCallback, useMemo, useImperativeHandle, forwardRef } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity, Text, Platform } from 'react-native';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { debounce } from 'lodash';
import Icon from 'react-native-vector-icons/MaterialIcons';
import TravelTimeDisplay from './TravelTimeDisplay';
import { calculateAdaptiveBounds } from '../utils/adaptiveBounds';
import { colors, spacing, typography } from '../styles/designTokens';

const MatchMapView = forwardRef(({
  matches = [],
  homeBases = [],
  initialRegion = null,
  onRegionChange = () => {},
  onMarkerPress = () => {},
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

  // Render match markers with memoization
  const markers = useMemo(() => {
    if (!matches || matches.length === 0) {
      console.log('MapView: No matches, clearing all markers');
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
    

    
    // Use stable keys based on fixture ID only to prevent unnecessary re-renders
    return validMatches.map(match => {
      const venue = match.fixture.venue;
      const isSelected = selectedMatchId === match.fixture.id;
      const coordinate = {
        latitude: venue.coordinates[1],  // GeoJSON: [lon, lat]
        longitude: venue.coordinates[0], // So lat is index 1, lon is index 0
      };
      
      // Use fixture ID as key for stability - this prevents React from recreating markers
      // when the matches array reference changes but the actual matches are the same
      const markerKey = `match-${String(match.fixture.id)}`;
      const matchId = String(match.fixture.id);
      const travelTime = travelTimes[matchId] || travelTimes[match.matchId] || null;
      
      return (
        <Marker
          key={markerKey}
          coordinate={coordinate}
          onPress={() => handleMarkerPress(match)}
          pinColor={isSelected ? '#FF6B6B' : '#1976d2'}
          tracksViewChanges={false}
          identifier={markerKey}
        >
          <Callout>
            <View style={styles.calloutContainer}>
              <Text style={styles.calloutTitle}>
                {match.teams?.home?.name || 'Home'} vs {match.teams?.away?.name || 'Away'}
              </Text>
              {match.fixture?.venue?.name && (
                <Text style={styles.calloutVenue}>{match.fixture.venue.name}</Text>
              )}
              {travelTime && (
                <View style={styles.calloutTravelTime}>
                  <TravelTimeDisplay travelTime={travelTime} />
                </View>
              )}
            </View>
          </Callout>
        </Marker>
      );
    });
  }, [matches, selectedMatchId, handleMarkerPress, travelTimes]);

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
  calloutContainer: {
    padding: spacing.sm,
    minWidth: 150,
    maxWidth: 200,
  },
  calloutTitle: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  calloutVenue: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  calloutTravelTime: {
    marginTop: spacing.xs,
  },
});

export default MatchMapView;
 