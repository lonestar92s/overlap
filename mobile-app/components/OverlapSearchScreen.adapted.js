/**
 * Adapted version of OverlapSearchScreen that matches the existing app design
 * Uses the app's design tokens instead of the bold Figma design
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
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
import { colors, spacing, typography, borderRadius, shadows } from '../styles/designTokens';

const OverlapSearchScreenAdapted = ({
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
          color: colors.primary,
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
          color: colors.primary,
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
            color: colors.primary,
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
              color: colors.primary,
              textColor: '#fff',
            };
          } else if (index === dateRange.length - 1) {
            range[dateStr] = {
              selected: true,
              endingDay: true,
              color: colors.primary,
              textColor: '#fff',
            };
          } else {
            range[dateStr] = {
              selected: true,
              color: '#e3f2fd',
              textColor: colors.primary,
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
        <MaterialIcons name="location-on" size={20} color={colors.primary} />
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
    if (item.location) {
      // Handle recent search selection
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      
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
                <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
                <View style={styles.searchInputTextContainer}>
                  <Text style={styles.searchInputPlaceholder}>Search by location</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.searchButtonContainer}>
                <MaterialIcons name="close" size={24} color={colors.text.secondary} style={styles.closeIcon} />
                <Text style={styles.searchButtonText}>Search by location</Text>
              </View>
            )}
          </View>

          {/* Filter Buttons */}
          <View style={styles.filterButtonsContainer}>
            <TouchableOpacity
              style={[styles.filterButton, { marginBottom: spacing.md }]}
              onPress={() => setShowCalendar(!showCalendar)}
            >
              <Text style={styles.filterLabel}>When</Text>
              <View style={styles.filterButtonContent}>
                <Text style={styles.filterButtonTextValue}>{formatDateRange()}</Text>
                <MaterialIcons name="keyboard-arrow-down" size={24} color={colors.text.primary} style={{ marginLeft: spacing.sm }} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.filterButton}>
              <Text style={styles.filterLabel}>Who</Text>
              <View style={styles.filterButtonContent}>
                <Text style={styles.filterButtonTextValue}>Add Dates</Text>
                <MaterialIcons name="keyboard-arrow-down" size={24} color={colors.text.primary} style={{ marginLeft: spacing.sm }} />
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
                    selectedDayBackgroundColor: colors.primary,
                    selectedDayTextColor: '#fff',
                    todayTextColor: colors.primary,
                    dayTextColor: colors.text.primary,
                    textDisabledColor: colors.text.light,
                    arrowColor: colors.primary,
                    monthTextColor: colors.text.primary,
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
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  searchContainer: {
    flex: 1,
    paddingTop: spacing.md,
  },
  searchInputWrapper: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    height: 48,
    backgroundColor: colors.card,
  },
  searchInputTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.md,
  },
  searchInputPlaceholder: {
    ...typography.body,
    color: colors.text.secondary,
  },
  searchButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeIcon: {
    marginRight: spacing.sm,
  },
  searchButtonText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  filterButtonsContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  filterButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 60,
    backgroundColor: colors.card,
  },
  filterLabel: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  filterButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterButtonTextValue: {
    ...typography.caption,
    ...typography.button,
    fontSize: 12,
    color: colors.text.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.lg,
  },
  searchCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.lg,
    padding: spacing.xl,
    backgroundColor: colors.card,
    ...shadows.medium,
  },
  locationAutocomplete: {
    marginBottom: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.sm + spacing.xs,
  },
  recentSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  recentSearchIcon: {
    width: 40,
    height: 40,
    marginRight: spacing.xl + spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recentSearchContent: {
    flex: 1,
  },
  recentSearchTitle: {
    ...typography.caption,
    color: colors.text.primary,
    marginBottom: spacing.xs + 3,
  },
  recentSearchSubtitle: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  suggestedTeamItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  teamIcon: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.xl + spacing.md,
  },
  teamIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamIconText: {
    ...typography.body,
    color: colors.text.primary,
  },
  suggestedTeamContent: {
    flex: 1,
  },
  suggestedTeamTitle: {
    ...typography.caption,
    color: colors.text.primary,
    marginBottom: spacing.xs + 3,
  },
  suggestedTeamSubtitle: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  calendarContainer: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...shadows.small,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl + spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  clearButton: {
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  clearButtonText: {
    ...typography.caption,
    ...typography.button,
    fontSize: 12,
    color: colors.card,
    fontWeight: '500',
  },
  searchButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
  },
  searchButtonDisabled: {
    opacity: 0.5,
    backgroundColor: colors.border,
  },
  searchButtonTextAction: {
    ...typography.caption,
    ...typography.button,
    fontSize: 12,
    color: colors.card,
  },
});

export default OverlapSearchScreenAdapted;

