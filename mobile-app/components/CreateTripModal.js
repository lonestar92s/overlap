import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Calendar } from 'react-native-calendars';
import { useItineraries } from '../contexts/ItineraryContext';
import { colors, spacing, typography, borderRadius, shadows } from '../styles/designTokens';
import { createDateRange } from '../utils/dateUtils';

const CreateTripModal = ({ visible, onClose, onTripCreated }) => {
  const { createItinerary } = useItineraries();
  
  const [tripName, setTripName] = useState('');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDates, setSelectedDates] = useState({});
  const [isCreating, setIsCreating] = useState(false);

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

  const handleCreate = async () => {
    if (!tripName.trim()) {
      Alert.alert('Error', 'Please enter a trip name');
      return;
    }

    if (!startDate || !endDate) {
      Alert.alert('Error', 'Please select both start and end dates');
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      Alert.alert('Error', 'End date must be after start date');
      return;
    }

    setIsCreating(true);
    try {
      await createItinerary(
        tripName.trim(),
        null, // destination
        new Date(startDate).toISOString(),
        new Date(endDate).toISOString()
      );
      
      // Reset form
      setTripName('');
      setStartDate(null);
      setEndDate(null);
      setSelectedDates({});
      setShowCalendar(false);
      
      if (onTripCreated) {
        onTripCreated();
      }
      
      onClose();
    } catch (error) {
      if (__DEV__) {
        console.error('Error creating trip:', error);
      }
      Alert.alert('Error', 'Failed to create trip. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setTripName('');
    setStartDate(null);
    setEndDate(null);
    setSelectedDates({});
    setShowCalendar(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Create New Trip</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Icon name="close" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.form}>
            <Text style={styles.label}>Trip Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., London Football Trip"
              placeholderTextColor={colors.text.light}
              value={tripName}
              onChangeText={setTripName}
              autoFocus={true}
              maxLength={50}
            />

            <Text style={styles.label}>Trip Dates *</Text>
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

            <TouchableOpacity
              style={[
                styles.createButton,
                (!tripName.trim() || !startDate || !endDate || isCreating) && styles.createButtonDisabled
              ]}
              onPress={handleCreate}
              disabled={!tripName.trim() || !startDate || !endDate || isCreating}
            >
              {isCreating ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <Text style={styles.createButtonText}>Create Trip</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
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
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  form: {
    flex: 1,
  },
  label: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.cardGrey,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md + spacing.xs,
    paddingVertical: spacing.sm + spacing.xs,
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  dateButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    backgroundColor: colors.cardGrey,
    marginBottom: spacing.md,
  },
  dateButtonText: {
    ...typography.body,
    color: colors.text.primary,
  },
  calendarContainer: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    backgroundColor: colors.card,
    borderRadius: borderRadius.sm,
    ...shadows.small,
  },
  createButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.md + spacing.xs,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  createButtonDisabled: {
    backgroundColor: colors.interactive.disabled,
  },
  createButtonText: {
    color: colors.onPrimary,
    ...typography.body,
    fontWeight: '600',
  },
});

export default CreateTripModal;

