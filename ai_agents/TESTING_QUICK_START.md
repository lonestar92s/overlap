# Quick Start: Testing Multi-Query Search

## 🚀 Fastest Way to Test

### Option 1: Test Against Railway (Production) - Recommended

```bash
cd flight-match-finder/overlap/backend

# Test against Railway deployment (default)
node test-multi-query-manual.js

# Or explicitly set Railway URL
RAILWAY_URL=https://friendly-gratitude-production-3f31.up.railway.app/api node test-multi-query-manual.js
```

### Option 2: Test Against Local Server

```bash
# 1. Start your backend server
cd flight-match-finder/overlap/backend
npm run dev

# 2. In another terminal, run the manual test script with local URL
API_BASE_URL=http://localhost:3001/api node test-multi-query-manual.js
```

This will test 8 different queries against your live API and show you the results.

---

### Option 2: cURL Test (Quick Single Query)

```bash
# Make sure server is running first
curl -X POST http://localhost:3001/api/search/natural-language \
  -H "Content-Type: application/json" \
  -d '{
    "query": "I want to see Bayern Munich play at home, but would also like to see 2 other matches within 200 miles over a 10 day period. The other matches can be bundesliga 2 or austrian bundesliga"
  }'
```

---

### Option 3: Automated Tests (Full Coverage)

```bash
cd flight-match-finder/overlap/backend

# Run all tests
npm test

# Run only multi-query tests
npm test -- --testPathPattern=multiQuery

# Run in watch mode (auto-rerun on changes)
npm run test:watch
```

---

## 📋 What to Check

### ✅ Success Indicators

1. **Response Structure**:
   ```json
   {
     "success": true,
     "isMultiQuery": true,
     "matches": {
       "primary": { ... },
       "secondary": [ ... ]
     }
   }
   ```

2. **Parsing Accuracy**:
   - `isMultiQuery` = `true` for multi-queries
   - `primary.teams` contains correct team
   - `secondary.count` matches requested count
   - `secondary.maxDistance` matches requested distance

3. **Results**:
   - Primary match found
   - Secondary matches found (or warning if insufficient)
   - Distances calculated correctly

### ❌ Common Issues

1. **"OpenAI API key not configured"**
   - Fix: Set `OPENAI_API_KEY` in `.env` file

2. **"Server not reachable"**
   - Fix: Start backend with `npm run dev`

3. **"No primary match found"**
   - Check: Team name spelling, date range, match availability

4. **"Insufficient secondary matches"**
   - Expected: Warning message, partial results returned

---

## 🧪 Test Queries to Try

### 1. Basic Multi-Query
```
I want to see Bayern Munich play at home, but would also like to see 2 other matches within 200 miles over a 10 day period. The other matches can be bundesliga 2 or austrian bundesliga
```

### 2. Count Variations
```
Bayern Munich home + a few other matches within 200 miles
```

### 3. Distance Variations
```
Bayern Munich home + 2 other matches within 100 km
```

### 4. Single Query (Backward Compatible)
```
Arsenal matches in London next month
```

### 5. Error Case
```
asdfghjkl random text
```

---

## 📊 Expected Performance

- **Parsing**: 1-2 seconds
- **Search**: 2-4 seconds  
- **Total**: 4-8 seconds

If slower, check:
- OpenAI API response time
- Database query performance
- Network latency

---

## 🔍 Debugging

### Enable Verbose Logging

In your backend code, check console logs:
- `🔍 Parsed query:` - Shows parsed structure
- `🔍 Search params:` - Shows search parameters
- `🔍 Direct search result:` - Shows match results

### Check Test Output

The manual test script shows:
- ✅ Green = Success
- ❌ Red = Error  
- ⚠️ Yellow = Warning

---

## 📚 More Information

- **Full Testing Guide**: `ai_agents/TESTING_GUIDE.md`
- **Test Cases**: `ai_agents/MULTI_QUERY_TEST_CASES.md`
- **API Contract**: `ai_agents/MULTI_QUERY_API_CONTRACT.md`

---

## Next Steps

1. ✅ Run manual test script
2. ✅ Check response structure matches API contract
3. ✅ Verify parsing accuracy
4. ✅ Test edge cases
5. ✅ Run automated tests

