#!/usr/bin/env node

/**
 * Console Log Audit Script
 * 
 * Scans all JS files and categorizes console logs:
 * - KEEP: Production-critical (errors, warnings)
 * - WRAP: Debug logs that need __DEV__ checks
 * - REMOVE: Verbose/unnecessary logs
 */

const fs = require('fs');
const path = require('path');

const mobileAppDir = path.join(__dirname, '..');
const results = {
  keep: [],
  wrap: [],
  remove: [],
  alreadyWrapped: []
};

// Patterns to identify log types
const keepPatterns = [
  /console\.(warn|error)\(.*(?:EXPO_PUBLIC|API_URL|configuration|config)/i,
  /console\.(warn|error)\(.*(?:rate limit|rate limited)/i,
  /console\.error\(.*(?:auth|login|token|authentication)/i,
  /console\.error\(.*(?:network|fetch|request failed)/i,
];

const removePatterns = [
  /console\.log\(.*(?:Deleting|Removing|Adding|Updating).*(?:trip|match|flight)/i,
  /console\.log\(.*(?:response|Returning cached)/i,
  /console\.log\(.*(?:Button clicked|pressed|called)/i,
  /console\.log\(.*(?:🔵|🔘|🗑️|📋|⚡)/, // Emoji-based operation logs
];

const debugPatterns = [
  /console\.log\(.*(?:\[FILTER\]|\[SEARCH\]|\[VENUE\]|\[MAP\]|\[INIT\])/i,
  /console\.log\(.*(?:\[PERF\]|\[DEBUG\])/i,
  /console\.log\(.*(?:analysis|check|state|bounds)/i,
];

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const relativePath = path.relative(mobileAppDir, filePath);
  
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    
    // Skip if already wrapped in __DEV__
    if (line.includes('__DEV__') && /console\.(log|warn|error|info|debug)/.test(line)) {
      const match = line.match(/console\.(log|warn|error|info|debug)\(/);
      if (match) {
        results.alreadyWrapped.push({
          file: relativePath,
          line: lineNum,
          type: match[1],
          code: line.trim()
        });
      }
      return;
    }
    
    // Check for console statements
    const consoleMatch = line.match(/console\.(log|warn|error|info|debug)\(/);
    if (!consoleMatch) return;
    
    const logType = consoleMatch[1];
    const logEntry = {
      file: relativePath,
      line: lineNum,
      type: logType,
      code: line.trim()
    };
    
    // Categorize
    if (keepPatterns.some(pattern => pattern.test(line))) {
      results.keep.push(logEntry);
    } else if (removePatterns.some(pattern => pattern.test(line))) {
      results.remove.push(logEntry);
    } else if (debugPatterns.some(pattern => pattern.test(line))) {
      results.wrap.push(logEntry);
    } else if (logType === 'error') {
      // All errors should be kept (but wrapped in __DEV__ or sent to error service)
      results.wrap.push(logEntry);
    } else if (logType === 'warn') {
      // Warnings might be production-worthy
      results.keep.push(logEntry);
    } else {
      // Default: wrap debug logs
      results.wrap.push(logEntry);
    }
  });
}

function scanDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    // Skip node_modules, dist, build, etc.
    if (entry.name === 'node_modules' || 
        entry.name === 'dist' || 
        entry.name === 'build' ||
        entry.name === '.git' ||
        entry.name === 'scripts') {
      continue;
    }
    
    if (entry.isDirectory()) {
      scanDirectory(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      scanFile(fullPath);
    }
  }
}

// Run scan
console.log('Scanning files...\n');
scanDirectory(mobileAppDir);

// Generate report
const report = {
  summary: {
    total: results.keep.length + results.wrap.length + results.remove.length + results.alreadyWrapped.length,
    keep: results.keep.length,
    wrap: results.wrap.length,
    remove: results.remove.length,
    alreadyWrapped: results.alreadyWrapped.length
  },
  details: {
    keep: results.keep,
    wrap: results.wrap,
    remove: results.remove,
    alreadyWrapped: results.alreadyWrapped
  }
};

// Output results
console.log('=== CONSOLE LOG AUDIT RESULTS ===\n');
console.log(`Total console statements found: ${report.summary.total}`);
console.log(`Already wrapped in __DEV__: ${report.summary.alreadyWrapped} ✓`);
console.log(`Keep (production): ${report.summary.keep}`);
console.log(`Wrap in __DEV__: ${report.summary.wrap}`);
console.log(`Remove: ${report.summary.remove}\n`);

// Save detailed report
const reportPath = path.join(mobileAppDir, 'CONSOLE_LOG_AUDIT_DETAILED.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`Detailed report saved to: ${reportPath}\n`);

// Show top files needing attention
const fileCounts = {};
[...results.wrap, ...results.remove].forEach(entry => {
  fileCounts[entry.file] = (fileCounts[entry.file] || 0) + 1;
});

const topFiles = Object.entries(fileCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10);

console.log('Top files needing attention:');
topFiles.forEach(([file, count]) => {
  console.log(`  ${file}: ${count} logs`);
});

