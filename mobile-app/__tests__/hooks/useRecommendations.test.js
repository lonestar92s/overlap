import { renderHook, waitFor } from '@testing-library/react-native';
import { useRecommendations } from '../../hooks/useRecommendations';
import ApiService from '../../services/api';

// Mock ApiService
jest.mock('../../services/api', () => ({
  getRecommendations: jest.fn(),
  trackRecommendation: jest.fn(),
  invalidateRecommendationCache: jest.fn(),
  getCachedRecommendations: jest.fn(() => null),
}));

describe('useRecommendations', () => {
  const mockTripId = 'trip123';
  const mockRecommendations = [
    {
      matchId: 'match1',
      recommendedForDate: '2026-01-10',
      match: { id: 'match1', fixture: { id: 'match1' } },
      score: 100,
      reason: 'Test reason'
    },
    {
      matchId: 'match2',
      recommendedForDate: '2026-01-11',
      match: { id: 'match2', fixture: { id: 'match2' } },
      score: 90,
      reason: 'Test reason 2'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    ApiService.getRecommendations.mockResolvedValue({
      success: true,
      recommendations: [],
      fromStorage: false
    });
    ApiService.trackRecommendation.mockResolvedValue({ success: true });
  });

  describe('Stored Recommendations', () => {
    it('should use stored recommendations from trip object when available', async () => {
      const tripWithRecommendations = {
        id: mockTripId,
        recommendationsVersion: 'v2',
        recommendations: mockRecommendations
      };

      const { result } = renderHook(() =>
        useRecommendations(mockTripId, tripWithRecommendations, { autoFetch: true })
      );

      await waitFor(() => {
        expect(result.current.recommendations).toHaveLength(2);
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBe(null);
      });

      // Should not call API when stored recommendations are available
      expect(ApiService.getRecommendations).not.toHaveBeenCalled();
    });

    it('should handle empty stored recommendations (v2)', async () => {
      const tripWithEmptyRecommendations = {
        id: mockTripId,
        recommendationsVersion: 'v2',
        recommendations: []
      };

      const { result } = renderHook(() =>
        useRecommendations(mockTripId, tripWithEmptyRecommendations, { autoFetch: true })
      );

      await waitFor(() => {
        expect(result.current.recommendations).toHaveLength(0);
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBe(null);
      });

      // Should not call API when trip has v2 but empty recommendations
      expect(ApiService.getRecommendations).not.toHaveBeenCalled();
    });

    it('should fetch from API when trip has no stored recommendations', async () => {
      const tripWithoutRecommendations = {
        id: mockTripId,
        recommendationsVersion: null,
        recommendations: null
      };

      ApiService.getRecommendations.mockResolvedValue({
        success: true,
        recommendations: mockRecommendations,
        fromStorage: false
      });

      const { result } = renderHook(() =>
        useRecommendations(mockTripId, tripWithoutRecommendations, { autoFetch: true })
      );

      await waitFor(() => {
        expect(ApiService.getRecommendations).toHaveBeenCalledWith(mockTripId, false);
      });

      await waitFor(() => {
        expect(result.current.recommendations).toHaveLength(2);
      });
    });

    it('should fetch from API when trip object is null initially', async () => {
      ApiService.getRecommendations.mockResolvedValue({
        success: true,
        recommendations: mockRecommendations,
        fromStorage: false
      });

      const { result, rerender } = renderHook(
        ({ trip }) => useRecommendations(mockTripId, trip, { autoFetch: true }),
        { initialProps: { trip: null } }
      );

      await waitFor(() => {
        expect(ApiService.getRecommendations).toHaveBeenCalledWith(mockTripId, false);
      });

      // Simulate trip loading with stored recommendations
      const tripWithRecommendations = {
        id: mockTripId,
        recommendationsVersion: 'v2',
        recommendations: mockRecommendations
      };

      rerender({ trip: tripWithRecommendations });

      await waitFor(() => {
        expect(result.current.recommendations).toHaveLength(2);
      });
    });
  });

  describe('API Fetching', () => {
    it('should fetch recommendations from API when stored recommendations are not available', async () => {
      const tripWithoutStored = {
        id: mockTripId,
        recommendationsVersion: null
      };

      ApiService.getRecommendations.mockResolvedValue({
        success: true,
        recommendations: mockRecommendations,
        fromStorage: false
      });

      const { result } = renderHook(() =>
        useRecommendations(mockTripId, tripWithoutStored, { autoFetch: true })
      );

      await waitFor(() => {
        expect(ApiService.getRecommendations).toHaveBeenCalledWith(mockTripId, false);
      });

      await waitFor(() => {
        expect(result.current.recommendations).toHaveLength(2);
        expect(result.current.error).toBe(null);
      });
    });

    it('should handle API errors gracefully', async () => {
      const tripWithoutStored = {
        id: mockTripId,
        recommendationsVersion: null
      };

      ApiService.getRecommendations.mockRejectedValue(new Error('API Error'));

      const { result } = renderHook(() =>
        useRecommendations(mockTripId, tripWithoutStored, { autoFetch: true })
      );

      await waitFor(() => {
        expect(result.current.error).toBe('API Error');
        expect(result.current.recommendations).toHaveLength(0);
      });
    });

    it('should use stored recommendations in fetchRecommendations when trip is available', async () => {
      const tripWithRecommendations = {
        id: mockTripId,
        recommendationsVersion: 'v2',
        recommendations: mockRecommendations
      };

      const { result } = renderHook(() =>
        useRecommendations(mockTripId, tripWithRecommendations, { autoFetch: false })
      );

      // Manually trigger fetch
      await result.current.refetch(false);

      // Should use stored recommendations, not call API
      expect(ApiService.getRecommendations).not.toHaveBeenCalled();
      
      // Wait for recommendations to be set from stored trip data
      await waitFor(() => {
        expect(result.current.recommendations).toHaveLength(2);
      });
    });

    it('should force refresh when forceRefresh is true', async () => {
      const tripWithRecommendations = {
        id: mockTripId,
        recommendationsVersion: 'v2',
        recommendations: mockRecommendations
      };

      ApiService.getRecommendations.mockResolvedValue({
        success: true,
        recommendations: [{ matchId: 'newMatch', match: { id: 'newMatch' } }],
        fromStorage: false
      });

      const { result } = renderHook(() =>
        useRecommendations(mockTripId, tripWithRecommendations, { autoFetch: false })
      );

      // Force refresh should bypass stored recommendations
      await result.current.refetch(true);

      await waitFor(() => {
        expect(ApiService.getRecommendations).toHaveBeenCalledWith(mockTripId, true);
      });
    });
  });

  describe('Dismiss Recommendation', () => {
    it('should dismiss a recommendation and remove it from list', async () => {
      const tripWithRecommendations = {
        id: mockTripId,
        recommendationsVersion: 'v2',
        recommendations: mockRecommendations
      };

      ApiService.trackRecommendation.mockResolvedValue({ success: true });

      const { result } = renderHook(() =>
        useRecommendations(mockTripId, tripWithRecommendations, { autoFetch: true })
      );

      await waitFor(() => {
        expect(result.current.recommendations).toHaveLength(2);
      });

      // Dismiss first recommendation
      await result.current.dismiss(result.current.recommendations[0]);

      await waitFor(() => {
        expect(result.current.recommendations).toHaveLength(1);
        expect(result.current.recommendations[0].matchId).toBe('match2');
        expect(ApiService.trackRecommendation).toHaveBeenCalledWith(
          'match1',
          'dismissed',
          mockTripId,
          '2026-01-10',
          100,
          'Test reason'
        );
      });
    });
  });

  describe('Add to Trip', () => {
    it('should add recommendation to trip and remove from list', async () => {
      const tripWithRecommendations = {
        id: mockTripId,
        recommendationsVersion: 'v2',
        recommendations: mockRecommendations
      };

      const mockAddMatchToItinerary = jest.fn().mockResolvedValue({ success: true });
      ApiService.trackRecommendation.mockResolvedValue({ success: true });

      const { result } = renderHook(() =>
        useRecommendations(mockTripId, tripWithRecommendations, { autoFetch: true })
      );

      await waitFor(() => {
        expect(result.current.recommendations).toHaveLength(2);
      });

      // Add first recommendation to trip
      await result.current.addToTrip(result.current.recommendations[0], mockAddMatchToItinerary);

      await waitFor(() => {
        expect(result.current.recommendations).toHaveLength(1);
        expect(mockAddMatchToItinerary).toHaveBeenCalled();
        expect(ApiService.trackRecommendation).toHaveBeenCalledWith(
          'match1',
          'saved',
          mockTripId,
          '2026-01-10',
          100,
          'Test reason'
        );
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle null trip object gracefully', async () => {
      ApiService.getRecommendations.mockResolvedValue({
        success: true,
        recommendations: mockRecommendations,
        fromStorage: false
      });

      const { result } = renderHook(() =>
        useRecommendations(mockTripId, null, { autoFetch: true })
      );

      await waitFor(() => {
        expect(ApiService.getRecommendations).toHaveBeenCalled();
      });
    });

    it('should handle trip with recommendationsVersion v2 but null recommendations array', async () => {
      const tripWithNullRecommendations = {
        id: mockTripId,
        recommendationsVersion: 'v2',
        recommendations: null
      };

      ApiService.getRecommendations.mockResolvedValue({
        success: true,
        recommendations: mockRecommendations,
        fromStorage: false
      });

      const { result } = renderHook(() =>
        useRecommendations(mockTripId, tripWithNullRecommendations, { autoFetch: true })
      );

      await waitFor(() => {
        expect(ApiService.getRecommendations).toHaveBeenCalled();
      });
    });

    it('should not auto-fetch when autoFetch is false', async () => {
      const tripWithRecommendations = {
        id: mockTripId,
        recommendationsVersion: 'v2',
        recommendations: mockRecommendations
      };

      const { result } = renderHook(() =>
        useRecommendations(mockTripId, tripWithRecommendations, { autoFetch: false })
      );

      // Wait a bit to ensure no auto-fetch happens
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(ApiService.getRecommendations).not.toHaveBeenCalled();
      expect(result.current.recommendations).toHaveLength(0); // Not loaded yet
    });

    it('should handle tripId changes', async () => {
      const trip1 = {
        id: 'trip1',
        recommendationsVersion: 'v2',
        recommendations: [mockRecommendations[0]]
      };

      const trip2 = {
        id: 'trip2',
        recommendationsVersion: 'v2',
        recommendations: [mockRecommendations[1]]
      };

      const { result, rerender } = renderHook(
        ({ tripId, trip }) => useRecommendations(tripId, trip, { autoFetch: true }),
        { initialProps: { tripId: 'trip1', trip: trip1 } }
      );

      await waitFor(() => {
        expect(result.current.recommendations).toHaveLength(1);
      });

      // Change trip
      rerender({ tripId: 'trip2', trip: trip2 });

      await waitFor(() => {
        expect(result.current.recommendations).toHaveLength(1);
        expect(result.current.recommendations[0].matchId).toBe('match2');
      });
    });
  });
});

