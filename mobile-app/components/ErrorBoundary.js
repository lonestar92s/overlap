import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

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
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // Check if it's a timezone-related error
    if (error.message && error.message.includes('timeZone')) {
      console.warn('Timezone error caught by ErrorBoundary:', error.message);
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
          
          <TouchableOpacity style={styles.retryButton} onPress={this.handleRetry}>
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
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#dc3545',
    marginBottom: 10,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  debugInfo: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6c757d',
    marginBottom: 5,
  },
  debugText: {
    fontSize: 10,
    color: '#6c757d',
    fontFamily: 'monospace',
  },
});

export default ErrorBoundary;

