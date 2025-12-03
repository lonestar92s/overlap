/**
 * Venue Coordinate Utilities
 * 
 * Common utilities for parsing and handling venue coordinates
 * Handles multiple coordinate formats (GeoJSON, object, etc.)
 */

/**
 * Extract coordinates from venue data
 * Handles multiple possible formats:
 * - GeoJSON array: [longitude, latitude]
 * - Object: { lat, lng } or { latitude, longitude }
 * - Separate fields: venue.lat, venue.lng
 * @param {Object} venue - Venue object
 * @returns {Object|null} - { lat, lng } or null if not found
 */
export const extractVenueCoordinates = (venue) => {
  if (!venue) return null;
  
  // Try venueData.coordinates first (saved format)
  let coords = venue.venueData?.coordinates || 
               venue.coordinates || 
               venue.fixture?.venue?.coordinates ||
               null;
  
  // If no coordinates array, try separate lat/lng fields
  if (!coords) {
    const lat = venue.lat || venue.latitude || venue.fixture?.venue?.lat;
    const lng = venue.lng || venue.longitude || venue.fixture?.venue?.lng;
    
    if (lat != null && lng != null) {
      return { lat: Number(lat), lng: Number(lng) };
    }
    return null;
  }
  
  // Handle array format [longitude, latitude] (GeoJSON)
  if (Array.isArray(coords) && coords.length === 2) {
    return { lat: coords[1], lng: coords[0] };  // GeoJSON: [lon, lat]
  }
  
  // Handle object format { lat, lng } or { latitude, longitude }
  if (typeof coords === 'object') {
    if (coords.lat != null && coords.lng != null) {
      return { lat: Number(coords.lat), lng: Number(coords.lng) };
    } else if (coords.latitude != null && coords.longitude != null) {
      return { lat: Number(coords.latitude), lng: Number(coords.longitude) };
    }
  }
  
  return null;
};

/**
 * Check if coordinates are valid
 * @param {Object} coords - Coordinates object { lat, lng }
 * @returns {boolean} - True if coordinates are valid
 */
export const isValidCoordinates = (coords) => {
  if (!coords || typeof coords !== 'object') return false;
  
  const { lat, lng } = coords;
  
  return typeof lat === 'number' && 
         typeof lng === 'number' &&
         lat >= -90 && lat <= 90 &&
         lng >= -180 && lng <= 180;
};

/**
 * Check if venue has valid coordinates
 * @param {Object} venue - Venue object
 * @returns {boolean} - True if venue has valid coordinates
 */
export const venueHasCoordinates = (venue) => {
  const coords = extractVenueCoordinates(venue);
  return isValidCoordinates(coords);
};

/**
 * Generate venue group key for grouping matches by venue
 * Prioritizes coordinates for physical location matching
 * @param {Object} match - Match object
 * @returns {string|null} - Venue group key or null
 */
export const getVenueGroupKey = (match) => {
  const venue = match?.fixture?.venue || match?.venue;
  if (!venue) return null;
  
  // Prioritize coordinates for physical location matching (handles shared stadiums)
  // Round coordinates to 6 decimal places (~0.1m precision) to handle floating point differences
  const coords = extractVenueCoordinates(venue);
  if (coords && isValidCoordinates(coords)) {
    const roundedLon = Math.round(coords.lng * 1000000) / 1000000;
    const roundedLat = Math.round(coords.lat * 1000000) / 1000000;
    return `geo:${roundedLon},${roundedLat}`;
  }
  
  // Fallback to venue ID if no coordinates available
  if (venue.id != null) {
    return `id:${venue.id}`;
  }
  
  return null;
};

export default {
  extractVenueCoordinates,
  isValidCoordinates,
  venueHasCoordinates,
  getVenueGroupKey
};

