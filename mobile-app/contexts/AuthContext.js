import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import ApiService from '../services/api';

// Secure storage keys
const SECURE_STORAGE_KEYS = {
  AUTH_TOKEN: 'authToken',
  REMEMBER_ME: 'rememberMe', // Stored in AsyncStorage (not sensitive)
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
      // Try to get token from secure storage first
      let storedToken = null;
      try {
        storedToken = await SecureStore.getItemAsync(SECURE_STORAGE_KEYS.AUTH_TOKEN);
      } catch (secureError) {
        // Fallback to AsyncStorage for migration (remove after migration period)
        try {
          storedToken = await AsyncStorage.getItem('authToken');
          // If found in AsyncStorage, migrate to SecureStore
          if (storedToken) {
            await SecureStore.setItemAsync(SECURE_STORAGE_KEYS.AUTH_TOKEN, storedToken);
            await AsyncStorage.removeItem('authToken'); // Remove from insecure storage
          }
        } catch (migrationError) {
          console.error('Error migrating token to secure storage:', migrationError);
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
          console.log('Token validation failed, clearing auth state');
          console.log('Token validation error details:', error.message);
          
          // Check if it's a network error vs authentication error
          if (error.message.includes('Network error') || error.message.includes('timeout')) {
            console.log('Network error during token validation, keeping token for retry');
            // Don't clear auth state for network errors, just set user to null temporarily
            setUser(null);
          } else {
            // Token is invalid or expired, clear it
            await logout();
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
        // Always store token in secure storage (encrypted)
        await SecureStore.setItemAsync(SECURE_STORAGE_KEYS.AUTH_TOKEN, authToken);
        
        // Store remember me preference in AsyncStorage (not sensitive)
        await AsyncStorage.setItem('rememberMe', remember ? 'true' : 'false');
        
        // Clean up old token from AsyncStorage if it exists (migration)
        try {
          await AsyncStorage.removeItem('authToken');
        } catch (e) {
          // Ignore if doesn't exist
        }
        
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
        await SecureStore.setItemAsync(SECURE_STORAGE_KEYS.AUTH_TOKEN, authToken);
        await AsyncStorage.setItem('rememberMe', 'true');
        
        // Clean up old token from AsyncStorage if it exists
        try {
          await AsyncStorage.removeItem('authToken');
        } catch (e) {
          // Ignore if doesn't exist
        }
        
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
      // Clear stored data from secure storage
      try {
        await SecureStore.deleteItemAsync(SECURE_STORAGE_KEYS.AUTH_TOKEN);
      } catch (secureError) {
        // Fallback: try AsyncStorage (for migration)
        try {
          await AsyncStorage.removeItem('authToken');
        } catch (e) {
          // Ignore if doesn't exist
        }
      }
      
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
        await SecureStore.setItemAsync(SECURE_STORAGE_KEYS.AUTH_TOKEN, authToken);
        await AsyncStorage.setItem('rememberMe', 'true');
        
        // Clean up old token from AsyncStorage if it exists
        try {
          await AsyncStorage.removeItem('authToken');
        } catch (e) {
          // Ignore if doesn't exist
        }
        
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
