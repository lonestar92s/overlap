/**
 * Custom hook for managing match filtering logic
 * Handles filter application and match filtering
 */

import { useMemo, useCallback } from 'react';
import { useFilter } from '../contexts/FilterContext';
import { filterMatchesBySelection } from '../utils/matchFilterBySelection';

/**
 * Hook for managing match filtering
 * @param {Array} matches - Array of matches to filter
 * @returns {Object} Filtered matches and utilities
 */
export const useMatchFilters = (matches = []) => {
  const { filterData, selectedFilters } = useFilter();

  /**
   * Filter matches based on selected filters
   * @param {Array} matchesToFilter - Matches to filter
   * @returns {Array} Filtered matches
   */
  const getFilteredMatches = useCallback(
    (matchesToFilter) => {
      if (!matchesToFilter || matchesToFilter.length === 0) return matchesToFilter;
      if (!filterData || !filterData.matchIds || filterData.matchIds.length === 0) {
        return matchesToFilter;
      }
      if (!selectedFilters) return matchesToFilter;
      return filterMatchesBySelection(matchesToFilter, selectedFilters, filterData);
    },
    [filterData, selectedFilters]
  );

  // Memoized filtered matches
  const filteredMatches = useMemo(() => {
    return getFilteredMatches(matches);
  }, [matches, getFilteredMatches]);

  /**
   * Get active filter count
   * @returns {number} Number of active filters
   */
  const getActiveFilterCount = useCallback(() => {
    return (selectedFilters?.countries?.length || 0) + 
           (selectedFilters?.leagues?.length || 0) + 
           (selectedFilters?.teams?.length || 0);
  }, [selectedFilters]);

  /**
   * Check if filters are active
   * @returns {boolean} True if any filters are selected
   */
  const hasActiveFilters = useMemo(() => {
    return getActiveFilterCount() > 0;
  }, [getActiveFilterCount]);

  return {
    filteredMatches,
    getFilteredMatches,
    getActiveFilterCount,
    hasActiveFilters,
    filterData,
    selectedFilters
  };
};

export default useMatchFilters;

