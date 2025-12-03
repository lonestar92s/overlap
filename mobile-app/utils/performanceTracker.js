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
  const phaseTimings = [];
  
  return (success = true, error = null) => {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    const metric = {
      type,
      duration,
      timestamp,
      success,
      error: error?.message || null,
      phaseTimings: phaseTimings.length > 0 ? phaseTimings : undefined,
      metadata: {
        ...metadata,
        startTime,
        endTime,
      },
    };
    
    // Log in development with phase breakdown if available
    if (__DEV__) {
      const status = success ? '✅' : '❌';
      let logMessage = `⏱️ [PERF] ${status} ${type}: ${duration.toFixed(2)}ms`;
      
      if (phaseTimings.length > 0) {
        const phaseBreakdown = phaseTimings.map(p => `  ${p.phase}: ${p.duration.toFixed(2)}ms`).join('\n');
        logMessage += `\n  Phase Breakdown:\n${phaseBreakdown}`;
      }
      
      // Add warnings for slow operations
      if (duration > 5000) {
        logMessage += `\n  ⚠️ WARNING: Very slow operation (>5s)`;
      } else if (duration > 3000) {
        logMessage += `\n  ⚠️ WARNING: Slow operation (>3s)`;
      }
      
      console.log(logMessage, metadata);
    }
    
    // Store metric (async, don't wait)
    storeMetric(metric).catch(() => {
      // Silently fail if storage fails
    });
    
    return duration;
  };
};

/**
 * Start a phase timer within an existing timer
 * Used to track sub-operations within a larger operation
 * @param {Function} stopTimer - The stop function from startTimer
 * @param {string} phaseName - Name of the phase (e.g., 'API_CALL', 'DATA_PROCESSING')
 * @returns {Function} Stop function for this phase
 */
export const startPhaseTimer = (stopTimer, phaseName) => {
  const phaseStartTime = performance.now();
  
  return (phaseMetadata = {}) => {
    const phaseEndTime = performance.now();
    const phaseDuration = phaseEndTime - phaseStartTime;
    
    // Store phase timing (we'll attach this to the main timer when it stops)
    // For now, we'll need to modify startTimer to accept phase timings
    // This is a simplified version - the actual implementation will be in the timer context
    
    if (__DEV__) {
      console.log(`  ⏱️ [PHASE] ${phaseName}: ${phaseDuration.toFixed(2)}ms`, phaseMetadata);
      
      // Warn about slow phases
      if (phaseDuration > 3000) {
        console.warn(`  ⚠️ [PHASE] ${phaseName} is very slow: ${phaseDuration.toFixed(2)}ms`);
      } else if (phaseDuration > 1000) {
        console.warn(`  ⚠️ [PHASE] ${phaseName} is slow: ${phaseDuration.toFixed(2)}ms`);
      }
    }
    
    return {
      phase: phaseName,
      duration: phaseDuration,
      startTime: phaseStartTime,
      endTime: phaseEndTime,
      metadata: phaseMetadata,
    };
  };
};

/**
 * Enhanced timer with phase tracking support
 * @param {string} type - Type of metric
 * @param {Object} metadata - Additional metadata
 * @returns {Object} Timer object with stop function and phase tracking
 */
