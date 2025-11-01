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
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useItineraries } from '../contexts/ItineraryContext';
import { colors, spacing, typography, borderRadius, shadows } from '../styles/designTokens';

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
          onPress: () => deleteItinerary(itinerary.id || itinerary._id)
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

  const renderItineraryItem = ({ item }) => (
    <View style={styles.itineraryCard}>
      <TouchableOpacity
        style={styles.itineraryContent}
        onPress={() => handleItineraryPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.itineraryHeader}>
          <View style={styles.itineraryInfo}>
            <Text style={styles.itineraryName}>{item.name}</Text>
          </View>
          <View style={styles.itineraryStats}>
            <Text style={styles.matchCount}>{item.matches?.length || 0} matches</Text>
            <Icon name="chevron-right" size={24} color={colors.text.light} />
          </View>
        </View>
        
        {item.matches && item.matches.length > 0 && (
          <View style={styles.matchesPreview}>
            <Text style={styles.matchesPreviewTitle}>Upcoming matches:</Text>
            {item.matches.slice(0, 3).map((match, index) => {
              const homeTeam = match.homeTeam?.name || match.teams?.home?.name || 'Unknown';
              const awayTeam = match.awayTeam?.name || match.teams?.away?.name || 'Unknown';
              const date = match.date;
              return (
                <Text key={match.matchId || `match-${index}`} style={styles.matchPreview}>
                  {homeTeam} vs {awayTeam} - {date ? new Date(date).toLocaleDateString() : 'TBD'}
                </Text>
              );
            })}
            {item.matches.length > 3 && (
              <Text style={styles.moreMatches}>+{item.matches.length - 3} more</Text>
            )}
          </View>
        )}
      </TouchableOpacity>
      
      {/* Settings Button */}
      <TouchableOpacity
        style={styles.settingsButton}
        onPress={() => handleSettingsPress(item)}
        activeOpacity={0.7}
      >
        <Icon name="more-vert" size={20} color={colors.text.secondary} />
      </TouchableOpacity>
    </View>
  );

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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Trips</Text>
        <Text style={styles.headerSubtitle}>
          {itineraries.length} {itineraries.length === 1 ? 'itinerary' : 'itineraries'}
        </Text>
        <Text style={styles.headerNote}>Shows all your planned trips and saved matches</Text>
      </View>

      {itineraries.length > 0 ? (
        <FlatList
          data={itineraries}
          renderItem={renderItineraryItem}
          keyExtractor={(item) => item.id || item._id}
          contentContainerStyle={styles.listContainer}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          showsVerticalScrollIndicator={false}
        />
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
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.lg,
    paddingTop: spacing.lg, // SafeAreaView handles safe area, this is additional spacing
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.h1Large,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  headerNote: {
    ...typography.caption,
    color: colors.text.light,
    fontStyle: 'italic',
    marginBottom: spacing.xs / 2,
  },
  headerTip: {
    fontSize: 11,
    color: colors.text.secondary,
    fontStyle: 'italic',
  },
  listContainer: {
    padding: spacing.md,
  },
  itineraryCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    ...shadows.small,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  itineraryContent: {
    flex: 1,
    padding: spacing.md,
  },
  settingsButton: {
    backgroundColor: colors.cardGrey,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopRightRadius: borderRadius.md,
    borderBottomRightRadius: borderRadius.md,
  },
  itineraryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm + spacing.xs,
  },
  itineraryInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  itineraryName: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  itineraryDestination: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginBottom: spacing.xs / 2,
  },
  itineraryDates: {
    ...typography.bodySmall,
    color: colors.text.secondary,
  },
  itineraryStats: {
    alignItems: 'center',
  },
  matchCount: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  matchesPreview: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.sm + spacing.xs,
  },
  matchesPreviewTitle: {
    ...typography.bodySmall,
    fontWeight: '500',
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  matchPreview: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  moreMatches: {
    fontSize: 13,
    color: colors.text.secondary,
    fontStyle: 'italic',
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

