import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform
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
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {homeBase ? 'Edit Home Base' : 'Add Home Base'}
            </Text>
            <TouchableOpacity 
              onPress={handleClose} 
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close modal"
              accessibilityHint="Double tap to close the home base form"
            >
              <MaterialIcons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={styles.form}>
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
                    style={styles.dateInput}
                    value={dateFrom}
                    onChangeText={setDateFrom}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.text.light}
                    accessibilityLabel="Start date"
                    accessibilityHint="Enter the start date in YYYY-MM-DD format"
                  />
                </View>
                <View style={styles.dateInputContainer}>
                  <Text style={styles.dateLabel}>To</Text>
                  <TextInput
                    style={styles.dateInput}
                    value={dateTo}
                    onChangeText={setDateTo}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.text.light}
                    accessibilityLabel="End date"
                    accessibilityHint="Enter the end date in YYYY-MM-DD format"
                  />
                </View>
              </View>
            </View>

            {/* Notes */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Notes (Optional)</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Add any notes about this location..."
                placeholderTextColor={colors.text.light}
                multiline
                numberOfLines={3}
                accessibilityLabel="Notes"
                accessibilityHint="Optional field to add notes about this home base location"
              />
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              accessibilityHint="Double tap to cancel and close the form"
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel={saving ? "Saving home base" : "Save home base"}
              accessibilityHint="Double tap to save the home base"
              accessibilityState={{ disabled: saving }}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 34 : spacing.md,
    ...shadows.large,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  closeButton: {
    padding: spacing.sm,
  },
  form: {
    padding: spacing.md,
    overflow: 'visible', // Allow dropdown to show, but contained by parent
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  locationInputGroup: {
    marginBottom: spacing.lg, // Extra spacing to prevent dropdown overlap with type selector
  },
  label: {
    ...typography.body,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    fontWeight: '600',
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
    minHeight: 80,
    textAlignVertical: 'top',
    paddingVertical: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelButton: {
    ...components.buttonSecondary,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    ...typography.button,
    color: colors.text.primary,
  },
  saveButton: {
    ...components.button,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    ...typography.button,
    color: colors.onPrimary,
  },
});

export default HomeBaseSelector;

