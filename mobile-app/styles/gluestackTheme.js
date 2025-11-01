import { createConfig } from '@gluestack-ui/themed';

// Import existing design tokens to maintain consistency
import { colors, spacing, typography, borderRadius } from './designTokens';

// Create custom theme configuration based on existing design tokens
export const config = createConfig({
  tokens: {
    colors: {
      // Primary colors
      primary0: colors.primary,
      primary50: '#E3F2FD',
      primary100: '#BBDEFB',
      primary200: '#90CAF9',
      primary300: '#64B5F6',
      primary400: '#42A5F5',
      primary500: colors.primary,
      primary600: '#0069CC',
      primary700: '#0059B3',
      primary800: '#004A99',
      primary900: '#003D80',
      primary950: '#002E66',
      
      // Secondary colors
      secondary0: colors.secondary,
      secondary50: '#FFE5EA',
      secondary100: '#FFB8C5',
      secondary200: '#FF8AA0',
      secondary300: '#FF5C7B',
      secondary400: '#FF3E61',
      secondary500: colors.secondary,
      secondary600: '#E62D4D',
      secondary700: '#CC2343',
      secondary800: '#B31938',
      secondary900: '#990F2E',
      secondary950: '#800524',
      
      // Background colors
      backgroundLight0: colors.background,
      backgroundLight50: '#FAFAFA',
      backgroundLight100: colors.background,
      backgroundLight200: colors.cardGrey,
      backgroundLight300: colors.card,
      
      // Text colors
      textLight0: colors.text.primary,
      textLight50: colors.text.secondary,
      textLight100: colors.text.light,
      textLight200: colors.text.accent,
      
      // Status colors
      success0: colors.success,
      success50: '#E8F5E9',
      success100: '#C8E6C9',
      success500: colors.success,
      success600: '#43A047',
      success700: '#388E3C',
      
      error0: colors.error,
      error50: '#FFEBEE',
      error100: '#FFCDD2',
      error500: colors.error,
      error600: '#E53935',
      error700: '#D32F2F',
      
      warning0: colors.warning,
      warning50: '#FFF3E0',
      warning100: '#FFE0B2',
      warning500: colors.warning,
      warning600: '#FB8C00',
      warning700: '#F57C00',
      
      // Border colors
      borderLight0: colors.border,
      borderLight50: colors.borderLight,
      borderLight100: colors.border,
      borderLight200: '#CCCCCC',
    },
    space: {
      xs: spacing.xs,
      sm: spacing.sm,
      md: spacing.md,
      lg: spacing.lg,
      xl: spacing.xl,
      '2xl': spacing.xxl,
      '3xl': 64,
      '4xl': 80,
    },
    borderRadius: {
      none: 0,
      xs: borderRadius.xs,
      sm: borderRadius.sm,
      md: borderRadius.md,
      lg: borderRadius.lg,
      xl: borderRadius.xl,
      full: borderRadius.pill,
    },
    fontSizes: {
      xs: typography.caption.fontSize,
      sm: typography.bodySmall.fontSize,
      md: typography.body.fontSize,
      lg: typography.h3.fontSize,
      xl: typography.h2.fontSize,
      '2xl': typography.h1.fontSize,
      '3xl': 30,
      '4xl': 36,
    },
    fontWeights: {
      thin: '100',
      extralight: '200',
      light: '300',
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      extrabold: '800',
      black: '900',
    },
    lineHeights: {
      xs: typography.caption.lineHeight,
      sm: typography.bodySmall.lineHeight,
      md: typography.body.lineHeight,
      lg: typography.h3.lineHeight,
      xl: typography.h2.lineHeight,
      '2xl': typography.h1.lineHeight,
      '3xl': 38,
      '4xl': 44,
    },
  },
});

// Export theme for use in components
export default config;
