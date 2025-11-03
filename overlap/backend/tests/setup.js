// Jest setup file for backend tests
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.test') });

// Set test environment variables if .env.test doesn't exist
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/overlap-test';

// Mock external services
jest.mock('axios');
jest.mock('cloudinary');

// Increase timeout for integration tests
jest.setTimeout(30000);

// Global test utilities
global.createMockUser = () => ({
  _id: '507f1f77bcf86cd799439011',
  email: 'test@example.com',
  password: '$2a$10$hashedpassword',
  role: 'user',
  subscription: {
    tier: 'freemium',
    expiresAt: null
  },
  preferences: {
    favoriteTeams: [],
    favoriteLeagues: [],
    defaultSearchRadius: 100
  }
});

// Cleanup after all tests
afterAll(async () => {
  // Close any open connections, clear timers, etc.
  await new Promise(resolve => setTimeout(resolve, 500));
});

