import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../styles/designTokens';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error for debugging
    if (__DEV__) {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // Check if it's a timezone-related error
    if (error.message && error.message.includes('timeZone')) {
      if (__DEV__) {
        console.warn('Timezone error caught by ErrorBoundary:', error.message);
      }
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      // Check if it's a timezone error
      const isTimezoneError = this.state.error?.message?.includes('timeZone') || 
                              this.state.error?.message?.includes('Incorrect timeZone');

      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>
            {isTimezoneError ? 'Time Display Issue' : 'Something went wrong'}
          </Text>
          
          <Text style={styles.errorMessage}>
            {isTimezoneError 
              ? 'There was an issue displaying the match time. The time information may not be available.'
              : 'An unexpected error occurred. Please try again.'
            }
          </Text>
          
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={this.handleRetry}
            accessibilityLabel="Try again"
            accessibilityRole="button"
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
          
          {__DEV__ && (
            <View style={styles.debugInfo}>
              <Text style={styles.debugTitle}>Debug Info:</Text>
              <Text style={styles.debugText}>{this.state.error?.message}</Text>
            </View>
          )}
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  errorTitle: {
    ...typography.h3,
    fontWeight: 'bold',
    color: colors.error,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  errorMessage: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  retryButtonText: {
    color: colors.onPrimary,
    ...typography.button,
  },
  debugInfo: {
    marginTop: spacing.lg,
    padding: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  debugTitle: {
    ...typography.caption,
    fontWeight: 'bold',
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  debugText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontFamily: 'monospace',
  },
});

export default ErrorBoundary;

