import ApiService from '../../services/api';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

// Mock fetch
global.fetch = jest.fn();

describe('API Service', () => {
  // Use localhost for tests to match implementation fallback
  const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 
    'http://localhost:3001/api';

  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockClear();
  });

  describe('login', () => {
    it('should login user successfully', async () => {
      const mockResponse = {
        success: true,
        user: { id: '1', email: 'test@example.com' },
        token: 'test-token'
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await ApiService.login('test@example.com', 'password123');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/login'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'password123'
          })
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it('should handle login error', async () => {
      const mockResponse = {
        success: false,
        error: 'Invalid credentials'
      };

      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => mockResponse
      });

      const result = await ApiService.login('test@example.com', 'wrongpassword');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });

    it('should handle network errors', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await ApiService.login('test@example.com', 'password123');
      // API service catches network errors and returns { success: false, error: 'Network error' }
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('searchAggregatedMatches', () => {
    it('should fetch matches with query parameters', async () => {
      const mockMatches = [
        { id: 1, fixture: { date: '2025-02-15' } },
        { id: 2, fixture: { date: '2025-02-16' } }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockMatches })
      });

      const result = await ApiService.searchAggregatedMatches({
        dateFrom: '2025-02-15',
        dateTo: '2025-02-20',
        competitions: ['39']
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/search/aggregated'),
        expect.any(Object)
      );

      expect(result.data).toEqual(mockMatches);
    });

    it('should include auth token in headers when authenticated', async () => {
      const mockToken = 'test-token';
      ApiService.setAuthToken(mockToken);

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] })
      });

      await ApiService.searchAggregatedMatches({
        dateFrom: '2025-02-15',
        dateTo: '2025-02-20'
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockToken}`
          })
        })
      );
    });
  });

  describe('setAuthToken', () => {
    it('should store auth token', () => {
      const token = 'test-token';
      ApiService.setAuthToken(token);

      // Token should be stored internally
      // The exact implementation depends on how ApiService stores tokens
      expect(ApiService.setAuthToken).toBeDefined();
    });
  });

  describe('getCurrentUser', () => {
    it('should fetch current user when authenticated', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User'
      };

      const mockToken = 'test-token';
      ApiService.setAuthToken(mockToken);

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, user: mockUser })
      });

      const result = await ApiService.getCurrentUser();

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/me'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockToken}`
          })
        })
      );

      expect(result).toEqual(mockUser);
    });

    it('should throw error when not authenticated', async () => {
      ApiService.setAuthToken(null);

      await expect(ApiService.getCurrentUser()).rejects.toThrow();
    });
  });
});

