import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';

// Secure storage keys
const SECURE_STORAGE_KEYS = {
  AUTH_TOKEN: 'authToken',
  REMEMBER_ME: 'rememberMe', // Stored in AsyncStorage (not sensitive)
};

// Secure storage wrapper with fallback to AsyncStorage
// expo-secure-store requires a development build, so we fallback gracefully
let SecureStore = null;
let secureStoreAvailable = false;

try {
  SecureStore = require('expo-secure-store');
  // Check if SecureStore is actually available (not just imported)
  // In Expo Go, the module exists but methods throw errors
  secureStoreAvailable = !!SecureStore.getItemAsync;
} catch (error) {
  // SecureStore not available (Expo Go or not installed)
  // Will fallback to AsyncStorage
  secureStoreAvailable = false;
}

// Secure storage helper functions
const secureStorage = {
  async getItem(key) {
    // Always try AsyncStorage first as fallback, then SecureStore if available
    // This ensures we can read tokens saved before SecureStore was added
    const asyncValue = await AsyncStorage.getItem(key);
    
    if (secureStoreAvailable && SecureStore) {
      try {
        const secureValue = await SecureStore.getItemAsync(key);
        // If SecureStore has a value, use it (it's more secure)
        // Otherwise, use AsyncStorage value if available
        return secureValue || asyncValue;
      } catch (error) {
        // SecureStore failed, use AsyncStorage
        console.warn('SecureStore getItem failed, using AsyncStorage:', error.message);
        return asyncValue;
      }
    }
    // SecureStore not available, use AsyncStorage
    return asyncValue;
  },

  async setItem(key, value) {
    // Always save to AsyncStorage as backup
    await AsyncStorage.setItem(key, value);
    
    if (secureStoreAvailable && SecureStore) {
      try {
        // Also save to SecureStore if available (more secure)
        await SecureStore.setItemAsync(key, value);
      } catch (error) {
        // SecureStore failed, but AsyncStorage already saved, so continue
        console.warn('SecureStore setItem failed, using AsyncStorage only:', error.message);
      }
    }
  },

  async removeItem(key) {
    // Remove from both locations
    await AsyncStorage.removeItem(key).catch(() => {});
    
    if (secureStoreAvailable && SecureStore) {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch (error) {
        // Ignore SecureStore errors, AsyncStorage already cleared
        console.warn('SecureStore removeItem failed:', error.message);
      }
    }
  }
};

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rememberMe, setRememberMe] = useState(false);

  // Check for existing token on app start
  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      // Try to get token from secure storage (with fallback)
      let storedToken = await secureStorage.getItem(SECURE_STORAGE_KEYS.AUTH_TOKEN);
      
      // If not found, try AsyncStorage for migration
      if (!storedToken) {
        storedToken = await AsyncStorage.getItem('authToken');
        // If found in AsyncStorage, migrate to secure storage
        if (storedToken) {
          await secureStorage.setItem(SECURE_STORAGE_KEYS.AUTH_TOKEN, storedToken);
          await AsyncStorage.removeItem('authToken'); // Remove from insecure storage
        }
      }
      
      const storedRememberMe = await AsyncStorage.getItem('rememberMe');
      
      if (storedToken) {
        setToken(storedToken);
        setRememberMe(storedRememberMe === 'true');
        
        // Set the token in the API service
        ApiService.setAuthToken(storedToken);
        
        // Verify token is still valid by making a test API call
        try {
          const userData = await ApiService.getCurrentUser();
          setUser(userData);
        } catch (error) {
          // Check if it's a rate limit error - don't clear auth state for rate limits
          if (error.isRateLimit || error.status === 429 || error.message.includes('rate limit') || error.message.includes('Too many requests')) {
            console.log('Rate limit during token validation, keeping token for retry');
            // Don't clear auth state for rate limits - keep token and retry later
            setUser(null);
            return; // Exit early, don't clear auth state
          }
          
          // Check if it's an actual authentication failure (401)
          if (error.isAuthFailure || error.status === 401 || error.message.includes('Authentication failed')) {
            console.log('Token validation failed - authentication error, clearing auth state');
            console.log('Token validation error details:', error.message);
            // Token is invalid or expired, clear it
            await logout();
            return;
          }
          
          // Check if it's a network error vs other errors
          if (error.message.includes('Network error') || error.message.includes('timeout')) {
            console.log('Network error during token validation, keeping token for retry');
            // Don't clear auth state for network errors, just set user to null temporarily
            setUser(null);
          } else {
            // For other errors, log but don't clear auth state (might be temporary)
            console.log('Token validation error (non-auth), keeping token:', error.message);
            setUser(null);
          }
        }
      }
    } catch (error) {
      console.error('Error checking auth state:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password, remember = false) => {
    try {
      setLoading(true);
      const response = await ApiService.login(email, password);
      
      if (response.success) {
        const { user: userData, token: authToken } = response;
        
        setUser(userData);
        setToken(authToken);
        setRememberMe(remember);
        
        // Set the token in the API service
        ApiService.setAuthToken(authToken);
        
        // Store token securely and remember me preference
        // Store token in secure storage (encrypted if available, otherwise AsyncStorage)
        // secureStorage.setItem now saves to both AsyncStorage and SecureStore
        await secureStorage.setItem(SECURE_STORAGE_KEYS.AUTH_TOKEN, authToken);
        
        // Store remember me preference in AsyncStorage (not sensitive)
        await AsyncStorage.setItem('rememberMe', remember ? 'true' : 'false');
        
        return { success: true };
      } else {
        return { success: false, error: response.error || 'Login failed' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message || 'Login failed' };
    } finally {
      setLoading(false);
    }
  };

  const register = async (email, password) => {
    try {
      setLoading(true);
      const response = await ApiService.register(email, password);
      
      if (response.success) {
        const { user: userData, token: authToken } = response;
        
        setUser(userData);
        setToken(authToken);
        setRememberMe(true); // Auto-remember on registration
        
        // Set the token in the API service
        ApiService.setAuthToken(authToken);
        
        // Store token securely and remember me preference
        // secureStorage.setItem now saves to both AsyncStorage and SecureStore
        await secureStorage.setItem(SECURE_STORAGE_KEYS.AUTH_TOKEN, authToken);
        await AsyncStorage.setItem('rememberMe', 'true');
        
        return { success: true };
      } else {
        return { success: false, error: response.error || 'Registration failed' };
      }
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: error.message || 'Registration failed' };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      // Clear stored data from secure storage (with fallback)
      await secureStorage.removeItem(SECURE_STORAGE_KEYS.AUTH_TOKEN);
      
      // Also clear from AsyncStorage (in case it was there)
      await AsyncStorage.removeItem('authToken').catch(() => {});
      
      // Clear remember me preference
      await AsyncStorage.removeItem('rememberMe');
      
      // Clear token from API service
      ApiService.setAuthToken(null);
      
      // Clear state
      setUser(null);
      setToken(null);
      setRememberMe(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const loginWithWorkOS = async (code) => {
    try {
      setLoading(true);
      const response = await ApiService.handleWorkOSCallback(code);
      
      if (response.success) {
        const { user: userData, token: authToken } = response;
        
        setUser(userData);
        setToken(authToken);
        setRememberMe(true); // Auto-remember WorkOS logins
        
        // Set the token in the API service
        ApiService.setAuthToken(authToken);
        
        // Store token securely and remember me preference
        // secureStorage.setItem now saves to both AsyncStorage and SecureStore
        await secureStorage.setItem(SECURE_STORAGE_KEYS.AUTH_TOKEN, authToken);
        await AsyncStorage.setItem('rememberMe', 'true');
        
        return { success: true };
      } else {
        return { success: false, error: response.error || 'WorkOS login failed' };
      }
    } catch (error) {
      console.error('WorkOS login error:', error);
      return { success: false, error: error.message || 'WorkOS login failed' };
    } finally {
      setLoading(false);
    }
  };

  const isAuthenticated = () => {
    return !!user && !!token;
  };

  const value = {
    user,
    token,
    loading,
    rememberMe,
    login,
    register,
    loginWithWorkOS,
    logout,
    isAuthenticated,
    setRememberMe
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
