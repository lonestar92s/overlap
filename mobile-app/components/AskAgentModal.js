import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { borderRadius, colors, spacing, typography } from '../styles/designTokens';

const AskAgentModal = ({
  visible,
  onClose,
  prompt,
  onPromptChange,
  onSend,
  loading = false,
  feedbackMessage = '',
  feedbackType = 'info',
  placeholder = 'Ask anything about this trip...',
  quickPrompts = [],
}) => {
  const defaultPrompts = useMemo(
    () => [
      'Find me top matches in Manchester from May 1 to May 5.',
      'Show me Manchester United matches and nearby fixtures.',
      'Plan a weekend with at least 2 matches in London.',
    ],
    []
  );
  const promptChips = quickPrompts.length > 0 ? quickPrompts : defaultPrompts;

  const toneStyle =
    feedbackType === 'error'
      ? styles.feedbackError
      : feedbackType === 'success'
        ? styles.feedbackSuccess
        : styles.feedbackInfo;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close Ask Agent modal"
        />
        <KeyboardAvoidingView
          style={styles.modalWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <View style={styles.dragHandle} />

            <View style={styles.header}>
              <View style={styles.titleWrap}>
                <MaterialIcons name="auto-awesome" size={20} color={colors.primary} />
                <Text style={styles.title}>Ask Agent</Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close Ask Agent"
              >
                <MaterialIcons name="close" size={20} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.content}
              contentContainerStyle={styles.contentContainer}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.heroSection}>
                <Text style={styles.heroTitle}>Hi there</Text>
                <Text style={styles.heroSubtitle}>How can I help plan your football trip?</Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickPromptList}
                keyboardShouldPersistTaps="handled"
              >
                {promptChips.map((chip) => (
                  <TouchableOpacity
                    key={chip}
                    style={styles.quickPromptChip}
                    onPress={() => onPromptChange(chip)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`Use prompt: ${chip}`}
                  >
                    <Text style={styles.quickPromptText}>{chip}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </ScrollView>

            {feedbackMessage ? (
              <Text style={[styles.feedback, toneStyle]}>{feedbackMessage}</Text>
            ) : null}

            <View style={styles.inputDock}>
              <TextInput
                value={prompt}
                onChangeText={onPromptChange}
                multiline
                placeholder={placeholder}
                placeholderTextColor={colors.text.light}
                style={styles.input}
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={[styles.sendButton, (loading || !prompt.trim()) && styles.sendButtonDisabled]}
                activeOpacity={0.85}
                onPress={onSend}
                disabled={loading || !prompt.trim()}
                accessibilityRole="button"
                accessibilityLabel="Send Ask Agent message"
              >
                {loading ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <MaterialIcons name="send" size={18} color={colors.white} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalWrap: {
    width: '100%',
    paddingBottom: spacing.md,
  },
  modalCard: {
    backgroundColor: colors.card,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    minHeight: '68%',
    maxHeight: '84%',
  },
  dragHandle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    ...typography.h3,
    fontWeight: '600',
    color: colors.text.primary,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: spacing.md,
  },
  heroSection: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  heroTitle: {
    ...typography.h1,
    color: colors.primary,
    marginBottom: spacing.xs,
    fontWeight: '700',
  },
  heroSubtitle: {
    ...typography.h3,
    color: colors.text.secondary,
  },
  quickPromptList: {
    paddingRight: spacing.sm,
  },
  quickPromptChip: {
    backgroundColor: colors.cardGrey,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginRight: spacing.sm,
    width: 220,
  },
  quickPromptText: {
    ...typography.body,
    color: colors.text.primary,
  },
  inputDock: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.text.primary,
    backgroundColor: colors.cardGrey,
  },
  feedback: {
    marginTop: spacing.sm,
    ...typography.bodySmall,
  },
  feedbackInfo: {
    color: colors.text.secondary,
  },
  feedbackSuccess: {
    color: colors.success,
  },
  feedbackError: {
    color: colors.error,
  },
  sendButton: {
    marginLeft: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.pill,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});

export default AskAgentModal;
