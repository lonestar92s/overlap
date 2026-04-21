import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';
import NotificationService from '../services/notifications';
import { secureAuthStorage, AUTH_TOKEN_STORAGE_KEY } from '../services/secureAuthStorage';

const REMEMBER_ME_KEY = 'rememberMe';

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
  const pushTokenRef = useRef(null);

  const registerPushToken = async () => {
    try {
      const pushToken = await NotificationService.registerForPushNotifications();
      if (pushToken) {
        pushTokenRef.current = pushToken;
        await NotificationService.registerTokenWithBackend(pushToken);
      }
    } catch (error) {
      console.warn('Push notification registration failed (non-blocking):', error);
    }
  };

  // Check for existing token on app start
  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      // Try to get token from secure storage (with fallback)
      let storedToken = await secureAuthStorage.getItem(AUTH_TOKEN_STORAGE_KEY);

      // If not found, try AsyncStorage for migration (legacy paths)
      if (!storedToken) {
        storedToken = await AsyncStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
        if (storedToken) {
          await secureAuthStorage.setItem(AUTH_TOKEN_STORAGE_KEY, storedToken);
          await AsyncStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
        }
      }

      const storedRememberMe = await AsyncStorage.getItem(REMEMBER_ME_KEY);
      
      if (storedToken) {
        setToken(storedToken);
        setRememberMe(storedRememberMe === 'true');
        
        // Set the token in the API service
        ApiService.setAuthToken(storedToken);
        
        // Verify token is still valid by making a test API call
        try {
          const userData = await ApiService.getCurrentUser();
          setUser(userData);
          registerPushToken();
        } catch (error) {
          // Check if it's a rate limit error - don't clear auth state for rate limits
          if (error.isRateLimit || error.status === 429 || error.message.includes('rate limit') || error.message.includes('Too many requests')) {
            // Don't clear auth state for rate limits - keep token and retry later
            setUser(null);
            return; // Exit early, don't clear auth state
          }
          
          // Check if it's an actual authentication failure (401)
          if (error.isAuthFailure || error.status === 401 || error.message.includes('Authentication failed')) {
            // Token is invalid or expired, clear it
            await logout();
            return;
          }
          
          // Check if it's a network error vs other errors
          if (error.message.includes('Network error') || error.message.includes('timeout')) {
            // Don't clear auth state for network errors, just set user to null temporarily
            setUser(null);
          } else {
            // For other errors, log but don't clear auth state (might be temporary)
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
        
        await secureAuthStorage.setItem(AUTH_TOKEN_STORAGE_KEY, authToken);

        // Store remember me preference in AsyncStorage (not sensitive)
        await AsyncStorage.setItem(REMEMBER_ME_KEY, remember ? 'true' : 'false');

        registerPushToken();
        
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

  const register = async (email, password, acceptedTerms) => {
    try {
      setLoading(true);
      const response = await ApiService.register(email, password, acceptedTerms);
      
      if (response.success) {
        const { user: userData, token: authToken } = response;
        
        setUser(userData);
        setToken(authToken);
        setRememberMe(true); // Auto-remember on registration
        
        // Set the token in the API service
        ApiService.setAuthToken(authToken);
        
        await secureAuthStorage.setItem(AUTH_TOKEN_STORAGE_KEY, authToken);
        await AsyncStorage.setItem(REMEMBER_ME_KEY, 'true');

        registerPushToken();

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
      // Unregister push token before clearing auth
      if (pushTokenRef.current) {
        await NotificationService.unregisterTokenFromBackend(pushTokenRef.current);
        pushTokenRef.current = null;
      }

      // Clear stored data from secure storage (with fallback)
      await secureAuthStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);

      await AsyncStorage.removeItem(AUTH_TOKEN_STORAGE_KEY).catch(() => {});

      await AsyncStorage.removeItem(REMEMBER_ME_KEY);
      
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
        
        await secureAuthStorage.setItem(AUTH_TOKEN_STORAGE_KEY, authToken);
        await AsyncStorage.setItem(REMEMBER_ME_KEY, 'true');

        registerPushToken();

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

  const refreshUser = async () => {
    try {
      const userData = await ApiService.getCurrentUser();
      setUser(userData);
    } catch (error) {
      if (__DEV__) {
        console.warn('refreshUser failed:', error?.message);
      }
    }
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
    setRememberMe,
    refreshUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
