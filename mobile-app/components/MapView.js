import React, { useState, useRef, useEffect, useCallback, useMemo, useImperativeHandle, forwardRef } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity, Text, Platform } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { debounce } from 'lodash';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { calculateAdaptiveBounds } from '../utils/adaptiveBounds';

const MatchMapView = forwardRef(({
  matches = [],
  initialRegion = null,
  onRegionChange = () => {},
  onMarkerPress = () => {},
  selectedMatchId = null,
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

  // Fit map to show all matches using adaptive bounds
  const fitToMatches = useCallback(() => {
    if (!matches || matches.length === 0 || !mapRef.current) return;

    const coordinates = matches
      .filter(match => {
        const venue = match.fixture?.venue;
        return venue?.coordinates && venue.coordinates.length === 2;
      })
      .map(match => ({
        latitude: match.fixture.venue.coordinates[1],  // GeoJSON: [lon, lat]
        longitude: match.fixture.venue.coordinates[0], // So lat is index 1, lon is index 0
      }));

    if (coordinates.length === 0) return;

    // Use adaptive bounds calculation for better match coverage
    const adaptiveRegion = calculateAdaptiveBounds(coordinates, {
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
  }, [matches]);

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
      
      return (
        <Marker
          key={markerKey}
          coordinate={coordinate}
          onPress={() => handleMarkerPress(match)}
          pinColor={isSelected ? '#FF6B6B' : '#1976d2'}
          tracksViewChanges={false}
          identifier={markerKey}
        />
      );
    });
  }, [matches, selectedMatchId, handleMarkerPress]);

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
 