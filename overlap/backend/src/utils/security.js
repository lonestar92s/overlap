/**
 * Security utility functions
 * Provides input sanitization and validation for database queries
 */

/**
 * Escape special regex characters to prevent ReDoS attacks
 * @param {string} string - Input string to escape
 * @returns {string} - Escaped string safe for use in regex
 */
const escapeRegex = (string) => {
    if (!string || typeof string !== 'string') {
        return '';
    }
    // Escape special regex characters: . * + ? ^ $ { } ( ) | [ ] \
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Sanitize and validate search query
 * @param {string} query - User input query
 * @param {number} maxLength - Maximum allowed length (default: 100)
 * @returns {Object} - { valid: boolean, sanitized: string, error: string }
 */
const sanitizeSearchQuery = (query, maxLength = 100) => {
    if (!query || typeof query !== 'string') {
        return { valid: false, sanitized: '', error: 'Query must be a non-empty string' };
    }

    // Trim whitespace
    const trimmed = query.trim();

    // Check minimum length
    if (trimmed.length < 2) {
        return { valid: false, sanitized: '', error: 'Query must be at least 2 characters' };
    }

    // Check maximum length
    if (trimmed.length > maxLength) {
        return { valid: false, sanitized: '', error: `Query must be no more than ${maxLength} characters` };
    }

    // Escape regex special characters
    const sanitized = escapeRegex(trimmed);

    return { valid: true, sanitized, error: null };
};

/**
 * Validate MongoDB ObjectId format
 * @param {string} id - ID to validate
 * @returns {boolean} - True if valid ObjectId format
 */
const isValidObjectId = (id) => {
    if (!id || typeof id !== 'string') {
        return false;
    }
    // MongoDB ObjectId is 24 hex characters
    return /^[0-9a-fA-F]{24}$/.test(id);
};

/**
 * Sanitize object to prevent NoSQL injection
 * Removes MongoDB operators from object
 * @param {Object} obj - Object to sanitize
 * @returns {Object} - Sanitized object
 */
const sanitizeObject = (obj) => {
    if (!obj || typeof obj !== 'object') {
        return {};
    }

    const sanitized = {};
    const dangerousKeys = ['$where', '$ne', '$gt', '$gte', '$lt', '$lte', '$in', '$nin', '$exists', '$regex', '$text', '$search'];

    for (const [key, value] of Object.entries(obj)) {
        // Skip MongoDB operators
        if (dangerousKeys.includes(key)) {
            continue;
        }

        // Recursively sanitize nested objects
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            sanitized[key] = sanitizeObject(value);
        } else {
            sanitized[key] = value;
        }
    }

    return sanitized;
};

module.exports = {
    escapeRegex,
    sanitizeSearchQuery,
    isValidObjectId,
    sanitizeObject
};


