/**
 * Custom hook for managing date range selection and formatting
 */

import { useState, useCallback, useMemo } from 'react';
import { formatDisplayDate, formatDateHeader, formatDateRange as formatDateRangeUtil } from '../utils/dateUtils';

/**
 * Hook for managing date range selection
 * @param {string} initialDateFrom - Initial start date
 * @param {string} initialDateTo - Initial end date
 * @returns {Object} Date range state and utilities
 */
export const useDateRange = (initialDateFrom = null, initialDateTo = null) => {
  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateTo, setDateTo] = useState(initialDateTo);
  const [selectedDateHeader, setSelectedDateHeader] = useState(null);

  const updateDateFrom = useCallback((newDateFrom) => {
    setDateFrom(newDateFrom);
  }, []);

  const updateDateTo = useCallback((newDateTo) => {
    setDateTo(newDateTo);
  }, []);

  const updateDateRange = useCallback((newDateFrom, newDateTo) => {
    setDateFrom(newDateFrom);
    setDateTo(newDateTo);
  }, []);

  const setSelectedDate = useCallback((date) => {
    setSelectedDateHeader(date);
  }, []);

  const clearSelectedDate = useCallback(() => {
    setSelectedDateHeader(null);
  }, []);

  const resetDateRange = useCallback(() => {
    setDateFrom(null);
    setDateTo(null);
    setSelectedDateHeader(null);
  }, []);

  // Format date for display
  const formattedDateFrom = useMemo(() => {
    return formatDisplayDate(dateFrom);
  }, [dateFrom]);

  const formattedDateTo = useMemo(() => {
    return formatDisplayDate(dateTo);
  }, [dateTo]);

  // Format date range string
  const formattedDateRange = useMemo(() => {
    if (!dateFrom || !dateTo) return null;
    return formatDateRangeUtil(dateFrom, dateTo);
  }, [dateFrom, dateTo]);

  // Format selected date header
  const formattedSelectedDateHeader = useMemo(() => {
    if (!selectedDateHeader) return null;
    return formatDateHeader(selectedDateHeader);
  }, [selectedDateHeader]);

  /**
   * Filter matches by selected date header
   * @param {Array} matches - Matches to filter
   * @returns {Array} Filtered matches
   */
  const filterMatchesByDate = useCallback((matches) => {
    if (!selectedDateHeader || !matches) return matches;
    
    return matches.filter(match => {
      const matchDate = new Date(match.fixture?.date || match.date);
      const selectedDate = new Date(selectedDateHeader);
      
      return matchDate.toDateString() === selectedDate.toDateString();
    });
  }, [selectedDateHeader]);

  /**
   * Group matches by date
   * @param {Array} matches - Matches to group
   * @returns {Object} Grouped matches by date
   */
  const groupMatchesByDate = useCallback((matches) => {
    if (!matches || matches.length === 0) return {};
    
    const grouped = matches.reduce((acc, match) => {
      const matchDate = new Date(match.fixture?.date || match.date);
      const dateKey = matchDate.toDateString();
      
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(match);
      return acc;
    }, {});
    
    // Sort dates and sort matches within each date
    const sortedGrouped = {};
    Object.keys(grouped)
      .sort((a, b) => {
        const dateA = new Date(a);
        const dateB = new Date(b);
        return dateA.getTime() - dateB.getTime();
      })
      .forEach(dateKey => {
        sortedGrouped[dateKey] = grouped[dateKey].sort((a, b) => 
          new Date(a.fixture?.date || a.date) - new Date(b.fixture?.date || b.date)
        );
      });
    
    return sortedGrouped;
  }, []);

  return {
    dateFrom,
    dateTo,
    selectedDateHeader,
    setDateFrom: updateDateFrom,
    setDateTo: updateDateTo,
    updateDateRange,
    setSelectedDate,
    clearSelectedDate,
    resetDateRange,
    formattedDateFrom,
    formattedDateTo,
    formattedDateRange,
    formattedSelectedDateHeader,
    filterMatchesByDate,
    groupMatchesByDate,
    hasDateRange: !!(dateFrom && dateTo),
    hasSelectedDate: !!selectedDateHeader
  };
};

export default useDateRange;

