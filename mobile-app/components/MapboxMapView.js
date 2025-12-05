import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity, Text } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { debounce } from 'lodash';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { MAPBOX_CONFIG } from '../utils/mapConfig';

// Set Mapbox access token from environment variable
if (MAPBOX_CONFIG.accessToken) {
  Mapbox.setAccessToken(MAPBOX_CONFIG.accessToken);
}

const MapboxMapView = ({
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
  autoFitKey = 0,
  onMapPress = () => {},
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

// Auto-fit to markers only when explicitly triggered
useEffect(() => {
  if (((matches && matches.length > 0) || (recommendedMatches && recommendedMatches.length > 0)) && mapReady && mapRef.current) {
    const timer = setTimeout(() => {
      fitToMatches();
    }, 300);
    return () => clearTimeout(timer);
  }
}, [autoFitKey, mapReady, matches, recommendedMatches]);

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

  // Handle home base press
  const handleHomeBasePress = (homeBase) => {
    onHomeBasePress(homeBase);
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

  // Fit map to show all matches, recommended matches, and home bases
  const fitToMatches = () => {
    if (!mapRef.current) return;

    // Collect coordinates from matches (GeoJSON format: [longitude, latitude])
    const matchCoordinates = (matches || [])
      .filter(match => match.fixture?.venue?.coordinates)
      .map(match => [
        match.fixture.venue.coordinates[0], // longitude (GeoJSON index 0)
        match.fixture.venue.coordinates[1]  // latitude (GeoJSON index 1)
      ]);

    // Collect coordinates from recommended matches (GeoJSON format: [longitude, latitude])
    const recommendedMatchCoordinates = (recommendedMatches || [])
      .filter(match => match.fixture?.venue?.coordinates)
      .map(match => [
        match.fixture.venue.coordinates[0], // longitude (GeoJSON index 0)
        match.fixture.venue.coordinates[1]  // latitude (GeoJSON index 1)
      ]);

    // Collect coordinates from home bases (convert to GeoJSON format)
    const homeBaseCoordinates = (homeBases || [])
      .filter(homeBase => {
        const coords = homeBase.coordinates;
        return coords && typeof coords.lat === 'number' && typeof coords.lng === 'number';
      })
      .map(homeBase => [
        homeBase.coordinates.lng, // longitude (GeoJSON format)
        homeBase.coordinates.lat  // latitude (GeoJSON format)
      ]);

    // Combine all coordinates
    const allCoordinates = [...matchCoordinates, ...recommendedMatchCoordinates, ...homeBaseCoordinates];

    if (allCoordinates.length > 0) {
      mapRef.current.fitBounds(allCoordinates, {
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
        onPress={() => onMapPress()}
      >
        {/* User location */}
        {userLocation && (
          <Mapbox.UserLocation
            visible={true}
            showsUserHeadingIndicator={true}
          />
        )}

        {/* Match markers - grouped by venue */}
        {useMemo(() => {
          if (!matches || matches.length === 0) return null;

          // Helper function to generate venue group key (prioritizes coordinates for physical location matching)
          const getVenueGroupKey = (match) => {
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
          };

          // Filter valid matches
          const validMatches = matches.filter(match => {
            const venue = match.fixture?.venue;
            if (!venue || !venue.coordinates || !Array.isArray(venue.coordinates)) {
              return false;
            }
            const [lon, lat] = venue.coordinates;
            if (typeof lon !== 'number' || typeof lat !== 'number' ||
                lon < -180 || lon > 180 || lat < -90 || lat > 90) {
              return false;
            }
            return true;
          });

          // Group matches by venue
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
            // Use the first match from the venue group for marker display
            const firstMatch = venueGroup.matches[0];
            const venue = firstMatch.fixture.venue;
            const [longitude, latitude] = venue.coordinates;
            const isSelected = venueGroup.matches.some(m => 
              String(m.fixture?.id) === String(selectedMatchId)
            );

            const markerKey = `venue-${venueGroup.key}`;

            return (
              <Mapbox.PointAnnotation
                key={markerKey}
                id={markerKey}
                coordinate={[longitude, latitude]}
                onSelected={() => handleMarkerPress(firstMatch)}
              >
                <View style={[
                  styles.marker,
                  isSelected && styles.selectedMarker
                ]}>
                  <Text style={styles.markerText}>
                    {firstMatch.teams.home.name.charAt(0)}{firstMatch.teams.away.name.charAt(0)}
                  </Text>
                </View>
              </Mapbox.PointAnnotation>
            );
          });
        }, [matches, selectedMatchId, handleMarkerPress])}

        {/* Recommended match markers (yellow) */}
        {recommendedMatches && recommendedMatches.map((match) => {
          if (!match.fixture?.venue?.coordinates) return null;

          // GeoJSON format: [longitude, latitude]
          const [longitude, latitude] = match.fixture.venue.coordinates;

          return (
            <Mapbox.PointAnnotation
              key={`recommended-${String(match.fixture?.id)}`}
              id={`recommended-${String(match.fixture?.id)}`}
              coordinate={[longitude, latitude]}
              onSelected={() => onRecommendedMatchPress(match)}
            >
              <View style={styles.recommendedMarker}>
                <Text style={styles.recommendedMarkerText}>
                  {match.teams?.home?.name?.charAt(0) || 'H'}{match.teams?.away?.name?.charAt(0) || 'A'}
                </Text>
              </View>
            </Mapbox.PointAnnotation>
          );
        })}

        {/* Home base markers */}
        {homeBases && homeBases.map((homeBase) => {
          const coords = homeBase.coordinates;
          if (!coords) {
            return null;
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
            return null;
          }
          
          // Check if coordinates are within reasonable world bounds
          if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
            return null;
          }

          // GeoJSON format: [longitude, latitude]
          const [longitude, latitude] = [lng, lat];

          return (
            <Mapbox.PointAnnotation
              key={`homebase-${String(homeBase._id || homeBase.id || homeBase.name)}`}
              id={`homebase-${String(homeBase._id || homeBase.id || homeBase.name)}`}
              coordinate={[longitude, latitude]}
              onSelected={() => handleHomeBasePress(homeBase)}
            >
              <View style={styles.homeBaseMarker}>
                <Icon name="home" size={20} color="white" />
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
  homeBaseMarker: {
    backgroundColor: '#4CAF50', // Green color for home bases
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
  recommendedMarker: {
    backgroundColor: '#FFD700', // Yellow color for recommended matches (using design token: colors.markers.recommended)
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
  recommendedMarkerText: {
    color: '#000',
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
 