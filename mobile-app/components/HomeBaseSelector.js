import React, { useState, useRef } from 'react';
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
import { MaterialIcons } from '@expo/vector-icons';
import LocationAutocomplete from './LocationAutocomplete';
import { colors, spacing, typography, borderRadius, shadows, input, components } from '../styles/designTokens';

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
      ? new Date(homeBase.dateRange.from).toISOString().split('T')[0]
      : (tripDateRange?.from ? new Date(tripDateRange.from).toISOString().split('T')[0] : '')
  );
  const [dateTo, setDateTo] = useState(
    homeBase?.dateRange?.to 
      ? new Date(homeBase.dateRange.to).toISOString().split('T')[0]
      : (tripDateRange?.to ? new Date(tripDateRange.to).toISOString().split('T')[0] : '')
  );
  const [notes, setNotes] = useState(homeBase?.notes || '');
  const [saving, setSaving] = useState(false);
  const scrollViewRef = useRef(null);
  const dateFromInputRef = useRef(null);
  const dateToInputRef = useRef(null);
  const notesInputRef = useRef(null);

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

    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);
    
    if (fromDate > toDate) {
      Alert.alert('Validation Error', 'Start date must be before end date');
      return;
    }

    setSaving(true);

    try {
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
          from: fromDate.toISOString(),
          to: toDate.toISOString()
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
        ? new Date(homeBase.dateRange.from).toISOString().split('T')[0]
        : (tripDateRange?.from ? new Date(tripDateRange.from).toISOString().split('T')[0] : '')
    );
    setDateTo(
      homeBase?.dateRange?.to 
        ? new Date(homeBase.dateRange.to).toISOString().split('T')[0]
        : (tripDateRange?.to ? new Date(tripDateRange.to).toISOString().split('T')[0] : '')
    );
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
              <View style={styles.dateRow}>
                <View style={styles.dateInputContainer}>
                  <Text style={styles.dateLabel}>From</Text>
                  <TextInput
                    ref={dateFromInputRef}
                    style={styles.dateInput}
                    value={dateFrom}
                    onChangeText={setDateFrom}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.text.light}
                    accessibilityLabel="Start date"
                    accessibilityHint="Enter the start date in YYYY-MM-DD format"
                    onFocus={() => {
                      setTimeout(() => {
                        scrollViewRef.current?.scrollToEnd({ animated: true });
                      }, 300);
                    }}
                  />
                </View>
                <View style={styles.dateInputContainer}>
                  <Text style={styles.dateLabel}>To</Text>
                  <TextInput
                    ref={dateToInputRef}
                    style={styles.dateInput}
                    value={dateTo}
                    onChangeText={setDateTo}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.text.light}
                    accessibilityLabel="End date"
                    accessibilityHint="Enter the end date in YYYY-MM-DD format"
                    onFocus={() => {
                      setTimeout(() => {
                        scrollViewRef.current?.scrollToEnd({ animated: true });
                      }, 300);
                    }}
                  />
                </View>
              </View>
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
    paddingBottom: spacing.xxl + spacing.xl // Extra padding at bottom for keyboard
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
  dateRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dateInputContainer: {
    flex: 1,
  },
  dateLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  dateInput: {
    ...input,
  },
  notesInput: {
    minHeight: 100,
    textAlignVertical: 'top',
    backgroundColor: colors.cardGrey
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

