import React, { useState, useEffect, useRef } from 'react';
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
import FlightSearchTab from './FlightSearchTab';
import MatchSearchTab from './MatchSearchTab';
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
  const [activeTab, setActiveTab] = useState('matches'); // 'matches' or 'flights'
  const [location, setLocation] = useState(initialLocation);
  const [selectedDates, setSelectedDates] = useState({});
  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateTo, setDateTo] = useState(initialDateTo);
  const [showCalendar, setShowCalendar] = useState(false);
  const prevLocationRef = useRef(initialLocation);

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

  // Auto-open calendar when location is first selected (transitions from null to a value)
  useEffect(() => {
    const prevLocation = prevLocationRef.current;
    // Only open calendar if location changed from null/undefined to a truthy value
    if (location && !prevLocation) {
      if (__DEV__) {
        console.log('[SearchModal] Location selected, auto-opening calendar:', location?.city, location?.country);
      }
      setShowCalendar(true);
    }
    prevLocationRef.current = location;
  }, [location]);

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

        {/* Tab Navigation */}
        {/* Flights tab commented out - no booking capability yet */}
        {/* <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'matches' && styles.activeTab]}
            onPress={() => setActiveTab('matches')}
            activeOpacity={0.7}
            accessibilityLabel="Search matches"
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'matches' }}
          >
            <Text style={[
              styles.tabText,
              activeTab === 'matches' && styles.activeTabText
            ]}>
              Matches
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tab, activeTab === 'flights' && styles.activeTab]}
            onPress={() => setActiveTab('flights')}
            activeOpacity={0.7}
            accessibilityLabel="Search flights"
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'flights' }}
          >
            <Text style={[
              styles.tabText,
              activeTab === 'flights' && styles.activeTabText
            ]}>
              Flights
            </Text>
          </TouchableOpacity>
        </View> */}

        {/* Tab Content */}
        {/* {activeTab === 'matches' ? ( */}
          <MatchSearchTab
            location={location}
            setLocation={setLocation}
            dateFrom={dateFrom}
            setDateFrom={setDateFrom}
            dateTo={dateTo}
            setDateTo={setDateTo}
            selectedDates={selectedDates}
            setSelectedDates={setSelectedDates}
            showCalendar={showCalendar}
            setShowCalendar={setShowCalendar}
            onDayPress={onDayPress}
            formatDisplayDate={formatDisplayDate}
            handleSearch={handleSearch}
            loading={loading}
          />
        {/* ) : (
          <FlightSearchTab
            onClose={onClose}
            dateFrom={dateFrom}
            dateTo={dateTo}
          />
        )} */}
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.cardGrey,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 48,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.xs,
    alignItems: 'center',
    marginHorizontal: spacing.xs,
  },
  activeTab: {
    backgroundColor: colors.card,
  },
  tabText: {
    ...typography.body,
    color: colors.text.secondary,
    fontWeight: '500',
    fontSize: 16,
  },
  activeTabText: {
    color: colors.text.primary,
    fontWeight: '600',
    fontSize: 16,
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

