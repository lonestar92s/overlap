// Map provider configuration
// Set this to 'mapbox' to use Mapbox, or 'google' to use Google Maps
export const MAP_PROVIDER = 'google'; // Back to Google Maps

// Mapbox configuration
export const MAPBOX_CONFIG = {
  // SECURITY: Token loaded from environment variable to prevent exposure
  accessToken: process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '',
  styleURL: 'mapbox://styles/mapbox/streets-v11', // Default style
};

// Google Maps configuration
export const GOOGLE_MAPS_CONFIG = {
  apiKey: process.env.GOOGLE_API_KEY || 'YOUR_GOOGLE_MAPS_API_KEY', // From environment variable
};

// Feature flags for map functionality
export const MAP_FEATURES = {
  useMapbox: MAP_PROVIDER === 'mapbox',
  useGoogleMaps: MAP_PROVIDER === 'google',
  enableCustomMarkers: true,
  enableClustering: true,
  enableOfflineMaps: MAP_PROVIDER === 'mapbox',
};

// Helper function to get the appropriate map component
export const getMapComponent = () => {
  if (MAP_PROVIDER === 'mapbox') {
    return require('../components/MapboxMapView').default;
  } else {
    return require('../components/MapView').default;
  }
};

// Helper function to check if Mapbox is enabled
export const isMapboxEnabled = () => MAP_PROVIDER === 'mapbox';

// Helper function to check if Google Maps is enabled
export const isGoogleMapsEnabled = () => MAP_PROVIDER === 'google'; 