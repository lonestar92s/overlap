import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Input, Button } from 'react-native-elements';
import ApiService from '../services/api';
import { colors, spacing, typography, borderRadius, input, components } from '../styles/designTokens';
import { screenKeyboardAvoidingProps } from '../utils/keyboardUtils';

const FeedbackScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { type = 'general', initialMessage = null } = route.params || {};
  
  const [feedbackText, setFeedbackText] = useState(initialMessage || '');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialMessage) {
      setFeedbackText(initialMessage);
    }
  }, [initialMessage]);

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
      navigation.goBack();
    } catch (error) {
      if (__DEV__) {
        console.error('Error sending feedback:', error);
      }
      Alert.alert('Error', error.message || 'Failed to send feedback. Please try again later.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        {...screenKeyboardAvoidingProps()}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.contentContainer}>
            <Text style={styles.title}>Send Feedback</Text>
            
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
                onPress={() => navigation.goBack()}
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  contentContainer: {
    width: '100%',
    // Exception: maxWidth for content constraint (acceptable per design system guidelines)
    // This ensures readable line length on larger screens
    maxWidth: 600,
    alignSelf: 'center',
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
    marginBottom: spacing.lg,
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
    // Use input token but override for multiline
    borderWidth: input.borderWidth,
    borderColor: input.borderColor,
    borderRadius: input.borderRadius,
    backgroundColor: input.backgroundColor,
    paddingHorizontal: spacing.sm,
    // Use minHeight instead of height for multiline input
    minHeight: 120,
  },
  input: {
    ...typography.body,
    color: colors.text.primary,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  label: {
    ...typography.bodySmall,
    fontWeight: '600', // Label text should be semi-bold for emphasis
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
    minHeight: 44, // Minimum touch target size (iOS: 44pt, Android: 48dp)
  },
  cancelButton: {
    ...components.buttonSecondary,
    // Override to match design
    backgroundColor: colors.cardGrey,
  },
  cancelButtonText: {
    ...typography.button,
    color: colors.text.primary,
  },
  submitButton: {
    ...components.button,
  },
  submitButtonText: {
    ...typography.button,
    color: colors.onPrimary,
  },
});

export default FeedbackScreen;





