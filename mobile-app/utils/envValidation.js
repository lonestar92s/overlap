/**
 * Environment Variable Validation
 * Validates required environment variables on app startup
 */

/**
 * Validates that required environment variables are set
 * Throws error if any required variables are missing in production
 */
export const validateEnvironmentVariables = () => {
  const errors = [];
  
  // Production environment checks
  if (!__DEV__) {
    // API URL is required in production
    if (!process.env.EXPO_PUBLIC_API_URL) {
      errors.push('EXPO_PUBLIC_API_URL is required in production builds');
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
  
  // Throw if critical errors found
  if (errors.length > 0) {
    const errorMessage = `Environment validation failed:\n${errors.join('\n')}\n\nPlease check your .env file or EAS secrets.`;
    console.error('🚨 ENVIRONMENT VALIDATION ERROR:', errorMessage);
    throw new Error(errorMessage);
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


