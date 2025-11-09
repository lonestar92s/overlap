import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useItineraries } from '../contexts/ItineraryContext';
import ErrorBoundary from './ErrorBoundary';
import { colors, spacing, typography, borderRadius, shadows } from '../styles/designTokens';

const ItineraryModal = ({ visible, onClose, matchData, onSave }) => {
  const { itineraries, createItinerary, addMatchToItinerary } = useItineraries();
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newItineraryName, setNewItineraryName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleSaveToExisting = async (itineraryId) => {
    try {
      const matchInfo = formatMatchInfo();
      await addMatchToItinerary(itineraryId, matchInfo);
      
      // Trigger success haptic feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      Alert.alert('Success', 'Match added to itinerary!');
      onSave();
      onClose();
    } catch (error) {
      if (__DEV__) {
        console.error('Error adding match to itinerary:', error);
      }
      
      // Trigger error haptic feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      Alert.alert('Error', 'Failed to add match to itinerary');
    }
  };

  const handleCreateNewItinerary = async () => {
    setIsCreating(true);
    try {
      const newItinerary = await createItinerary(
        newItineraryName.trim(),
        null, // destination
        null, // startDate
        null  // endDate
      );

      // Add the match to the new itinerary
      const matchInfo = formatMatchInfo();
      await addMatchToItinerary(newItinerary.id || newItinerary._id, matchInfo);
      
      // Trigger success haptic feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      Alert.alert('Success', 'New itinerary created and match added!');
      onSave();
      onClose();
      
      // Reset form
      setNewItineraryName('');
      setShowCreateForm(false);
    } catch (error) {
      if (__DEV__) {
        console.error('Error creating itinerary:', error);
      }
      
      // Trigger error haptic feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      Alert.alert('Error', 'Failed to create itinerary');
    } finally {
      setIsCreating(false);
    }
  };

  const formatMatchInfo = () => {

    
    // Extract the fields that the backend API expects
    const matchId = matchData.id || matchData.fixture?.id;
    const homeTeamName = matchData.teams?.home?.name || matchData.homeTeam || 'Unknown';
    const awayTeamName = matchData.teams?.away?.name || matchData.awayTeam || 'Unknown';
    const homeTeamLogo = matchData.teams?.home?.logo || '';
    const awayTeamLogo = matchData.teams?.away?.logo || '';
    const league = matchData.league?.name || matchData.competition?.name || 'Unknown League';
    const venue = matchData.fixture?.venue?.name || matchData.venue?.name || 'Unknown Venue';
    const date = matchData.fixture?.date || matchData.date;
    
    // IMPORTANT: Save the complete venue object for map functionality
    let venueData = matchData.fixture?.venue || matchData.venue || {};
    
    // Ensure venue data has the required structure for maps and recommendations
    // IMPORTANT: Preserve the image property when recreating venueData
    if (!venueData.coordinates && venueData.name && venueData.city) {
      // If coordinates are missing but we have name/city, create a proper venue object
      // Spread venueData first to preserve all properties (including image), then override specific fields
      venueData = {
        ...venueData, // Keep all original properties including image, id, capacity, surface, address, etc.
        name: venueData.name,
        city: venueData.city,
        country: venueData.country || matchData.league?.country || 'Unknown Country',
        coordinates: null, // Will be geocoded by the backend when needed
      };
    }
    

    
    // Return the format expected by the backend API
    // IMPORTANT: Match the exact Mongoose schema structure but enhance with venue data
    return {
      matchId,
      homeTeam: {
        name: homeTeamName,
        logo: homeTeamLogo
      },
      awayTeam: {
        name: awayTeamName,
        logo: awayTeamLogo
      },
      league,
      venue,  // Keep string for backend compatibility
      venueData: venueData,  // Add complete venue object for map functionality
      date: date ? new Date(date).toISOString() : new Date().toISOString()
    };
  };

  // Get match info for display
  const matchInfo = formatMatchInfo();
  
  return (
    <ErrorBoundary>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Save to Itinerary</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="close" size={24} color="#333" />
          </TouchableOpacity>
        </View>

        {/* Match Info */}
        <View style={styles.matchInfo}>
          <Text style={styles.matchTitle}>
            {matchInfo.homeTeam?.name || matchInfo.teams?.home?.name || 'Unknown'} vs {matchInfo.awayTeam?.name || matchInfo.teams?.away?.name || 'Unknown'}
          </Text>
          <Text style={styles.matchDetails}>
            {matchInfo.league || 'Unknown League'} • {matchInfo.venue || 'Unknown Venue'}
          </Text>
          <Text style={styles.matchDate}>
            {matchInfo.date ? new Date(matchInfo.date).toLocaleDateString() : 'TBD'}
          </Text>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Existing Itineraries */}
          {itineraries.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Save to existing itinerary</Text>
              {itineraries.map((itinerary) => (
                <TouchableOpacity
                  key={itinerary.id || itinerary._id}
                  style={styles.itineraryItem}
                  onPress={() => handleSaveToExisting(itinerary.id || itinerary._id)}
                >
                  <View style={styles.itineraryInfo}>
                    <Text style={styles.itineraryName}>{itinerary.name}</Text>
                    <Text style={styles.itineraryDestination}>{itinerary.destination}</Text>
                    <Text style={styles.itineraryDates}>
                      {itinerary.startDate && itinerary.endDate 
                        ? `${new Date(itinerary.startDate).toLocaleDateString()} - ${new Date(itinerary.endDate).toLocaleDateString()}`
                        : 'Dates TBD'
                      }
                    </Text>
                    <Text style={styles.matchCount}>
                      {itinerary.matches.length} match{itinerary.matches.length !== 1 ? 'es' : ''}
                    </Text>
                  </View>
                  <Icon name="add" size={24} color="#1976d2" />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Create New Itinerary */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => setShowCreateForm(!showCreateForm)}
            >
              <Icon 
                name={showCreateForm ? "expand-less" : "expand-more"} 
                size={24} 
                color="#1976d2" 
              />
              <Text style={styles.createButtonText}>Create new itinerary</Text>
            </TouchableOpacity>

            {showCreateForm && (
              <View style={styles.createForm}>
                <TextInput
                  style={styles.input}
                  placeholder="Itinerary name (e.g., London Football Trip)"
                  placeholderTextColor="#666"
                  value={newItineraryName}
                  onChangeText={setNewItineraryName}
                />
                
                <TouchableOpacity
                  style={[
                    styles.saveButton, 
                    (!newItineraryName.trim() || isCreating) && styles.saveButtonDisabled
                  ]}
                  onPress={handleCreateNewItinerary}
                  disabled={!newItineraryName.trim() || isCreating}
                >
                  {isCreating ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Create & Save Match</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
      </Modal>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.h3,
    fontWeight: '600',
    color: colors.text.primary,
  },
  closeButton: {
    padding: spacing.xs + 1,
  },
  matchInfo: {
    padding: spacing.lg,
    backgroundColor: colors.cardGrey,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  matchTitle: {
    ...typography.h2,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.xs + 1,
  },
  matchDetails: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: 3, // Small gap between details lines
  },
  matchDate: {
    ...typography.bodySmall,
    color: colors.text.light,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl + spacing.sm,
  },
  sectionTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.md + spacing.xs,
  },
  itineraryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md + spacing.xs,
    paddingHorizontal: spacing.md + spacing.xs,
    backgroundColor: colors.cardGrey,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm + spacing.xs,
  },
  itineraryInfo: {
    flex: 1,
  },
  itineraryName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 3, // Small gap between name and destination
  },
  itineraryDestination: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginBottom: 3, // Small gap between destination and dates
  },
  itineraryDates: {
    ...typography.caption,
    color: colors.text.light,
    marginBottom: 3, // Small gap between dates and match count
  },
  matchCount: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '500',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md + spacing.xs,
    paddingHorizontal: spacing.md + spacing.xs,
    backgroundColor: colors.status.attendancePromptBg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  createButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: spacing.sm + spacing.xs,
  },
  createForm: {
    marginTop: spacing.md + spacing.xs,
    padding: spacing.md + spacing.xs,
    backgroundColor: colors.cardGrey,
    borderRadius: borderRadius.md,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md + spacing.xs,
    paddingVertical: spacing.sm + spacing.xs,
    ...typography.body,
    marginBottom: spacing.md + spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.md + spacing.xs,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: colors.interactive.disabled,
  },
  saveButtonText: {
    color: colors.onPrimary,
    ...typography.body,
    fontWeight: '600',
  },
});

export default ItineraryModal;
