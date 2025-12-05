/**
 * Custom hook for managing trip recommendations
 * Handles fetching, caching, deduplication, tracking, and dismissal
 * 
 * IMPORTANT: This hook does NOT handle useFocusEffect - screens should call refetch()
 * from their own useFocusEffect hooks to sync recommendations across screens
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import ApiService from '../services/api';

// Shared request cache to prevent duplicate API calls when multiple screens fetch simultaneously
const activeRequests = new Map();

/**
 * Hook for managing trip recommendations
 * @param {string} tripId - Trip ID to fetch recommendations for
 * @param {Object} options - Optional configuration
 * @param {boolean} options.autoFetch - Whether to fetch on mount (default: true)
 * @returns {Object} Recommendations state and utilities
 */
export const useRecommendations = (tripId, options = {}) => {
  const { autoFetch = true } = options;
  
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  // AbortController for cancelling in-flight requests
  const abortControllerRef = useRef(null);
  
  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Cancel any in-flight requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      // Remove from active requests
      if (tripId) {
        activeRequests.delete(tripId);
      }
    };
  }, [tripId]);
  
  /**
   * Deduplicate recommendations by matchId
   */
  const deduplicateRecommendations = useCallback((recommendations) => {
    const seenMatchIds = new Set();
    return recommendations.filter(rec => {
      const matchId = String(rec.matchId || rec.match?.fixture?.id || rec.match?.id);
      if (seenMatchIds.has(matchId)) {
        console.log(`⚠️ Filtering duplicate recommendation in UI for matchId: ${matchId}`);
        return false;
      }
      seenMatchIds.add(matchId);
      return true;
    });
  }, []);
  
  /**
   * Track that user viewed recommendations (only if not cached)
   */
  const trackViewedRecommendations = useCallback(async (recommendations, tripId, wasCached) => {
    if (wasCached) return; // Don't track if from cache
    
    try {
      const trackedMatchIds = new Set();
      for (const rec of recommendations) {
        const matchId = String(rec.matchId || rec.match?.fixture?.id || rec.match?.id);
        if (!trackedMatchIds.has(matchId)) {
          trackedMatchIds.add(matchId);
          await ApiService.trackRecommendation(
            matchId,
            'viewed',
            tripId,
            rec.recommendedForDate,
            rec.score,
            rec.reason
          );
        }
      }
    } catch (err) {
      console.error('Error tracking viewed recommendations:', err);
      // Don't throw - tracking failure shouldn't break the UI
    }
  }, []);
  
  /**
   * Fetch recommendations for the trip
   */
  const fetchRecommendations = useCallback(async (forceRefresh = false) => {
    if (!tripId) {
      if (isMountedRef.current) {
        setRecommendations([]);
        setError(null);
      }
      return;
    }
    
    // Check if there's already an active request for this tripId
    const existingRequest = activeRequests.get(tripId);
    if (existingRequest && !forceRefresh) {
      // Wait for existing request to complete
      try {
        const result = await existingRequest;
        if (isMountedRef.current) {
          setRecommendations(result.recommendations || []);
          setError(null);
        }
        return;
      } catch (err) {
        // If existing request failed, continue with new request
        console.warn('Existing request failed, starting new request:', err);
      }
    }
    
    // Only show loading if we don't have cached data
    const hasCache = ApiService.getCachedRecommendations(tripId);
    if (!hasCache && isMountedRef.current) {
      setLoading(true);
    }
    
    // Create new AbortController for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    // Create promise for request deduplication
    const requestPromise = (async () => {
      try {
        const data = await ApiService.getRecommendations(tripId, forceRefresh);
        
        // Check if request was aborted
        if (abortController.signal.aborted || !isMountedRef.current) {
          return { recommendations: [], cached: false };
        }
        
        if (data.success) {
          // Deduplicate recommendations
          const uniqueRecommendations = deduplicateRecommendations(data.recommendations || []);
          
          // Track viewed recommendations (only if not cached)
          await trackViewedRecommendations(uniqueRecommendations, tripId, data.cached);
          
          // Update state
          if (isMountedRef.current) {
            setRecommendations(uniqueRecommendations);
            setError(null);
          }
          
          return { recommendations: uniqueRecommendations, cached: data.cached };
        } else {
          throw new Error(data.message || 'Failed to fetch recommendations');
        }
      } catch (err) {
        // Don't update state if request was aborted
        if (abortController.signal.aborted || !isMountedRef.current) {
          return { recommendations: [], cached: false };
        }
        
        // Handle error
        if (isMountedRef.current) {
          setError(err.message || 'Failed to fetch recommendations');
          setRecommendations([]);
        }
        throw err;
      } finally {
        // Remove from active requests
        activeRequests.delete(tripId);
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    })();
    
    // Store promise for request deduplication
    activeRequests.set(tripId, requestPromise);
    
    try {
      await requestPromise;
    } catch (err) {
      // Error already handled in promise
      if (!abortController.signal.aborted && isMountedRef.current) {
        console.error('Error fetching recommendations:', err);
      }
    }
  }, [tripId, deduplicateRecommendations, trackViewedRecommendations]);
  
  /**
   * Dismiss a recommendation
   */
  const dismiss = useCallback(async (recommendation) => {
    try {
      const recommendationData = recommendation._recommendationData || recommendation;
      const matchId = recommendationData.matchId || recommendationData.match?.id || recommendationData.match?.fixture?.id;
      
      if (!matchId) {
        console.warn('Cannot dismiss recommendation: no matchId found');
        return;
      }
      
      // Track that user dismissed the recommendation
      await ApiService.trackRecommendation(
        matchId,
        'dismissed',
        tripId,
        recommendationData.recommendedForDate,
        recommendationData.score,
        recommendationData.reason
      );
      
      // Invalidate cache since user preferences have changed
      ApiService.invalidateRecommendationCache(tripId);
      
      // Remove the recommendation from the list immediately
      if (isMountedRef.current) {
        setRecommendations(prev => prev.filter(rec => {
          const recMatchId = rec.matchId || rec.match?.id || rec.match?.fixture?.id;
          return String(recMatchId) !== String(matchId);
        }));
      }
    } catch (err) {
      console.error('Error dismissing recommendation:', err);
      if (isMountedRef.current) {
        setError(err.message || 'Failed to dismiss recommendation');
      }
      throw err; // Re-throw so screen can show error to user
    }
  }, [tripId]);
  
  /**
   * Add a recommendation to the trip
   * Note: This doesn't actually add to trip - it just tracks and removes from recommendations
   * The screen should handle the actual trip addition using addMatchToItinerary
   */
  const addToTrip = useCallback(async (recommendation, addMatchToItineraryFn) => {
    try {
      const recommendationData = recommendation._recommendationData || recommendation;
      const match = recommendationData.match || recommendation;
      const matchId = recommendationData.matchId || match.id || match.matchId || match.fixture?.id;
      
      if (!matchId) {
        throw new Error('Cannot add recommendation to trip: no matchId found');
      }
      
      // Track that user saved the recommendation
      await ApiService.trackRecommendation(
        matchId,
        'saved',
        tripId,
        recommendationData.recommendedForDate,
        recommendationData.score,
        recommendationData.reason
      );
      
      // Invalidate cache since trip content has changed
      ApiService.invalidateRecommendationCache(tripId);
      
      // Format match data for the mobile app API
      const formattedMatchData = {
        matchId: match.id || match.matchId || match.fixture?.id,
        homeTeam: {
          name: match.teams?.home?.name,
          logo: match.teams?.home?.logo
        },
        awayTeam: {
          name: match.teams?.away?.name,
          logo: match.teams?.away?.logo
        },
        league: match.league?.name,
        venue: match.fixture?.venue?.name,
        venueData: match.fixture?.venue,
        date: match.fixture?.date
      };
      
      // Add match to trip (if function provided)
      if (addMatchToItineraryFn) {
        await addMatchToItineraryFn(tripId, formattedMatchData);
      }
      
      // Remove the recommendation from the list
      if (isMountedRef.current) {
        setRecommendations(prev => prev.filter(rec => {
          const recMatchId = rec.matchId || rec.match?.id || rec.match?.fixture?.id;
          return String(recMatchId) !== String(matchId);
        }));
      }
    } catch (err) {
      console.error('Error adding recommendation to trip:', err);
      if (isMountedRef.current) {
        setError(err.message || 'Failed to add match to trip');
      }
      throw err; // Re-throw so screen can show error to user
    }
  }, [tripId]);
  
  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch && tripId) {
      fetchRecommendations(false);
    }
  }, [tripId, autoFetch]); // Only depend on tripId and autoFetch, not fetchRecommendations
  
  // Memoized refetch function (stable reference)
  const refetch = useCallback((forceRefresh = false) => {
    return fetchRecommendations(forceRefresh);
  }, [fetchRecommendations]);
  
  return {
    recommendations,
    loading,
    error,
    refetch,
    dismiss,
    addToTrip,
  };
};

export default useRecommendations;

