import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  ScrollView,
  KeyboardAvoidingView
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { MaterialIcons } from '@expo/vector-icons';
import LocationAutocomplete from './LocationAutocomplete';
import { colors, spacing, typography, borderRadius, shadows, input, components } from '../styles/designTokens';
import { formatDateToLocalString, getTodayLocalString, createDateRange } from '../utils/dateUtils';

const HomeBaseSelector = ({ 
  visible, 
  onClose, 
  onSave, 
  homeBase = null, // For editing existing home base
  tripDateRange = null // { from: Date, to: Date }
}) => {
  const [name, setName] = useState(homeBase?.name || '');
  const [type, setType] = useState(homeBase?.type || 'custom');
  const [selectedLocation, setSelectedLocation] = useState(
    homeBase ? {
      city: homeBase.address?.city || '',
      country: homeBase.address?.country || '',
      region: '',
      lat: homeBase.coordinates?.lat || null,
      lon: homeBase.coordinates?.lng || null
    } : null
  );
  const [dateFrom, setDateFrom] = useState(
    homeBase?.dateRange?.from 
      ? formatDateToLocalString(new Date(homeBase.dateRange.from))
      : (tripDateRange?.from ? formatDateToLocalString(new Date(tripDateRange.from)) : null)
  );
  const [dateTo, setDateTo] = useState(
    homeBase?.dateRange?.to 
      ? formatDateToLocalString(new Date(homeBase.dateRange.to))
      : (tripDateRange?.to ? formatDateToLocalString(new Date(tripDateRange.to)) : null)
  );
  const [selectedDates, setSelectedDates] = useState({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState(homeBase?.notes || '');
  const [saving, setSaving] = useState(false);
  const scrollViewRef = useRef(null);
  const notesInputRef = useRef(null);

  // Initialize selected dates when dateFrom/dateTo change
  useEffect(() => {
    if (dateFrom && dateTo) {
      const dateRange = createDateRange(dateFrom, dateTo);
      const dates = {};
      dateRange.forEach((dateStr, index) => {
        dates[dateStr] = {
          selected: true,
          startingDay: index === 0,
          endingDay: index === dateRange.length - 1,
          color: index === 0 || index === dateRange.length - 1 ? '#1976d2' : '#e3f2fd',
          textColor: index === 0 || index === dateRange.length - 1 ? 'white' : '#1976d2'
        };
      });
      setSelectedDates(dates);
    } else if (dateFrom) {
      setSelectedDates({
        [dateFrom]: {
          selected: true,
          startingDay: true,
          color: '#1976d2',
          textColor: 'white'
        }
      });
    } else {
      setSelectedDates({});
    }
  }, [dateFrom, dateTo]);

  const handleLocationSelect = (location) => {
    if (location) {
      setSelectedLocation({
        city: location.city || '',
        country: location.country || '',
        region: location.region || '',
        lat: location.lat || null,
        lon: location.lon || null
      });
      
      // Auto-fill name if empty
      if (!name) {
        setName(location.city || '');
      }
    }
  };

  const formatDisplayDate = (dateString) => {
    if (!dateString) return 'Select date';
    // Parse date string safely without timezone conversion
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const onDayPress = (day) => {
    const dateString = day.dateString;
    
    if (!dateFrom || (dateFrom && dateTo)) {
      // Starting new selection
      setDateFrom(dateString);
      setDateTo(null);
      setSelectedDates({
        [dateString]: {
          selected: true,
          startingDay: true,
          color: '#1976d2',
          textColor: 'white'
        }
      });
    } else if (dateFrom && !dateTo) {
      // Selecting end date
      if (dateString < dateFrom) {
        // If selected date is before start date, make it the new start date
        setDateFrom(dateString);
        setDateTo(null);
        setSelectedDates({
          [dateString]: {
            selected: true,
            startingDay: true,
            color: '#1976d2',
            textColor: 'white'
          }
        });
      } else {
        // Valid end date selection
        setDateTo(dateString);
        
        // Create range marking
        const dateRange = createDateRange(dateFrom, dateString);
        const range = {};
        dateRange.forEach((dateStr, index) => {
          range[dateStr] = {
            selected: true,
            startingDay: index === 0,
            endingDay: index === dateRange.length - 1,
            color: index === 0 || index === dateRange.length - 1 ? '#1976d2' : '#e3f2fd',
            textColor: index === 0 || index === dateRange.length - 1 ? 'white' : '#1976d2'
          };
        });
        
        setSelectedDates(range);
        // Auto-close calendar after selecting date range
        setTimeout(() => setShowDatePicker(false), 500);
      }
    }
  };

  const clearDates = () => {
    setDateFrom(null);
    setDateTo(null);
    setSelectedDates({});
  };

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter a name for your home base');
      return;
    }

    if (!selectedLocation || !selectedLocation.city) {
      Alert.alert('Validation Error', 'Please select a location');
      return;
    }

    if (!dateFrom || !dateTo) {
      Alert.alert('Validation Error', 'Please select a date range');
      return;
    }

    setSaving(true);

    try {
      // Parse date strings manually to avoid timezone issues
      const parseDateString = (dateStr) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day);
      };

      const homeBaseData = {
        name: name.trim(),
        type: type,
        address: {
          city: selectedLocation.city,
          country: selectedLocation.country,
          street: '',
          postalCode: ''
        },
        coordinates: {
          lat: selectedLocation.lat,
          lng: selectedLocation.lon
        },
        dateRange: {
          from: parseDateString(dateFrom).toISOString(),
          to: parseDateString(dateTo).toISOString()
        },
        notes: notes.trim()
      };

      await onSave(homeBaseData);
      handleClose();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to save home base');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    // Reset form
    setName(homeBase?.name || '');
    setType(homeBase?.type || 'custom');
    setSelectedLocation(
      homeBase ? {
        city: homeBase.address?.city || '',
        country: homeBase.address?.country || '',
        region: '',
        lat: homeBase.coordinates?.lat || null,
        lon: homeBase.coordinates?.lng || null
      } : null
    );
    setDateFrom(
      homeBase?.dateRange?.from 
        ? formatDateToLocalString(new Date(homeBase.dateRange.from))
        : (tripDateRange?.from ? formatDateToLocalString(new Date(tripDateRange.from)) : null)
    );
    setDateTo(
      homeBase?.dateRange?.to 
        ? formatDateToLocalString(new Date(homeBase.dateRange.to))
        : (tripDateRange?.to ? formatDateToLocalString(new Date(tripDateRange.to)) : null)
    );
    setSelectedDates({});
    setShowDatePicker(false);
    setNotes(homeBase?.notes || '');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>
            {homeBase ? 'Edit Home Base' : 'Add Home Base'}
          </Text>
          <TouchableOpacity 
            onPress={handleSave} 
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingView}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView 
            ref={scrollViewRef}
            style={styles.content}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
          >
            {/* Name Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Name *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g., Hotel X, Airbnb in Shoreditch"
                placeholderTextColor={colors.text.light}
                accessibilityLabel="Home base name"
                accessibilityHint="Enter a name for your home base, such as a hotel or Airbnb"
              />
            </View>

            {/* Location Autocomplete */}
            <View style={[styles.inputGroup, styles.locationInputGroup]}>
              <Text style={styles.label}>Location *</Text>
              <View style={styles.locationAutocompleteContainer}>
                <LocationAutocomplete
                  value={selectedLocation}
                  onSelect={handleLocationSelect}
                  placeholder="Search for a location..."
                  style={styles.locationInput}
                />
              </View>
            </View>

            {/* Type Selector */}
            <View style={[styles.inputGroup, styles.typeSelectorGroup]}>
              <Text style={styles.label}>Type</Text>
              <View style={styles.typeSelector}>
                {['city', 'hotel', 'airbnb', 'custom'].map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.typeButton,
                      type === t && styles.typeButtonActive
                    ]}
                    onPress={() => setType(t)}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${t} type`}
                    accessibilityState={{ selected: type === t }}
                    accessibilityHint={`Double tap to select ${t} as the home base type`}
                  >
                    <Text style={[
                      styles.typeButtonText,
                      type === t && styles.typeButtonTextActive
                    ]}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Date Range */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Date Range *</Text>
              <TouchableOpacity
                style={styles.dateRangeButton}
                onPress={() => setShowDatePicker(!showDatePicker)}
                activeOpacity={0.7}
              >
                <View style={styles.dateRangeContent}>
                  <View style={styles.dateSection}>
                    <Text style={styles.dateLabel}>From</Text>
                    <Text style={styles.dateValue}>{formatDisplayDate(dateFrom)}</Text>
                  </View>
                  <View style={styles.dateDivider} />
                  <View style={styles.dateSection}>
                    <Text style={styles.dateLabel}>To</Text>
                    <Text style={styles.dateValue}>{formatDisplayDate(dateTo)}</Text>
                  </View>
                </View>
              </TouchableOpacity>

              {dateFrom && dateTo && (
                <TouchableOpacity style={styles.clearDatesButton} onPress={clearDates}>
                  <Text style={styles.clearDatesText}>Clear dates</Text>
                </TouchableOpacity>
              )}

              {showDatePicker && (
                <View style={styles.calendarContainer}>
                  <Calendar
                    onDayPress={onDayPress}
                    markingType={'period'}
                    markedDates={selectedDates}
                    minDate={getTodayLocalString()}
                    theme={{
                      selectedDayBackgroundColor: '#1976d2',
                      selectedDayTextColor: 'white',
                      todayTextColor: '#1976d2',
                      dayTextColor: '#333',
                      textDisabledColor: '#ccc',
                      arrowColor: '#1976d2',
                      monthTextColor: '#333',
                      textDayFontWeight: '500',
                      textMonthFontWeight: 'bold',
                      textDayHeaderFontWeight: '600',
                    }}
                  />
                </View>
              )}
            </View>

            {/* Notes */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Notes (Optional)</Text>
              <TextInput
                ref={notesInputRef}
                style={[styles.input, styles.notesInput]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Add any notes about this location..."
                placeholderTextColor={colors.text.light}
                multiline
                numberOfLines={3}
                accessibilityLabel="Notes"
                accessibilityHint="Optional field to add notes about this home base location"
                onFocus={() => {
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 300);
                }}
              />
            </View>

            {/* Spacer for keyboard */}
            <View style={styles.keyboardSpacer} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card
  },
  closeButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm + spacing.xs
  },
  closeButtonText: {
    ...typography.body,
    color: colors.primary
  },
  title: {
    ...typography.h3,
    fontWeight: '600',
    color: colors.text.primary
  },
  keyboardAvoidingView: {
    flex: 1
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg
  },
  scrollContent: {
    paddingVertical: spacing.lg,
    paddingBottom: spacing.xxl + spacing.xxl + spacing.lg // Extra padding at bottom for keyboard spacing
  },
  inputGroup: {
    marginBottom: spacing.xl + spacing.sm,
  },
  locationInputGroup: {
    marginBottom: spacing.xl + spacing.sm, // Extra spacing to prevent dropdown overlap with type selector
  },
  label: {
    ...typography.h3,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm + spacing.xs
  },
  input: {
    ...input,
  },
  locationAutocompleteContainer: {
    position: 'relative',
    zIndex: 100,
    marginBottom: 0,
  },
  locationInput: {
    marginTop: 0,
  },
  typeSelectorGroup: {
    zIndex: 1,
    position: 'relative',
  },
  typeSelector: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  typeButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  typeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeButtonText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  typeButtonTextActive: {
    color: colors.onPrimary,
    fontWeight: '600',
  },
  dateRangeButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.cardGrey,
    padding: spacing.md,
  },
  dateRangeContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateSection: {
    flex: 1,
  },
  dateLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  dateValue: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '500',
  },
  dateDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  clearDatesButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  clearDatesText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '500',
  },
  calendarContainer: {
    marginTop: spacing.md,
    backgroundColor: colors.card,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    ...shadows.small,
  },
  notesInput: {
    minHeight: 100,
    textAlignVertical: 'top',
    backgroundColor: colors.cardGrey
  },
  keyboardSpacer: {
    minHeight: 200, // Extra space at bottom to ensure inputs stay above keyboard
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm
  },
  saveButtonDisabled: {
    backgroundColor: colors.interactive.disabled
  },
  saveButtonText: {
    color: colors.onPrimary,
    ...typography.body,
    fontWeight: '600'
  },
});

export default HomeBaseSelector;

