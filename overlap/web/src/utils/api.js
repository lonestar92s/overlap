// Utility function to get the correct backend URL
export const getBackendUrl = () => {
  // If running on localhost, use localhost
  // Otherwise, use the current hostname (for mobile/network access)
  const hostname = window.location.hostname;
  return hostname === 'localhost' ? 'http://localhost:3001' : `http://${hostname}:3001`;
};

// API base URLs
export const API_BASE_URL = getBackendUrl();

// Common fetch wrapper with authentication
export const apiRequest = async (url, options = {}) => {
  const token = localStorage.getItem('token');
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    },
  };

  const response = await fetch(url, { ...defaultOptions, ...options });
  return response;
}; 