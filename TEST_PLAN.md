# Comprehensive Test Plan

## Overview

This document outlines the testing strategy for both the backend API and mobile app. Tests are organized into unit tests, integration tests, and cover happy paths, edge cases, async operations, offline scenarios, and error states.

## Test Structure

```
backend/
├── tests/
│   ├── setup.js                    # Jest configuration & global setup
│   ├── helpers/
│   │   └── testHelpers.js          # Shared test utilities
│   ├── unit/
│   │   ├── routes/                 # API route tests
│   │   └── services/               # Service layer tests
│   └── integration/
│       └── routes/                 # Integration tests with DB

mobile-app/
├── tests/
│   └── setup.js                    # Jest & React Native mocks
└── __tests__/
    ├── screens/                    # Screen component tests
    ├── components/                 # Component tests
    ├── contexts/                   # Context provider tests
    └── services/                   # API service tests
```

## Backend Testing

### Test Infrastructure

- **Framework**: Jest + Supertest
- **Environment**: Node.js test environment
- **Database**: MongoDB (test database or in-memory)
- **Mocking**: External APIs (API-Sports, Cloudinary, WorkOS)

### Test Coverage Areas

#### 1. Authentication Routes (`/api/auth`)

**Unit Tests:**
- ✅ POST `/api/auth/register` - User registration
  - Happy path: Register new user
  - Edge case: Duplicate email
  - Edge case: Invalid email format
  - Edge case: Missing required fields
  - Error state: Database connection failure

- ✅ POST `/api/auth/login` - User login
  - Happy path: Valid credentials
  - Edge case: Invalid password
  - Edge case: Non-existent user
  - Error state: Token generation failure

- ✅ GET `/api/auth/me` - Get current user
  - Happy path: Authenticated user
  - Edge case: Expired token
  - Error state: Invalid token

#### 2. Matches Routes (`/api/matches`)

**Unit Tests:**
- ✅ GET `/api/matches` - Get matches
  - Happy path: Fetch matches with date range
  - Edge case: No matches in date range
  - Edge case: Invalid date format
  - Async: Handling API-Sports response timeouts
  - Error state: External API failure

- ✅ GET `/api/matches/:id` - Get single match
  - Happy path: Valid match ID
  - Edge case: Non-existent match ID
  - Error state: Database error

#### 3. Trips Routes (`/api/trips`)

**Unit Tests:**
- ✅ GET `/api/trips` - Get user trips
  - Happy path: Return user's trips
  - Edge case: No trips
  - Edge case: Filter by status (active/completed)
  - Offline: No authentication (returns empty array)

- ✅ POST `/api/trips` - Create trip
  - Happy path: Create new trip
  - Edge case: Missing required fields
  - Edge case: Invalid date range
  - Error state: Database save failure

#### 4. Services

**Unit Tests:**
- ✅ `recommendationService.js`
  - Happy path: Generate recommendations for trip
  - Edge case: All days have matches (no recommendations)
  - Edge case: No saved matches for proximity search
  - Error state: External API failure

- ✅ `teamService.js`
  - Happy path: Search teams by name
  - Edge case: No results
  - Edge case: Cache hit
  - Error state: Database error

- ✅ `venueService.js`
  - Happy path: Search venues by location
  - Edge case: Invalid coordinates
  - Error state: Geocoding service failure

## Mobile App Testing

### Test Infrastructure

- **Framework**: Jest + React Testing Library + @testing-library/react-native
- **Environment**: jest-expo preset
- **Mocking**: AsyncStorage, Expo modules, React Navigation, Maps

### Test Coverage Areas

#### 1. Screens

**Unit Tests:**
- ✅ `LoginScreen.js`
  - Happy path: Successful login
  - Edge case: Invalid email format
  - Edge case: Empty fields
  - Edge case: Wrong password
  - Error state: Network error
  - Async: Loading state during login

- ✅ `SearchScreen.js` (To be added)
  - Happy path: Search matches
  - Edge case: No results
  - Edge case: Invalid date range
  - Offline: Handle network errors gracefully
  - Async: Loading states

- ✅ `ResultsScreen.js` (To be added)
  - Happy path: Display match results
  - Edge case: Empty results
  - Async: Pagination

#### 2. Components

