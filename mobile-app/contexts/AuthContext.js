import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';

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
      const storedToken = await AsyncStorage.getItem('authToken');
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
          // Token is invalid, clear it
          await logout();
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
        
        // Store token and remember me preference
        if (remember) {
          await AsyncStorage.setItem('authToken', authToken);
          await AsyncStorage.setItem('rememberMe', 'true');
        } else {
          // Store token temporarily (will be cleared on app restart)
          await AsyncStorage.setItem('authToken', authToken);
          await AsyncStorage.setItem('rememberMe', 'false');
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

  const register = async (email, password, tier = 'freemium') => {
    try {
      setLoading(true);
      const response = await ApiService.register(email, password, tier);
      
      if (response.success) {
        const { user: userData, token: authToken } = response;
        
        setUser(userData);
        setToken(authToken);
        setRememberMe(true); // Auto-remember on registration
        
        // Set the token in the API service
        ApiService.setAuthToken(authToken);
        
        // Store token and remember me preference
        await AsyncStorage.setItem('authToken', authToken);
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
      // Clear stored data
      await AsyncStorage.removeItem('authToken');
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
