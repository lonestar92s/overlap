import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { Button, Overlay } from 'react-native-elements';
import { Calendar } from 'react-native-calendars';
import LocationAutocomplete from './LocationAutocomplete';
import { formatDateToLocalString, createDateRange } from '../utils/dateUtils';
import { colors, spacing, typography, borderRadius, shadows } from '../styles/designTokens';

const SearchModal = ({ 
  visible, 
  onClose, 
  onSearch, 
  initialLocation = null,
  initialDateFrom = null,
  initialDateTo = null,
  loading = false
}) => {
  const [location, setLocation] = useState(initialLocation);
  const [selectedDates, setSelectedDates] = useState({});
  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateTo, setDateTo] = useState(initialDateTo);
  const [showCalendar, setShowCalendar] = useState(false);

  // Update state when initial values change
  useEffect(() => {
    setLocation(initialLocation);
    setDateFrom(initialDateFrom);
    setDateTo(initialDateTo);
    
    // Set selected dates for calendar
    if (initialDateFrom && initialDateTo) {
      const dateRange = createDateRange(initialDateFrom, initialDateTo);
      const dates = {};
      dateRange.forEach((dateStr, index) => {
        dates[dateStr] = {
          selected: true,
          startingDay: index === 0,
          endingDay: index === dateRange.length - 1,
        };
      });
      setSelectedDates(dates);
    }
  }, [initialLocation, initialDateFrom, initialDateTo]);

  const formatDate = (date) => {
    if (!date) return null;
    return date.split('T')[0];
  };

  const formatDisplayDate = (dateString) => {
    if (!dateString) return 'Add dates';
    // Parse the date string safely without timezone conversion
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const onDayPress = (day) => {
    const selectedDate = day.dateString;
    
    if (!dateFrom || (dateFrom && dateTo)) {
      // Start new selection
      setDateFrom(selectedDate);
      setDateTo(null);
      setSelectedDates({
        [selectedDate]: {
          selected: true,
          startingDay: true,
          endingDay: true,
        }
      });
    } else {
      // Complete selection
      if (selectedDate < dateFrom) {
        // Swap dates if end is before start
        setDateFrom(selectedDate);
        setDateTo(dateFrom);
        const dateRange = createDateRange(selectedDate, dateFrom);
        const dates = {};
        dateRange.forEach((dateStr, index) => {
          dates[dateStr] = {
            selected: true,
            startingDay: index === 0,
            endingDay: index === dateRange.length - 1,
          };
        });
        setSelectedDates(dates);
      } else {
        setDateTo(selectedDate);
        const dateRange = createDateRange(dateFrom, selectedDate);
        const dates = {};
        dateRange.forEach((dateStr, index) => {
          dates[dateStr] = {
            selected: true,
            startingDay: index === 0,
            endingDay: index === dateRange.length - 1,
          };
        });
        setSelectedDates(dates);
      }
    }
  };

  const clearAll = () => {
    setLocation(null);
    setDateFrom(null);
    setDateTo(null);
    setSelectedDates({});
  };

  const handleSearch = async () => {
    if (!location) {
      Alert.alert('Error', 'Please select a location');
      return;
    }

    if (!dateFrom || !dateTo) {
      Alert.alert('Error', 'Please select your travel dates');
      return;
    }

    const searchParams = {
      location,
      dateFrom: formatDate(dateFrom),
      dateTo: formatDate(dateTo)
    };

    onSearch(searchParams);
  };

  return (
    <Overlay
      isVisible={visible}
      onBackdropPress={onClose}
      overlayStyle={styles.overlayStyle}
      animationType="slide"
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={onClose} 
            style={styles.closeButton}
            accessibilityLabel="Close search modal"
            accessibilityRole="button"
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Search</Text>
          <TouchableOpacity 
            onPress={clearAll} 
            style={styles.clearButton}
            accessibilityLabel="Clear all search filters"
            accessibilityRole="button"
          >
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>

        {/* Search Form */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={100}
          style={styles.keyboardAvoidingView}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.form}>
            {/* Location */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Where</Text>
              <LocationAutocomplete
                onLocationSelect={setLocation}
                initialValue={location?.city}
                placeholder="Search for a city"
              />
            </View>

            {/* Dates */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>When</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowCalendar(!showCalendar)}
                accessibilityLabel={dateFrom && dateTo 
                  ? `Selected dates: ${formatDisplayDate(dateFrom)} to ${formatDisplayDate(dateTo)}`
                  : 'Select travel dates'}
                accessibilityRole="button"
              >
                <Text style={styles.dateButtonText}>
                  {dateFrom && dateTo 
                    ? `${formatDisplayDate(dateFrom)} - ${formatDisplayDate(dateTo)}`
                    : 'Select dates'
                  }
                </Text>
              </TouchableOpacity>
            </View>

            {/* Calendar */}
            {showCalendar && (
              <View style={styles.calendarContainer}>
                <Calendar
                  onDayPress={onDayPress}
                  markedDates={selectedDates}
                  markingType="period"
                  theme={{
                    selectedDayBackgroundColor: '#007AFF',
                    selectedDayTextColor: '#ffffff',
                    todayTextColor: '#007AFF',
                    dayTextColor: '#2d4150',
                    textDisabledColor: '#d9e1e8',
                    arrowColor: '#007AFF',
                    monthTextColor: '#2d4150',
                    indicatorColor: '#007AFF',
                    textDayFontWeight: '300',
                    textMonthFontWeight: 'bold',
                    textDayHeaderFontWeight: '300',
                    textDayFontSize: 16,
                    textMonthFontSize: 16,
                    textDayHeaderFontSize: 13
                  }}
                />
              </View>
            )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Search Button */}
        <View style={styles.buttonContainer}>
          <Button
            title={loading ? "Searching..." : "Search Matches"}
            onPress={handleSearch}
            disabled={loading || !location || !dateFrom || !dateTo}
            loading={loading}
            buttonStyle={styles.searchButton}
            titleStyle={styles.searchButtonText}
          />
        </View>
      </View>
    </Overlay>
  );
};

const styles = StyleSheet.create({
  overlayStyle: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: 0,
    margin: spacing.lg,
    width: '90%',
    maxHeight: '80%',
  },
  container: {
    flex: 1,
    backgroundColor: colors.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 20,
    color: colors.primary,
  },
  headerTitle: {
    ...typography.h3,
    fontWeight: '600',
  },
  clearButton: {
    padding: 5,
  },
  clearButtonText: {
    ...typography.body,
    color: colors.primary,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  form: {
    flex: 1,
    padding: spacing.lg,
  },
  section: {
    marginBottom: spacing.xxl,
  },
  sectionTitle: {
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
  buttonContainer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  searchButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.sm,
  },
  searchButtonText: {
    ...typography.button,
  },
});

export default SearchModal;

