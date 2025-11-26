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
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import ApiService from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { colors, spacing, typography, borderRadius, iconSizes } from '../styles/designTokens';
import PhotoViewerModal from '../components/PhotoViewerModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_ITEM_SIZE = SCREEN_WIDTH / 3;

const MemoriesScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [memories, setMemories] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState(null);
  const [activeTab, setActiveTab] = useState('memories');
  const [photoViewerVisible, setPhotoViewerVisible] = useState(false);
  const [selectedMemoryForViewer, setSelectedMemoryForViewer] = useState(null);

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
    
    // Check if memory has photos
    const hasPhotos = memory.photos && memory.photos.length > 0;
    
    if (hasPhotos) {
      // Open photo viewer
      setSelectedMemoryForViewer(memory);
      setPhotoViewerVisible(true);
    } else {
      // Navigate to edit memory screen if no photos
      navigation.navigate('EditMemory', { memory });
    }
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

  // Handle delete memory from photo viewer
  const handleDeleteMemoryFromViewer = useCallback(async () => {
    if (!selectedMemoryForViewer) return;
    
    try {
      setLoading(true);
      const response = await ApiService.deleteMemory(selectedMemoryForViewer._id || selectedMemoryForViewer.matchId);
      
      if (response.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Remove from local state
        setMemories(prev => prev.filter(m => (m._id || m.matchId) !== (selectedMemoryForViewer._id || selectedMemoryForViewer.matchId)));
        // Refresh stats
        const statsResponse = await ApiService.getMemoryStats();
        if (statsResponse.success) {
          setStats(statsResponse.data);
        }
        // Close viewer
        setPhotoViewerVisible(false);
        setSelectedMemoryForViewer(null);
      }
    } catch (error) {
      console.error('Error deleting memory:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to delete memory. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [selectedMemoryForViewer]);

  // Handle edit memory from photo viewer
  const handleEditMemoryFromViewer = useCallback(() => {
    if (!selectedMemoryForViewer) return;
    
    setPhotoViewerVisible(false);
    navigation.navigate('EditMemory', { memory: selectedMemoryForViewer });
    setSelectedMemoryForViewer(null);
  }, [selectedMemoryForViewer, navigation]);

  // Handle close photo viewer
  const handleClosePhotoViewer = useCallback(() => {
    setPhotoViewerVisible(false);
    setSelectedMemoryForViewer(null);
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

  // Handle edit avatar
  const handleEditAvatar = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // TODO: Implement avatar editing functionality
    Alert.alert('Edit Profile Picture', 'Avatar editing coming soon!');
  }, []);


  // Get display name
  const getDisplayName = useCallback(() => {
    if (!user) return 'User';
    
    // Prefer full name from profile
    if (user.profile?.firstName && user.profile?.lastName) {
      return `${user.profile.firstName} ${user.profile.lastName}`;
    }
    
    // Use firstName if available
    if (user.profile?.firstName) {
      return user.profile.firstName;
    }
    
    // Fallback to username (capitalize first letter)
    if (user.username) {
      return user.username.charAt(0).toUpperCase() + user.username.slice(1);
    }
    
    // Last resort: email prefix
    return user.email?.split('@')[0] || 'User';
  }, [user]);

  // Get user subtitle/bio
  const getUserSubtitle = useCallback(() => {
    // You can customize this based on user preferences or profile data
    return 'Football Enthusiast';
  }, []);

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
    const memoryTitle = memory.matchTitle || memory.teams || 'Memory';
    
    return (
      <TouchableOpacity
        style={styles.memoryGridItem}
        onPress={() => handleMemoryPress(memory)}
        activeOpacity={0.8}
        accessibilityLabel={`Memory: ${memoryTitle}`}
        accessibilityRole="button"
        accessibilityHint="Tap to view memory details"
      >
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.memoryGridImage}
            resizeMode="cover"
            accessibilityLabel={`Photo for ${memoryTitle}`}
          />
        ) : (
          <View style={styles.memoryGridPlaceholder}>
            <MaterialIcons name="photo" size={40} color={colors.text.light} />
          </View>
        )}
        
        {/* Multi-photo indicator */}
        {hasMultiplePhotos && (
          <View style={styles.multiPhotoIndicator} accessibilityLabel="Multiple photos">
            <MaterialIcons name="collections" size={16} color="white" />
          </View>
        )}
      </TouchableOpacity>
    );
  }, [getImageUrl, handleMemoryPress]);

  // Render profile header
  const renderProfileHeader = useCallback(() => {
    const displayName = getDisplayName();
    const subtitle = getUserSubtitle();

    return (
      <View style={styles.profileHeader}>
        <TouchableOpacity 
          style={styles.avatarContainer}
          onPress={handleEditAvatar}
          accessibilityLabel="Edit profile picture"
          accessibilityRole="button"
        >
          <View style={styles.avatar}>
            <MaterialIcons name="account-circle" size={100} color={colors.text.light} />
          </View>
          <View style={styles.editIconContainer}>
            <MaterialIcons name="edit" size={iconSizes.sm} color={colors.text.primary} />
          </View>
        </TouchableOpacity>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{displayName}</Text>
          <View style={{ height: spacing.xs }} />
          <Text style={styles.userSubtitle}>{subtitle}</Text>
        </View>
      </View>
    );
  }, [getDisplayName, getUserSubtitle, handleEditAvatar]);

  // Render stats section
  const renderStats = useCallback(() => {
    if (!stats) return null;

    return (
      <View style={styles.statsContainer}>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.totalMemories || 0}</Text>
            <View style={{ height: spacing.xs + 2 }} />
            <Text style={styles.statLabel} numberOfLines={1}>Matches</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.uniqueStadiumsCount || 0}</Text>
            <View style={{ height: spacing.xs + 2 }} />
            <Text style={styles.statLabel} numberOfLines={1}>Stadiums</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{memories.length || 0}</Text>
            <View style={{ height: spacing.xs + 2 }} />
            <Text style={styles.statLabel} numberOfLines={1}>Memories</Text>
          </View>
        </View>
      </View>
    );
  }, [stats, memories.length]);

  // Render tab navigation
  const renderTabs = useCallback(() => {
    const tabs = [
      { id: 'memories', label: 'Memories' },
      { id: 'savedStadiums', label: 'Saved Stadiums' },
      { id: 'previousMatches', label: 'Previous Matches' },
    ];

    return (
      <View style={styles.tabsContainer}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tabButton,
              activeTab === tab.id && styles.tabButtonActive,
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab(tab.id);
            }}
            accessibilityLabel={tab.label}
            accessibilityRole="button"
            accessibilityState={{ selected: activeTab === tab.id }}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeTab === tab.id && styles.tabButtonTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }, [activeTab]);

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
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <View style={styles.profileSection}>
          {renderProfileHeader()}
          {renderStats()}
        </View>

        {/* Tab Navigation */}
        {renderTabs()}

        {/* Add New Memory Button */}
        <View style={styles.addButtonContainer}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddMemory}
            accessibilityLabel="Add New Memory"
            accessibilityRole="button"
            accessibilityHint="Opens the screen to add a new memory"
          >
            <MaterialIcons name="add" size={20} color={colors.text.primary} style={{ marginRight: spacing.sm }} />
            <Text style={styles.addButtonText}>Add New Memory</Text>
          </TouchableOpacity>
        </View>

        {/* Memories Grid */}
        {activeTab === 'memories' && (
          <>
            {memories.length > 0 ? (
              <View style={styles.memoriesGridContainer}>
                <FlatList
                  data={memories}
                  renderItem={renderMemoryItem}
                  keyExtractor={(item) => item._id || item.matchId || String(Math.random())}
                  numColumns={3}
                  scrollEnabled={false}
                  columnWrapperStyle={styles.gridRow}
                />
              </View>
            ) : (
              <View style={styles.emptyState}>
                <MaterialIcons name="photo-library" size={80} color={colors.text.light} />
                <Text style={styles.emptyTitle}>No Memories Yet</Text>
                <Text style={styles.emptySubtitle}>
                  Start building your football journey by adding your first memory
                </Text>
                <TouchableOpacity
                  style={styles.emptyStateButton}
                  onPress={handleAddMemory}
                  accessibilityLabel="Add Your First Memory"
                  accessibilityRole="button"
                >
                  <Text style={styles.emptyStateButtonTitle}>Add Your First Memory</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* Saved Stadiums Tab Content */}
        {activeTab === 'savedStadiums' && (
          <View style={styles.emptyState}>
            <MaterialIcons name="stadium" size={80} color={colors.text.light} />
            <Text style={styles.emptyTitle}>No Saved Stadiums</Text>
            <Text style={styles.emptySubtitle}>
              Save stadiums to see them here
            </Text>
          </View>
        )}

        {/* Previous Matches Tab Content */}
        {activeTab === 'previousMatches' && (
          <View style={styles.emptyState}>
            <MaterialIcons name="sports-soccer" size={80} color={colors.text.light} />
            <Text style={styles.emptyTitle}>No Previous Matches</Text>
            <Text style={styles.emptySubtitle}>
              Your previous matches will appear here
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Photo Viewer Modal */}
      <PhotoViewerModal
        visible={photoViewerVisible}
        onClose={handleClosePhotoViewer}
        memory={selectedMemoryForViewer}
        onEdit={handleEditMemoryFromViewer}
        onDelete={handleDeleteMemoryFromViewer}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card,
  },
  scrollView: {
    flex: 1,
  },
  profileSection: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    alignItems: 'center',
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.cardGrey,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  editIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    alignItems: 'center',
  },
  userName: {
    ...typography.h1,
    color: colors.text.primary,
    textAlign: 'center',
  },
  userSubtitle: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  statsContainer: {
    width: '100%',
    marginTop: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: spacing.lg, // Reduced margin to give more space for text
    minWidth: 70, // Increased minimum width to prevent wrapping
    maxWidth: 120, // Maximum width to prevent items from being too wide
  },
  statNumber: {
    ...typography.h2,
    color: colors.text.primary,
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  tabButtonActive: {
    borderBottomWidth: 1.5,
    borderBottomColor: colors.text.primary,
  },
  tabButtonText: {
    ...typography.caption,
    color: colors.text.primary,
  },
  tabButtonTextActive: {
    fontWeight: '600',
  },
  addButtonContainer: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5E9', // Light green background for better contrast
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.xl * 2.25, // ~72px to match 8pt grid
    paddingVertical: spacing.md,
  },
  addButtonText: {
    ...typography.button,
    fontSize: typography.bodySmall.fontSize, // 14px as per design
    color: colors.text.primary,
    fontWeight: '600',
  },
  memoriesGridContainer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  memoryGridItem: {
    width: (SCREEN_WIDTH - spacing.xl * 2 - spacing.sm * 2) / 3, // Account for padding and gaps
    height: (SCREEN_WIDTH - spacing.xl * 2 - spacing.sm * 2) / 3,
    position: 'relative',
    backgroundColor: colors.borderLight,
    borderRadius: borderRadius.xs,
    overflow: 'hidden',
  },
  memoryGridImage: {
    width: '100%',
    height: '100%',
  },
  memoryGridPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  multiPhotoIndicator: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: borderRadius.xs,
    padding: spacing.xs,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xxl,
    marginTop: spacing.xl,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.text.primary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  emptyStateButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  emptyStateButtonTitle: {
    ...typography.button,
    color: colors.onPrimary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    ...typography.body,
    color: colors.text.secondary,
  },
});

export default MemoriesScreen;

