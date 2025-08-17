/**
 * Date utility functions to avoid timezone conversion issues
 */

/**
 * Format a Date object to YYYY-MM-DD string using local time (not UTC)
 * This prevents the off-by-one-day issue that happens with toISOString()
 * @param {Date} date - Date object to format
 * @returns {string} - Date string in YYYY-MM-DD format
 */
export const formatDateToLocalString = (date) => {
  if (!date || !(date instanceof Date)) {
    return null;
  }
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

/**
 * Get today's date as YYYY-MM-DD string in local time
 * @returns {string} - Today's date in YYYY-MM-DD format
 */
export const getTodayLocalString = () => {
  const today = new Date();
  return formatDateToLocalString(today);
};

/**
 * Get a date string from a Date object, preserving local time
 * @param {Date|string} dateInput - Date object or date string
 * @returns {string} - Date string in YYYY-MM-DD format
 */
export const getLocalDateString = (dateInput) => {
  if (!dateInput) return null;
  
  if (typeof dateInput === 'string') {
    // If it's already a string, just return it
    return dateInput;
  }
  
  if (dateInput instanceof Date) {
    // If it's a Date object, format it to local string
    return formatDateToLocalString(dateInput);
  }
  
  return null;
};

/**
 * Create a date range array between two dates
 * @param {string|Date} startDate - Start date
 * @param {string|Date} endDate - End date
 * @returns {string[]} - Array of date strings in YYYY-MM-DD format
 */
export const createDateRange = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const dates = [];
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(formatDateToLocalString(d));
  }
  
  return dates;
};