**Unit Tests:**
- ✅ `MatchCard.js`
  - Happy path: Render match information
  - Edge case: Missing match data
  - Edge case: Null match
  - Edge case: Different match statuses (NS, FT, LIVE)
  - Interaction: Heart button toggle
  - Interaction: Card press navigation

- ✅ `LocationAutocomplete.js` (To be added)
  - Happy path: Search and select location
  - Edge case: No results
  - Async: Debounced search
  - Error state: API failure

#### 3. Contexts

**Unit Tests:**
- ✅ `AuthContext.js`
  - Happy path: Login and set user state
  - Happy path: Logout and clear state
  - Edge case: Restore auth from AsyncStorage
  - Edge case: Invalid stored token
  - Offline: Network errors during auth
  - Async: Loading states

- ✅ `ItineraryContext.js` (To be added)
  - Happy path: Add match to itinerary
  - Edge case: Duplicate match
  - Edge case: Remove match
  - Offline: Persist changes locally

#### 4. Services

**Unit Tests:**
- ✅ `api.js`
  - Happy path: Login request
  - Happy path: Get matches with auth token
  - Edge case: No auth token
  - Error state: Network error
  - Error state: 401 unauthorized
  - Offline: Request failure handling
  - Async: Request timeouts

#### 5. Hooks

**Unit Tests:**
- ✅ `useRecommendations.js`
  - Happy path: Use stored recommendations from trip object
  - Happy path: Fetch recommendations from API when not stored
  - Edge case: Empty stored recommendations (v2)
  - Edge case: Null trip object
  - Edge case: Trip with v2 but null recommendations array
  - Edge case: TripId changes
  - Interaction: Dismiss recommendation
  - Interaction: Add recommendation to trip
  - Error state: API errors
  - Async: Loading states
  - Async: Force refresh vs normal fetch

## Test Execution

### Backend

```bash
cd flight-match-finder/overlap/backend

# Run all tests
npm test

# Run in watch mode
npm run test:watch

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Generate coverage report
npm test -- --coverage
```

### Mobile App

```bash
cd flight-match-finder/mobile-app

# Run all tests
npm test

# Run in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Test Guidelines

### General Rules

1. **No Network in Unit Tests**: All external API calls must be mocked
2. **Deterministic Tests**: Tests should produce consistent results
3. **Isolated Tests**: Each test should be independent and not rely on other tests
4. **Clean Setup/Teardown**: Use `beforeEach` and `afterEach` for cleanup

### Backend Specific

- Mock MongoDB connections or use a test database
- Mock external services (API-Sports, Cloudinary, WorkOS)
- Use test helpers for common operations (token generation, mock users)
- Test both successful responses and error cases
- Test authentication middleware behavior

### Mobile App Specific

- Mock all Expo modules and native modules
- Mock React Navigation hooks
- Mock AsyncStorage for persistence tests
- Test user interactions (press, scroll, input)
- Test async operations with `waitFor`
- Test error boundaries

## Coverage Goals

### Backend
- **Routes**: 80%+ coverage
- **Services**: 85%+ coverage
- **Middleware**: 90%+ coverage

### Mobile App
- **Screens**: 75%+ coverage
- **Components**: 80%+ coverage
- **Contexts**: 85%+ coverage
- **Services**: 90%+ coverage

## Continuous Integration

Tests should be run:
- On every pull request
- Before merging to main branch
- As part of deployment pipeline

## Test Data

### Backend Test Fixtures

- Mock users with different subscription tiers
- Mock matches with various statuses
- Mock trips with different states (active, completed)

### Mobile App Test Fixtures

- Sample match data
- Sample user data
- Sample trip data

## Next Steps

1. ✅ Set up Jest infrastructure for backend
2. ✅ Set up Jest + React Testing Library for mobile app
3. ✅ Create example tests for key features
4. ⏳ Expand test coverage for all routes and services
5. ⏳ Add E2E tests with Detox (if needed)
6. ⏳ Set up CI/CD test execution
7. ⏳ Add performance tests for critical paths
8. ⏳ Add accessibility tests for mobile app

## Notes

- Backend integration tests may require a test MongoDB instance
- Some tests may need environment variables configured
- Mock data should match real API response structures
- Tests should run fast (< 30 seconds for full suite)
- Use `--verbose` flag to see detailed test output

