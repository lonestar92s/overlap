import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  SafeAreaView,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import LocationAutocomplete from './LocationAutocomplete';
import { getTodayLocalString, createDateRange } from '../utils/dateUtils';
import { colors, spacing, typography, borderRadius } from '../styles/designTokens';

const OverlapSearchScreen = ({
  onClose,
  onSearch,
  initialLocation = null,
  initialDateFrom = null,
  initialDateTo = null,
  recentSearches = [],
  suggestedTeams = [],
}) => {
  const [location, setLocation] = useState(initialLocation);
  const [selectedDates, setSelectedDates] = useState({});
  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateTo, setDateTo] = useState(initialDateTo);
  const [showCalendar, setShowCalendar] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (initialDateFrom && initialDateTo) {
      const dateRange = createDateRange(initialDateFrom, initialDateTo);
      const dates = {};
      dateRange.forEach((dateStr, index) => {
        dates[dateStr] = {
          selected: true,
          startingDay: index === 0,
          endingDay: index === dateRange.length - 1,
          color: '#000',
          textColor: '#fff',
        };
      });
      setSelectedDates(dates);
    }
  }, [initialDateFrom, initialDateTo]);

  const formatDateRange = () => {
    if (!dateFrom && !dateTo) return 'Add Dates';
    if (dateFrom && !dateTo) {
      const date = new Date(dateFrom.replace(/-/g, '/'));
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    if (dateFrom && dateTo) {
      const fromDate = new Date(dateFrom.replace(/-/g, '/'));
      const toDate = new Date(dateTo.replace(/-/g, '/'));
      return `${fromDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${toDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
    return 'Add Dates';
  };

  const onDayPress = (day) => {
    const dateString = day.dateString;

    if (!dateFrom || (dateFrom && dateTo)) {
      setDateFrom(dateString);
      setDateTo(null);
      setSelectedDates({
        [dateString]: {
          selected: true,
          startingDay: true,
          color: '#000',
          textColor: '#fff',
        },
      });
    } else if (dateFrom && !dateTo) {
      if (dateString < dateFrom) {
        setDateFrom(dateString);
        setDateTo(null);
        setSelectedDates({
          [dateString]: {
            selected: true,
            startingDay: true,
            color: '#000',
            textColor: '#fff',
          },
        });
      } else {
        setDateTo(dateString);
        const dateRange = createDateRange(dateFrom, dateString);
        const range = {};
        dateRange.forEach((dateStr, index) => {
          if (index === 0) {
            range[dateStr] = {
              selected: true,
              startingDay: true,
              color: '#000',
              textColor: '#fff',
            };
          } else if (index === dateRange.length - 1) {
            range[dateStr] = {
              selected: true,
              endingDay: true,
              color: '#000',
              textColor: '#fff',
            };
          } else {
            range[dateStr] = {
              selected: true,
              color: '#e0e0e0',
              textColor: '#000',
            };
          }
        });
        setSelectedDates(range);
        setTimeout(() => setShowCalendar(false), 500);
      }
    }
  };

  const clearAll = () => {
    setLocation(null);
    setDateFrom(null);
    setDateTo(null);
    setSelectedDates({});
    setSearchQuery('');
    setIsTyping(false);
  };

  const handleSearch = () => {
    if (!location && !dateFrom) {
      return;
    }

    const searchParams = {
      location,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
    };

    if (onSearch) {
      onSearch(searchParams);
    }
  };

  const renderRecentSearch = ({ item }) => (
    <TouchableOpacity style={styles.recentSearchItem} onPress={() => handleRecentSearchPress(item)}>
      <View style={styles.recentSearchIcon}>
        <MaterialIcons name="location-on" size={40} color="#000" />
      </View>
      <View style={styles.recentSearchContent}>
        <Text style={styles.recentSearchTitle}>{item.location || 'London'}</Text>
        <Text style={styles.recentSearchSubtitle}>Matches happening near you</Text>
      </View>
    </TouchableOpacity>
  );

  const renderSuggestedTeam = ({ item }) => (
    <TouchableOpacity style={styles.suggestedTeamItem}>
      <View style={styles.teamIcon}>
        <View style={styles.teamIconCircle}>
          <Text style={styles.teamIconText}>{item.name?.[0] || 'T'}</Text>
        </View>
      </View>
      <View style={styles.suggestedTeamContent}>
        <Text style={styles.suggestedTeamTitle}>{item.name || 'Team Name'}</Text>
        <Text style={styles.suggestedTeamSubtitle}>{item.country || 'Spain'}</Text>
      </View>
    </TouchableOpacity>
  );

  const handleRecentSearchPress = (item) => {
    // Handle recent search selection
    if (item.location) {
      // Navigate or set location
    }
  };

  const handleSearchInputChange = (text) => {
    setSearchQuery(text);
    setIsTyping(text.length > 0);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#D9E8F2" />
      
      {/* Status Bar Background */}
      <View style={styles.statusBarBackground} />

      {/* Main Content */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={0}
      >
        <View style={styles.searchContainer}>
          {/* Search Input */}
          <View style={styles.searchInputWrapper}>
            {isTyping ? (
              <TouchableOpacity
                style={styles.searchInputContainer}
                onPress={() => setIsTyping(false)}
              >
                <MaterialIcons name="arrow-back" size={25} color="#000" />
              <View style={styles.searchInputTextContainer}>
                <View style={styles.searchInputDivider} />
                <Text style={styles.searchInputPlaceholder}>Search by location</Text>
              </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.searchButtonContainer}>
                <MaterialIcons name="close" size={25} color="#000" style={styles.closeIcon} />
                <Text style={styles.searchButtonText}>Search by location</Text>
              </View>
            )}
          </View>

          {/* Filter Buttons */}
          <View style={styles.filterButtonsContainer}>
              <TouchableOpacity
              style={[styles.filterButton, { marginBottom: 16 }]}
              onPress={() => setShowCalendar(!showCalendar)}
            >
              <Text style={styles.filterLabel}>When</Text>
              <View style={styles.filterButtonContent}>
                <Text style={styles.filterButtonTextValue}>{formatDateRange()}</Text>
                <MaterialIcons name="keyboard-arrow-down" size={24} color="#000" style={{ marginLeft: 8 }} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.filterButton}>
              <Text style={styles.filterLabel}>Who</Text>
              <View style={styles.filterButtonContent}>
                <Text style={styles.filterButtonTextValue}>Add Dates</Text>
                <MaterialIcons name="keyboard-arrow-down" size={24} color="#000" style={{ marginLeft: 8 }} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Search Card with Recent Searches and Suggestions */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.searchCard}>
              {/* Location Autocomplete */}
              <LocationAutocomplete
                value={location}
                onSelect={setLocation}
                placeholder="Search destinations"
                style={styles.locationAutocomplete}
              />

              {/* Recent Searches Section */}
              {recentSearches.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Recent searches</Text>
                  <FlatList
                    data={recentSearches}
                    renderItem={renderRecentSearch}
                    keyExtractor={(item, index) => `recent-${index}`}
                    scrollEnabled={false}
                  />
                </View>
              )}

              {/* Suggested Teams Section */}
              {suggestedTeams.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Suggested Teams</Text>
                  <FlatList
                    data={suggestedTeams}
                    renderItem={renderSuggestedTeam}
                    keyExtractor={(item, index) => `team-${index}`}
                    scrollEnabled={false}
                  />
                </View>
              )}
            </View>

            {/* Calendar */}
            {showCalendar && (
              <View style={styles.calendarContainer}>
                <Calendar
                  onDayPress={onDayPress}
                  markingType="period"
                  markedDates={selectedDates}
                  minDate={getTodayLocalString()}
                  theme={{
                    selectedDayBackgroundColor: '#000',
                    selectedDayTextColor: '#fff',
                    todayTextColor: '#000',
                    dayTextColor: '#000',
                    textDisabledColor: 'rgba(0,0,0,0.3)',
                    arrowColor: '#000',
                    monthTextColor: '#000',
                    textDayFontWeight: '500',
                    textMonthFontWeight: 'bold',
                    textDayHeaderFontWeight: '600',
                  }}
                />
              </View>
            )}
          </ScrollView>

          {/* Bottom Action Bar */}
          <View style={styles.actionBar}>
            <TouchableOpacity onPress={clearAll} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>Clear All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.searchButton,
                (!location && !dateFrom) && styles.searchButtonDisabled,
              ]}
              onPress={handleSearch}
              disabled={!location && !dateFrom}
            >
              <Text style={styles.searchButtonTextAction}>Search</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  statusBarBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: '#D9E8F2',
  },
  keyboardView: {
    flex: 1,
  },
  searchContainer: {
    flex: 1,
    paddingTop: 55,
  },
  searchInputWrapper: {
    paddingHorizontal: 32,
    marginBottom: 24,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  searchInputTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInputDivider: {
    width: 18,
    height: 1,
    backgroundColor: '#000',
    marginRight: 2,
    transform: [{ rotate: '90deg' }],
  },
  searchInputPlaceholder: {
    fontSize: 16,
    color: 'rgba(0,0,0,0.5)',
    fontFamily: 'Helvetica Neue',
  },
  searchButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeIcon: {
    marginRight: 8,
  },
  searchButtonText: {
    fontSize: 16,
    color: 'rgba(0,0,0,0.5)',
    fontFamily: 'Helvetica Neue',
  },
  filterButtonsContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  filterButton: {
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 14,
    paddingHorizontal: 32,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 60,
  },
  filterLabel: {
    fontSize: 12,
    color: 'rgba(0,0,0,0.5)',
    fontFamily: 'Helvetica Neue',
    fontWeight: '400',
  },
  filterButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterButtonTextValue: {
    fontSize: 12,
    color: '#000',
    fontFamily: 'Helvetica Neue',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  searchCard: {
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 14,
    marginHorizontal: 20,
    padding: 32,
    minHeight: 563,
  },
  locationAutocomplete: {
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    color: 'rgba(0,0,0,0.5)',
    fontFamily: 'Helvetica Neue',
    marginBottom: 11,
  },
  recentSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 8,
  },
  recentSearchIcon: {
    width: 40,
    height: 40,
    marginRight: 36,
  },
  recentSearchContent: {
    flex: 1,
  },
  recentSearchTitle: {
    fontSize: 12,
    color: '#000',
    fontFamily: 'Helvetica Neue',
    marginBottom: 7,
  },
  recentSearchSubtitle: {
    fontSize: 12,
    color: 'rgba(0,0,0,0.5)',
    fontFamily: 'Helvetica Neue',
  },
  suggestedTeamItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 8,
  },
  teamIcon: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 36,
  },
  teamIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamIconText: {
    fontSize: 16,
    color: '#000',
  },
  suggestedTeamContent: {
    flex: 1,
  },
  suggestedTeamTitle: {
    fontSize: 12,
    color: '#000',
    fontFamily: 'Helvetica Neue',
    marginBottom: 7,
  },
  suggestedTeamSubtitle: {
    fontSize: 12,
    color: 'rgba(0,0,0,0.5)',
    fontFamily: 'Helvetica Neue',
  },
  calendarContainer: {
    marginHorizontal: 20,
    marginTop: 24,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 46,
    paddingVertical: 16,
    backgroundColor: '#fff',
  },
  clearButton: {
    backgroundColor: '#F06161',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  clearButtonText: {
    fontSize: 12,
    color: '#000',
    fontFamily: 'Helvetica Neue',
    fontWeight: '500',
  },
  searchButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchButtonDisabled: {
    opacity: 0.5,
  },
  searchButtonTextAction: {
    fontSize: 12,
    color: '#000',
    fontFamily: 'Helvetica Neue',
  },
  filterButtonTextValue: {
    fontSize: 12,
    color: '#000',
    fontFamily: 'Helvetica Neue',
    fontWeight: '500',
  },
});

export default OverlapSearchScreen;

