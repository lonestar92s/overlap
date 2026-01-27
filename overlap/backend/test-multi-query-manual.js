#!/usr/bin/env node
/**
 * Manual testing script for multi-query natural language search
 * 
 * Usage:
 *   # Test against Railway (default - recommended)
 *   node test-multi-query-manual.js
 * 
 *   # Test against local server
 *   API_BASE_URL=http://localhost:3001/api node test-multi-query-manual.js
 * 
 * Prerequisites:
 *   - Railway deployment must be live (default)
 *   - OR local backend server running on http://localhost:3001
 *   - OPENAI_API_KEY configured on Railway (or in local .env)
 */
require('dotenv').config();
// Default to Railway production URL, fallback to localhost for development
const API_BASE_URL = process.env.API_BASE_URL || 
  process.env.RAILWAY_URL || 
  'https://friendly-gratitude-production-3f31.up.railway.app/api';
const IS_LOCAL = API_BASE_URL.includes('localhost');
// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};
function log(message, color = 'reset') {
}
function logSection(title) {
  log(title, 'bright');
}
function logTest(testName) {
  log(`\n📝 Test: ${testName}`, 'cyan');
}
async function testQuery(query, conversationHistory = []) {
  try {
    const startTime = Date.now();
    log(`Query: "${query}"`, 'yellow');
    if (conversationHistory.length > 0) {
      log(`Conversation History: ${conversationHistory.length} messages`, 'blue');
    }
    const response = await fetch(`${API_BASE_URL}/search/natural-language`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        conversationHistory
      })
    });
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    if (!response.ok) {
      const error = await response.json();
      log(`❌ Error: ${response.status}`, 'red');
      return { success: false, error };
    }
    const data = await response.json();
    log(`✅ Response received (${elapsedTime}s)`, 'green');
    log(`Success: ${data.success}`, data.success ? 'green' : 'red');
    log(`Confidence: ${data.confidence}%`, data.confidence >= 80 ? 'green' : 'yellow');
    log(`Is Multi-Query: ${data.isMultiQuery || false}`, 'blue');
    if (data.isMultiQuery) {
      log('\n📊 Multi-Query Structure:', 'bright');
      if (data.matches?.primary) {
        log('\n🏆 Primary Match:', 'bright');
      }
      if (data.matches?.secondary) {
        log(`\n📋 Secondary Matches (${data.matches.secondary.length}):`, 'bright');
        data.matches.secondary.forEach((match, index) => {
        });
      }
    } else {
      log('\n📋 Matches:', 'bright');
      if (data.matches && data.matches.length > 0) {
        data.matches.slice(0, 3).forEach((match, index) => {
        });
        if (data.matches.length > 3) {
        }
      }
    }
    if (data.message) {
      log(`\n💬 Message: ${data.message}`, 'blue');
    }
    if (data.warning) {
      log(`\n⚠️  Warning: ${data.warning}`, 'yellow');
    }
    return { success: true, data, elapsedTime };
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    console.error(error);
    return { success: false, error: error.message };
  }
}
async function runTests() {
  logSection('Multi-Query Natural Language Search - Manual Tests');
  // Test 1: Basic Multi-Query
  logTest('TC-PARSE-001: Basic Multi-Query Detection');
  await testQuery(
    "I want to see Bayern Munich play at home, but would also like to see 2 other matches within 200 miles over a 10 day period. The other matches can be bundesliga 2 or austrian bundesliga"
  );
  // Test 2: Count Constraint Variations
  logTest('TC-PARSE-002: Count Constraint - "a few matches"');
  await testQuery(
    "Bayern Munich home + a few other matches within 200 miles over 10 days"
  );
  // Test 3: Distance Constraint Variations
  logTest('TC-PARSE-003: Distance Constraint - "within 100 km"');
  await testQuery(
    "Bayern Munich home + 2 other matches within 100 km over 10 days. Other matches: Bundesliga 2"
  );
  // Test 4: Single Query (Backward Compatibility)
  logTest('TC-BACK-001: Single Query - Backward Compatibility');
  await testQuery(
    "Arsenal matches in London next month"
  );
  // Test 5: Complex Multi-Query
  logTest('TC-PARSE-007: Complex Multi-Query');
  await testQuery(
    "I want to see Real Madrid play at home in March, but would also like to see 3 other matches within 150 miles over a 2 week period. The other matches should be from La Liga 2 or Segunda Division"
  );
  // Test 6: Insufficient Secondary Matches
  logTest('TC-EXEC-002: Insufficient Secondary Matches');
  await testQuery(
    "Bayern Munich home + 10 other matches within 50 miles over 10 days"
  );
  // Test 7: With Conversation History
  logTest('TC-INT-002: Conversation History Integration');
  const conversationHistory = [
    {
      isBot: true,
      data: {
        parsed: {
          location: { city: "Munich", country: "Germany" },
          dateRange: { start: "2025-03-01", end: "2025-03-10" },
          teams: [{ name: "Bayern Munich" }]
        }
      }
    }
  ];
  await testQuery(
    "but also 2 other matches within 200 miles",
    conversationHistory
  );
  // Test 8: Error Case - Missing Date Range
  logTest('TC-ERROR-002: Missing Date Range');
  await testQuery(
    "Bayern Munich home + 2 other matches"
  );
  logSection('Tests Complete');
  log('\n📊 Summary:', 'bright');
  log('Check the output above for test results.', 'blue');
  log('✅ Green = Success', 'green');
  log('❌ Red = Error', 'red');
  log('⚠️  Yellow = Warning', 'yellow');
}
// Check if server is running
async function checkServer() {
  try {
    // Try to reach the search endpoint or any API endpoint
    const response = await fetch(`${API_BASE_URL.replace('/api', '')}/api/search/health`).catch(() => {
      // If health endpoint doesn't exist, try a simple GET to root
      return fetch(`${API_BASE_URL.replace('/api', '')}/`).catch(() => null);
    });
    return true;
  } catch (error) {
    // Try alternative check - just ping the base URL
    try {
      await fetch(`${API_BASE_URL.replace('/api', '')}`, { method: 'HEAD' });
      return true;
    } catch (e) {
      log('❌ Server not reachable. Make sure backend is running on ' + API_BASE_URL.replace('/api', ''), 'red');
      log('   Start server with: npm run dev', 'yellow');
      log('   Default port is 3001 (not 3000)', 'yellow');
      return false;
    }
  }
}
// Main execution
(async () => {
  logSection('Pre-flight Checks');
  log(`🌐 Testing against: ${API_BASE_URL}`, 'blue');
  if (IS_LOCAL) {
    log('📍 Mode: LOCAL (localhost)', 'yellow');
    log('   To test Railway instead, set: RAILWAY_URL=https://friendly-gratitude-production-3f31.up.railway.app/api', 'yellow');
  } else {
    log('📍 Mode: RAILWAY (Production)', 'green');
    log('   To test locally instead, set: API_BASE_URL=http://localhost:3001/api', 'yellow');
  }
  if (!process.env.OPENAI_API_KEY) {
    log('⚠️  Warning: OPENAI_API_KEY not set in environment', 'yellow');
    log('   Tests may fail if OpenAI parsing is required', 'yellow');
  }
  const serverRunning = await checkServer();
  if (!serverRunning) {
    if (IS_LOCAL) {
      log('\n💡 Tip: Make sure backend is running locally:', 'yellow');
      log('   cd flight-match-finder/overlap/backend', 'yellow');
      log('   npm run dev', 'yellow');
    } else {
      log('\n💡 Tip: Check Railway deployment status:', 'yellow');
      log('   https://railway.app/dashboard', 'yellow');
    }
    process.exit(1);
  }
  log('✅ Server is reachable', 'green');
  log('✅ Starting tests...\n', 'green');
  await runTests();
  log('\n✨ All tests completed!', 'green');
})();
