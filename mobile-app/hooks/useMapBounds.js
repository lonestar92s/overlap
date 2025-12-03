/**
 * Custom hook for managing map bounds and region state
 * Handles map region, bounds calculation, and related state
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';

/**
 * Hook for managing map region and bounds
 * @param {Object} initialRegion - Initial map region
 * @returns {Object} Map bounds state and utilities
 */
export const useMapBounds = (initialRegion = null) => {
  const [mapRegion, setMapRegion] = useState(initialRegion);
  const [debouncedMapRegion, setDebouncedMapRegion] = useState(initialRegion);
  const [originalSearchBounds, setOriginalSearchBounds] = useState(null);
  const [hasMovedFromInitial, setHasMovedFromInitial] = useState(false);
  const [initialSearchRegion, setInitialSearchRegion] = useState(null);

  // Debounce map region updates
  useEffect(() => {
    if (!mapRegion) return;
    
    const timer = setTimeout(() => {
      setDebouncedMapRegion(mapRegion);
    }, 300); // 300ms delay - update after user stops moving map
    
    return () => clearTimeout(timer);
  }, [mapRegion]);

  /**
   * Calculate bounds from region
   * @param {Object} region - Map region object
   * @returns {Object|null} Bounds object or null
   */
  const calculateBoundsFromRegion = useCallback((region) => {
    if (!region || !region.latitude || !region.longitude || 
        !region.latitudeDelta || !region.longitudeDelta) {
      return null;
    }

    return {
      northeast: {
        lat: region.latitude + (region.latitudeDelta / 2),
        lng: region.longitude + (region.longitudeDelta / 2)
      },
      southwest: {
        lat: region.latitude - (region.latitudeDelta / 2),
        lng: region.longitude - (region.longitudeDelta / 2)
      }
    };
  }, []);

  /**
   * Calculate region from bounds
   * @param {Object} bounds - Bounds object
   * @returns {Object|null} Region object or null
   */
  const calculateRegionFromBounds = useCallback((bounds) => {
    if (!bounds || !bounds.northeast || !bounds.southwest) {
      return null;
    }

    const centerLat = (bounds.northeast.lat + bounds.southwest.lat) / 2;
    const centerLng = (bounds.northeast.lng + bounds.southwest.lng) / 2;
    const latDelta = bounds.northeast.lat - bounds.southwest.lat;
    const lngDelta = bounds.northeast.lng - bounds.southwest.lng;

    return {
      latitude: centerLat,
      longitude: centerLng,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta
    };
  }, []);

  /**
   * Check if coordinates are within bounds
   * @param {Array} coordinates - [longitude, latitude] or { lat, lng }
   * @param {Object} bounds - Bounds object
   * @returns {boolean} True if coordinates are within bounds
   */
  const isWithinBounds = useCallback((coordinates, bounds) => {
    if (!coordinates || !bounds) return false;

    let lat, lng;
    if (Array.isArray(coordinates)) {
      [lng, lat] = coordinates; // GeoJSON: [lon, lat]
    } else if (coordinates.lat && coordinates.lng) {
      lat = coordinates.lat;
      lng = coordinates.lng;
    } else {
      return false;
    }

    return lat >= bounds.southwest.lat && 
           lat <= bounds.northeast.lat &&
           lng >= bounds.southwest.lng && 
           lng <= bounds.northeast.lng;
  }, []);

  /**
   * Handle map region change
   * @param {Object} region - New map region
   * @param {Object} bounds - Optional bounds object
   */
  const handleRegionChange = useCallback((region, bounds = null) => {
    setMapRegion(region);
    setHasMovedFromInitial(true);
    
    // If bounds not provided, calculate from region
    if (!bounds) {
      bounds = calculateBoundsFromRegion(region);
    }
  }, [calculateBoundsFromRegion]);

  /**
   * Set original search bounds (for filtering)
   * @param {Object} bounds - Bounds object
   */
  const setOriginalBounds = useCallback((bounds) => {
    setOriginalSearchBounds(bounds);
  }, []);

  /**
   * Initialize search region
   * @param {Object} region - Initial region
   */
  const initializeSearchRegion = useCallback((region) => {
    if (region && !initialSearchRegion) {
      setInitialSearchRegion(region);
      setMapRegion(region);
      
      // Set original search bounds from region
      const bounds = calculateBoundsFromRegion(region);
      if (bounds) {
        setOriginalSearchBounds(bounds);
      }
    }
  }, [initialSearchRegion, calculateBoundsFromRegion]);

  // Current bounds (memoized)
  const currentBounds = useMemo(() => {
    return calculateBoundsFromRegion(mapRegion);
  }, [mapRegion, calculateBoundsFromRegion]);

  return {
    mapRegion,
    debouncedMapRegion,
    originalSearchBounds,
    hasMovedFromInitial,
    initialSearchRegion,
    currentBounds,
    setMapRegion,
    setDebouncedMapRegion,
    setOriginalSearchBounds: setOriginalBounds,
    setHasMovedFromInitial,
    handleRegionChange,
    initializeSearchRegion,
    calculateBoundsFromRegion,
    calculateRegionFromBounds,
    isWithinBounds
  };
};

export default useMapBounds;

