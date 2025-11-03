# Testing Guide

## Quick Start

### Backend Testing

```bash
cd flight-match-finder/overlap/backend

# Install test dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Mobile App Testing

```bash
cd flight-match-finder/mobile-app

# Install test dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## What's Been Set Up

### Backend
✅ Jest testing framework configured
✅ Supertest for API testing
✅ Test utilities and helpers
✅ Example tests for:
  - Authentication routes
  - Trips routes
  - Team service
  - Recommendation service

### Mobile App
✅ Jest + React Testing Library configured
✅ Expo testing preset (jest-expo)
✅ Mocks for AsyncStorage, Expo modules, Navigation, Maps
✅ Example tests for:
  - LoginScreen
  - MatchCard component
  - AuthContext
  - API service

## Test Structure

See [TEST_PLAN.md](./TEST_PLAN.md) for comprehensive documentation.

## Next Steps

1. Install test dependencies in both projects
2. Run the example tests to verify setup
3. Expand test coverage based on your priorities
4. Add CI/CD integration

