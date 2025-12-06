import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import ApiService from '../../services/api';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

// Mock expo-secure-store (will fallback to AsyncStorage in tests)
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.reject(new Error('Not available'))),
  setItemAsync: jest.fn(() => Promise.reject(new Error('Not available'))),
  deleteItemAsync: jest.fn(() => Promise.reject(new Error('Not available'))),
}));

// Mock the API service
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: {
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    getCurrentUser: jest.fn(),
    setAuthToken: jest.fn(),
  },
}));

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.clear();
  });

  it('should provide auth context', () => {
    const wrapper = ({ children }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current).toBeDefined();
    expect(result.current).toHaveProperty('login');
    expect(result.current).toHaveProperty('logout');
    expect(result.current).toHaveProperty('user');
    expect(result.current).toHaveProperty('loading');
  });

  it('should login user successfully', async () => {
    const mockUser = { id: '1', email: 'test@example.com' };
    const mockToken = 'test-token';

    ApiService.login.mockResolvedValue({
      success: true,
      user: mockUser,
      token: mockToken
    });

    const wrapper = ({ children }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login('test@example.com', 'password123', false);
    });

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.token).toBe(mockToken);
      expect(ApiService.setAuthToken).toHaveBeenCalledWith(mockToken);
    }, { timeout: 3000 });
  });

  it('should handle login failure', async () => {
    ApiService.login.mockResolvedValue({
      success: false,
      error: 'Invalid credentials'
    });

    const wrapper = ({ children }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      const response = await result.current.login('test@example.com', 'wrongpassword', false);
      expect(response.success).toBe(false);
    });

    expect(result.current.user).toBeNull();
  });

  it('should logout user and clear storage', async () => {
    const mockUser = { id: '1', email: 'test@example.com' };
    const mockToken = 'test-token';

    ApiService.login.mockResolvedValue({
      success: true,
      user: mockUser,
      token: mockToken
    });

    ApiService.logout.mockResolvedValue({ success: true });

    const wrapper = ({ children }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Login first
    await act(async () => {
      await result.current.login('test@example.com', 'password123', false);
    });

    // Then logout
    await act(async () => {
      await result.current.logout();
    });

    await waitFor(() => {
      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('authToken');
    });
  });

  it('should restore auth state from storage on mount', async () => {
    const mockToken = 'stored-token';
    const mockUser = { id: '1', email: 'test@example.com' };

    // Mock AsyncStorage to return the token
    AsyncStorage.getItem.mockImplementation((key) => {
      if (key === 'authToken') {
        return Promise.resolve(mockToken);
      }
      return Promise.resolve(null);
    });

    ApiService.getCurrentUser.mockResolvedValue(mockUser);

    const wrapper = ({ children }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(ApiService.getCurrentUser).toHaveBeenCalled();
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.token).toBe(mockToken);
  });

  it('should handle invalid stored token', async () => {
    const mockToken = 'invalid-token';
    await AsyncStorage.setItem('authToken', mockToken);
    
    ApiService.getCurrentUser.mockRejectedValue(new Error('Invalid token'));

    const wrapper = ({ children }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toBeNull();
  });
});

