/**
 * Environment Variable Validation
 * Validates required environment variables on app startup
 */

/**
 * Validates that required environment variables are set
 * Fails fast in production if required variables are missing
 */
export const validateEnvironmentVariables = () => {
  const warnings = [];
  const errors = [];
  
  // Production environment checks
  if (!__DEV__) {
    // API URL is required in production - fail fast if missing
    if (!process.env.EXPO_PUBLIC_API_URL) {
      errors.push(
        'EXPO_PUBLIC_API_URL is required in production. ' +
        'Set it in EAS secrets: eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value "https://your-api.com/api"'
      );
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
      warnings.push('EXPO_PUBLIC_API_URL not set - using localhost fallback');
    }
  }
  
  // Fail fast in production if required variables are missing
  if (errors.length > 0) {
    const errorMessage = `Environment validation errors:\n${errors.join('\n')}`;
    console.error('❌ ENVIRONMENT VALIDATION ERROR:', errorMessage);
    throw new Error(errorMessage);
  }
  
  // Log warnings in development
  if (warnings.length > 0) {
    const warningMessage = `Environment validation warnings:\n${warnings.join('\n')}`;
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




