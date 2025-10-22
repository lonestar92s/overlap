import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Card, Button } from 'react-native-elements';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Platform } from 'react-native';
import ApiService from '../services/api';
import { MAP_PROVIDER } from '../utils/mapConfig';

const { width, height } = Dimensions.get('window');

const MemoriesMapScreen = () => {
  const navigation = useNavigation();
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMemory, setSelectedMemory] = useState(null);
  const [mapRegion, setMapRegion] = useState(null);

  // Fetch memories
  const fetchMemories = useCallback(async () => {
    try {
      setLoading(true);
      const response = await ApiService.getMemories();
      
      if (response.success) {
        const memoriesWithCoordinates = response.data.filter(memory => 
          memory.venue?.coordinates || 
          (memory.photos && memory.photos.some(photo => photo.coordinates))
        );
        
        setMemories(memoriesWithCoordinates);
        
        // Set initial map region if we have coordinates
        if (memoriesWithCoordinates.length > 0) {
          const coordinates = memoriesWithCoordinates
            .map(memory => {
              if (memory.venue?.coordinates) {
                return memory.venue.coordinates;
              }
              const photoWithCoords = memory.photos?.find(photo => photo.coordinates);
              return photoWithCoords?.coordinates;
            })
            .filter(coord => coord && Array.isArray(coord) && coord.length === 2);
          
          if (coordinates.length > 0) {
            const lats = coordinates.map(coord => coord[1]); // latitude
            const lngs = coordinates.map(coord => coord[0]); // longitude
            
            const minLat = Math.min(...lats);
            const maxLat = Math.max(...lats);
            const minLng = Math.min(...lngs);
            const maxLng = Math.max(...lngs);
            
            const centerLat = (minLat + maxLat) / 2;
            const centerLng = (minLng + maxLng) / 2;
            const deltaLat = (maxLat - minLat) * 2.5; // Increased padding
            const deltaLng = (maxLng - minLng) * 2.5; // Increased padding
            
            setMapRegion({
              latitude: centerLat,
              longitude: centerLng,
              latitudeDelta: Math.max(deltaLat, 0.2), // Increased minimum
              longitudeDelta: Math.max(deltaLng, 0.2), // Increased minimum
            });
          }
        }
      }
    } catch (error) {
      console.error('Error fetching memories:', error);
      Alert.alert('Error', 'Failed to load memories');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load memories on mount
  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  // Handle marker press
  const handleMarkerPress = useCallback((memory) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMemory(memory);
  }, []);

  // Close memory card
  const closeMemoryCard = useCallback(() => {
    setSelectedMemory(null);
  }, []);

  // Get coordinates for a memory
  const getMemoryCoordinates = useCallback((memory) => {
    if (memory.venue?.coordinates && Array.isArray(memory.venue.coordinates)) {
      return {
        latitude: memory.venue.coordinates[1],
        longitude: memory.venue.coordinates[0],
      };
    }
    
    const photoWithCoords = memory.photos?.find(photo => photo.coordinates);
    if (photoWithCoords?.coordinates && Array.isArray(photoWithCoords.coordinates)) {
      return {
        latitude: photoWithCoords.coordinates.lat || photoWithCoords.coordinates[1],
        longitude: photoWithCoords.coordinates.lng || photoWithCoords.coordinates[0],
      };
    }
    
    return null;
  }, []);

  // Render memory card overlay
  const renderMemoryCard = useCallback(() => {
    if (!selectedMemory) return null;

    const hasPhotos = selectedMemory.photos && selectedMemory.photos.length > 0;
    const firstPhoto = hasPhotos ? selectedMemory.photos[0] : null;
    
    return (
      <View style={styles.memoryCardOverlay}>
        <Card containerStyle={styles.memoryCard}>
          {/* Photo Section */}
          <View style={styles.photoSection}>
            {hasPhotos ? (
              <View style={styles.photoContainer}>
                <Text style={styles.photoCount}>
                  {selectedMemory.photos.length} photo{selectedMemory.photos.length !== 1 ? 's' : ''}
                </Text>
              </View>
            ) : (
              <View style={styles.noPhotoContainer}>
                <MaterialIcons name="photo" size={40} color="#ccc" />
                <Text style={styles.noPhotoText}>No Photos</Text>
              </View>
            )}
          </View>

          {/* Memory Info */}
          <View style={styles.memoryInfo}>
            <Text style={styles.teamsText}>
              {selectedMemory.homeTeam?.name || 'Unknown'} vs {selectedMemory.awayTeam?.name || 'Unknown'}
            </Text>
            
            <Text style={styles.venueText}>
              {selectedMemory.venue?.name || 'Unknown Venue'}
            </Text>
            
            <Text style={styles.dateText}>
              {new Date(selectedMemory.date).toLocaleDateString()}
            </Text>
            
            {/* Score Display */}
            {(selectedMemory.userScore || selectedMemory.apiMatchData?.officialScore) && (
              <Text style={styles.scoreText}>
                {selectedMemory.apiMatchData?.officialScore || selectedMemory.userScore}
              </Text>
            )}
            
            {selectedMemory.competition && (
              <Text style={styles.competitionText}>{selectedMemory.competition}</Text>
            )}
            
            {selectedMemory.userNotes && (
              <Text style={styles.notesText} numberOfLines={3}>
                {selectedMemory.userNotes}
              </Text>
            )}
          </View>

          {/* Close Button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={closeMemoryCard}
          >
            <MaterialIcons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </Card>
      </View>
    );
  }, [selectedMemory, closeMemoryCard]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading your memories...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Memories Map</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Map */}
      <MapView
        style={styles.map}
        region={mapRegion}
        onRegionChangeComplete={setMapRegion}
        showsUserLocation={true}
        showsMyLocationButton={true}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : MapView.PROVIDER_DEFAULT}
      >
        {memories.map((memory, index) => {
          const coordinates = getMemoryCoordinates(memory);
          if (!coordinates) return null;

          return (
            <Marker
              key={`${memory._id || memory.matchId}-${index}`}
              coordinate={coordinates}
              onPress={() => handleMarkerPress(memory)}
            >
              <View style={styles.markerContainer}>
                <MaterialIcons name="sports-soccer" size={24} color="#007AFF" />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Memory Card Overlay */}
      {renderMemoryCard()}

      {/* Empty State */}
      {memories.length === 0 && (
        <View style={styles.emptyState}>
          <MaterialIcons name="map" size={80} color="#ccc" />
          <Text style={styles.emptyTitle}>No Memories on Map</Text>
          <Text style={styles.emptySubtitle}>
            Add memories with location data to see them on the map
          </Text>
          <Button
            title="Add Memory"
            onPress={() => navigation.navigate('AddMemory')}
            buttonStyle={styles.emptyStateButton}
            titleStyle={styles.emptyStateButtonTitle}
          />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 10,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  placeholder: {
    width: 40,
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 8,
    borderWidth: 2,
    borderColor: '#007AFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  memoryCardOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    zIndex: 1000,
  },
  memoryCard: {
    borderRadius: 16,
    padding: 0,
    margin: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  photoSection: {
    position: 'relative',
  },
  photoContainer: {
    width: '100%',
    height: 120,
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoCount: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  noPhotoContainer: {
    width: '100%',
    height: 120,
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noPhotoText: {
    color: '#999',
    marginTop: 8,
    fontSize: 14,
  },
  memoryInfo: {
    padding: 16,
  },
  teamsText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
  },
  venueText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    textAlign: 'center',
  },
  dateText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    textAlign: 'center',
  },
  scoreText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 4,
    textAlign: 'center',
  },
  competitionText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  notesText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 16,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    position: 'absolute',
    top: '50%',
    left: 20,
    right: 20,
    transform: [{ translateY: -100 }],
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  emptyStateButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyStateButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
});

export default MemoriesMapScreen;
