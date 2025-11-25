import { Platform } from 'react-native';

/**
 * Get the appropriate keyboard vertical offset based on platform and context
 * @param {Object} options - Configuration options
 * @param {boolean} options.isModal - Whether the component is in a modal
 * @param {number} options.headerHeight - Height of header/navigation bar (optional)
 * @param {number} options.customOffset - Custom offset value (optional)
 * @returns {number} The keyboard vertical offset
 */
export const getKeyboardVerticalOffset = ({ isModal = false, headerHeight = 0, customOffset = null }) => {
  // If custom offset is provided, use it
  if (customOffset !== null) {
    return customOffset;
  }

  // For modals, use minimal offset (SafeAreaView handles most of it)
  if (isModal) {
    return Platform.OS === 'ios' ? 0 : 20;
  }

  // For full screens, account for header height
  // Default header height is typically around 44-56px on iOS, 56px on Android
  const defaultHeaderHeight = Platform.OS === 'ios' ? 44 : 56;
  const effectiveHeaderHeight = headerHeight || defaultHeaderHeight;

  // Return offset that accounts for header
  return Platform.OS === 'ios' ? effectiveHeaderHeight : effectiveHeaderHeight + 20;
};

/**
 * Get the appropriate KeyboardAvoidingView behavior based on platform
 * @returns {'padding' | 'height' | 'position'} The behavior prop value
 */
export const getKeyboardAvoidingBehavior = () => {
  return Platform.OS === 'ios' ? 'padding' : 'height';
};

/**
 * Standard KeyboardAvoidingView props for modals
 * Use this for consistent behavior across all modals
 */
export const modalKeyboardAvoidingProps = {
  behavior: getKeyboardAvoidingBehavior(),
  keyboardVerticalOffset: getKeyboardVerticalOffset({ isModal: true }),
};

/**
 * Standard KeyboardAvoidingView props for full screens
 * @param {number} headerHeight - Height of header/navigation bar
 */
export const screenKeyboardAvoidingProps = (headerHeight = 0) => ({
  behavior: getKeyboardAvoidingBehavior(),
  keyboardVerticalOffset: getKeyboardVerticalOffset({ isModal: false, headerHeight }),
});

