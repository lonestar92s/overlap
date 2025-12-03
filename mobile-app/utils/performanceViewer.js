/**
 * Performance Viewer Utility
 * 
 * Helper functions to view and display performance metrics.
 * Can be used in development screens or debug panels.
 */

import { getStats, getSummary, clearMetrics, MetricType } from './performanceTracker';

/**
 * Format duration for display
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration
 */
export const formatDuration = (ms) => {
  if (ms < 1000) {
    return `${ms.toFixed(0)}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
  }
};

/**
 * Get formatted performance summary
 * @returns {Promise<string>} Formatted summary string
 */
export const getFormattedSummary = async () => {
  const summary = await getSummary();
  
  if (Object.keys(summary).length === 0) {
    return 'No performance metrics recorded yet.';
  }
  
  let output = '📊 Performance Summary\n\n';
  
  for (const [type, stats] of Object.entries(summary)) {
    output += `**${type}**\n`;
    output += `  Count: ${stats.count}\n`;
    output += `  Avg: ${formatDuration(stats.avgDuration)}\n`;
    output += `  Min: ${formatDuration(stats.minDuration)}\n`;
    output += `  Max: ${formatDuration(stats.maxDuration)}\n`;
    output += `  Success Rate: ${stats.successRate.toFixed(1)}%\n`;
    output += '\n';
  }
  
  return output;
};

/**
 * Get formatted stats for a specific metric type
 * @param {string} type - Metric type
 * @returns {Promise<string>} Formatted stats string
 */
export const getFormattedStats = async (type) => {
  const stats = await getStats(type);
  
  if (stats.count === 0) {
    return `No metrics recorded for ${type}`;
  }
  
  let output = `📊 ${type} Performance\n\n`;
  output += `Total Searches: ${stats.count}\n`;
  output += `Average Duration: ${formatDuration(stats.avgDuration)}\n`;
  output += `Fastest: ${formatDuration(stats.minDuration)}\n`;
  output += `Slowest: ${formatDuration(stats.maxDuration)}\n`;
  output += `Success Rate: ${stats.successRate.toFixed(1)}%\n\n`;
  
  if (stats.recent && stats.recent.length > 0) {
    output += 'Recent Searches:\n';
    stats.recent.forEach((metric, index) => {
      const status = metric.success ? '✅' : '❌';
      const date = new Date(metric.timestamp).toLocaleTimeString();
      output += `  ${status} ${formatDuration(metric.duration)} - ${date}\n`;
    });
  }
  
  return output;
};

/**
 * Compare two metric types
 * @param {string} type1 - First metric type
 * @param {string} type2 - Second metric type
 * @returns {Promise<string>} Comparison string
 */
export const compareMetrics = async (type1, type2) => {
  const stats1 = await getStats(type1);
  const stats2 = await getStats(type2);
  
  if (stats1.count === 0 && stats2.count === 0) {
    return `No metrics recorded for ${type1} or ${type2}`;
  }
  
  let output = `📊 Comparison: ${type1} vs ${type2}\n\n`;
  
  if (stats1.count > 0) {
    output += `${type1}:\n`;
    output += `  Count: ${stats1.count}\n`;
    output += `  Avg: ${formatDuration(stats1.avgDuration)}\n`;
    output += `  Success: ${stats1.successRate.toFixed(1)}%\n\n`;
  }
  
  if (stats2.count > 0) {
    output += `${type2}:\n`;
    output += `  Count: ${stats2.count}\n`;
    output += `  Avg: ${formatDuration(stats2.avgDuration)}\n`;
    output += `  Success: ${stats2.successRate.toFixed(1)}%\n\n`;
  }
  
  if (stats1.count > 0 && stats2.count > 0) {
    const diff = stats1.avgDuration - stats2.avgDuration;
    const percentDiff = ((diff / stats2.avgDuration) * 100).toFixed(1);
    output += `Difference: ${diff > 0 ? '+' : ''}${formatDuration(diff)} (${percentDiff > 0 ? '+' : ''}${percentDiff}%)\n`;
  }
  
  return output;
};

export default {
  formatDuration,
  getFormattedSummary,
  getFormattedStats,
  compareMetrics,
  MetricType,
};

