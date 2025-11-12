# Multi-Query Search Testing Guide

## Quick Start

### 1. Test Against Railway (Production) - Recommended

```bash
cd flight-match-finder/overlap/backend

# Test against Railway deployment (default)
node test-multi-query-manual.js

# The script defaults to Railway URL:
# https://friendly-gratitude-production-3f31.up.railway.app/api
```

### 2. Test Against Local Server

```bash
# Start the backend server
npm run dev

# In another terminal, run manual test script with local URL
API_BASE_URL=http://localhost:3001/api node test-multi-query-manual.js
```

### 3. Run Automated Tests

```bash
cd flight-match-finder/overlap/backend

# Run all tests
npm test

# Run only multi-query tests
npm test -- --testPathPattern=multiQuery

# Run in watch mode (auto-rerun on changes)
npm run test:watch

# Run with coverage report
npm test -- --coverage
```

### 3. Test with cURL/Postman

See "Manual API Testing" section below for example requests.

---

## Test Structure

```
overlap/backend/
├── tests/
│   ├── unit/
│   │   └── routes/
│   │       └── search.multiQuery.test.js    # Unit tests for parsing
│   ├── integration/
│   │   └── routes/
│   │       └── search.multiQuery.test.js   # Integration tests for API
│   └── helpers/
│       └── multiQueryTestHelpers.js        # Test utilities
├── test-multi-query-manual.js              # Manual testing script
└── test-multi-query-parsing.js             # Parsing function tests
```

---

## Test Types

### 1. Unit Tests (Parsing Functions)

**File**: `tests/unit/routes/search.multiQuery.test.js`

**What it tests**:
- Multi-query detection
- Count constraint extraction
- Distance constraint extraction
- Date range calculation
- Response mapping

**Run**:
```bash
npm run test:unit -- --testPathPattern=multiQuery
```

### 2. Integration Tests (API Endpoint)

**File**: `tests/integration/routes/search.multiQuery.test.js`

**What it tests**:
- Full API endpoint `/api/search/natural-language`
- End-to-end query flow
- Response structure
- Error handling

**Run**:
```bash
npm run test:integration -- --testPathPattern=multiQuery
```

### 3. Manual Tests (Real API)

**File**: `test-multi-query-manual.js`

**What it tests**:
- Real queries against live API
- Actual OpenAI parsing
- Real match data
- Performance

**Run**:
```bash
node test-multi-query-manual.js
```

---

## Running Tests

### Prerequisites

#### For Railway Testing (Default)
- No setup needed! Script defaults to Railway production URL
- Railway deployment must be live and accessible
- OpenAI API key should be configured on Railway

#### For Local Testing
1. **Install dependencies**:
```bash
cd flight-match-finder/overlap/backend
npm install
```

2. **Set up environment variables**:
Create `.env` file:
```bash
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/match-finder
OPENAI_API_KEY=your-openai-key
API_SPORTS_KEY=your-api-sports-key
```

3. **Start MongoDB** (if running locally):
```bash
# Using Docker
docker run -d -p 27017:27017 mongo:latest

# Or use existing MongoDB instance
```

4. **Start backend server**:
```bash
npm run dev
```

### Run All Tests

```bash
npm test
```

### Run Specific Test File

```bash
# Unit tests only
npm test -- tests/unit/routes/search.multiQuery.test.js

# Integration tests only
npm test -- tests/integration/routes/search.multiQuery.test.js
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Tests with Coverage

```bash
npm test -- --coverage
```

Coverage report will be generated in `coverage/` directory.

---

## Manual API Testing

### Using cURL

#### Test Against Railway (Production)

```bash
curl -X POST https://friendly-gratitude-production-3f31.up.railway.app/api/search/natural-language \
  -H "Content-Type: application/json" \
  -d '{
    "query": "I want to see Bayern Munich play at home, but would also like to see 2 other matches within 200 miles over a 10 day period. The other matches can be bundesliga 2 or austrian bundesliga"
  }'
```

#### Test Against Local Server

```bash
curl -X POST http://localhost:3001/api/search/natural-language \
  -H "Content-Type: application/json" \
  -d '{
    "query": "I want to see Bayern Munich play at home, but would also like to see 2 other matches within 200 miles over a 10 day period. The other matches can be bundesliga 2 or austrian bundesliga"
  }'
