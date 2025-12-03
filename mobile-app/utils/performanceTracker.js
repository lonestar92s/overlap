/**
 * Performance Tracking Utility
 * 
 * Tracks search performance metrics to measure and compare performance changes.
 * Can be used to track API calls, component renders, and user interactions.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const PERFORMANCE_STORAGE_KEY = '@performance_metrics';
const MAX_STORED_METRICS = 100; // Keep last 100 metrics

/**
 * Performance metric types
 */
export const MetricType = {
  SEARCH_INITIAL: 'search_initial',
  SEARCH_THIS_AREA: 'search_this_area',
  SEARCH_UNIFIED: 'search_unified',
  SEARCH_FLIGHTS: 'search_flights',
  FILTER_COMPUTATION: 'filter_computation',
  MAP_RENDER: 'map_render',
  COMPONENT_RENDER: 'component_render',
};

/**
 * Track a performance metric
 * @param {string} type - Type of metric (from MetricType)
 * @param {Function} asyncFn - Async function to track
 * @param {Object} metadata - Additional metadata to store
 * @returns {Promise} Result of the async function
 */
export const trackPerformance = async (type, asyncFn, metadata = {}) => {
  const startTime = performance.now();
  const timestamp = new Date().toISOString();
  
  try {
    const result = await asyncFn();
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    const metric = {
      type,
      duration,
      timestamp,
      success: true,
      metadata: {
        ...metadata,
        startTime,
        endTime,
      },
    };
    
    // Log in development
    if (__DEV__) {
      console.log(`⏱️ [PERF] ${type}: ${duration.toFixed(2)}ms`, metadata);
    }
    
    // Store metric
    await storeMetric(metric);
    
    return result;
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    const metric = {
      type,
      duration,
      timestamp,
      success: false,
      error: error.message,
      metadata: {
        ...metadata,
        startTime,
        endTime,
      },
    };
    
    // Log in development
    if (__DEV__) {
      console.error(`⏱️ [PERF] ${type} FAILED: ${duration.toFixed(2)}ms`, error);
    }
    
    // Store metric
    await storeMetric(metric);
    
    throw error;
  }
};

/**
 * Track a synchronous operation
 * @param {string} type - Type of metric
 * @param {Function} syncFn - Synchronous function to track
 * @param {Object} metadata - Additional metadata
 * @returns {*} Result of the function
 */
export const trackSyncPerformance = (type, syncFn, metadata = {}) => {
  const startTime = performance.now();
  const timestamp = new Date().toISOString();
  
  try {
    const result = syncFn();
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    const metric = {
      type,
      duration,
      timestamp,
      success: true,
      metadata: {
        ...metadata,
        startTime,
        endTime,
      },
    };
    
    // Log in development (only if duration is significant)
    if (__DEV__ && duration > 10) {
      console.log(`⏱️ [PERF] ${type}: ${duration.toFixed(2)}ms`, metadata);
    }
    
    // Store metric (async, don't wait)
    storeMetric(metric).catch(() => {
      // Silently fail if storage fails
    });
    
    return result;
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    if (__DEV__) {
      console.error(`⏱️ [PERF] ${type} FAILED: ${duration.toFixed(2)}ms`, error);
    }
    
    throw error;
  }
};

/**
 * Start a performance timer (for manual tracking)
 * @param {string} type - Type of metric
 * @param {Object} metadata - Additional metadata
 * @returns {Function} Stop function that returns the duration
 */
export const startTimer = (type, metadata = {}) => {
  const startTime = performance.now();
  const timestamp = new Date().toISOString();
  
  return (success = true, error = null) => {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    const metric = {
      type,
      duration,
      timestamp,
      success,
      error: error?.message || null,
      metadata: {
        ...metadata,
        startTime,
        endTime,
      },
    };
    
    // Log in development
    if (__DEV__) {
      const status = success ? '✅' : '❌';
      console.log(`⏱️ [PERF] ${status} ${type}: ${duration.toFixed(2)}ms`, metadata);
    }
    
    // Store metric (async, don't wait)
    storeMetric(metric).catch(() => {
      // Silently fail if storage fails
    });
    
    return duration;
  };
};

/**
 * Store a metric in AsyncStorage
 * @param {Object} metric - Metric to store
 */
const storeMetric = async (metric) => {
  try {
    const existing = await AsyncStorage.getItem(PERFORMANCE_STORAGE_KEY);
    const metrics = existing ? JSON.parse(existing) : [];
    
    // Add new metric
    metrics.push(metric);
    
    // Keep only the last N metrics
    if (metrics.length > MAX_STORED_METRICS) {
      metrics.splice(0, metrics.length - MAX_STORED_METRICS);
    }
    
    await AsyncStorage.setItem(PERFORMANCE_STORAGE_KEY, JSON.stringify(metrics));
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to store performance metric:', error);
    }
  }
};

/**
 * Get all stored metrics
 * @param {string} type - Optional filter by metric type
 * @returns {Promise<Array>} Array of metrics
 */
export const getMetrics = async (type = null) => {
  try {
    const existing = await AsyncStorage.getItem(PERFORMANCE_STORAGE_KEY);
    const metrics = existing ? JSON.parse(existing) : [];
    
    if (type) {
      return metrics.filter(m => m.type === type);
    }
    
    return metrics;
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to get performance metrics:', error);
    }
    return [];
  }
};

/**
 * Get performance statistics for a metric type
 * @param {string} type - Metric type
 * @returns {Promise<Object>} Statistics object
 */
export const getStats = async (type) => {
  const metrics = await getMetrics(type);
  
  if (metrics.length === 0) {
    return {
      count: 0,
      avgDuration: 0,
      minDuration: 0,
      maxDuration: 0,
      successRate: 0,
    };
  }
  
  const durations = metrics.map(m => m.duration);
  const successful = metrics.filter(m => m.success);
  
  return {
    count: metrics.length,
    avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
    minDuration: Math.min(...durations),
    maxDuration: Math.max(...durations),
    successRate: (successful.length / metrics.length) * 100,
    recent: metrics.slice(-10).map(m => ({
      duration: m.duration,
      timestamp: m.timestamp,
      success: m.success,
    })),
  };
};

/**
 * Clear all stored metrics
 */
export const clearMetrics = async () => {
  try {
    await AsyncStorage.removeItem(PERFORMANCE_STORAGE_KEY);
    if (__DEV__) {
      console.log('✅ Performance metrics cleared');
    }
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to clear performance metrics:', error);
    }
  }
};

/**
 * Get summary of all metric types
 * @returns {Promise<Object>} Summary object
 */
export const getSummary = async () => {
  const allMetrics = await getMetrics();
  const summary = {};
  
  // Group by type
  const byType = {};
  allMetrics.forEach(metric => {
    if (!byType[metric.type]) {
      byType[metric.type] = [];
    }
    byType[metric.type].push(metric);
  });
  
  // Calculate stats for each type
  for (const [type, metrics] of Object.entries(byType)) {
    const durations = metrics.map(m => m.duration);
    const successful = metrics.filter(m => m.success);
    
    summary[type] = {
      count: metrics.length,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      successRate: (successful.length / metrics.length) * 100,
    };
  }
  
  return summary;
};

export default {
  trackPerformance,
  trackSyncPerformance,
  startTimer,
  getMetrics,
  getStats,
  getSummary,
  clearMetrics,
  MetricType,
};

