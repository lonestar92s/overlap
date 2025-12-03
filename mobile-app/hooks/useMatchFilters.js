/**
 * Custom hook for managing match filtering logic
 * Handles filter application and match filtering
 */

import { useMemo, useCallback } from 'react';
import { useFilter } from '../contexts/FilterContext';

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
  const getFilteredMatches = useCallback((matchesToFilter) => {
    if (!matchesToFilter || matchesToFilter.length === 0) return matchesToFilter;
    
    // If filterData is not ready, return all matches (prevents race condition)
    if (!filterData || !filterData.matchIds || filterData.matchIds.length === 0) {
      return matchesToFilter;
    }
    
    if (!selectedFilters) return matchesToFilter;
    
    const { countries, leagues, teams } = selectedFilters;
    // Normalize selected IDs to strings for consistent comparisons
    const selectedCountryIds = (countries || []).map((id) => id?.toString());
    const selectedLeagueIds = (leagues || []).map((id) => id?.toString());
    const selectedTeamIds = (teams || []).map((id) => id?.toString());
    
    // If no filters are selected, return all matches
    if (selectedCountryIds.length === 0 && selectedLeagueIds.length === 0 && selectedTeamIds.length === 0) {
      return matchesToFilter;
    }
    
    const filtered = matchesToFilter.filter(match => {
      let matched = false;
      
      // Country OR
      if (selectedCountryIds.length > 0) {
        const matchCountry =
          match.area?.code ||
          match.area?.id?.toString() ||
          (typeof match.venue?.country === 'string'
            ? match.venue.country
            : match.venue?.country?.id?.toString());
        if (selectedCountryIds.includes(matchCountry)) {
          matched = true;
        }
      }
      
      // League OR
      if (selectedLeagueIds.length > 0) {
        const matchLeague =
          match.competition?.id?.toString() ||
          match.competition?.code?.toString() ||
          (typeof match.league === 'string'
            ? match.league
            : match.league?.id?.toString() || match.league?.name);
        if (selectedLeagueIds.includes(matchLeague)) {
          matched = true;
        }
      }
      
      // Team OR
      if (selectedTeamIds.length > 0) {
        const homeTeamId = match.teams?.home?.id;
        const awayTeamId = match.teams?.away?.id;
        const homeTeamIdStr = homeTeamId?.toString();
        const awayTeamIdStr = awayTeamId?.toString();
        const homeMatch = selectedTeamIds.includes(homeTeamIdStr) || selectedTeamIds.includes(homeTeamId);
        const awayMatch = selectedTeamIds.includes(awayTeamIdStr) || selectedTeamIds.includes(awayTeamId);
        if (homeMatch || awayMatch) {
          matched = true;
        }
      }
      
      return matched;
    });
    
    return filtered;
  }, [filterData, selectedFilters]);

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

