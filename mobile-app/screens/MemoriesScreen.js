import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from 'react-native-elements';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import ApiService from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_ITEM_SIZE = SCREEN_WIDTH / 3;

const MemoriesScreen = () => {
  const navigation = useNavigation();
  const [memories, setMemories] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState(null);

  // Fetch memories and stats
  const fetchMemories = useCallback(async () => {
    try {
      setLoading(true);
      const [memoriesResponse, statsResponse] = await Promise.all([
        ApiService.getMemories(),
        ApiService.getMemoryStats()
      ]);

      if (memoriesResponse.success) {
        setMemories(memoriesResponse.data || []);
      }

      if (statsResponse.success) {
        setStats(statsResponse.data);
      }
    } catch (error) {
      console.error('Error fetching memories:', error);
      Alert.alert('Error', 'Failed to load memories');
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh memories
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMemories();
    setRefreshing(false);
  }, [fetchMemories]);

  // Load memories on mount
  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  // Handle memory selection
  const handleMemoryPress = useCallback((memory) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMemory(memory);
    // Navigate to edit memory screen
    navigation.navigate('EditMemory', { memory });
  }, [navigation]);

  // Delete memory
  const handleDeleteMemory = useCallback(async (memory) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    Alert.alert(
      'Delete Memory',
      'Are you sure you want to delete this memory? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const response = await ApiService.deleteMemory(memory._id || memory.matchId);
              
              if (response.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                // Remove from local state
                setMemories(prev => prev.filter(m => (m._id || m.matchId) !== (memory._id || memory.matchId)));
                // Refresh stats
                const statsResponse = await ApiService.getMemoryStats();
                if (statsResponse.success) {
                  setStats(statsResponse.data);
                }
              }
            } catch (error) {
              console.error('Error deleting memory:', error);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', 'Failed to delete memory. Please try again.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  }, []);

  // Navigate to add memory
  const handleAddMemory = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('AddMemory');
  }, [navigation]);

  // Navigate to memories map
  const handleMemoriesMap = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('MemoriesMap');
  }, [navigation]);

  // Get the best available image URL
  const getImageUrl = useCallback((photo) => {
    if (!photo) return null;
    
    // Always use the main URL for React Native compatibility
    if (photo.url) return photo.url;
    
    // If we have a publicId but no URL, construct a simple one
    if (photo.publicId) {
      // Use a simple, React Native-compatible URL format
      return `https://res.cloudinary.com/dtujkmf8d/image/upload/w_400,h_400,c_fill,q_auto,f_auto/${photo.publicId}`;
    }
    
    // If we have an _id but no other data, this might be a corrupted photo object
    if (photo._id && !photo.publicId && !photo.url) {
      console.warn('⚠️ Photo object missing essential fields:', photo);
      return null;
    }
    
    return null;
  }, []);

  // Render memory grid item (single square)
  const renderMemoryItem = useCallback(({ item: memory }) => {
    const hasPhotos = memory.photos && memory.photos.length > 0;
    const firstPhoto = hasPhotos ? memory.photos[0] : null;
    const imageUrl = getImageUrl(firstPhoto);
    const hasMultiplePhotos = memory.photos && memory.photos.length > 1;
    
    return (
      <TouchableOpacity
        style={styles.memoryGridItem}
        onPress={() => handleMemoryPress(memory)}
        activeOpacity={0.8}
      >
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.memoryGridImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.memoryGridPlaceholder}>
            <MaterialIcons name="photo" size={40} color="#ccc" />
          </View>
        )}
        
        {/* Multi-photo indicator */}
        {hasMultiplePhotos && (
          <View style={styles.multiPhotoIndicator}>
            <MaterialIcons name="collections" size={16} color="white" />
          </View>
        )}
      </TouchableOpacity>
    );
  }, [getImageUrl, handleMemoryPress]);

  // Render stats section
  const renderStats = useCallback(() => {
    if (!stats) return null;

    return (
      <View style={styles.statsContainer}>
        <Text style={styles.statsTitle}>Your Football Journey</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.totalMemories}</Text>
            <Text style={styles.statLabel}>Matches</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.totalPhotos}</Text>
            <Text style={styles.statLabel}>Photos</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.uniqueStadiumsCount}</Text>
            <Text style={styles.statLabel}>Stadiums</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.uniqueCountriesCount}</Text>
            <Text style={styles.statLabel}>Countries</Text>
          </View>
        </View>
      </View>
    );
  }, [stats]);

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
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Memories</Text>
          <Text style={styles.subtitle}>Your football adventures</Text>
        </View>

        {/* Stats Section */}
        {renderStats()}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <Button
            title="Add Memory"
            icon={
              <MaterialIcons name="add-a-photo" size={20} color="white" style={{ marginRight: 8 }} />
            }
            onPress={handleAddMemory}
            buttonStyle={styles.addButton}
            titleStyle={styles.buttonTitle}
          />
          
          <Button
            title="Map View"
            icon={
              <MaterialIcons name="map" size={20} color="white" style={{ marginRight: 8 }} />
            }
            onPress={handleMemoriesMap}
            buttonStyle={styles.mapButton}
            titleStyle={styles.buttonTitle}
          />
        </View>

        {/* Memories Grid */}
        {memories.length > 0 ? (
          <View style={styles.memoriesGridContainer}>
            <FlatList
              data={memories}
              renderItem={renderMemoryItem}
              keyExtractor={(item) => item._id || item.matchId || String(Math.random())}
              numColumns={3}
              scrollEnabled={false}
            />
          </View>
        ) : (
          <View style={styles.emptyState}>
            <MaterialIcons name="photo-library" size={80} color="#ccc" />
            <Text style={styles.emptyTitle}>No Memories Yet</Text>
            <Text style={styles.emptySubtitle}>
              Start building your football journey by adding your first memory
            </Text>
            <Button
              title="Add Your First Memory"
              onPress={handleAddMemory}
              buttonStyle={styles.emptyStateButton}
              titleStyle={styles.emptyStateButtonTitle}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  statsContainer: {
    margin: 20,
    marginTop: 0,
  },
  statsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 0,
    gap: 12,
  },
  addButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 12,
    flex: 1,
  },
  mapButton: {
    backgroundColor: '#34C759',
    borderRadius: 12,
    paddingVertical: 12,
    flex: 1,
  },
  buttonTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  memoriesGridContainer: {
    paddingBottom: 20,
  },
  memoryGridItem: {
    width: GRID_ITEM_SIZE,
    height: GRID_ITEM_SIZE,
    position: 'relative',
    backgroundColor: '#f0f0f0',
  },
  memoryGridImage: {
    width: '100%',
    height: '100%',
  },
  memoryGridPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  multiPhotoIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
    padding: 4,
  },
  photoContainer: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  noPhotoContainer: {
    width: '100%',
    minHeight: 150,
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  noPhotoText: {
    color: '#999',
    marginTop: 8,
    fontSize: 14,
  },
  photoErrorText: {
    color: '#ff6b6b',
    fontSize: 12,
    marginTop: 4,
  },
  photoCountBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  photoCountText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
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
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    marginTop: 40,
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
  deleteButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255, 59, 48, 0.9)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});

export default MemoriesScreen;

