import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, Platform, KeyboardAvoidingView, ScrollView, Modal, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';
import { Input, Button } from 'react-native-elements';
import ApiService from '../services/api';
import { colors, spacing, typography, borderRadius } from '../styles/designTokens';
import { modalKeyboardAvoidingProps } from '../utils/keyboardUtils';

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
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <KeyboardAvoidingView
              {...modalKeyboardAvoidingProps}
              style={styles.keyboardView}
            >
              <View style={styles.overlay}>
                <ScrollView
                  style={styles.scrollView}
                  contentContainerStyle={styles.scrollContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled={true}
                >
                  <View style={styles.contentContainer}>
                    <View style={styles.header}>
                      <Text style={styles.title}>Send Feedback</Text>
                      <TouchableOpacity
                        onPress={handleClose}
                        style={styles.closeButton}
                        accessibilityLabel="Close feedback modal"
                        accessibilityRole="button"
                      >
                        <Text style={styles.closeButtonText}>✕</Text>
                      </TouchableOpacity>
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
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardView: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    backgroundColor: colors.card,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.md,
  },
  contentContainer: {
    width: '100%',
    flexDirection: 'column',
  },
  header: {
    marginBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
    fontWeight: '600',
    flex: 1,
  },
  closeButton: {
    padding: spacing.xs,
    marginLeft: spacing.sm,
  },
  closeButtonText: {
    fontSize: 24,
    color: colors.text.secondary,
    fontWeight: '300',
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
    marginTop: spacing.md,
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
