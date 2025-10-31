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
} from 'react-native';
import ApiService from '../services/api';
import { colors, spacing, typography, borderRadius, shadows } from '../styles/designTokens';

const AttendanceModal = ({ 
  visible, 
  onClose, 
  match, 
  onAttendanceConfirmed 
}) => {
  const [loading, setLoading] = useState(false);
  const [userScore, setUserScore] = useState('');
  const [userNotes, setUserNotes] = useState('');

  const handleConfirmAttendance = async () => {
    if (!match) return;

    setLoading(true);
    try {
      const response = await ApiService.markMatchAttended({
        matchId: match.id || match.fixture?.id,
        matchData: match,
        userScore: userScore.trim() || null,
        userNotes: userNotes.trim() || null
      });

      if (response.success) {
        Alert.alert(
          'Match Added!',
          'This match has been added to your attended matches.',
          [{ text: 'OK', onPress: onAttendanceConfirmed }]
        );
        onClose();
      } else {
        Alert.alert('Error', response.message || 'Failed to mark match as attended');
      }
    } catch (error) {
      console.error('Error marking match as attended:', error);
      Alert.alert('Error', 'Failed to mark match as attended. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  if (!match) return null;

  const homeTeam = match.teams?.home?.name || match.homeTeam || 'Home Team';
  const awayTeam = match.teams?.away?.name || match.awayTeam || 'Away Team';
  const venue = match.fixture?.venue?.name || match.venue || 'Unknown Venue';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Did you attend this match?</Text>
            <Text style={styles.matchInfo}>
              {homeTeam} vs {awayTeam}
            </Text>
            <Text style={styles.venue}>{venue}</Text>
          </View>

          <View style={styles.content}>
            <Text style={styles.label}>Final Score (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 2-1 or Arsenal 2-1 Chelsea"
              value={userScore}
              onChangeText={setUserScore}
              maxLength={50}
            />

            <Text style={styles.label}>Notes (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Share your experience..."
              value={userNotes}
              onChangeText={setUserNotes}
              multiline
              numberOfLines={3}
              maxLength={200}
            />
          </View>

          <View style={styles.buttons}>
            <TouchableOpacity
              style={[styles.button, styles.skipButton]}
              onPress={handleSkip}
              disabled={loading}
              accessibilityLabel="Skip attendance confirmation"
              accessibilityRole="button"
            >
              <Text style={styles.skipButtonText}>Skip</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.confirmButton]}
              onPress={handleConfirmAttendance}
              disabled={loading}
              accessibilityLabel="Confirm attendance"
              accessibilityRole="button"
            >
              {loading ? (
                <ActivityIndicator color={colors.card} size="small" />
              ) : (
                <Text style={styles.confirmButtonText}>Yes, I Attended</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modal: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  header: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    alignItems: 'center',
  },
  title: {
    ...typography.h2,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  matchInfo: {
    ...typography.body,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  venue: {
    ...typography.bodySmall,
    color: colors.text.secondary,
  },
  content: {
    padding: spacing.lg,
  },
  label: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    ...typography.body,
    backgroundColor: colors.cardGrey,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  buttons: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  button: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  skipButtonText: {
    color: colors.text.secondary,
    ...typography.button,
  },
  confirmButton: {
    backgroundColor: colors.primary,
  },
  confirmButtonText: {
    color: colors.card,
    ...typography.button,
  },
});

export default AttendanceModal;
