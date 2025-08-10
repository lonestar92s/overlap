// Map provider configuration
// Set this to 'mapbox' to use Mapbox, or 'google' to use Google Maps
export const MAP_PROVIDER = 'google'; // Back to Google Maps

// Mapbox configuration
export const MAPBOX_CONFIG = {
  accessToken: 'pk.eyJ1IjoibG9uZXN0YXI5MnMiLCJhIjoiY202ZTB4dm5qMDBkaTJrcHFkeGZpdjlnYiJ9.UZyXT21en4sTzQSOmV5Maw',
  styleURL: 'mapbox://styles/mapbox/streets-v11', // Default style
};

// Google Maps configuration
export const GOOGLE_MAPS_CONFIG = {
  apiKey: 'YOUR_GOOGLE_MAPS_API_KEY', // If you have one
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