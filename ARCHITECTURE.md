# Architecture

This document provides a high-level overview of the Flight Match Finder architecture. For detailed technical specifications, see the referenced documents.

## System Overview

Flight Match Finder is a full-stack application for finding and planning trips around football matches. It consists of:

1. **Mobile App** (React Native/Expo)
2. **Backend API** (Node.js/Express)
3. **Web App** (React) - Optional admin/overlap extension

## Architecture Principles

1. **Modular Design**: Each module should be independently understandable and modifiable
2. **Separation of Concerns**: Clear boundaries between UI, business logic, and data layers
3. **Reusability**: Shared components, utilities, and services
4. **Performance First**: Caching, lazy loading, and optimization
5. **Scalability**: Design for growth in users and features

## Mobile App Architecture

### Tech Stack
- **Framework**: React Native with Expo
- **Navigation**: React Navigation
- **State Management**: React Context API
- **Maps**: Mapbox (@rnmapbox/maps)
- **Styling**: StyleSheet with Design Tokens
- **Testing**: Jest + React Native Testing Library

### Folder Structure
```
mobile-app/
├── components/       # Reusable UI components
├── screens/          # Screen-level components
├── contexts/         # Global state management
├── hooks/            # Custom React hooks
├── services/         # API and external services
├── utils/            # Utility functions
├── styles/           # Design tokens and theme
└── __tests__/        # Test files
```

### Key Patterns

**Context API for State:**
- `AuthContext`: User authentication state
- `FilterContext`: Search filter state
- `ItineraryContext`: Trip/itinerary state

**Service Layer:**
- `api.js`: Centralized API client
- `naturalLanguageService.js`: Natural language processing

**Custom Hooks:**
- `useDateRange.js`: Date range management
- `useMatchFilters.js`: Filter logic
- `useSearchState.js`: Search state management

**Design System:**
- `designTokens.js`: Centralized colors, spacing, typography
- Consistent styling across all components

### Component Architecture

**Screen Components:**
- Full-page components that handle navigation
- Examples: `SearchScreen`, `TripOverviewScreen`, `MapResultsScreen`

**Reusable Components:**
- Self-contained, reusable UI elements
- Examples: `MatchCard`, `FilterModal`, `LocationAutocomplete`

**Modal Components:**
- Overlay components for focused interactions
- Examples: `CreateTripModal`, `MatchModal`, `FilterModal`

### State Management Flow

```
User Action → Component → Context/Hook → Service → API → Backend
                ↓
            Update State → Re-render UI
```

## Backend Architecture

### Tech Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT
- **External APIs**: API-Sports, OpenAI, Amadeus, Cloudinary

### Folder Structure
```
overlap/backend/src/
├── routes/           # Express route handlers
├── services/         # Business logic
├── models/           # Mongoose models
├── middleware/       # Express middleware
├── utils/            # Utility functions
├── config/           # Configuration
└── providers/        # External API providers
```

### API Structure

**Authentication Routes** (`/api/auth`):
- POST `/register` - User registration
- POST `/login` - User login
- POST `/forgot-password` - Password reset request
- POST `/reset-password` - Password reset
- GET `/me` - Get current user

**Match Routes** (`/api/matches`):
- GET `/search` - Search matches
- GET `/by-team` - Get matches by team
- GET `/recommended` - Get recommendations

**Trip Routes** (`/api/trips`):
- GET `/` - Get user trips
- POST `/` - Create trip
- GET `/:id` - Get trip details
- PUT `/:id` - Update trip
- DELETE `/:id` - Delete trip

**Search Routes** (`/api/search`):
- POST `/natural-language` - Natural language search
- GET `/venues` - Search venues

### Service Layer

**Core Services:**
- `recommendationService.js`: Match recommendation algorithm
- `geocodingService.js`: Location geocoding
- `venueService.js`: Venue management
- `transportationService.js`: Flight/train search (planned)

**External Integrations:**
- `amadeusProvider.js`: Flight API integration
- OpenAI: Natural language processing
- Cloudinary: Image storage

### Data Models

**User Model:**
- Authentication data
- Preferences (teams, leagues, venues)
- Trips array
- Saved matches
- Memories

**Trip Model:**
- Trip metadata (name, dates)
- Matches array
- Home bases (planned)
- Travel information (planned)

