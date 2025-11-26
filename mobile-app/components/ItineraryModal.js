import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Calendar } from 'react-native-calendars';
import { useItineraries } from '../contexts/ItineraryContext';
import ErrorBoundary from './ErrorBoundary';
import { colors, spacing, typography, borderRadius, shadows } from '../styles/designTokens';
import { createDateRange } from '../utils/dateUtils';

const ItineraryModal = ({ visible, onClose, matchData, onSave }) => {
  const { itineraries, createItinerary, addMatchToItinerary } = useItineraries();
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newItineraryName, setNewItineraryName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDates, setSelectedDates] = useState({});

  // Initialize dates from match when modal opens or matchData changes
  useEffect(() => {
    if (matchData && visible) {
      const matchDate = matchData.fixture?.date || matchData.date;
      if (matchDate) {
        const dateStr = new Date(matchDate).toISOString().split('T')[0];
        setStartDate(dateStr);
        setEndDate(dateStr);
        setSelectedDates({
          [dateStr]: {
            selected: true,
            startingDay: true,
            endingDay: true,
          }
        });
      }
    }
  }, [matchData, visible]);

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
        startDate ? new Date(startDate).toISOString() : null, // startDate
        endDate ? new Date(endDate).toISOString() : null  // endDate
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
      setStartDate(null);
      setEndDate(null);
      setSelectedDates({});
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

  const formatDisplayDate = (dateString) => {
    if (!dateString) return 'Select date';
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const onDayPress = (day) => {
    const selectedDate = day.dateString;
    
    if (!startDate || (startDate && endDate)) {
      // Start new selection
      setStartDate(selectedDate);
      setEndDate(null);
      setSelectedDates({
        [selectedDate]: {
          selected: true,
          startingDay: true,
          endingDay: true,
          color: colors.primary,
          textColor: '#ffffff',
        }
      });
    } else {
      // Complete selection
      if (selectedDate < startDate) {
        // Swap dates if end is before start
        setStartDate(selectedDate);
        setEndDate(startDate);
        const dateRange = createDateRange(selectedDate, startDate);
        const dates = {};
        dateRange.forEach((dateStr, index) => {
          dates[dateStr] = {
            selected: true,
            startingDay: index === 0,
            endingDay: index === dateRange.length - 1,
            color: colors.primary,
            textColor: index === 0 || index === dateRange.length - 1 ? '#ffffff' : colors.text.primary,
          };
        });
        setSelectedDates(dates);
      } else {
        setEndDate(selectedDate);
        const dateRange = createDateRange(startDate, selectedDate);
        const dates = {};
        dateRange.forEach((dateStr, index) => {
          dates[dateStr] = {
            selected: true,
            startingDay: index === 0,
            endingDay: index === dateRange.length - 1,
            color: colors.primary,
            textColor: index === 0 || index === dateRange.length - 1 ? '#ffffff' : colors.text.primary,
          };
        });
        setSelectedDates(dates);
      }
      // Auto-close calendar after selecting date range
      setTimeout(() => setShowCalendar(false), 500);
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

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingView}
        >
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
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
                      {(() => {
                        // Prefer stored dates, fallback to calculated dates from matches
                        if (itinerary.startDate && itinerary.endDate) {
                          return `${new Date(itinerary.startDate).toLocaleDateString()} - ${new Date(itinerary.endDate).toLocaleDateString()}`;
                        }
                        
                        // Fallback to calculating from matches
                        if (itinerary.matches && itinerary.matches.length > 0) {
                          const dates = itinerary.matches
                            .map(m => new Date(m.date))
                            .filter(d => !isNaN(d.getTime()))
                            .sort((a, b) => a - b);
                          
                          if (dates.length > 0) {
                            const start = dates[0];
                            const end = dates[dates.length - 1];
                            return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
                          }
                        }
                        
                        return 'Dates TBD';
                      })()}
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
                
                {/* Date Range Selection */}
                <View style={styles.dateSection}>
                  <Text style={styles.dateLabel}>Trip Dates (optional)</Text>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowCalendar(!showCalendar)}
                  >
                    <Text style={styles.dateButtonText}>
                      {startDate && endDate
                        ? `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`
                        : startDate
                        ? `${formatDisplayDate(startDate)} - Select end date`
                        : 'Select dates'}
                    </Text>
                  </TouchableOpacity>
                  
                  {showCalendar && (
                    <View style={styles.calendarContainer}>
                      <Calendar
                        onDayPress={onDayPress}
                        markedDates={selectedDates}
                        markingType="period"
                        minDate={new Date().toISOString().split('T')[0]}
                        theme={{
                          selectedDayBackgroundColor: colors.primary,
                          selectedDayTextColor: '#ffffff',
                          todayTextColor: colors.primary,
                          dayTextColor: '#2d4150',
                          textDisabledColor: '#d9e1e8',
                          arrowColor: colors.primary,
                          monthTextColor: '#2d4150',
                          indicatorColor: colors.primary,
                          textDayFontWeight: '300',
                          textMonthFontWeight: 'bold',
                          textDayHeaderFontWeight: '300',
                          textDayFontSize: 16,
                          textMonthFontSize: 16,
                          textDayHeaderFontSize: 13,
                          calendarBackground: colors.card,
                        }}
                      />
                    </View>
                  )}
                </View>
                
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
        </KeyboardAvoidingView>
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
  keyboardAvoidingView: {
    flex: 1,
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
  dateSection: {
    marginBottom: spacing.md + spacing.xs,
  },
  dateLabel: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.sm,
    color: colors.text.primary,
  },
  dateButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    backgroundColor: colors.cardGrey,
  },
  dateButtonText: {
    ...typography.body,
    color: colors.text.primary,
  },
  calendarContainer: {
    marginTop: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: borderRadius.sm,
    ...shadows.small,
  },
});

export default ItineraryModal;
