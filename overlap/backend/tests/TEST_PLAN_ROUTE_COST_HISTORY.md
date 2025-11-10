# Test Plan: RouteCostHistory Model & TransportationService

## Overview
This test plan covers comprehensive testing for the RouteCostHistory Mongoose model and the TransportationService class that orchestrates flight/train searches and updates route cost history.

## Test Strategy
- **Unit Tests**: Mock all external dependencies (Mongoose, providers)
- **No Network Calls**: All API calls mocked
- **Deterministic**: Tests should produce consistent results
- **Coverage**: Happy paths, edge cases, async operations, error states

---

## RouteCostHistory Model Tests

### 1. Schema Validation Tests
**Test Cases:**
- ✅ Valid route creation with required fields (origin.code, destination.code, type)
- ✅ Invalid route creation missing required fields
- ✅ Type enum validation (only 'flight' or 'train' allowed)
- ✅ Default currency value (USD)
- ✅ Price history array structure validation
- ✅ Multi-currency price history structure validation
- ✅ Statistics object structure validation

**Edge Cases:**
- Empty price history array
- Invalid date formats in price history
- Negative prices
- Missing currency in price history items

### 2. Instance Methods Tests

#### `addPricePoint(price, currency, source, metadata)`
**Happy Path:**
- ✅ Add single price point successfully
- ✅ Update statistics after adding price point
- ✅ Update lastSearched timestamp
- ✅ Increment searchCount
- ✅ Add metadata correctly

**Edge Cases:**
- ✅ Add price point with different currency than route currency
- ✅ Add price point with empty metadata
- ✅ Add multiple price points sequentially
- ✅ Handle null/undefined values gracefully

#### `updateStatistics()`
**Happy Path:**
- ✅ Calculate min, max, avg prices correctly
- ✅ Update lastUpdated timestamp
- ✅ Set sampleCount correctly
- ✅ Filter by route currency

**Edge Cases:**
- ✅ Empty price history (should not update statistics)
- ✅ Single price point
- ✅ Multiple prices with same value
- ✅ Prices in different currencies (should filter correctly)

#### `getAveragePrice(startDate, endDate)`
**Happy Path:**
- ✅ Calculate average for date range correctly
- ✅ Filter by currency correctly
- ✅ Return null for empty date range

**Edge Cases:**
- ✅ No prices in date range (return null)
- ✅ Single price in range
- ✅ Prices outside date range excluded
- ✅ Invalid date range (startDate > endDate)
- ✅ Prices with different currencies excluded

### 3. Static Methods Tests

#### `findOrCreate(origin, destination, type, currency)`
**Happy Path:**
- ✅ Find existing route successfully
- ✅ Create new route when not found
- ✅ Initialize empty arrays and statistics

**Edge Cases:**
- ✅ Handle database errors gracefully
- ✅ Multiple concurrent findOrCreate calls
- ✅ Different currencies for same route

### 4. Index Tests
- ✅ Compound index on origin.code, destination.code, type works
- ✅ Date range queries use index efficiently

---

## TransportationService Tests

### 1. Constructor Tests
**Happy Path:**
- ✅ Initialize with Amadeus provider when available
- ✅ Initialize empty providers array when Amadeus unavailable

**Edge Cases:**
- ✅ Handle provider initialization errors gracefully
- ✅ Continue with other providers if one fails

### 2. `searchFlights(params)` Tests
**Happy Path:**
- ✅ Successfully search with first provider
- ✅ Return results with provider info
- ✅ Update route cost history asynchronously
- ✅ Return correct result structure

**Error Handling:**
- ✅ Throw error when no providers configured
- ✅ Fallback to next provider on failure
- ✅ Throw error when all providers fail
- ✅ Include last error message in failure

**Edge Cases:**
- ✅ Handle provider timeout
- ✅ Handle malformed provider responses
- ✅ Route cost history update failure doesn't block response
- ✅ Empty search results

### 3. `searchTrains(params)` Tests
**Happy Path:**
- ✅ Throw "not yet implemented" error (current behavior)

**Future:**
- When implemented, test similar to searchFlights

### 4. `updateRouteCostHistory(origin, destination, type, results)` Tests
**Happy Path:**
- ✅ Extract prices from results correctly
- ✅ Find or create route cost history
- ✅ Add price points for each result
- ✅ Save route successfully
- ✅ Handle multiple currencies

**Error Handling:**
- ✅ Handle empty results array
- ✅ Handle results without prices
- ✅ Handle database save errors (don't throw)
- ✅ Log errors but continue execution

**Edge Cases:**
- ✅ Results with missing price fields
- ✅ Results with null/undefined prices
- ✅ Multiple results with same price
- ✅ Results with different currencies

### 5. `getRouteCostHistory(origin, destination, type, currency)` Tests
**Happy Path:**
- ✅ Return route when found
- ✅ Return null when not found
- ✅ Filter by currency correctly

**Error Handling:**
- ✅ Handle database query errors gracefully
- ✅ Return null on error (don't throw)
- ✅ Log errors

**Edge Cases:**
- ✅ Invalid parameters
- ✅ Database connection errors

### 6. `searchAirports(query, limit)` Tests
**Happy Path:**
- ✅ Search airports successfully
- ✅ Respect limit parameter
- ✅ Return array of airports

**Error Handling:**
- ✅ Return empty array when no providers
- ✅ Return empty array on provider error
- ✅ Handle network errors gracefully

**Edge Cases:**
- ✅ Empty query string
- ✅ Very large limit
- ✅ Special characters in query

### 7. `getNearestAirports(latitude, longitude, radius, limit)` Tests
**Happy Path:**
- ✅ Get nearest airports successfully
- ✅ Respect radius and limit parameters
- ✅ Return array of airports

**Error Handling:**
- ✅ Return empty array when no providers
- ✅ Return empty array on provider error
- ✅ Handle invalid coordinates

**Edge Cases:**
- ✅ Invalid latitude/longitude values
- ✅ Zero radius
- ✅ Very large radius

### 8. `getFlightStatus(flightNumber, scheduledDepartureDate)` Tests
**Happy Path:**
- ✅ Get flight status successfully
- ✅ Parse flight number correctly
- ✅ Return flight status object

**Error Handling:**
- ✅ Throw error when no providers
- ✅ Handle invalid flight number format
- ✅ Handle provider errors

**Edge Cases:**
- ✅ Invalid date format
- ✅ Flight number without airline code
- ✅ Non-existent flight number

---

## Test Implementation Notes

### Mocking Strategy
- **Mongoose Models**: Mock RouteCostHistory model methods
- **Providers**: Mock AmadeusProvider and other providers
- **Database**: Use in-memory MongoDB for integration tests, mocks for unit tests

### Test Data
- Use consistent test data across tests
- Create helper functions for generating test routes, prices, etc.
- Use realistic airport codes (e.g., 'JFK', 'LAX', 'LHR')

### Coverage Goals
- **RouteCostHistory**: 100% method coverage
- **TransportationService**: 90%+ coverage (excluding TODO implementations)
- **Edge Cases**: All identified edge cases covered
- **Error States**: All error paths tested

---

## Test Files Structure
```
tests/
  unit/
    models/
      routeCostHistory.test.js
    services/
      transportationService.test.js
```

---

## Execution Plan
1. ✅ Create test plan (this document)
2. ⏳ Implement RouteCostHistory model tests
3. ⏳ Implement TransportationService tests
4. ⏳ Run tests and verify coverage
5. ⏳ Fix any issues and ensure all tests pass

