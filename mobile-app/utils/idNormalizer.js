/**
 * ID Normalization Utilities
 * 
 * Handles consistent ID field normalization across the app.
 * MongoDB documents use `_id` while our app primarily uses `id`.
 * These utilities ensure consistent handling.
 */

/**
 * Normalizes document IDs to ensure consistent `id` field
 * Handles MongoDB _id conversion and string normalization
 * 
 * @param {Object|null|undefined} doc - Document to normalize
 * @returns {Object|null} - Document with normalized id field, or null if input is null/undefined
 */
export const normalizeId = (doc) => {
  if (!doc) return null;
  
  // If already has id, ensure it's a string and return normalized copy
  if (doc.id !== undefined && doc.id !== null) {
    return { ...doc, id: String(doc.id) };
  }
  
  // Convert _id to id if present
  if (doc._id !== undefined && doc._id !== null) {
    return { ...doc, id: String(doc._id) };
  }
  
  // Return copy even if no ID field (preserves other properties)
  return { ...doc };
};

/**
 * Normalizes an array of documents
 * 
 * @param {Array} docs - Array of documents to normalize
 * @returns {Array} - Array of normalized documents
 */
export const normalizeIds = (docs) => {
  if (!Array.isArray(docs)) return [];
  return docs.map(normalizeId).filter(Boolean);
};

/**
 * Gets ID from document (handles both id and _id)
 * 
 * @param {Object|null|undefined} doc - Document to extract ID from
 * @returns {string|null} - Document ID as string, or null if not found
 */
export const getDocumentId = (doc) => {
  if (!doc) return null;
  const id = doc.id ?? doc._id;
  return id != null ? String(id) : null;
};

/**
 * Compares two document IDs for equality
 * Handles string conversion and null/undefined cases
 * 
 * @param {string|number|null|undefined} id1 - First ID to compare
 * @param {string|number|null|undefined} id2 - Second ID to compare
 * @returns {boolean} - True if IDs are equal (after string conversion)
 */
export const idsEqual = (id1, id2) => {
  // Handle null/undefined cases
  if (id1 == null && id2 == null) return true;
  if (id1 == null || id2 == null) return false;
  
  // Convert both to strings for comparison
  return String(id1) === String(id2);
};

/**
 * Finds a document in an array by ID
 * Handles both id and _id fields for matching
 * 
 * @param {Array} array - Array to search
 * @param {string|number} targetId - ID to find
 * @returns {Object|undefined} - Found document or undefined
 */
export const findById = (array, targetId) => {
  if (!Array.isArray(array) || targetId == null) return undefined;
  const normalizedTargetId = String(targetId);
  
  return array.find(item => {
    const itemId = getDocumentId(item);
    return itemId && itemId === normalizedTargetId;
  });
};

/**
 * Filters an array to remove items matching the given ID
 * Handles both id and _id fields
 * 
 * @param {Array} array - Array to filter
 * @param {string|number} targetId - ID to remove
 * @returns {Array} - Filtered array without matching items
 */
export const filterById = (array, targetId) => {
  if (!Array.isArray(array) || targetId == null) return array || [];
  const normalizedTargetId = String(targetId);
  
  return array.filter(item => {
    const itemId = getDocumentId(item);
    return !itemId || itemId !== normalizedTargetId;
  });
};

export default {
  normalizeId,
  normalizeIds,
  getDocumentId,
  idsEqual,
  findById,
  filterById,
};

