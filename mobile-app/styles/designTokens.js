// Design Tokens based on Figma wireframes
// Colors, spacing, typography, and component styles

export const colors = {
  // Primary colors
  primary: '#007AFF',
  secondary: '#FF385C',
  background: '#F5F5F5',
  card: '#FFFFFF',
  cardGrey: '#F8F8F8',
  
  // Surface colors (for React Native Paper compatibility)
  surface: '#FFFFFF',
  surfaceVariant: '#F8F8F8',
  
  // Text colors
  text: {
    primary: '#333333',
    secondary: '#666666',
    accent: '#FF385C',
    light: '#999999',
  },
  
  // Text colors for different backgrounds (accessibility)
  onPrimary: '#FFFFFF', // Text on primary button
  onSecondary: '#FFFFFF', // Text on secondary button
  onSurface: '#333333', // Text on white surface (same as text.primary)
  onBackground: '#333333', // Text on background (same as text.primary)
  
  // Semantic colors
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  
  // Border colors
  border: '#E0E0E0',
  borderLight: '#F0F0F0',
  
  // Interactive state colors
  interactive: {
    hover: '#0056CC', // Darker primary for hover
    pressed: '#003D99', // Even darker for pressed
    disabled: '#CCCCCC', // For disabled buttons/inputs
    disabledText: '#999999', // Text color when disabled
  },
  
  // Status background colors (light variants for badges/indicators)
  status: {
    completedBg: '#e8f5e8', // Light green for completed status
    liveBg: '#fff3cd', // Light yellow for live status
    recommendationBg: '#fff8e1', // Light amber for recommendations
    attendancePromptBg: '#e3f2fd', // Light blue for attendance prompts
    attendedBg: '#e8f5e8', // Light green for attended indicator
    liveIndicatorBg: '#fff3e0', // Light orange for live indicator
    defaultBg: '#F8F8F8', // Default/neutral state background
  },
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };

// Safe area spacing (for status bar, notch, etc.)
// Use with useSafeAreaInsets() hook for dynamic values
// These are minimum safe values if safe area insets are not available
export const safeArea = {
  top: 44, // Standard iOS status bar + notch area (use insets.top when available)
  bottom: 34, // Standard iOS home indicator area (use insets.bottom when available)
  // For screens without SafeAreaView, use: paddingTop: safeArea.top + spacing.md
  // For screens with SafeAreaView, use: paddingTop: spacing.lg (SafeAreaView handles safe area)
};

export const typography = {
  h1: { fontSize: 24, fontWeight: '700', lineHeight: 32 }, // Changed 'bold' to '700' for better RN support
  h2: { fontSize: 20, fontWeight: '600', lineHeight: 28 },
  h3: { fontSize: 18, fontWeight: '600', lineHeight: 24 },
  body: { fontSize: 16, fontWeight: '400', lineHeight: 22 },
  bodySmall: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
  button: { fontSize: 16, fontWeight: '600', lineHeight: 22 },
  // Additional variants
  h1Large: { fontSize: 28, fontWeight: '700', lineHeight: 36 },
  overline: { fontSize: 10, fontWeight: '600', lineHeight: 14, textTransform: 'uppercase' },
};

export const borderRadius = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, pill: 20 };

export const shadows = {
  small: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  medium: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4 },
  large: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 8 },
};

// Material Design elevation levels (for React Native Paper compatibility)
export const elevation = {
  none: 0,
  level1: 2,
  level2: 4,
  level3: 8,
  level4: 12,
  level5: 16,
};

export const iconSizes = {
  xs: 12,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 48,
};

export const animation = {
  fast: 150,
  normal: 250,
  slow: 350,
  easing: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
  easingOut: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
  easingIn: 'cubic-bezier(0.4, 0.0, 1, 1)',
};

export const zIndex = {
  base: 0,
  dropdown: 100,
  sticky: 200,
  overlay: 300,
  modal: 400,
  toast: 500,
};

export const input = {
  height: 48,
  paddingHorizontal: spacing.md,
  borderRadius: borderRadius.sm,
  borderWidth: 1,
  borderColor: colors.border,
  backgroundColor: colors.card,
  fontSize: typography.body.fontSize,
  color: colors.text.primary,
};

export const components = {
  card: { backgroundColor: colors.card, borderRadius: borderRadius.md, padding: spacing.md, ...shadows.small },
  cardGrey: { backgroundColor: colors.cardGrey, borderRadius: borderRadius.md, padding: spacing.md, ...shadows.small },
  pill: { backgroundColor: colors.primary, borderRadius: borderRadius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  button: { backgroundColor: colors.primary, borderRadius: borderRadius.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  buttonSecondary: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: borderRadius.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  buttonDisabled: { backgroundColor: colors.interactive.disabled, borderRadius: borderRadius.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
};

// Helper function to convert tokens to React Native Paper theme (for future migration)
export const paperTheme = {
  colors: {
    primary: colors.primary,
    accent: colors.secondary,
    background: colors.background,
    surface: colors.surface,
    surfaceVariant: colors.surfaceVariant,
    text: colors.text.primary,
    onSurface: colors.onSurface,
    onBackground: colors.onBackground,
    disabled: colors.interactive.disabled,
    placeholder: colors.text.light,
    backdrop: 'rgba(0, 0, 0, 0.5)',
    notification: colors.secondary,
  },
  // Paper spacing uses different scale, but we can map ours
  roundness: borderRadius.md,
};

export default { 
  colors, 
  spacing, 
  typography, 
  borderRadius, 
  shadows, 
  elevation,
  iconSizes,
  animation,
  zIndex,
  input,
  components,
  paperTheme,
};


