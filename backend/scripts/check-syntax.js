#!/usr/bin/env node

/**
 * Syntax Check Script
 * Validates that all JavaScript files can be parsed without syntax errors
 * This prevents deployment crashes from syntax errors
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SRC_DIR = path.join(__dirname, '../src');
const errors = [];

/**
 * Recursively find all .js files in a directory
 */
function findJSFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and other common ignore directories
      if (!['node_modules', '.git', 'coverage', 'dist', 'build'].includes(file)) {
        findJSFiles(filePath, fileList);
      }
    } else if (file.endsWith('.js')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

/**
 * Check syntax of a single file
 */
function checkFileSyntax(filePath) {
  try {
    // Use Node.js to parse the file - this will throw on syntax errors
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Try to create a module from the file content
    // This will catch syntax errors before runtime
    new Function('exports', 'require', 'module', '__filename', '__dirname', content);
    
    // Also try using node --check (more reliable)
    try {
      execSync(`node --check "${filePath}"`, { stdio: 'pipe' });
    } catch (checkError) {
      throw new Error(`Syntax error detected: ${checkError.message}`);
    }
    
    return null;
  } catch (error) {
    return {
      file: path.relative(process.cwd(), filePath),
      error: error.message
    };
  }
}

// Main execution
console.log('🔍 Checking JavaScript syntax...\n');

const jsFiles = findJSFiles(SRC_DIR);

if (jsFiles.length === 0) {
  console.log('⚠️  No JavaScript files found in src/ directory');
  process.exit(0);
}

console.log(`Found ${jsFiles.length} JavaScript file(s) to check\n`);

jsFiles.forEach(file => {
  const error = checkFileSyntax(file);
  if (error) {
    errors.push(error);
    console.error(`❌ ${error.file}`);
    console.error(`   ${error.error}\n`);
  } else {
    console.log(`✅ ${path.relative(process.cwd(), file)}`);
  }
});

console.log('\n' + '='.repeat(50));

if (errors.length > 0) {
  console.error(`\n❌ Syntax check failed: ${errors.length} error(s) found\n`);
  errors.forEach(err => {
    console.error(`  • ${err.file}: ${err.error}`);
  });
  console.error('\n⚠️  Please fix these syntax errors before deploying.\n');
  process.exit(1);
} else {
  console.log(`\n✅ All ${jsFiles.length} file(s) passed syntax check!\n`);
  process.exit(0);
}
