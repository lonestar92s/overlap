/**
 * Custom hook for managing trip recommendations
 * Now reads from trip.recommendations (stored on trip document)
 * Falls back to API call if trip doesn't have stored recommendations (migration support)
 * 
 * IMPORTANT: This hook does NOT handle useFocusEffect - screens should call refetch()
 * from their own useFocusEffect hooks to sync recommendations across screens
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import ApiService from '../services/api';

// Shared request cache to prevent duplicate API calls when multiple screens fetch simultaneously
const activeRequests = new Map();

// Debounce tracking to prevent rapid successive fetches
const lastFetchTime = new Map();
const DEBOUNCE_DELAY = 2000; // 2 seconds between fetches

/**
 * Hook for managing trip recommendations
 * @param {string} tripId - Trip ID to fetch recommendations for
 * @param {Object} trip - Trip object (optional, if provided will read recommendations from trip.recommendations)
 * @param {Object} options - Optional configuration
 * @param {boolean} options.autoFetch - Whether to fetch on mount (default: true)
 * @returns {Object} Recommendations state and utilities
 */
export const useRecommendations = (tripId, tripOrOptions = {}, options = {}) => {
  // Handle both old signature (tripId, options) and new signature (tripId, trip, options)
  let trip = null;
  let finalOptions = {};
  if (tripOrOptions && typeof tripOrOptions === 'object' && tripOrOptions !== null && !tripOrOptions.autoFetch && !tripOrOptions.hasOwnProperty('autoFetch')) {
    // Second param is trip object
    trip = tripOrOptions;
    finalOptions = options || {};
  } else {
    // Second param is options (backward compatibility)
    finalOptions = tripOrOptions && typeof tripOrOptions === 'object' && tripOrOptions !== null ? tripOrOptions : {};
  }
  
  const { autoFetch = true } = finalOptions;
  
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  // AbortController for cancelling in-flight requests
  const abortControllerRef = useRef(null);
  // Track which recommendations have been tracked in this session to prevent duplicates
  const trackedInSessionRef = useRef(new Set());
  // Track current tripId to clear session tracking when trip changes
  const currentTripIdRef = useRef(tripId);
  
  // Cleanup on unmount and clear session tracking when tripId changes
  useEffect(() => {
    isMountedRef.current = true;
    
    // Clear session tracking if tripId changed
    if (currentTripIdRef.current !== tripId) {
      trackedInSessionRef.current.clear();
      currentTripIdRef.current = tripId;
    }
    
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
   * Track that user viewed recommendations (only if not cached and not already tracked in this session)
   */
  const trackViewedRecommendations = useCallback(async (recommendations, tripId, wasCached) => {
    if (wasCached) return; // Don't track if from cache
    if (!recommendations || recommendations.length === 0) return;
    
    try {
      const trackedMatchIds = new Set();
      let rateLimited = false;
      
      for (const rec of recommendations) {
        const matchId = String(rec.matchId || rec.match?.fixture?.id || rec.match?.id);
        if (!matchId || trackedMatchIds.has(matchId)) {
          continue; // Skip invalid or already tracked match IDs in this batch
        }
        
        // Skip if already tracked in this session
        if (trackedInSessionRef.current.has(matchId)) {
          continue;
        }
        
        trackedMatchIds.add(matchId);
        trackedInSessionRef.current.add(matchId); // Mark as tracked in session
        
        try {
          const result = await ApiService.trackRecommendation(
            matchId,
            'viewed',
            tripId,
            rec.recommendedForDate,
            rec.score,
            rec.reason
          );
          
          // If we hit rate limit, stop tracking to avoid more errors
          if (result && result.rateLimited) {
            rateLimited = true;
            break;
          }
          
          // Add a small delay between calls to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err) {
          // Log individual failures but continue with others
          // Suppress rate limit errors
          if (!err.message?.includes('429') && !err.message?.includes('rate limit')) {
            console.warn(`⚠️ Failed to track recommendation ${matchId}:`, err.message);
          }
          
          // If we hit rate limit, stop tracking
          if (err.message?.includes('429') || err.message?.includes('rate limit')) {
            rateLimited = true;
            break;
          }
        }
      }
      
      if (rateLimited) {
        // Silently handle rate limiting - don't log as error
        if (__DEV__) {
          console.log('📊 Rate limited while tracking recommendations - stopping to avoid errors');
        }
      }
    } catch (err) {
      // Only log non-rate-limit errors
      if (!err.message?.includes('429') && !err.message?.includes('rate limit')) {
        console.error('Error tracking viewed recommendations:', err);
      }
      // Don't throw - tracking failure shouldn't break the UI
    }
  }, []);
  
  /**
   * Fetch recommendations for the trip
   * Now reads from trip.recommendations if available, otherwise falls back to API
   */
  const fetchRecommendations = useCallback(async (forceRefresh = false) => {
    if (!tripId) {
      if (isMountedRef.current) {
        setRecommendations([]);
        setError(null);
      }
      return;
    }
    
    // Don't fetch recommendations for past/completed trips
    if (trip && trip.isCompleted === true) {
      if (isMountedRef.current) {
        setRecommendations([]);
        setError(null);
        setLoading(false);
      }
      return;
    }
    
    // If we have trip with stored recommendations and not forcing refresh, use them
    const hasStoredRecommendations = trip && 
                                      trip.recommendationsVersion === 'v2' && 
                                      Array.isArray(trip.recommendations) &&
                                      !forceRefresh;
    
    if (hasStoredRecommendations) {
      console.log('📥 Using stored recommendations from trip document');
      const uniqueRecommendations = deduplicateRecommendations(trip.recommendations || []);
      
      // Don't track stored recommendations - they're already persisted and tracking causes excessive API calls
      // trackViewedRecommendations(uniqueRecommendations, tripId, true) would skip tracking anyway,
      // but we don't even need to call it for stored recommendations
      
      if (isMountedRef.current) {
        setRecommendations(uniqueRecommendations);
        setError(null);
        setLoading(false);
      }
      return;
    }
    
    // Fallback: Fetch from API (for migration period or force refresh)
    
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
        // But check if it was rate limited - if so, use cache
        if (err.rateLimited || err.message?.includes('429') || err.message?.includes('rate limit')) {
          const cached = ApiService.getCachedRecommendations(tripId);
          if (cached && cached.recommendations) {
            console.log('⚠️ Rate limited - using cached recommendations');
            if (isMountedRef.current) {
              setRecommendations(cached.recommendations || []);
              setError(null);
            }
            return;
          }
        }
        console.warn('Existing request failed, starting new request:', err);
      }
    }
    
    // Debounce: Skip fetch if we just fetched recently (unless forcing refresh)
    if (!forceRefresh) {
      const lastFetch = lastFetchTime.get(tripId);
      const now = Date.now();
      if (lastFetch && (now - lastFetch) < DEBOUNCE_DELAY) {
        // Use cached data if available
        const cached = ApiService.getCachedRecommendations(tripId);
        if (cached && cached.recommendations) {
          console.log('📥 Using cached recommendations (debounced)');
          if (isMountedRef.current) {
            setRecommendations(cached.recommendations || []);
            setError(null);
          }
          return;
        }
        // No cache, but skip fetch to avoid rate limiting
        return;
      }
      lastFetchTime.set(tripId, now);
    }
    
    console.log('📥 Fetching recommendations from API (fallback or force refresh)');
    
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
        
        // Check if rate limited
        if (data.rateLimited) {
          // Try to use cached recommendations
          const cached = ApiService.getCachedRecommendations(tripId);
          if (cached && cached.recommendations) {
            console.log('⚠️ Rate limited - using cached recommendations');
            const uniqueRecommendations = deduplicateRecommendations(cached.recommendations || []);
            if (isMountedRef.current) {
              setRecommendations(uniqueRecommendations);
              setError(null);
            }
            return { recommendations: uniqueRecommendations, cached: true };
          }
          // No cache available, but don't throw error
          if (isMountedRef.current) {
            setRecommendations([]);
            setError(null); // Don't show error for rate limits
          }
          return { recommendations: [], cached: false };
        }
        
        if (data.success) {
          // Deduplicate recommendations
          const uniqueRecommendations = deduplicateRecommendations(data.recommendations || []);
          
          // Log if recommendations came from storage
          if (data.fromStorage) {
            console.log(`📥 API returned ${uniqueRecommendations.length} stored recommendations from trip document`);
          } else {
            console.log(`📥 API returned ${uniqueRecommendations.length} newly generated recommendations`);
          }
          
          // Track viewed recommendations (only if not from storage)
          await trackViewedRecommendations(uniqueRecommendations, tripId, data.fromStorage || false);
          
          // Update state
          if (isMountedRef.current) {
            setRecommendations(uniqueRecommendations);
            setError(null);
          }
          
          return { recommendations: uniqueRecommendations, cached: data.cached || data.fromStorage };
        } else {
          throw new Error(data.message || data.error || 'Failed to fetch recommendations');
        }
      } catch (err) {
        // Don't update state if request was aborted
        if (abortController.signal.aborted || !isMountedRef.current) {
          return { recommendations: [], cached: false };
        }
        
        // Check if it's a rate limit error
        if (err.rateLimited || err.message?.includes('429') || err.message?.includes('rate limit') || err.message?.includes('Too many requests')) {
          // Try to use cached recommendations
          const cached = ApiService.getCachedRecommendations(tripId);
          if (cached && cached.recommendations) {
            console.log('⚠️ Rate limited (error) - using cached recommendations');
            const uniqueRecommendations = deduplicateRecommendations(cached.recommendations || []);
            if (isMountedRef.current) {
              setRecommendations(uniqueRecommendations);
              setError(null);
            }
            return { recommendations: uniqueRecommendations, cached: true };
          }
          // No cache available, but don't show error for rate limits
          if (isMountedRef.current) {
            setRecommendations([]);
            setError(null);
          }
          return { recommendations: [], cached: false };
        }
        
        // Handle other errors
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
      // Only log if it's not a rate limit error
      if (!abortController.signal.aborted && isMountedRef.current) {
        if (!err.rateLimited && !err.message?.includes('429') && !err.message?.includes('rate limit')) {
          console.error('Error fetching recommendations:', err);
        }
      }
    }
  }, [tripId, trip, deduplicateRecommendations, trackViewedRecommendations]);
  
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
  
  // Auto-load recommendations on mount if enabled
  useEffect(() => {
    if (autoFetch && tripId) {
      // Don't fetch recommendations for past/completed trips
      if (trip && trip.isCompleted === true) {
        if (isMountedRef.current) {
          setRecommendations([]);
          setError(null);
          setLoading(false);
        }
        return;
      }
      
      // If trip has stored recommendations, use them immediately (no loading state)
      const hasStoredRecommendations = trip && 
                                        trip.recommendationsVersion === 'v2' && 
                                        Array.isArray(trip.recommendations) &&
                                        trip.recommendations.length > 0;
      
      if (hasStoredRecommendations) {
        // Cancel any in-flight API requests since we have stored recommendations
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
        }
        // Remove from active requests
        activeRequests.delete(tripId);
        
        console.log(`📥 Using ${trip.recommendations.length} stored recommendations from trip document (cancelled API request)`);
        const uniqueRecommendations = deduplicateRecommendations(trip.recommendations || []);
        if (isMountedRef.current) {
          setRecommendations(uniqueRecommendations);
          setError(null);
          setLoading(false);
        }
        // Don't track stored recommendations - they're already persisted and tracking causes excessive API calls
        // trackViewedRecommendations(uniqueRecommendations, tripId, true) would skip tracking anyway,
        // but we don't even need to call it for stored recommendations
      } else if (trip && trip.recommendationsVersion === 'v2' && Array.isArray(trip.recommendations) && trip.recommendations.length === 0) {
        // Trip has v2 but empty recommendations - this is valid (e.g., all days have matches)
        // Cancel any in-flight API requests since we know there are no recommendations
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
        }
        activeRequests.delete(tripId);
        
        console.log('📥 Trip has empty stored recommendations (v2) - this is expected');
        if (isMountedRef.current) {
          setRecommendations([]);
          setError(null);
          setLoading(false);
        }
      } else if (!trip) {
        // Trip not loaded yet - don't fetch yet, wait for trip to load
        // The effect will re-run when trip loads, then we can check for stored recommendations
        // or fetch from API if needed
        console.log('📥 Waiting for trip to load before fetching recommendations');
      } else {
        // Trip loaded but no stored recommendations - fetch from API
        fetchRecommendations(false);
      }
    }
  }, [tripId, autoFetch, trip, fetchRecommendations]); // Include trip in dependencies
  
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

