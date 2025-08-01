import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { debounce } from 'lodash';

const MatchMapView = ({
  matches = [],
  initialRegion = null,
  onRegionChange = () => {},
  onMarkerPress = () => {},
  selectedMatchId = null,
  style = {}
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
  const handleRegionChangeComplete = (newRegion) => {
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

  // Center map on specific location
  const centerMap = (latitude, longitude, animated = true) => {
    const newRegion = {
      latitude,
      longitude,
      latitudeDelta: region.latitudeDelta,
      longitudeDelta: region.longitudeDelta,
    };

    if (mapRef.current) {
      if (animated) {
        mapRef.current.animateToRegion(newRegion, 1000);
      } else {
        mapRef.current.setRegion(newRegion);
      }
    }
  };

  // Fit map to show all matches
  const fitToMatches = () => {
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

    if (coordinates.length > 0) {
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 100, right: 50, bottom: 300, left: 50 }, // Increased top padding for header
        animated: true,
      });
    }
  };

  // Render match markers with memoization
  const markers = useMemo(() => {
    if (!matches || matches.length === 0) {
      return null;
    }
    
    const validMatches = matches.filter(match => {
      const venue = match.fixture?.venue;
      return venue?.coordinates && venue.coordinates.length === 2;
    });
    
    return validMatches.map(match => {
      const venue = match.fixture.venue;
      const isSelected = selectedMatchId === match.fixture.id;
      const coordinate = {
        latitude: venue.coordinates[1],  // GeoJSON: [lon, lat]
        longitude: venue.coordinates[0], // So lat is index 1, lon is index 0
      };
      
      return (
        <Marker
          key={`match-${match.fixture.id}`} // Stable key based only on match ID
          coordinate={coordinate}
          onPress={() => handleMarkerPress(match)}
          pinColor={isSelected ? '#FF6B6B' : '#1976d2'}
          tracksViewChanges={false} // Improve performance
        />
      );
    });
  }, [matches, selectedMatchId, handleMarkerPress]);

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={region}
        onRegionChangeComplete={handleRegionChangeComplete}
        onMapReady={handleMapReady}
        showsUserLocation={!!userLocation}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        loadingEnabled={true}
        mapType="standard"
        moveOnMarkerPress={false} // Prevent map movement when pressing markers
      >
        {markers}
      </MapView>
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
});

// Export methods for parent components to control map
MatchMapView.centerMap = (ref, latitude, longitude, animated = true) => {
  if (ref?.current) {
    ref.current.centerMap(latitude, longitude, animated);
  }
};

MatchMapView.fitToMatches = (ref) => {
  if (ref?.current) {
    ref.current.fitToMatches();
  }
};

export default MatchMapView; 