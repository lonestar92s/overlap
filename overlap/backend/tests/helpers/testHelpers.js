/**
 * Test helper utilities for backend tests
 */

const jwt = require('jsonwebtoken');

/**
 * Generate a test JWT token for a user
 */
const generateTestToken = (userId = '507f1f77bcf86cd799439011') => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only',
    { expiresIn: '1h' }
  );
};

/**
 * Create a mock request object with authentication
 */
const createAuthenticatedRequest = (userId = '507f1f77bcf86cd799439011', user = null) => {
  const token = generateTestToken(userId);
  const mockUser = user || {
    _id: userId,
    email: 'test@example.com',
    role: 'user',
    subscription: { tier: 'freemium' }
  };

  return {
    header: (headerName) => {
      if (headerName === 'Authorization') {
        return `Bearer ${token}`;
      }
      return null;
    },
    user: mockUser,
    token: token
  };
};

/**
 * Create a mock Express response object
 */
const createMockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  return res;
};

/**
 * Create a mock Express next function
 */
const createMockNext = () => {
  return jest.fn();
};

/**
 * Wait for async operations
 */
const waitFor = (ms = 100) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

module.exports = {
  generateTestToken,
  createAuthenticatedRequest,
  createMockResponse,
  createMockNext,
  waitFor
};

