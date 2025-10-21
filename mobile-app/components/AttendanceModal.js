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
            >
              <Text style={styles.skipButtonText}>Skip</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.confirmButton]}
              onPress={handleConfirmAttendance}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
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
    padding: 20,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  matchInfo: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976d2',
    marginBottom: 4,
  },
  venue: {
    fontSize: 14,
    color: '#666',
  },
  content: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  buttons: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  skipButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#1976d2',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AttendanceModal;