```

#### Test 2: Single Query (Backward Compatibility)

```bash
curl -X POST http://localhost:3001/api/search/natural-language \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Arsenal matches in London next month"
  }'
```

#### Test 3: With Conversation History

```bash
curl -X POST http://localhost:3001/api/search/natural-language \
  -H "Content-Type: application/json" \
  -d '{
    "query": "but also 2 other matches within 200 miles",
    "conversationHistory": [
      {
        "isBot": true,
        "data": {
          "parsed": {
            "location": { "city": "Munich", "country": "Germany" },
            "dateRange": { "start": "2025-03-01", "end": "2025-03-10" },
            "teams": [{ "name": "Bayern Munich" }]
          }
        }
      }
    ]
  }'
```

### Using Postman

#### Railway (Production)
1. **Create new POST request**:
   - URL: `https://friendly-gratitude-production-3f31.up.railway.app/api/search/natural-language`
   - Method: POST
   - Headers: `Content-Type: application/json`

#### Local Server
1. **Create new POST request**:
   - URL: `http://localhost:3001/api/search/natural-language`
   - Method: POST
   - Headers: `Content-Type: application/json`

2. **Body (raw JSON)**:
```json
{
  "query": "Bayern Munich home + 2 other matches within 200 miles over 10 days",
  "conversationHistory": []
}
```

3. **Send request** and check response structure

### Using Node.js Script

See `test-multi-query-manual.js` (created below) for a complete example.

---

## Test Cases Reference

See `MULTI_QUERY_TEST_CASES.md` for complete list of test cases.

### Quick Test Checklist

- [ ] **TC-PARSE-001**: Basic multi-query detection
- [ ] **TC-PARSE-002**: Count constraint variations
- [ ] **TC-PARSE-003**: Distance constraint variations
- [ ] **TC-PARSE-004**: Date range variations
- [ ] **TC-EXEC-001**: Successful multi-query execution
- [ ] **TC-EXEC-002**: Insufficient secondary matches
- [ ] **TC-ERROR-001**: Parsing failure
- [ ] **TC-BACK-001**: Single query backward compatibility

---

## Debugging Tests

### Enable Verbose Logging

In test files, add:
```javascript
process.env.DEBUG = 'true';
```

### Check Test Output

Tests will log:
- Parsed query structure
- Search parameters
- Match results
- Errors

### Common Issues

1. **OpenAI API Key Missing**:
   - Error: "OpenAI API key not configured"
   - Fix: Set `OPENAI_API_KEY` in `.env.test`

2. **MongoDB Connection Failed**:
   - Error: "MongoNetworkError"
   - Fix: Start MongoDB or use mock database

3. **Test Timeout**:
   - Error: "Timeout - Async callback was not invoked"
   - Fix: Increase timeout in test file: `jest.setTimeout(30000)`

---

## Performance Testing

### Measure Response Times

```bash
# Run performance test
node test-multi-query-performance.js
```

Expected performance:
- Parsing: 1-2 seconds
- Search execution: 2-4 seconds
- Total: 4-8 seconds

### Load Testing

Use tools like:
- **Artillery**: `npm install -g artillery`
- **Apache Bench**: `ab -n 100 -c 10 http://localhost:3001/api/search/natural-language`

---

## Continuous Integration

### GitHub Actions Example

```yaml
name: Multi-Query Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          MONGODB_URI: ${{ secrets.MONGODB_URI }}
```

---

## Next Steps

1. **Run unit tests** to verify parsing functions
2. **Run integration tests** to verify API endpoint
3. **Run manual tests** with real queries
4. **Check test coverage** and add missing tests
5. **Fix any failing tests**

---

## Test Files to Create

1. ✅ `tests/unit/routes/search.multiQuery.test.js` - Unit tests
2. ✅ `tests/integration/routes/search.multiQuery.test.js` - Integration tests
3. ✅ `test-multi-query-manual.js` - Manual testing script
4. ✅ `tests/helpers/multiQueryTestHelpers.js` - Test utilities

See next section for file contents.