**Match Model:**
- Match data from API-Sports
- Venue information
- Team information
- League information

## Data Flow

### Search Flow
```
User Input → Natural Language Parser (OpenAI) → Search Parameters
    → Match Search (API-Sports) → Filter/Process → Results → UI
```

### Trip Creation Flow
```
Select Matches → Create Trip → Save to User → Update Context
    → Display in Trip List → Navigate to Trip Overview
```

### Recommendation Flow
```
User Preferences + Trip Context → Recommendation Service
    → Scoring Algorithm → Filtered Results → UI
```

## External Integrations

### API-Sports
- **Purpose**: Match data (teams, leagues, fixtures)
- **Integration**: REST API with rate limiting
- **Caching**: Implemented for frequently accessed data

### OpenAI
- **Purpose**: Natural language query parsing
- **Integration**: OpenAI API
- **Usage**: Convert user queries to structured search parameters

### Mapbox
- **Purpose**: Map rendering and geocoding
- **Integration**: @rnmapbox/maps SDK
- **Usage**: Display match locations, venue search

### Amadeus (Planned)
- **Purpose**: Flight search and booking
- **Integration**: Amadeus API
- **Usage**: Flight search for trip planning

### Cloudinary
- **Purpose**: Image storage and optimization
- **Integration**: Cloudinary SDK
- **Usage**: User-uploaded photos for memories

## Security Architecture

### Authentication
- JWT tokens for API authentication
- Secure token storage (expo-secure-store)
- Token expiration and refresh

### Authorization
- Role-based access control (admin/user)
- Resource ownership validation
- API rate limiting

### Data Protection
- Password hashing (bcrypt)
- Input validation and sanitization
- HTTPS only in production
- Environment variable management

## Performance Optimizations

### Frontend
- Component memoization (React.memo)
- Lazy loading of heavy components
- Image optimization
- Debounced search inputs
- Cached API responses

### Backend
- Database indexing
- API response caching
- Rate limiting
- Efficient database queries
- Connection pooling

## Testing Strategy

### Frontend Testing
- Unit tests for utilities and hooks
- Component tests with React Native Testing Library
- Integration tests for user flows

### Backend Testing
- Unit tests for services
- Integration tests for API routes
- Mock external API calls

## Deployment

### Infrastructure
- **Backend**: Railway
- **Mobile**: Expo/EAS for builds
- **Database**: MongoDB (hosted)

### CI/CD
- Automated testing on PR
- Automated deployment on merge
- Environment variable management

## Known Architecture Issues

See `ai_agents/ARCHITECTURE_ANALYSIS.md` for detailed analysis of:
- Oversized components (needs refactoring)
- State management improvements needed
- Code duplication issues
- Performance optimization opportunities

## Future Architecture Plans

### Planned Improvements
1. **State Management**: Consider Redux for complex state
2. **Caching Layer**: Redis for API caching
3. **Real-time Updates**: WebSocket support for live match updates
4. **Offline Support**: Local database sync
5. **Microservices**: Split backend into services (planned)

### Planned Features
- Flight search integration
- Train search integration
- Push notifications
- Cost tracking
- Home base management

## References

### Detailed Documentation
- **Architecture Analysis**: `ai_agents/ARCHITECTURE_ANALYSIS.md`
- **Flight/Train Architecture**: `ai_agents/FLIGHT_TRAIN_SEARCH_ARCHITECTURE.md`
- **Multi-Query Architecture**: `ai_agents/MULTI_MATCH_SEARCH_ARCHITECTURE.md`
- **Notifications Architecture**: `ai_agents/NOTIFICATIONS_SERVICE_ARCHITECTURE.md`
- **Component Analysis**: `mobile-app/components/COMPONENT_AUDIT_REPORT.md`

### Requirements
- **Requirements**: `REQUIREMENTS.md`
- **User Stories**: `USER_STORIES.md`
- **Conventions**: `CONVENTIONS.md`

### Technical Specs
- **Phase 1 Specs**: `ai_agents/PHASE1_TECHNICAL_SPECS.md`
- **API Contracts**: `ai_agents/MULTI_QUERY_API_CONTRACT.md`
- **Test Plan**: `TEST_PLAN.md`


