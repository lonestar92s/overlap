/**
 * API Error Handling Utilities
 * 
 * Standardized error handling for API responses
 */

/**
 * Handle API error response
 * @param {Error|Object} error - Error object or API error response
 * @param {string} context - Context where error occurred (e.g., "login", "searchMatches")
 * @returns {Object} - Standardized error response { success: false, error: string }
 */
export const handleApiError = (error, context = 'API request') => {
  if (__DEV__) {
    console.error(`Error in ${context}:`, error);
  }
  
  // Handle network errors
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return {
      success: false,
      error: 'Network error - please check your connection'
    };
  }
  
  // Handle timeout errors
  if (error.name === 'AbortError' || error.message?.includes('timeout')) {
    return {
      success: false,
      error: 'Request timed out - please try again'
    };
  }
  
  // Handle API response errors
  if (error.response) {
    const status = error.response.status;
    const errorMessage = error.response.data?.error || error.response.data?.message;
    
    if (status === 401) {
      return {
        success: false,
        error: 'Authentication failed - please log in again'
      };
    } else if (status === 403) {
      return {
        success: false,
        error: 'Access denied - insufficient permissions'
      };
    } else if (status >= 500) {
      return {
        success: false,
        error: 'Server error - please try again later'
      };
    } else if (errorMessage) {
      return {
        success: false,
        error: errorMessage
      };
    }
  }
  
  // Handle error objects with message
  if (error.message) {
    return {
      success: false,
      error: error.message
    };
  }
  
  // Fallback
  return {
    success: false,
    error: 'An unexpected error occurred'
  };
};

/**
 * Check if response is successful
 * @param {Object} response - API response object
 * @returns {boolean} - True if response indicates success
 */
export const isSuccessfulResponse = (response) => {
  return response && (
    response.success === true ||
    (response.status >= 200 && response.status < 300) ||
    (response.ok === true)
  );
};

/**
 * Extract error message from response
 * @param {Object} response - API response object
 * @returns {string|null} - Error message or null
 */
export const extractErrorMessage = (response) => {
  if (!response) return null;
  
  return response.error || 
         response.message || 
         response.data?.error || 
         response.data?.message ||
         null;
};

export default {
  handleApiError,
  isSuccessfulResponse,
  extractErrorMessage
};

