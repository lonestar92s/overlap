import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  FlatList
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useItineraries } from '../contexts/ItineraryContext';
import { colors, spacing, typography, borderRadius, shadows } from '../styles/designTokens';

const MatchPlanningModal = ({ visible, onClose, match, tripId, homeBases = [], onPlanningUpdated }) => {
  const { updateMatchPlanning } = useItineraries();
  const [planning, setPlanning] = useState({
    ticketsAcquired: 'no',
    accommodation: 'no',
    homeBaseId: null,
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (match && match.planning) {
      setPlanning({
        ticketsAcquired: match.planning.ticketsAcquired || 'no',
        accommodation: match.planning.accommodation || 'no',
        homeBaseId: match.planning.homeBaseId || null,
        notes: match.planning.notes || ''
      });
    }
  }, [match]);

  // Filter home bases by match date
  const availableHomeBases = useMemo(() => {
    if (!match || !match.date || !homeBases || homeBases.length === 0) {
      return [];
    }

    const matchDate = new Date(match.date);
    
    return homeBases.filter(homeBase => {
      if (!homeBase.dateRange || !homeBase.dateRange.from || !homeBase.dateRange.to) {
        return false;
      }
      
      const fromDate = new Date(homeBase.dateRange.from);
      const toDate = new Date(homeBase.dateRange.to);
      
      // Check if match date is within home base date range
      return matchDate >= fromDate && matchDate <= toDate;
    });
  }, [match, homeBases]);

  // Get selected home base details
  const selectedHomeBase = useMemo(() => {
    if (!planning.homeBaseId || !homeBases || homeBases.length === 0) {
      return null;
    }

    return homeBases.find(hb => {
      const hbId = String(hb._id || hb.id || '');
      return hbId === String(planning.homeBaseId) || 
             hbId.toLowerCase() === String(planning.homeBaseId).toLowerCase() ||
             hb._id?.toString() === String(planning.homeBaseId) ||
             hb.id?.toString() === String(planning.homeBaseId);
    });
  }, [planning.homeBaseId, homeBases]);

  const statusOptions = [
    { value: 'no', label: 'No', color: colors.error },
    { value: 'in-progress', label: 'In Progress', color: colors.warning },
    { value: 'yes', label: 'Yes', color: colors.success }
  ];

  const handleStatusChange = (field, value) => {
    setPlanning(prev => {
      const updated = {
        ...prev,
        [field]: value
      };
      
      // If accommodation is set to 'no', clear homeBaseId
      if (field === 'accommodation' && value === 'no') {
        updated.homeBaseId = null;
      }
      
      return updated;
    });
  };

  const handleHomeBaseSelect = (homeBaseId) => {
    setPlanning(prev => ({
      ...prev,
      homeBaseId: homeBaseId === prev.homeBaseId ? null : homeBaseId // Toggle if same selected
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

          {/* Home Base Selector - Show when accommodation is yes or in-progress */}
          {(planning.accommodation === 'yes' || planning.accommodation === 'in-progress') && (
            <View style={styles.homeBaseSection}>
              <Text style={styles.homeBaseLabel}>Select Home Base</Text>
              
              {availableHomeBases.length === 0 ? (
                <View style={styles.emptyHomeBaseState}>
                  <MaterialIcons name="home" size={32} color={colors.text.light} />
                  <Text style={styles.emptyHomeBaseText}>
                    No home bases available for this match date
                  </Text>
                  <Text style={styles.emptyHomeBaseSubtext}>
                    Add a home base in the trip settings that covers this match date
                  </Text>
                </View>
              ) : (
                <>
                  {selectedHomeBase && (
                    <View style={styles.selectedHomeBase}>
                      <MaterialIcons 
                        name={selectedHomeBase.type === 'hotel' ? 'hotel' : selectedHomeBase.type === 'airbnb' ? 'home' : 'location-on'} 
                        size={20} 
                        color={colors.primary} 
                      />
                      <View style={styles.selectedHomeBaseInfo}>
                        <Text style={styles.selectedHomeBaseName}>{selectedHomeBase.name}</Text>
                        <Text style={styles.selectedHomeBaseLocation}>
                          {selectedHomeBase.address?.city || ''}{selectedHomeBase.address?.country ? `, ${selectedHomeBase.address.country}` : ''}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleHomeBaseSelect(null)}
                        style={styles.clearHomeBaseButton}
                      >
                        <MaterialIcons name="close" size={18} color={colors.text.secondary} />
                      </TouchableOpacity>
                    </View>
                  )}
                  
                  <FlatList
                    data={availableHomeBases}
                    keyExtractor={(item) => item._id?.toString() || item.id?.toString() || `homebase-${item.name}`}
                    renderItem={({ item }) => {
                      const isSelected = planning.homeBaseId && (
                        String(item._id || item.id) === String(planning.homeBaseId) ||
                        String(item._id || item.id).toLowerCase() === String(planning.homeBaseId).toLowerCase()
                      );
                      
                      return (
                        <TouchableOpacity
                          style={[
                            styles.homeBaseOption,
                            isSelected && styles.homeBaseOptionSelected
                          ]}
                          onPress={() => handleHomeBaseSelect(item._id || item.id)}
                          activeOpacity={0.7}
                        >
                          <MaterialIcons 
                            name={item.type === 'hotel' ? 'hotel' : item.type === 'airbnb' ? 'home' : 'location-on'} 
                            size={20} 
                            color={isSelected ? colors.primary : colors.text.secondary} 
                          />
                          <View style={styles.homeBaseOptionInfo}>
                            <Text style={[
                              styles.homeBaseOptionName,
                              isSelected && styles.homeBaseOptionNameSelected
                            ]}>
                              {item.name}
                            </Text>
                            <Text style={styles.homeBaseOptionLocation}>
                              {item.address?.city || ''}{item.address?.country ? `, ${item.address.country}` : ''}
                            </Text>
                          </View>
                          {isSelected && (
                            <MaterialIcons name="check-circle" size={20} color={colors.primary} />
                          )}
                        </TouchableOpacity>
                      );
                    }}
                    scrollEnabled={false}
                  />
                </>
              )}
            </View>
          )}

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
  },
  homeBaseSection: {
    marginBottom: spacing.xl + spacing.sm
  },
  homeBaseLabel: {
    ...typography.h3,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm + spacing.xs
  },
  emptyHomeBaseState: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.cardGrey,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed'
  },
  emptyHomeBaseText: {
    ...typography.body,
    color: colors.text.primary,
    marginTop: spacing.sm,
    fontWeight: '600',
    textAlign: 'center'
  },
  emptyHomeBaseSubtext: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    textAlign: 'center'
  },
  selectedHomeBase: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.primary + '15',
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    marginBottom: spacing.sm
  },
  selectedHomeBaseInfo: {
    flex: 1,
    marginLeft: spacing.sm
  },
  selectedHomeBaseName: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: spacing.xs
  },
  selectedHomeBaseLocation: {
    ...typography.bodySmall,
    color: colors.text.secondary
  },
  clearHomeBaseButton: {
    padding: spacing.xs
  },
  homeBaseOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardGrey,
    marginBottom: spacing.sm
  },
  homeBaseOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10'
  },
  homeBaseOptionInfo: {
    flex: 1,
    marginLeft: spacing.sm
  },
  homeBaseOptionName: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '500',
    marginBottom: spacing.xs
  },
  homeBaseOptionNameSelected: {
    fontWeight: '600',
    color: colors.primary
  },
  homeBaseOptionLocation: {
    ...typography.bodySmall,
    color: colors.text.secondary
  }
});

export default MatchPlanningModal;
