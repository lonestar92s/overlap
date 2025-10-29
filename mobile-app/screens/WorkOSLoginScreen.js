import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  TouchableOpacity,
  Text,
  Platform
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import ApiService from '../services/api';

// Conditionally import WebView - only if native module is available
let WebView = null;
try {
  WebView = require('react-native-webview').WebView;
} catch (error) {
  console.warn('react-native-webview not available. Please build a development client.');
}

const WorkOSLoginScreen = ({ navigation }) => {
  const { loginWithWorkOS } = useAuth();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const webViewRef = useRef(null);
  const hasProcessedCallback = useRef(false);
  
  // Get the WorkOS login URL
  const loginUrl = ApiService.getWorkOSLoginUrl();

  // Check if WebView is available
  if (!WebView) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Sign in with Gmail</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={60} color="#ff9800" />
          <Text style={styles.errorTitle}>Development Build Required</Text>
          <Text style={styles.errorText}>
            To use in-app authentication, you need to build a development client that includes the WebView module.
          </Text>
          <Text style={styles.errorInstructions}>
            Run:{'\n'}
            {Platform.OS === 'ios' ? 'npx expo run:ios' : 'npx expo run:android'}
          </Text>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Handle navigation state changes to intercept the callback
  const handleNavigationStateChange = async (navState) => {
    const { url } = navState;
    
    // Check if this is the callback URL
    if (url.includes('/api/auth/workos/callback') && !hasProcessedCallback.current) {
      hasProcessedCallback.current = true; // Prevent double processing
      setProcessing(true);
      
      // Stop the WebView from navigating to the callback URL
      if (webViewRef.current) {
        webViewRef.current.stopLoading();
      }
      
      try {
        // Extract the authorization code from the URL
        // Parse URL manually for React Native compatibility
        const urlParts = url.split('?');
        const queryString = urlParts[1] || '';
        const params = {};
        queryString.split('&').forEach(param => {
          const [key, value] = param.split('=');
          if (key) {
            params[decodeURIComponent(key)] = decodeURIComponent(value || '');
          }
        });
        const code = params.code;
        const error = params.error;
        
        if (error) {
          // Handle OAuth error
          Alert.alert(
            'Authentication Failed',
            'Unable to sign in with Gmail. Please try again.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
          setProcessing(false);
          return;
        }
        
        if (code) {
          // Use the loginWithWorkOS method which calls the API to exchange code for token
          const result = await loginWithWorkOS(code);
          
          if (result.success) {
            // Success - navigation will be handled by App.js based on auth state
            navigation.goBack();
          } else {
            Alert.alert(
              'Authentication Failed',
              result.error || 'Failed to complete sign in. Please try again.',
              [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
          }
        } else {
          throw new Error('No authorization code received');
        }
      } catch (error) {
        console.error('WorkOS callback error:', error);
        Alert.alert(
          'Authentication Error',
          'An error occurred during sign in. Please try again.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } finally {
        setProcessing(false);
      }
    }
  };

  // Handle errors loading the page
  const handleError = (syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.error('WebView error:', nativeEvent);
    Alert.alert(
      'Connection Error',
      'Unable to load the sign-in page. Please check your internet connection.',
      [{ text: 'OK', onPress: () => navigation.goBack() }]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
          disabled={processing}
        >
          <MaterialIcons name="close" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sign in with Gmail</Text>
        <View style={styles.placeholder} />
      </View>

      {processing && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.processingText}>Completing sign in...</Text>
        </View>
      )}

      <WebView
        ref={webViewRef}
        source={{ uri: loginUrl }}
        onNavigationStateChange={handleNavigationStateChange}
        onShouldStartLoadWithRequest={(request) => {
          // Intercept the callback URL before it loads (iOS only)
          if (request.url.includes('/api/auth/workos/callback') && !hasProcessedCallback.current) {
            handleNavigationStateChange({ url: request.url });
            return false; // Prevent loading the callback URL
          }
          return true; // Allow other URLs to load
        }}
        onError={handleError}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        style={styles.webview}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1976d2" />
            <Text style={styles.loadingText}>Loading sign-in page...</Text>
          </View>
        )}
      />
      
      {loading && !processing && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 32,
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    zIndex: 1000,
  },
  processingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  errorText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  errorInstructions: {
    fontSize: 13,
    color: '#1976d2',
    textAlign: 'center',
    marginBottom: 30,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  backButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default WorkOSLoginScreen;

