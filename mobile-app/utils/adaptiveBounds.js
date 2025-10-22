/**
 * Adaptive bounds utility for map views
 * Considers venue density and urban vs rural areas to provide optimal zoom levels
 */

/**
 * Calculate adaptive bounds based on venue density and geographic distribution
 * @param {Array} coordinates - Array of {latitude, longitude} objects
 * @param {Object} options - Configuration options
 * @returns {Object} - Map region with adaptive bounds
 */
export const calculateAdaptiveBounds = (coordinates, options = {}) => {
  if (!coordinates || coordinates.length === 0) {
    return {
      latitude: 51.5074, // London default
      longitude: -0.1278,
      latitudeDelta: 0.8,
      longitudeDelta: 0.8,
    };
  }

  const {
    minSpan = 0.1,
    maxSpan = 5.0,
    basePadding = 2.0,
    urbanPadding = 3.0,
    ruralPadding = 1.5,
  } = options;

  // Calculate geographic bounds
  const lats = coordinates.map(c => c.latitude);
  const lngs = coordinates.map(c => c.longitude);
  
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  
  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;
  
  // Calculate span
  const spanLat = maxLat - minLat;
  const spanLng = maxLng - minLng;
  
  // Determine if this is an urban or rural area based on venue density
  const isUrbanArea = determineUrbanArea(centerLat, centerLng, spanLat, spanLng);
  
  // Calculate adaptive padding based on area type
  const adaptivePadding = isUrbanArea ? urbanPadding : ruralPadding;
  
  // Calculate final bounds with adaptive padding
  const finalLatDelta = Math.max(
    Math.min(spanLat * adaptivePadding, maxSpan),
    minSpan
  );
  const finalLngDelta = Math.max(
    Math.min(spanLng * adaptivePadding, maxSpan),
    minSpan
  );
  
  return {
    latitude: centerLat,
    longitude: centerLng,
    latitudeDelta: finalLatDelta,
    longitudeDelta: finalLngDelta,
  };
};

/**
 * Determine if the area is urban based on geographic location and span
 * @param {number} lat - Center latitude
 * @param {number} lng - Center longitude
 * @param {number} spanLat - Latitude span
 * @param {number} spanLng - Longitude span
 * @returns {boolean} - True if urban area
 */
const determineUrbanArea = (lat, lng, spanLat, spanLng) => {
  // Major urban areas with high venue density
  const urbanAreas = [
    // London
    { lat: 51.5074, lng: -0.1278, radius: 0.5 },
    // New York
    { lat: 40.7128, lng: -74.0060, radius: 0.5 },
    // Los Angeles
    { lat: 34.0522, lng: -118.2437, radius: 0.8 },
    // Paris
    { lat: 48.8566, lng: 2.3522, radius: 0.4 },
    // Berlin
    { lat: 52.5200, lng: 13.4050, radius: 0.4 },
    // Madrid
    { lat: 40.4168, lng: -3.7038, radius: 0.4 },
    // Barcelona
    { lat: 41.3851, lng: 2.1734, radius: 0.3 },
    // Milan
    { lat: 45.4642, lng: 9.1900, radius: 0.3 },
    // Rome
    { lat: 41.9028, lng: 12.4964, radius: 0.4 },
    // Amsterdam
    { lat: 52.3676, lng: 4.9041, radius: 0.3 },
  ];
  
  // Check if we're near any major urban area
  for (const area of urbanAreas) {
    const distance = Math.sqrt(
      Math.pow(lat - area.lat, 2) + Math.pow(lng - area.lng, 2)
    );
    if (distance < area.radius) {
      return true;
    }
  }
  
  // If span is very small, likely urban (dense venues)
  const totalSpan = spanLat + spanLng;
  return totalSpan < 0.1; // Very tight cluster suggests urban area
};

/**
 * Calculate search bounds with buffer for API calls
 * @param {Object} region - Map region
 * @param {Object} options - Buffer options
 * @returns {Object} - Search bounds with buffer
 */
export const calculateSearchBounds = (region, options = {}) => {
  const {
    bufferMultiplier = 1.3, // 30% buffer
    maxSpan = 10.0,
  } = options;
  
  const bufferedLatDelta = Math.min(
    region.latitudeDelta * bufferMultiplier,
    maxSpan
  );
  const bufferedLngDelta = Math.min(
    region.longitudeDelta * bufferMultiplier,
    maxSpan
  );
  
  return {
    northeast: {
      lat: region.latitude + (bufferedLatDelta / 2),
      lng: region.longitude + (bufferedLngDelta / 2),
    },
    southwest: {
      lat: region.latitude - (bufferedLatDelta / 2),
      lng: region.longitude - (bufferedLngDelta / 2),
    },
  };
};

/**
 * Get zoom category description for debugging
 * @param {number} latitudeDelta - Latitude delta
 * @returns {string} - Zoom category
 */
export const getZoomCategory = (latitudeDelta) => {
  if (latitudeDelta < 0.05) return 'city block';
  if (latitudeDelta < 0.2) return 'neighborhood';
  if (latitudeDelta < 1.0) return 'city';
  if (latitudeDelta < 3.0) return 'region';
  return 'country';
};
