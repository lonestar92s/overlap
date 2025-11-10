import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { Button } from 'react-native-elements';
import { Calendar } from 'react-native-calendars';
import LocationAutocomplete from './LocationAutocomplete';
import { colors, spacing, typography, borderRadius, shadows } from '../styles/designTokens';

const MatchSearchTab = ({
  location,
  setLocation,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  selectedDates,
  setSelectedDates,
  showCalendar,
  setShowCalendar,
  onDayPress,
  formatDisplayDate,
  handleSearch,
  loading,
}) => {
  return (
    <>
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
    </>
  );
};

const styles = StyleSheet.create({
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

export default MatchSearchTab;

