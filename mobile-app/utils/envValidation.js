/**
 * Environment Variable Validation
 * Validates required environment variables on app startup
 */

/**
 * Validates that required environment variables are set
 * Uses fallback values instead of crashing in production
 */
export const validateEnvironmentVariables = () => {
  const warnings = [];
  
  // Production environment checks
  if (!__DEV__) {
    // API URL is required in production - use fallback if missing
    if (!process.env.EXPO_PUBLIC_API_URL) {
      warnings.push('EXPO_PUBLIC_API_URL not set - using production fallback');
      // Set fallback production URL
      process.env.EXPO_PUBLIC_API_URL = 'https://friendly-gratitude-production-3f31.up.railway.app/api';
    }
    
    // Mapbox token required if using Mapbox
    // Note: This check is informational - mapConfig.js will handle missing token
    if (process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN === undefined) {
      console.warn('⚠️ EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN not set - Mapbox will not work if enabled');
    }
  }
  
  // Development environment warnings
  if (__DEV__) {
    if (!process.env.EXPO_PUBLIC_API_URL) {
      console.warn('⚠️ EXPO_PUBLIC_API_URL not set - using localhost fallback');
    }
  }
  
  // Log warnings but don't crash
  if (warnings.length > 0) {
    const warningMessage = `Environment validation warnings:\n${warnings.join('\n')}\n\nPlease set EXPO_PUBLIC_API_URL in EAS secrets for production builds.`;
    console.warn('⚠️ ENVIRONMENT VALIDATION WARNING:', warningMessage);
  }
  
  // Log successful validation in development
  if (__DEV__) {
    console.log('✅ Environment variables validated successfully');
    console.log('API URL:', process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api (fallback)');
  }
};

/**
 * Get environment variable with validation
 * @param {string} key - Environment variable key
 * @param {string} defaultValue - Default value (only used in development)
 * @param {boolean} required - Whether variable is required
 * @returns {string} Environment variable value
 */
export const getEnvVar = (key, defaultValue = null, required = false) => {
  const value = process.env[key];
  
  if (required && !value && !__DEV__) {
    throw new Error(`Required environment variable ${key} is missing`);
  }
  
  if (!value && defaultValue !== null) {
    if (__DEV__) {
      console.warn(`⚠️ ${key} not set, using default value`);
    }
    return defaultValue;
  }
  
  if (!value && required) {
    throw new Error(`Required environment variable ${key} is missing`);
  }
  
  return value || defaultValue;
};