export const startTimerWithPhases = (type, metadata = {}) => {
  const startTime = performance.now();
  const timestamp = new Date().toISOString();
  const phaseTimings = [];
  
  const stopTimer = (success = true, error = null) => {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    const metric = {
      type,
      duration,
      timestamp,
      success,
      error: error?.message || null,
      phaseTimings: phaseTimings.length > 0 ? phaseTimings : undefined,
      metadata: {
        ...metadata,
        startTime,
        endTime,
      },
    };
    
    // Log in development with phase breakdown
    if (__DEV__) {
      const status = success ? '✅' : '❌';
      let logMessage = `⏱️ [PERF] ${status} ${type}: ${duration.toFixed(2)}ms`;
      
      if (phaseTimings.length > 0) {
        const totalPhaseTime = phaseTimings.reduce((sum, p) => sum + p.duration, 0);
        const unaccountedTime = duration - totalPhaseTime;
        
        logMessage += `\n  Phase Breakdown:`;
        phaseTimings.forEach(p => {
          const percentage = ((p.duration / duration) * 100).toFixed(1);
          logMessage += `\n    ${p.phase}: ${p.duration.toFixed(2)}ms (${percentage}%)`;
        });
        
        if (unaccountedTime > 100) {
          const unaccountedPercentage = ((unaccountedTime / duration) * 100).toFixed(1);
          logMessage += `\n    Other: ${unaccountedTime.toFixed(2)}ms (${unaccountedPercentage}%)`;
        }
      }
      
      // Add warnings
      if (duration > 5000) {
        logMessage += `\n  ⚠️ WARNING: Very slow operation (>5s)`;
      } else if (duration > 3000) {
        logMessage += `\n  ⚠️ WARNING: Slow operation (>3s)`;
      }
      
      console.log(logMessage, metadata);
    }
    
    // Store metric (async, don't wait)
    storeMetric(metric).catch(() => {
      // Silently fail if storage fails
    });
    
    return duration;
  };
  
  const startPhase = (phaseName) => {
    const phaseStartTime = performance.now();
    
    return (phaseMetadata = {}) => {
      const phaseEndTime = performance.now();
      const phaseDuration = phaseEndTime - phaseStartTime;
      
      const phaseTiming = {
        phase: phaseName,
        duration: phaseDuration,
        startTime: phaseStartTime,
        endTime: phaseEndTime,
        metadata: phaseMetadata,
      };
      
      phaseTimings.push(phaseTiming);
      
      if (__DEV__) {
        console.log(`  ⏱️ [PHASE] ${phaseName}: ${phaseDuration.toFixed(2)}ms`, phaseMetadata);
        
        // Warn about slow phases
        if (phaseDuration > 3000) {
          console.warn(`  ⚠️ [PHASE] ${phaseName} is very slow: ${phaseDuration.toFixed(2)}ms`);
        } else if (phaseDuration > 1000) {
          console.warn(`  ⚠️ [PHASE] ${phaseName} is slow: ${phaseDuration.toFixed(2)}ms`);
        }
      }
      
      return phaseDuration;
    };
  };
  
  return {
    stop: stopTimer,
    startPhase,
    phaseTimings: () => [...phaseTimings], // Get current phase timings
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
      phaseStats: {},
      bottlenecks: [],
    };
  }
  
  const durations = metrics.map(m => m.duration);
  const successful = metrics.filter(m => m.success);
  const metricsWithPhases = metrics.filter(m => m.phaseTimings && m.phaseTimings.length > 0);
  
  // Calculate phase statistics
  const phaseStats = {};
  if (metricsWithPhases.length > 0) {
    // Group phase timings by phase name
    const phaseGroups = {};
    metricsWithPhases.forEach(metric => {
      metric.phaseTimings.forEach(phase => {
        if (!phaseGroups[phase.phase]) {
          phaseGroups[phase.phase] = [];
        }
        phaseGroups[phase.phase].push(phase.duration);
      });
    });
    
    // Calculate stats for each phase
    for (const [phaseName, phaseDurations] of Object.entries(phaseGroups)) {
      phaseStats[phaseName] = {
        count: phaseDurations.length,
        avgDuration: phaseDurations.reduce((a, b) => a + b, 0) / phaseDurations.length,
        minDuration: Math.min(...phaseDurations),
        maxDuration: Math.max(...phaseDurations),
        percentageOfTotal: 0, // Will be calculated below
      };
    }
    
    // Calculate percentage of total time for each phase
    const avgTotalDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    for (const phaseName in phaseStats) {
      phaseStats[phaseName].percentageOfTotal = (phaseStats[phaseName].avgDuration / avgTotalDuration) * 100;
    }
  }
  
  // Identify bottlenecks (phases that take >30% of total time or >1 second on average)
  const bottlenecks = [];
  for (const [phaseName, stats] of Object.entries(phaseStats)) {
    if (stats.percentageOfTotal > 30 || stats.avgDuration > 1000) {
      bottlenecks.push({
        phase: phaseName,
        avgDuration: stats.avgDuration,
        percentageOfTotal: stats.percentageOfTotal,
        severity: stats.avgDuration > 3000 ? 'critical' : stats.avgDuration > 1000 ? 'high' : 'medium',
      });
    }
  }
  
  // Sort bottlenecks by severity and duration
  bottlenecks.sort((a, b) => {
    const severityOrder = { critical: 3, high: 2, medium: 1 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[b.severity] - severityOrder[a.severity];
    }
    return b.avgDuration - a.avgDuration;
  });
  
  return {
    count: metrics.length,
    avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
    minDuration: Math.min(...durations),
    maxDuration: Math.max(...durations),
    successRate: (successful.length / metrics.length) * 100,
    phaseStats,
    bottlenecks,
    recent: metrics.slice(-10).map(m => ({
      duration: m.duration,
      timestamp: m.timestamp,
      success: m.success,
      phaseTimings: m.phaseTimings,
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
  startTimerWithPhases,
  startPhaseTimer,
  getMetrics,
  getStats,
  getSummary,
  clearMetrics,
  MetricType,
};

