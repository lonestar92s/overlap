import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, Platform, KeyboardAvoidingView, ScrollView } from 'react-native';
import { Overlay, Input, Button } from 'react-native-elements';
import ApiService from '../services/api';
import { colors, spacing, typography, borderRadius } from '../styles/designTokens';

const FeedbackModal = ({ visible, onClose, type = 'general', initialMessage = null }) => {
  const [feedbackText, setFeedbackText] = useState(initialMessage || '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!feedbackText.trim()) {
      Alert.alert('Empty Feedback', 'Please enter your feedback before sending.');
      return;
    }

    setSubmitting(true);
    try {
      await ApiService.submitFeedback(feedbackText.trim(), type);
      Alert.alert('Thank you!', 'Your feedback has been sent. We appreciate it!');
      setFeedbackText('');
      onClose();
    } catch (error) {
      if (__DEV__) {
        console.error('Error sending feedback:', error);
      }
      Alert.alert('Error', error.message || 'Failed to send feedback. Please try again later.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setFeedbackText('');
    onClose();
  };

  return (
    <Overlay
      isVisible={visible}
      onBackdropPress={handleClose}
      overlayStyle={styles.overlay}
      backdropStyle={styles.backdrop}
      animationType="slide"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 20}
      >
        <View style={styles.contentContainer}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <Text style={styles.title}>Send Feedback</Text>
            </View>

            {initialMessage && (
              <Text style={styles.initialMessage}>{initialMessage}</Text>
            )}

            <Input
              label="Your Feedback"
              placeholder="Type your feedback here..."
              value={feedbackText}
              onChangeText={setFeedbackText}
              multiline
              numberOfLines={6}
              inputStyle={styles.input}
              inputContainerStyle={styles.inputContainer}
              containerStyle={styles.inputWrapper}
              labelStyle={styles.label}
              disabled={submitting}
              accessibilityLabel="Feedback text input"
            />
          </ScrollView>

          <View style={styles.buttonContainer}>
            <Button
              title="Cancel"
              onPress={handleClose}
              disabled={submitting}
              buttonStyle={[styles.button, styles.cancelButton]}
              titleStyle={styles.cancelButtonText}
              containerStyle={styles.buttonWrapper}
              accessibilityLabel="Cancel feedback"
            />
            <Button
              title={submitting ? 'Sending...' : 'Send'}
              onPress={handleSubmit}
              disabled={submitting || !feedbackText.trim()}
              loading={submitting}
              buttonStyle={[styles.button, styles.submitButton]}
              titleStyle={styles.submitButtonText}
              containerStyle={styles.buttonWrapper}
              accessibilityLabel="Send feedback"
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Overlay>
  );
};

const styles = StyleSheet.create({
  overlay: {
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    backgroundColor: colors.card,
  },
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  keyboardView: {
    width: '100%',
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    width: '100%',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.md,
  },
  header: {
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
    fontWeight: '600',
  },
  initialMessage: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.cardGrey,
    borderRadius: borderRadius.sm,
  },
  inputWrapper: {
    paddingHorizontal: 0,
    marginBottom: spacing.md,
  },
  inputContainer: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.card,
  },
  input: {
    ...typography.body,
    color: colors.text.primary,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  label: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  buttonWrapper: {
    flex: 1,
  },
  button: {
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.md,
    minHeight: 44,
  },
  cancelButton: {
    backgroundColor: colors.cardGrey,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    ...typography.button,
    color: colors.text.primary,
  },
  submitButton: {
    backgroundColor: colors.primary,
  },
  submitButtonText: {
    ...typography.button,
    color: colors.onPrimary,
  },
});

export default FeedbackModal;
