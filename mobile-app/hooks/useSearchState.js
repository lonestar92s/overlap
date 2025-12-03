/**
 * Custom hook for managing search state
 * Extracts location, dateFrom, and dateTo state management
 */

import { useState, useCallback } from 'react';

/**
 * Hook for managing search parameters (location, dates)
 * @param {Object} initialParams - Initial search parameters
 * @returns {Object} Search state and setters
 */
export const useSearchState = (initialParams = {}) => {
  const [location, setLocation] = useState(initialParams.location || null);
  const [dateFrom, setDateFrom] = useState(initialParams.dateFrom || null);
  const [dateTo, setDateTo] = useState(initialParams.dateTo || null);

  const updateLocation = useCallback((newLocation) => {
    setLocation(newLocation);
  }, []);

  const updateDateFrom = useCallback((newDateFrom) => {
    setDateFrom(newDateFrom);
  }, []);

  const updateDateTo = useCallback((newDateTo) => {
    setDateTo(newDateTo);
  }, []);

  const updateSearchParams = useCallback((params) => {
    if (params.location !== undefined) setLocation(params.location);
    if (params.dateFrom !== undefined) setDateFrom(params.dateFrom);
    if (params.dateTo !== undefined) setDateTo(params.dateTo);
  }, []);

  const resetSearch = useCallback(() => {
    setLocation(null);
    setDateFrom(null);
    setDateTo(null);
  }, []);

  return {
    location,
    dateFrom,
    dateTo,
    setLocation: updateLocation,
    setDateFrom: updateDateFrom,
    setDateTo: updateDateTo,
    updateSearchParams,
    resetSearch,
    // Computed values
    hasSearchParams: !!(location && dateFrom && dateTo),
    searchParams: { location, dateFrom, dateTo }
  };
};

export default useSearchState;

