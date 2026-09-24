import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { borderRadius, colors, spacing, typography } from '../styles/designTokens';

const WINDOW_HEIGHT = Dimensions.get('window').height;
const SHEET_HEIGHT_COLLAPSED = Math.round(WINDOW_HEIGHT * 0.58);
const SHEET_HEIGHT_EXPANDED = Math.round(WINDOW_HEIGHT * 0.88);

/**
 * Ask Agent overlay.
 * Uses RN Modal (not @gorhom BottomSheetModal) so it reliably appears above
 * react-native-maps on the home screen — portals can render under the map.
 *
 * Prompt text is edited locally so keystrokes do not re-render the map screen.
 */
const AskAgentModal = ({
  visible,
  onClose,
  prompt = '',
  onPromptChange,
  onSend,
  loading = false,
  feedbackMessage = '',
  feedbackType = 'info',
  placeholder = 'Ask anything about this trip...',
  quickPrompts = [],
}) => {
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [inputFocused, setInputFocused] = useState(false);
  const [localPrompt, setLocalPrompt] = useState(prompt);

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

  // Hydrate local draft when the sheet opens (not on every parent keystroke sync).
  useEffect(() => {
    if (visible) {
      setLocalPrompt(prompt);
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps -- intentional: open-only hydrate

  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
      setInputFocused(false);
      return undefined;
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (event) => {
      setKeyboardHeight(event.endCoordinates?.height ?? 0);
    };
    const onHide = () => {
      setKeyboardHeight(0);
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  const commitPrompt = (next) => {
    setLocalPrompt(next);
  };

  const handleClose = () => {
    Keyboard.dismiss();
    onPromptChange?.(localPrompt);
    onClose?.();
  };

  const handleSend = () => {
    onPromptChange?.(localPrompt);
    onSend?.(localPrompt);
  };

  const keyboardOpen = keyboardHeight > 0 || inputFocused;
  const sheetBottom = keyboardHeight;
  const maxSheetHeight = WINDOW_HEIGHT - sheetBottom - Math.max(insets.top, spacing.md);
  const preferredHeight = keyboardOpen ? SHEET_HEIGHT_EXPANDED : SHEET_HEIGHT_COLLAPSED;
  const sheetHeight = Math.min(preferredHeight, maxSheetHeight);
  const sheetPaddingBottom =
    keyboardHeight > 0 ? spacing.md : Math.max(spacing.md, insets.bottom);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss Ask Agent"
        />

        <View
          style={[
            styles.sheet,
            {
              height: sheetHeight,
              marginBottom: sheetBottom,
              paddingBottom: sheetPaddingBottom,
            },
          ]}
        >
          <View style={styles.handleRoot}>
            <View style={styles.handleBar} />
            <View style={styles.handleHeader}>
              <View style={styles.titleWrap}>
                <MaterialIcons name="auto-awesome" size={20} color={colors.primary} />
                <Text style={styles.title}>Ask Agent</Text>
              </View>
              <TouchableOpacity
                onPress={handleClose}
                accessibilityRole="button"
                accessibilityLabel="Close Ask Agent"
              >
                <MaterialIcons name="close" size={20} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
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
                  onPress={() => commitPrompt(chip)}
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
          </ScrollView>

          <View style={styles.inputDock}>
            <TextInput
              value={localPrompt}
              onChangeText={setLocalPrompt}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              multiline
              placeholder={placeholder}
              placeholderTextColor={colors.text.light}
              style={styles.input}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[
                styles.sendButton,
                (loading || !localPrompt.trim()) && styles.sendButtonDisabled,
              ]}
              activeOpacity={0.85}
              onPress={handleSend}
              disabled={loading || !localPrompt.trim()}
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
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.md,
  },
  handleRoot: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
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
