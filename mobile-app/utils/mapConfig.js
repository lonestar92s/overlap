// Map provider configuration
export const MAP_PROVIDER = 'google';

// Google Maps configuration
export const GOOGLE_MAPS_CONFIG = {
  // SECURITY: API key from environment variable
  // In production, this should be set via EAS secrets
  apiKey: process.env.GOOGLE_API_KEY || (__DEV__ ? '' : (() => {
    if (__DEV__) {
      console.warn('⚠️ GOOGLE_API_KEY not set - Google Maps features may not work');
    } else {
      console.error('❌ GOOGLE_API_KEY environment variable is required in production');
    }
    return '';
  })()),
};

// Feature flags for map functionality
export const MAP_FEATURES = {
  useGoogleMaps: true,
  enableCustomMarkers: true,
  enableClustering: true,
  enableOfflineMaps: false,
};

// Helper function to get the map component
export const getMapComponent = () => {
  return require('../components/MapView').default;
};

// Helper function to check if Google Maps is enabled
export const isGoogleMapsEnabled = () => true;