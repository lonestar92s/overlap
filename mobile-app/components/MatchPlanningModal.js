import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useItineraries } from '../contexts/ItineraryContext';
import { colors, spacing, typography, borderRadius, shadows } from '../styles/designTokens';

const MatchPlanningModal = ({ visible, onClose, match, tripId, onPlanningUpdated }) => {
  const { updateMatchPlanning } = useItineraries();
  const [planning, setPlanning] = useState({
    ticketsAcquired: 'no',
    accommodation: 'no',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (match && match.planning) {
      setPlanning({
        ticketsAcquired: match.planning.ticketsAcquired || 'no',
        accommodation: match.planning.accommodation || 'no',
        notes: match.planning.notes || ''
      });
    }
  }, [match]);

  const statusOptions = [
    { value: 'no', label: 'No', color: colors.error },
    { value: 'in-progress', label: 'In Progress', color: colors.warning },
    { value: 'yes', label: 'Yes', color: colors.success }
  ];

  const handleStatusChange = (field, value) => {
    setPlanning(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    if (!match || !tripId) return;

    try {
      setSaving(true);
      const updatedTrip = await updateMatchPlanning(tripId, match.matchId, planning);
      
      Alert.alert('Success', 'Planning details updated successfully!');
      if (onPlanningUpdated) {
        onPlanningUpdated(updatedTrip);
      }
      onClose();
    } catch (error) {
      console.error('Error saving planning details:', error);
      Alert.alert('Error', 'Failed to save planning details. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const renderStatusSelector = (field, label) => {
    return (
      <View style={styles.statusSection}>
        <Text style={styles.statusLabel}>{label}</Text>
        <View style={styles.statusButtons}>
          {statusOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.statusButton,
                { backgroundColor: planning[field] === option.value ? option.color : colors.background }
              ]}
              onPress={() => handleStatusChange(field, option.value)}
            >
              <Text style={[
                styles.statusButtonText,
                { color: planning[field] === option.value ? colors.onPrimary : colors.text.primary }
              ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  if (!match) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Trip Planning</Text>
          <TouchableOpacity 
            onPress={handleSave} 
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.matchInfo}>
            <Text style={styles.matchTitle}>
              {match.homeTeam.name} vs {match.awayTeam.name}
            </Text>
            <Text style={styles.matchDetails}>
              {match.league} • {match.venue}
            </Text>
            <Text style={styles.matchDate}>
              {new Date(match.date).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </Text>
          </View>

          {renderStatusSelector('ticketsAcquired', 'Tickets Acquired')}
          {renderStatusSelector('accommodation', 'Accommodation')}

          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>Notes</Text>
            <TextInput
              style={styles.notesInput}
              value={planning.notes}
              onChangeText={(text) => setPlanning(prev => ({ ...prev, notes: text }))}
              placeholder="Add any additional planning notes..."
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </ScrollView>
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
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg
  },
  matchInfo: {
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.lg
  },
  matchTitle: {
    ...typography.h2,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.sm
  },
  matchDetails: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.xs
  },
  matchDate: {
    ...typography.bodySmall,
    color: colors.text.light
  },
  statusSection: {
    marginBottom: spacing.xl + spacing.sm
  },
  statusLabel: {
    ...typography.h3,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm + spacing.xs
  },
  statusButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  statusButton: {
    flex: 1,
    paddingVertical: spacing.sm + spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    marginHorizontal: spacing.xs,
    alignItems: 'center'
  },
  statusButtonText: {
    ...typography.bodySmall,
    fontWeight: '600'
  },
  notesSection: {
    marginBottom: spacing.xl + spacing.sm
  },
  notesLabel: {
    ...typography.h3,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm + spacing.xs
  },
  notesInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.sm + spacing.xs,
    ...typography.body,
    minHeight: 100,
    backgroundColor: colors.cardGrey
  }
});

export default MatchPlanningModal;
