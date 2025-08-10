import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity, Text } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { debounce } from 'lodash';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Set your Mapbox access token here
Mapbox.setAccessToken('pk.eyJ1IjoibG9uZXN0YXI5MnMiLCJhIjoiY202ZTB4dm5qMDBkaTJrcHFkeGZpdjlnYiJ9.UZyXT21en4sTzQSOmV5Maw');

const MapboxMapView = ({
  matches = [],
  initialRegion = null,
  onRegionChange = () => {},
  onMarkerPress = () => {},
  selectedMatchId = null,
  style = {},
  showLocationButton = true
}) => {
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

  // Update region when initialRegion prop changes
  useEffect(() => {
    if (initialRegion) {
      setRegion(initialRegion);
    }
  }, [initialRegion]);

  // Auto-fit to markers when matches load
  useEffect(() => {
    if (matches && matches.length > 0 && mapReady && mapRef.current) {
      // Small delay to ensure map is fully ready
      const timer = setTimeout(() => {
        fitToMatches();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [matches, mapReady]);

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
        // Silent fail for location
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
    }, 500),
    [onRegionChange]
  );

  // Handle region change (map movement)
  const handleRegionChangeComplete = (event) => {
    const newRegion = {
      latitude: event.geometry.coordinates[1],
      longitude: event.geometry.coordinates[0],
      latitudeDelta: event.properties.visibleBounds[1] - event.properties.visibleBounds[3],
      longitudeDelta: event.properties.visibleBounds[2] - event.properties.visibleBounds[0],
    };
    
    setRegion(newRegion);
    debouncedRegionChange(newRegion);
  };

  // Handle map ready
  const handleMapReady = () => {
    setMapReady(true);
  };

  // Handle marker press
  const handleMarkerPress = (match) => {
    onMarkerPress(match);
  };

  // Center map to specific coordinates
  const centerMap = (latitude, longitude, animated = true) => {
    if (mapRef.current) {
      mapRef.current.setCamera({
        centerCoordinate: [longitude, latitude],
        zoomLevel: 12,
        animationDuration: animated ? 1000 : 0,
      });
    }
  };

  // Fit map to show all matches
  const fitToMatches = () => {
    if (!matches || matches.length === 0 || !mapRef.current) return;

    const coordinates = matches
      .filter(match => match.fixture?.venue?.coordinates)
      .map(match => [
        match.fixture.venue.coordinates[1], // longitude
        match.fixture.venue.coordinates[0]  // latitude
      ]);

    if (coordinates.length > 0) {
      mapRef.current.fitBounds(coordinates, {
        edgePadding: { top: 100, right: 50, bottom: 200, left: 50 },
        animationDuration: 1000,
      });
    }
  };



  return (
    <View style={[styles.container, style]}>
      <Mapbox.MapView
        ref={mapRef}
        style={styles.map}
        styleURL={Mapbox.StyleURL.Street}
        onMapReady={handleMapReady}
        onRegionChangeComplete={handleRegionChangeComplete}
        centerCoordinate={[region.longitude, region.latitude]}
        zoomLevel={Math.log2(360 / region.longitudeDelta)}
      >
        {/* User location */}
        {userLocation && (
          <Mapbox.UserLocation
            visible={true}
            showsUserHeadingIndicator={true}
          />
        )}

        {/* Match markers */}
        {matches.map((match) => {
          if (!match.fixture?.venue?.coordinates) return null;

          const [latitude, longitude] = match.fixture.venue.coordinates;
          const isSelected = selectedMatchId === match.id;

          return (
            <Mapbox.PointAnnotation
              key={match.id}
              id={`match-${match.id}`}
              coordinate={[longitude, latitude]}
              onSelected={() => handleMarkerPress(match)}
            >
              <View style={[
                styles.marker,
                isSelected && styles.selectedMarker
              ]}>
                <Text style={styles.markerText}>
                  {match.teams.home.name.charAt(0)}{match.teams.away.name.charAt(0)}
                </Text>
              </View>
            </Mapbox.PointAnnotation>
          );
        })}
      </Mapbox.MapView>

      {/* Custom location button */}
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
            name="my-location"
            size={24}
            color={userLocation ? '#1976d2' : '#999'}
          />
        </TouchableOpacity>
      )}
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
  marker: {
    backgroundColor: '#ff385c',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  selectedMarker: {
    backgroundColor: '#1976d2',
    transform: [{ scale: 1.2 }],
  },
  markerText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  locationButton: {
    position: 'absolute',
    bottom: 120,
    right: 20,
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

export default MapboxMapView;
 