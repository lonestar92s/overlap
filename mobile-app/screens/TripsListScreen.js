import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Dimensions,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useItineraries } from '../contexts/ItineraryContext';
import { colors, spacing, typography, borderRadius, shadows } from '../styles/designTokens';

// Use solid color background instead of gradient
// Gradient requires native rebuild - using solid color for immediate functionality
// To enable gradient later: rebuild native app with `npx expo prebuild --clean && npx expo run:ios`
const GradientCard = ({ colors, style, children, start, end, ...props }) => {
  // Use a nice blue color that matches the gradient design intent
  // Using the first gradient color as solid background
  const backgroundColor = colors && colors[0] ? colors[0] : '#4A90E2';
  return (
    <View style={[{ backgroundColor }, style]} {...props}>
      {children}
    </View>
  );
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Card width from Figma: 392px, but we need padding from edges
// Using 24px padding on each side (as per Figma design spacing)
const CARD_WIDTH = Math.min(392, SCREEN_WIDTH - 48); // 24px padding on each side
const CARD_PADDING = 24; // Fixed 24px padding as per Figma

const TripsListScreen = ({ navigation }) => {
  const { itineraries, deleteItinerary, updateItinerary, loading, refreshItineraries } = useItineraries();
  const [refreshing, setRefreshing] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [newTripName, setNewTripName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);



  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshItineraries();
    } catch (error) {
      console.error('Error refreshing itineraries:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleItineraryPress = (itinerary) => {
    // Navigate to itinerary detail view
    navigation.navigate('TripOverview', { itineraryId: itinerary.id || itinerary._id });
  };

  const handleDeleteItinerary = (itinerary) => {
    Alert.alert(
      'Delete Itinerary',
      `Are you sure you want to delete "${itinerary.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteItinerary(itinerary.id || itinerary._id);
              // Success - trip is removed from state automatically
            } catch (error) {
              console.error('Error deleting trip:', error);
              Alert.alert(
                'Delete Failed',
                `Failed to delete "${itinerary.name}". Please try again.`,
                [{ text: 'OK' }]
              );
            }
          }
        }
      ]
    );
  };

  const handleSettingsPress = (itinerary) => {
    setSelectedTrip(itinerary);
    setSettingsModalVisible(true);
  };

  const handleRenamePress = () => {
    setSettingsModalVisible(false);
    setNewTripName(selectedTrip.name);
    setRenameModalVisible(true);
  };

  const handleDeletePress = () => {
    setSettingsModalVisible(false);
    handleDeleteItinerary(selectedTrip);
  };

  const handleRenameSubmit = async () => {
    if (!newTripName.trim()) {
      Alert.alert('Error', 'Please enter a trip name');
      return;
    }

    if (newTripName.trim() === selectedTrip.name) {
      setRenameModalVisible(false);
      return;
    }

    setIsUpdating(true);
    try {
      await updateItinerary(selectedTrip.id || selectedTrip._id, {
        name: newTripName.trim()
      });
      setRenameModalVisible(false);
      setSelectedTrip(null);
      setNewTripName('');
      // Show success message
      Alert.alert('Success', 'Trip renamed successfully!');
    } catch (error) {
      console.error('Error renaming trip:', error);
      Alert.alert('Error', 'Failed to rename trip. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRenameCancel = () => {
    setRenameModalVisible(false);
    setSelectedTrip(null);
    setNewTripName('');
  };

  const handleSettingsCancel = () => {
    setSettingsModalVisible(false);
    setSelectedTrip(null);
  };

  // Format date range for trip
  const formatDateRange = (matches) => {
    if (!matches || matches.length === 0) return null;
    
    const dates = matches
      .map(m => new Date(m.date))
      .filter(d => !isNaN(d.getTime()))
      .sort((a, b) => a - b);
    
    if (dates.length === 0) return null;
    
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];
    
    const formatDate = (date) => {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
    };
    
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  };

  // Count saved matches (matches with planning status)
  const countSavedMatches = (matches) => {
    if (!matches) return 0;
    return matches.filter(m => 
      m.planning && (
        m.planning.ticketsAcquired === 'yes' || 
        m.planning.accommodation === 'yes'
      )
    ).length;
  };

  // Get stadium image from first match in itinerary
  // Checks both API format (fixture.venue.image) and stored format (venueData.image)
  const getStadiumImage = (matches) => {
    if (!matches || matches.length === 0) {
      return null;
    }
    
    // Get the first match
    const firstMatch = matches[0];
    
    // Check 1: API format - match.fixture.venue.image (like PopularMatches/MatchCard)
    const fixtureVenue = firstMatch.fixture?.venue;
    if (fixtureVenue?.image) {
      return fixtureVenue.image;
    }
    
    // Check 2: Stored format - match.venueData.image (itinerary stored format)
    if (firstMatch.venueData) {
      if (typeof firstMatch.venueData === 'object' && firstMatch.venueData.image) {
        return firstMatch.venueData.image;
      }
    }
    
    // Check 3: Direct venue property (fallback)
    if (firstMatch.venue?.image) {
      return firstMatch.venue.image;
    }
    
    return null;
  };

  const renderItineraryItem = ({ item }) => {
    const matchCount = item.matches?.length || 0;
    const savedCount = countSavedMatches(item.matches);
    const dateRange = formatDateRange(item.matches);
    const stadiumImage = getStadiumImage(item.matches);
    
    return (
      <TouchableOpacity
        style={styles.tripCard}
        onPress={() => handleItineraryPress(item)}
        activeOpacity={0.9}
      >
        {/* Stadium Image or Gradient Background */}
        {stadiumImage ? (
          <View style={styles.cardGradient}>
            <Image
              source={{ uri: stadiumImage }}
              style={styles.cardBackgroundImage}
              resizeMode="cover"
            />
            <View style={styles.cardImageOverlay} />
          </View>
        ) : (
          <GradientCard
            colors={['#4A90E2', '#357ABD', '#2E5C8A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardGradient}
          />
        )}
        
        {/* Card Content */}
        <View style={styles.cardContent}>
          {/* Invite Section - Top Right */}
          <View style={styles.inviteSection}>
            <Text style={styles.inviteText}>Invite</Text>
            {/* Placeholder profile circles for future collaborators */}
            <View style={styles.profileIconsContainer}>
              {/* Show 4 placeholder circles when collaborators feature is added */}
              {/* For now, empty - will be populated with actual user avatars */}
            </View>
          </View>

          {/* Bottom Overlay with Trip Info - Positioned at bottom */}
          <View style={styles.tripInfoOverlay}>
            <Text style={styles.tripCardTitle} numberOfLines={1}>
              {item.name}
            </Text>
            {dateRange && (
              <Text style={styles.tripCardDate} numberOfLines={1}>
                {dateRange}
              </Text>
            )}
            <View style={styles.tripCardStats}>
              <Text style={styles.tripCardMatchCount}>
                {matchCount} match{matchCount !== 1 ? 'es' : ''}
              </Text>
              {savedCount > 0 && (
                <>
                  <View style={styles.statsSpacer} />
                  <Text style={styles.tripCardSavedCount}>
                    {savedCount} Saved
                  </Text>
                </>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="flight" size={64} color={colors.text.light} />
      <Text style={styles.emptyStateTitle}>No trips planned yet</Text>
      <Text style={styles.emptyStateSubtitle}>
        Start planning your football adventures by saving matches to new itineraries
      </Text>
      <TouchableOpacity
        style={styles.createTripButton}
        onPress={() => navigation.navigate('SearchTab')}
      >
        <Icon name="search" size={20} color={colors.onPrimary} />
        <Text style={styles.createTripButtonText}>Search for matches</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading your trips...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      {/* Header - Centered "Trips" Title */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Trips</Text>
      </View>

      {itineraries.length > 0 ? (
        <View style={styles.contentContainer}>
          <FlatList
            data={itineraries}
            renderItem={renderItineraryItem}
            keyExtractor={(item) => item.id || item._id}
            contentContainerStyle={styles.listContainer}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            showsVerticalScrollIndicator={false}
          />
        </View>
      ) : (
        renderEmptyState()
      )}

      {/* Settings Modal */}
      <Modal
        visible={settingsModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSettingsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.settingsModalContainer}>
            <View style={styles.settingsModalContent}>
              <Text style={styles.settingsModalTitle}>Trip Options</Text>
              <Text style={styles.settingsModalSubtitle}>
                What would you like to do with "{selectedTrip?.name}"?
              </Text>
              
              <TouchableOpacity
                style={styles.settingsOption}
                onPress={handleRenamePress}
              >
                <View style={styles.settingsOptionLeft}>
                  <Icon name="edit" size={20} color={colors.primary} />
                  <Text style={styles.settingsOptionText}>Rename Trip</Text>
                </View>
                <Icon name="chevron-right" size={20} color={colors.text.light} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.settingsOption}
                onPress={handleDeletePress}
              >
                <View style={styles.settingsOptionLeft}>
                  <Icon name="delete" size={20} color={colors.error} />
                  <Text style={[styles.settingsOptionText, styles.deleteOptionText]}>Delete Trip</Text>
                </View>
                <Icon name="chevron-right" size={20} color={colors.text.light} />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.settingsCancelButton}
                onPress={handleSettingsCancel}
              >
                <Text style={styles.settingsCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Rename Modal */}
      <Modal
        visible={renameModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleRenameCancel}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContainer}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Rename Trip</Text>
              <Text style={styles.modalSubtitle}>
                Enter a new name for "{selectedTrip?.name}"
              </Text>
              
              <TextInput
                style={styles.textInput}
                value={newTripName}
                onChangeText={setNewTripName}
                placeholder="Enter trip name"
                autoFocus={true}
                maxLength={50}
                returnKeyType="done"
                onSubmitEditing={handleRenameSubmit}
              />
              
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={handleRenameCancel}
                  disabled={isUpdating}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.modalButton, 
                    styles.saveButton,
                    (!newTripName.trim() || isUpdating) && styles.saveButtonDisabled
                  ]}
                  onPress={handleRenameSubmit}
                  disabled={!newTripName.trim() || isUpdating}
                >
                  {isUpdating ? (
                    <ActivityIndicator size="small" color={colors.onPrimary} />
                  ) : (
                    <Text style={styles.saveButtonText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card, // White background to match header
  },
  header: {
    paddingTop: spacing.lg + spacing.xs, // ~86.5px from top (accounting for status bar)
    paddingBottom: spacing.md,
    paddingHorizontal: CARD_PADDING, // 24px padding to match card padding
    alignItems: 'flex-start', // Left align
    justifyContent: 'flex-start',
    backgroundColor: colors.card,
    position: 'relative',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700', // Bold
    lineHeight: 32,
    color: colors.text.primary,
    textAlign: 'left', // Left aligned as per Figma
  },
  contentContainer: {
    flex: 1,
  },
  listContainer: {
    paddingHorizontal: CARD_PADDING, // 24px padding on each side
    paddingTop: spacing.lg + spacing.xs, // ~130px from top (accounting for header)
    paddingBottom: spacing.xl,
  },
  tripCard: {
    width: '100%', // Full width minus padding
    maxWidth: 392, // Max width from Figma
    height: 356,
    borderRadius: borderRadius.card,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    ...shadows.medium,
    alignSelf: 'stretch', // Stretch to fill container width
  },
  cardGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  cardBackgroundImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  cardImageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.1)', // Subtle dark overlay for better text readability
  },
  cardContent: {
    flex: 1,
    position: 'relative',
    zIndex: 1,
    padding: 0, // We'll position elements absolutely
  },
  inviteSection: {
    position: 'absolute',
    top: spacing.md + spacing.xs, // 24px from top
    right: spacing.md, // 16px from right
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  inviteText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '400',
    color: colors.inviteBlue, // #B0D0E4
    marginRight: spacing.sm + spacing.xs, // 13px gap as per Figma
  },
  profileIconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
    width: 84, // Width for 4 overlapping circles
    // Placeholder for future collaborators - will show overlapping profile circles
  },
  tripInfoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.67)', // 67% white opacity
    borderTopLeftRadius: borderRadius.md, // Only top corners rounded (12px)
    borderTopRightRadius: borderRadius.md,
    paddingHorizontal: spacing.md, // 16px horizontal
    paddingTop: 9, // 9px top padding (py-[9px])
    paddingBottom: spacing.md, // Match bottom padding
    height: 116, // Fixed height as per Figma
    justifyContent: 'flex-start',
  },
  tripCardTitle: {
    fontSize: 24,
    fontWeight: '700', // Bold
    lineHeight: 24,
    color: colors.text.primary,
    marginBottom: spacing.sm, // 8px gap
  },
  tripCardDate: {
    fontSize: 16,
    fontWeight: '400', // Regular
    lineHeight: 19, // Height 19px as per Figma
    color: colors.text.primary,
    marginBottom: spacing.sm, // 8px gap
  },
  tripCardStats: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 19, // Height 19px as per Figma
  },
  statsSpacer: {
    width: 4, // 4px gap between "matches" and "Saved"
  },
  tripCardMatchCount: {
    fontSize: 16,
    fontWeight: '400', // Regular
    lineHeight: 19,
    color: 'rgba(0, 0, 0, 0.75)', // 75% opacity black
  },
  tripCardSavedCount: {
    fontSize: 16,
    fontWeight: '400', // Regular
    lineHeight: 19,
    color: 'rgba(0, 0, 0, 0.75)', // 75% opacity black
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl * 1.25,
  },
  emptyStateTitle: {
    ...typography.h3,
    color: colors.text.secondary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  createTripButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + spacing.xs,
    borderRadius: borderRadius.sm,
  },
  createTripButtonText: {
    color: colors.onPrimary,
    ...typography.body,
    fontWeight: '500',
    marginLeft: spacing.sm,
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  // Settings modal styles
  settingsModalContainer: {
    width: '100%',
    maxWidth: 350,
  },
  settingsModalContent: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    ...shadows.large,
  },
  settingsModalTitle: {
    ...typography.h3,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  settingsModalSubtitle: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
    textAlign: 'center',
    lineHeight: 20,
  },
  settingsOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  settingsOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingsOptionText: {
    ...typography.body,
    color: colors.text.primary,
    marginLeft: spacing.sm + spacing.xs,
    fontWeight: '500',
  },
  deleteOptionText: {
    color: colors.error,
  },
  settingsCancelButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm + spacing.xs,
    alignItems: 'center',
    backgroundColor: colors.cardGrey,
    borderRadius: borderRadius.sm,
  },
  settingsCancelButtonText: {
    ...typography.body,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    ...shadows.large,
  },
  modalTitle: {
    ...typography.h2,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  modalSubtitle: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
    textAlign: 'center',
    lineHeight: 20,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + spacing.xs,
    ...typography.body,
    backgroundColor: colors.cardGrey,
    marginBottom: spacing.lg,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm + spacing.xs,
  },
  modalButton: {
    flex: 1,
    paddingVertical: spacing.sm + spacing.xs,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: colors.cardGrey,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    ...typography.body,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  saveButtonDisabled: {
    backgroundColor: colors.interactive.disabled,
  },
  saveButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.onPrimary,
  },
});

export default TripsListScreen;

