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

    // Collect coordinates from matches with strict validation
    const matchCoordinates = (matches || [])
      .filter(match => {
        const venue = match?.fixture?.venue;
        if (!venue || !venue.coordinates || !Array.isArray(venue.coordinates) || venue.coordinates.length !== 2) {
          return false;
        }
        
        const [lon, lat] = venue.coordinates;
        
        // Validate coordinates are valid numbers (not null, undefined, or NaN)
        if (typeof lon !== 'number' || typeof lat !== 'number' ||
            isNaN(lon) || isNaN(lat) ||
            lon === null || lat === null ||
            lon === undefined || lat === undefined) {
          if (__DEV__) {
            console.warn('⚠️ Invalid coordinates in fitToMatches, skipping:', {
              match: match?.teams?.home?.name || 'Unknown',
              coordinates: venue.coordinates,
              lon,
              lat
            });
          }
          return false;
        }
        
        // Validate coordinate bounds
        if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
          if (__DEV__) {
            console.warn('⚠️ Coordinates out of bounds in fitToMatches, skipping:', {
              match: match?.teams?.home?.name || 'Unknown',
              lon,
              lat
            });
          }
          return false;
        }
        
        return true;
      })
      .map(match => {
        const [lon, lat] = match.fixture.venue.coordinates;
        return {
          latitude: lat,  // GeoJSON: [lon, lat]
          longitude: lon, // So lat is index 1, lon is index 0
        };
      });

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
    // Reduced maxSpan from 5.0 to 2.0 for better regional zoom (e.g., UK Premier League)
    const adaptiveRegion = calculateAdaptiveBounds(allCoordinates, {
      minSpan: 0.1,
      maxSpan: 2.0,
      basePadding: 1.5,
      urbanPadding: 2.0,
      ruralPadding: 1.5,
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
    if (venue.coordinates && Array.isArray(venue.coordinates) && venue.coordinates.length === 2) {
      const [lon, lat] = venue.coordinates;
      
      // Validate coordinates are valid numbers (not null, undefined, or NaN)
      if (typeof lon !== 'number' || typeof lat !== 'number' ||
          isNaN(lon) || isNaN(lat) ||
          lon === null || lat === null ||
          lon === undefined || lat === undefined) {
        if (__DEV__) {
          console.warn('⚠️ Invalid coordinates in getVenueGroupKey:', {
            match: match?.teams?.home?.name || 'Unknown',
            coordinates: venue.coordinates,
            lon,
            lat
          });
        }
        // Fall through to venue ID check
      } else {
        // Both coordinates are valid numbers - use them
        const roundedLon = Math.round(lon * 1000000) / 1000000;
        const roundedLat = Math.round(lat * 1000000) / 1000000;
        
        // Final validation - ensure rounded values are still valid
        if (!isNaN(roundedLon) && !isNaN(roundedLat)) {
          return `geo:${roundedLon},${roundedLat}`;
        }
      }
    }
    
    // Fallback to venue ID if no coordinates available or coordinates are invalid
    if (venue.id != null && venue.id !== undefined && venue.id !== 'null' && venue.id !== 'undefined') {
      return `id:${venue.id}`;
    }
    
    if (__DEV__) {
      console.warn('⚠️ No valid key for venue:', {
        match: match?.teams?.home?.name || 'Unknown',
        venueId: venue.id,
        hasCoordinates: !!venue.coordinates,
        coordinates: venue.coordinates
      });
    }
    
    return null;
  }, []);

  // Render match markers with memoization - grouped by venue
  const markers = useMemo(() => {
    if (!matches || matches.length === 0) {
      if (__DEV__) {
        console.log('MapView: No matches, clearing all markers');
      }
      return []; // Return empty array instead of null to prevent crashes
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
    // Build array of valid markers only (never include null/undefined)
    const markerArray = [];
    Array.from(venueGroupsMap.values()).forEach((venueGroup) => {
      // CRITICAL: Validate venueGroup.key FIRST - if invalid, skip entirely
      // This prevents creating markers with invalid keys
      if (!venueGroup.key || typeof venueGroup.key !== 'string' || venueGroup.key.length === 0) {
        if (__DEV__) {
          console.warn('⚠️ Invalid venueGroup.key, skipping marker:', {
            key: venueGroup.key,
            venueGroup
          });
        }
        return; // Skip if key is invalid - don't create marker
      }
      
      // Use the first match from the venue group for marker display and selection check
      const firstMatch = venueGroup.matches[0];
      if (!firstMatch || !firstMatch.fixture || !firstMatch.fixture.venue) {
        if (__DEV__) {
          console.warn('⚠️ Invalid firstMatch in venueGroup, skipping marker');
        }
        return; // Skip invalid matches - don't create marker
      }
      
      const venue = firstMatch.fixture.venue;
      if (!venue || !venue.coordinates || !Array.isArray(venue.coordinates) || venue.coordinates.length !== 2) {
        if (__DEV__) {
          console.warn('⚠️ Invalid venue coordinates, skipping marker');
        }
        return; // Skip matches without valid coordinates - don't create marker
      }
      
      const [lon, lat] = venue.coordinates;
      
      // Validate coordinate values before creating marker
      if (typeof lon !== 'number' || typeof lat !== 'number' ||
          isNaN(lon) || isNaN(lat) ||
          lon < -180 || lon > 180 || lat < -90 || lat > 90) {
        if (__DEV__) {
          console.warn('⚠️ Invalid coordinate values, skipping marker:', { lon, lat });
        }
        return; // Skip invalid coordinates - don't create marker
      }
      
      const isSelected = venueGroup.matches.some(m => m.fixture?.id === selectedMatchId);
      const coordinate = {
        latitude: lat,  // GeoJSON: [lon, lat]
        longitude: lon, // So lat is index 1, lon is index 0
      };
      
      // Create markerKey - we know venueGroup.key is valid at this point
      const markerKey = `venue-${venueGroup.key}`;
      
      // Final validation - markerKey should always be valid if venueGroup.key is valid
      if (!markerKey || typeof markerKey !== 'string' || markerKey.length === 0) {
        if (__DEV__) {
          console.warn('⚠️ Invalid markerKey after construction, skipping marker');
        }
        return; // Skip if markerKey is somehow invalid - don't create marker
      }
      
      // All validations passed - create marker
      // At this point, we know:
      // - venueGroup.key is a valid string
      // - markerKey is valid
      // - coordinate is valid
      // - firstMatch is valid
      const markerComponent = (
        <Marker
          key={markerKey}
          coordinate={coordinate}
          onPress={() => handleMarkerPress(firstMatch)}
          pinColor={isSelected ? '#FF6B6B' : '#1976d2'}
          tracksViewChanges={false}
          identifier={markerKey}
        />
      );
      
      // Marker component is always valid at this point (React.createElement never returns null for valid inputs)
      markerArray.push(markerComponent);
    });
    
    // Return array directly - if we did our job, it contains only valid markers
    return markerArray;
  }, [matches, selectedMatchId, handleMarkerPress, getVenueGroupKey]);

  // Render recommended match markers with memoization (yellow pins)
  const recommendedMarkers = useMemo(() => {
    if (!recommendedMatches || recommendedMatches.length === 0) {
      return []; // Return empty array instead of null to prevent crashes
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
    
    // Build array of valid markers only (never include null/undefined)
    const recommendedMarkerArray = [];
    validRecommendedMatches.forEach(match => {
      if (!match || !match.fixture || !match.fixture.venue) {
        return; // Skip invalid matches
      }
      
      const venue = match.fixture.venue;
      if (!venue.coordinates || !Array.isArray(venue.coordinates) || venue.coordinates.length !== 2) {
        return; // Skip matches without valid coordinates
      }
      
      const [lon, lat] = venue.coordinates;
      
      // Validate coordinate values before creating marker
      if (typeof lon !== 'number' || typeof lat !== 'number' ||
          isNaN(lon) || isNaN(lat) ||
          lon < -180 || lon > 180 || lat < -90 || lat > 90) {
        return; // Skip invalid coordinates
      }
      
      const coordinate = {
        latitude: lat,  // GeoJSON: [lon, lat]
        longitude: lon, // So lat is index 1, lon is index 0
      };
      
      const matchId = match.fixture?.id;
      if (!matchId) {
        if (__DEV__) {
          console.warn('⚠️ Match missing fixture.id, skipping recommended marker');
        }
        return; // Skip if no valid ID
      }
      
      const markerKey = `recommended-${String(matchId)}`;
      
      // Validate markerKey is not undefined/null
      if (!markerKey) {
        if (__DEV__) {
          console.warn('⚠️ Invalid markerKey, skipping recommended marker');
        }
        return;
      }
      
      // All validations passed - create marker
      // At this point, we know:
      // - matchId is valid
      // - markerKey is valid
      // - coordinate is valid
      // - match is valid
      const markerComponent = (
        <Marker
          key={markerKey}
          coordinate={coordinate}
          onPress={() => handleRecommendedMatchPress(match)}
          pinColor="#FFD700" // Yellow color for recommended matches (using design token: colors.markers.recommended)
          tracksViewChanges={false}
          identifier={markerKey}
        />
      );
      
      // Marker component is always valid at this point (React.createElement never returns null for valid inputs)
      recommendedMarkerArray.push(markerComponent);
    });
    
    // Return array directly - if we did our job, it contains only valid markers
    return recommendedMarkerArray;
  }, [recommendedMatches, handleRecommendedMatchPress]);

  // Render home base markers with memoization
  const homeBaseMarkers = useMemo(() => {
    if (!homeBases || homeBases.length === 0) {
      return []; // Return empty array instead of null to prevent crashes
    }
    
    const validHomeBases = homeBases.filter(homeBase => {
      const coords = homeBase.coordinates;
      
      // Handle missing or null coordinates
      if (!coords) {
        return false;
      }
      
      // Try to get lat/lng, handling different formats and string-to-number conversion
      let lat = coords.lat;
      let lng = coords.lng;
      
      // Handle alternative property names
      if (lat === undefined || lat === null) {
        lat = coords.latitude;
      }
      if (lng === undefined || lng === null) {
        lng = coords.longitude || coords.lon;
      }
      
      // Convert strings to numbers if needed
      if (typeof lat === 'string') {
        lat = parseFloat(lat);
      }
      if (typeof lng === 'string') {
        lng = parseFloat(lng);
      }
      
      // Validate coordinates are numbers
      if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
        return false;
      }
      
      // Check if coordinates are within reasonable world bounds
      if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        return false;
      }
      
      // Store normalized coordinates back for use in marker creation
      homeBase._normalizedCoords = { lat, lng };
      
      return true;
    });
    
    // Build array of valid markers only (never include null/undefined)
    const homeBaseMarkerArray = [];
    validHomeBases.forEach(homeBase => {
      if (!homeBase) {
        return; // Skip invalid home bases
      }
      
      // Use normalized coordinates if available, otherwise fall back to original
      const coords = homeBase._normalizedCoords || homeBase.coordinates;
      if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number') {
        return; // Skip home bases without valid coordinates
      }
      
      // Validate coordinate values before creating marker
      if (isNaN(coords.lat) || isNaN(coords.lng) ||
          coords.lat < -90 || coords.lat > 90 ||
          coords.lng < -180 || coords.lng > 180) {
        return; // Skip invalid coordinates
      }
      
      const coordinate = {
        latitude: coords.lat,
        longitude: coords.lng,
      };
      
      const homeBaseId = homeBase._id || homeBase.id || homeBase.name;
      if (!homeBaseId) {
        if (__DEV__) {
          console.warn('⚠️ Home base missing ID/name, skipping marker');
        }
        return; // Skip if no valid ID
      }
      
      const markerKey = `homebase-${String(homeBaseId)}`;
      
      // Validate markerKey is not undefined/null
      if (!markerKey) {
        if (__DEV__) {
          console.warn('⚠️ Invalid markerKey, skipping home base marker');
        }
        return;
      }
      
      // All validations passed - create marker
      // At this point, we know:
      // - homeBaseId is valid
      // - markerKey is valid
      // - coordinate is valid
      // - homeBase is valid
      const markerComponent = (
        <Marker
          key={markerKey}
          coordinate={coordinate}
          onPress={() => handleHomeBasePress(homeBase)}
          pinColor="#4CAF50" // Green color for home bases
          tracksViewChanges={false}
          identifier={markerKey}
        />
      );
      
      // Marker component is always valid at this point (React.createElement never returns null for valid inputs)
      homeBaseMarkerArray.push(markerComponent);
    });
    
    // Return array directly - if we did our job, it contains only valid markers
    return homeBaseMarkerArray;
  }, [homeBases, handleHomeBasePress]);

  // Marker arrays are guaranteed to contain only valid Marker components
  // No need for additional filtering - if validation is done correctly, arrays are clean

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
 