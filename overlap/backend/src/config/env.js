/**
 * Environment Configuration
 * Helps differentiate between development and production
 */

const isDevelopment = process.env.NODE_ENV !== 'production';
const isProduction = process.env.NODE_ENV === 'production';

// Environment-specific configurations
const config = {
  development: {
    name: 'development',
    apiUrl: process.env.API_URL || 'http://localhost:3001',
    mongodbUri: process.env.MONGODB_URI || process.env.MONGO_URL,
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-key-change-in-production',
    workosApiKey: process.env.WORKOS_API_KEY,
    workosClientId: process.env.WORKOS_CLIENT_ID,
    workosRedirectUri: process.env.WORKOS_REDIRECT_URI || 'http://localhost:3001/api/auth/workos/callback',
    // Logging
    logLevel: 'debug',
    // Security
    showResetTokenInResponse: true, // Show reset token in development
  },
  production: {
    name: 'production',
    apiUrl: process.env.API_URL || 'https://friendly-gratitude-production-3f31.up.railway.app',
    mongodbUri: process.env.MONGODB_URI || process.env.MONGO_URL,
    jwtSecret: process.env.JWT_SECRET, // Must be set in production
    workosApiKey: process.env.WORKOS_API_KEY,
    workosClientId: process.env.WORKOS_CLIENT_ID,
    workosRedirectUri: process.env.WORKOS_REDIRECT_URI || 'https://friendly-gratitude-production-3f31.up.railway.app/api/auth/workos/callback',
    // Logging
    logLevel: 'error',
    // Security
    showResetTokenInResponse: false, // Never show tokens in production
  }
};

// Get current environment config
const getConfig = () => {
  return isDevelopment ? config.development : config.production;
};

// Helper functions
const getEnvVar = (key, defaultValue = null) => {
  return process.env[key] || defaultValue;
};

module.exports = {
  isDevelopment,
  isProduction,
  config,
  getConfig,
  getEnvVar,
  current: getConfig()
};

