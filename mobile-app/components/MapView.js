import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';

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
  
  console.log('MapView: Received initialRegion:', initialRegion);
  console.log('MapView: Using region:', region);

  // Update region when initialRegion prop changes
  useEffect(() => {
    if (initialRegion) {
      console.log('MapView: Updating region to:', initialRegion);
      setRegion(initialRegion);
    }
  }, [initialRegion]);

  // Request location permission and get user location
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.log('Location permission denied');
          return;
        }

        const location = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      } catch (error) {
        console.log('Error getting location:', error);
      }
    })();
  }, []);

  // Handle region change (map movement)
  const handleRegionChangeComplete = (newRegion) => {
    setRegion(newRegion);
    
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
    if (matches.length === 0) return;

    const coordinates = matches
      .filter(match => {
        const venue = match.fixture?.venue;
        return venue?.coordinates && venue.coordinates.length === 2;
      })
      .map(match => ({
        latitude: match.fixture.venue.coordinates[0],
        longitude: match.fixture.venue.coordinates[1],
      }));

    if (coordinates.length > 0 && mapRef.current) {
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 50, right: 50, bottom: 300, left: 50 }, // Account for bottom sheet
        animated: true,
      });
    }
  };

  // Render match markers
  const renderMarkers = () => {
    return matches
      .filter(match => {
        const venue = match.fixture?.venue;
        return venue?.coordinates && venue.coordinates.length === 2;
      })
      .map(match => {
        const venue = match.fixture.venue;
        const isSelected = selectedMatchId === match.fixture.id;
        
        return (
          <Marker
            key={match.fixture.id}
            coordinate={{
              latitude: venue.coordinates[0],
              longitude: venue.coordinates[1],
            }}
            title={`${match.teams.home.name} vs ${match.teams.away.name}`}
            description={`${venue.name}, ${venue.city}`}
            onPress={() => handleMarkerPress(match)}
            pinColor={isSelected ? '#FF6B6B' : '#1976d2'}
          />
        );
      });
  };

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={region}
        onRegionChangeComplete={handleRegionChangeComplete}
        showsUserLocation={!!userLocation}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        loadingEnabled={true}
        mapType="standard"
      >
        {renderMarkers()}
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