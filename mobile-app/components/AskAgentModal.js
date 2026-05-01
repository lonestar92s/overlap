import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { borderRadius, colors, spacing, typography } from '../styles/designTokens';

const SNAP_POINTS = ['52%', '88%'];

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
  const bottomSheetRef = useRef(null);
  const insets = useSafeAreaInsets();

  const defaultPrompts = useMemo(
    () => [
      'Find me matches in Manchester, UK from May 2nd to May 5th.',
      'Show me matches in Milan this weekend.',
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

  const handleDismiss = useCallback(() => {
    onClose?.();
  }, [onClose]);

  useEffect(() => {
    if (!bottomSheetRef.current) {
      return;
    }
    if (visible) {
      try {
        bottomSheetRef.current.present();
      } catch (e) {
        if (__DEV__) {
          console.error('AskAgentModal present:', e);
        }
      }
    } else {
      try {
        bottomSheetRef.current.dismiss();
      } catch (e) {
        if (__DEV__) {
          console.error('AskAgentModal dismiss:', e);
        }
      }
    }
  }, [visible]);

  const renderBackdrop = useCallback(
    (props) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.35}
        pressBehavior="close"
      />
    ),
    []
  );

  const renderHandle = useCallback(
    () => (
      <View style={styles.handleRoot}>
        <View style={styles.handleBar} />
        <View style={styles.handleHeader}>
          <View style={styles.titleWrap}>
            <MaterialIcons name="auto-awesome" size={20} color={colors.primary} />
            <Text style={styles.title}>Ask Agent</Text>
          </View>
          <TouchableOpacity
            onPress={() => bottomSheetRef.current?.dismiss()}
            accessibilityRole="button"
            accessibilityLabel="Close Ask Agent"
          >
            <MaterialIcons name="close" size={20} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>
      </View>
    ),
    []
  );

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={SNAP_POINTS}
      enableDynamicSizing={false}
      enablePanDownToClose
      enableContentPanningGesture
      enableHandlePanningGesture
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      topInset={insets.top}
      bottomInset={0}
      onDismiss={handleDismiss}
      backgroundStyle={styles.sheetBackground}
      handleComponent={renderHandle}
      backdropComponent={renderBackdrop}
    >
      <BottomSheetView style={styles.sheetColumn}>
        <BottomSheetScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroSection}>
            <Text style={styles.heroTitle}>Hi there</Text>
            <Text style={styles.heroSubtitle}>Can I help you find matches?</Text>
          </View>

          <ScrollView
            horizontal
            nestedScrollEnabled
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

          {feedbackMessage ? (
            <Text style={[styles.feedback, toneStyle]}>{feedbackMessage}</Text>
          ) : null}
        </BottomSheetScrollView>

        <View style={[styles.inputDock, { paddingBottom: Math.max(spacing.md, insets.bottom) }]}>
          <BottomSheetTextInput
            value={prompt}
            onChangeText={onPromptChange}
            onFocus={() => bottomSheetRef.current?.snapToIndex(1)}
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
      </BottomSheetView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: colors.card,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
  },
  handleRoot: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
  },
  handleBar: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  handleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetColumn: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.md,
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
