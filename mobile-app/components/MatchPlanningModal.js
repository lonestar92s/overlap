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

const MatchPlanningModal = ({ visible, onClose, match, tripId, onPlanningUpdated }) => {
  const { updateMatchPlanning } = useItineraries();
  const [planning, setPlanning] = useState({
    ticketsAcquired: 'no',
    flight: 'no',
    accommodation: 'no',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (match && match.planning) {
      setPlanning({
        ticketsAcquired: match.planning.ticketsAcquired || 'no',
        flight: match.planning.flight || 'no',
        accommodation: match.planning.accommodation || 'no',
        notes: match.planning.notes || ''
      });
    }
  }, [match]);

  const statusOptions = [
    { value: 'no', label: 'No', color: '#FF6B6B' },
    { value: 'in-progress', label: 'In Progress', color: '#FFD93D' },
    { value: 'yes', label: 'Yes', color: '#6BCF7F' }
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
                { backgroundColor: planning[field] === option.value ? option.color : '#F5F5F5' }
              ]}
              onPress={() => handleStatusChange(field, option.value)}
            >
              <Text style={[
                styles.statusButtonText,
                { color: planning[field] === option.value ? '#FFFFFF' : '#333333' }
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
          {renderStatusSelector('flight', 'Flight')}
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
    backgroundColor: '#FFFFFF'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFFFFF'
  },
  closeButton: {
    paddingVertical: 8,
    paddingHorizontal: 12
  },
  closeButtonText: {
    fontSize: 16,
    color: '#007AFF'
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333'
  },
  saveButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8
  },
  saveButtonDisabled: {
    backgroundColor: '#CCCCCC'
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600'
  },
  content: {
    flex: 1,
    paddingHorizontal: 20
  },
  matchInfo: {
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    marginBottom: 20
  },
  matchTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 8
  },
  matchDetails: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 4
  },
  matchDate: {
    fontSize: 14,
    color: '#888888'
  },
  statusSection: {
    marginBottom: 30
  },
  statusLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12
  },
  statusButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  statusButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center'
  },
  statusButtonText: {
    fontSize: 14,
    fontWeight: '600'
  },
  notesSection: {
    marginBottom: 30
  },
  notesLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    backgroundColor: '#FAFAFA'
  }
});

export default MatchPlanningModal;
