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
  // Parse date strings safely without timezone conversion
  const parseDateString = (dateStr) => {
    if (typeof dateStr === 'string') {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    return new Date(dateStr);
  };
  
  const start = parseDateString(startDate);
  const end = parseDateString(endDate);
  const dates = [];
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(formatDateToLocalString(d));
  }
  
  return dates;
};

/**
 * Format date for display (e.g., "Jan 15, 2024")
 * @param {string|Date} dateString - Date string or Date object
 * @returns {string} - Formatted date string
 */
export const formatDisplayDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    // Parse the date string safely without timezone conversion
    // This prevents the off-by-one-day issue when dates are interpreted as UTC
    if (typeof dateString === 'string') {
      const [year, month, day] = dateString.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });
    }
    return dateString.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  } catch (error) {
    if (__DEV__) {
      console.warn('Error formatting display date:', dateString, error);
    }
    return 'N/A';
  }
};

/**
 * Format date header with "Today", "Tomorrow", or full date
 * @param {string|Date} date - Date string or Date object
 * @returns {string} - Formatted date header
 */
export const formatDateHeader = (date) => {
  if (!date) return 'Unknown Date';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const matchDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  
  if (matchDate.getTime() === today.getTime()) {
    return 'Today';
  } else if (matchDate.getTime() === tomorrow.getTime()) {
    return 'Tomorrow';
  } else {
    return dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  }
};

/**
 * Format date range for trip display
 * @param {string|Date} startDate - Start date
 * @param {string|Date} endDate - End date
 * @param {Object} options - Formatting options
 * @returns {string|null} - Formatted date range string
 */
export const formatDateRange = (startDate, endDate, options = {}) => {
  if (!startDate || !endDate) return null;
  
  const formatDate = (date) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (options.format === 'short') {
      // Format: "Mon, Jan 15"
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${days[dateObj.getDay()]}, ${months[dateObj.getMonth()]} ${dateObj.getDate()}`;
    } else {
      // Format: "1/15" or "1/15-1/20"
      return dateObj.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
    }
  };
  
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  
  if (start.toDateString() === end.toDateString()) {
    return formatDate(start);
  }
  
  return `${formatDate(start)} - ${formatDate(end)}`;
};

