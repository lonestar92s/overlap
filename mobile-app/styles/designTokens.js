// Design Tokens based on Figma wireframes
// Colors, spacing, typography, and component styles

export const colors = {
  // Primary colors
  primary: '#007AFF',
  secondary: '#FF385C',
  background: '#F5F5F5',
  card: '#FFFFFF',
  cardGrey: '#F8F8F8',
  text: {
    primary: '#333333',
    secondary: '#666666',
    accent: '#FF385C',
    light: '#999999',
  },
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  border: '#E0E0E0',
  borderLight: '#F0F0F0',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };

export const typography = {
  h1: { fontSize: 24, fontWeight: 'bold', lineHeight: 32 },
  h2: { fontSize: 20, fontWeight: '600', lineHeight: 28 },
  h3: { fontSize: 18, fontWeight: '600', lineHeight: 24 },
  body: { fontSize: 16, fontWeight: '400', lineHeight: 22 },
  bodySmall: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
  button: { fontSize: 16, fontWeight: '600', lineHeight: 22 },
};

export const borderRadius = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, pill: 20 };

export const shadows = {
  small: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  medium:{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4 },
  large: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 8 },
};

export const components = {
  card: { backgroundColor: colors.card, borderRadius: borderRadius.md, padding: spacing.md, ...shadows.small },
  cardGrey:{ backgroundColor: colors.cardGrey, borderRadius: borderRadius.md, padding: spacing.md, ...shadows.small },
  pill: { backgroundColor: colors.primary, borderRadius: borderRadius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  button:{ backgroundColor: colors.primary, borderRadius: borderRadius.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  buttonSecondary:{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: borderRadius.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
};

export default { colors, spacing, typography, borderRadius, shadows, components };


