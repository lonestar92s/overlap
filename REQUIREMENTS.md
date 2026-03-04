# Requirements

This document consolidates all feature requirements for the Flight Match Finder application, updated to reflect the current codebase and functionality.

## Project Structure

- **Backend**: `overlap/backend/` — Node.js/Express API
- **Mobile App**: `mobile-app/` — React Native with Expo

## Core Features

### 1. Match Search
**Priority**: High  
**Status**: Implemented

**Requirements:**
- Search matches by team (home/away/any)
- Search by date range
- Search by location with distance radius
- Search by map bounds (MapSearchScreen)
- Search by league
- Natural language search support (MessagesScreen, LocationSearchModal)
- Multi-query search (primary match + secondary matches with different criteria)
- Filter by match type (home/away)
- Real-time match data from API-Sports
- Popular matches (location-based)
- Search by bounds for map-based discovery

**Technical Details:**
- Backend: `/api/matches/search`, `/api/matches/popular`, `/api/matches/competitions/:id`, `/api/search/*`
- Natural language parsing via OpenAI
- LocationIQ for location autocomplete
- Support for complex queries like "Bayern Munich home matches plus 2 other matches within 200 miles"

### 2. User Authentication
**Priority**: High  
**Status**: Implemented

**Requirements:**
- User registration with email/password
- User login
- Password reset functionality
- WorkOS integration for enterprise SSO
- JWT token-based authentication
- Secure password hashing (bcrypt)
- Session management

**Technical Details:**
- Backend: `/api/auth/*` endpoints
- Frontend: AuthContext for state management
- Secure token storage (expo-secure-store)

### 3. Trip Management
**Priority**: High  
**Status**: Implemented

**Requirements:**
- Create trips with multiple matches
- View trip overview with itinerary
- Edit trip details (name, description, notes, dates)
- Delete trips
- Save matches to trips
- Trip sharing functionality (ShareableTripView)
- Trip countdown widget
- Map view of trip matches (ItineraryMapScreen, TripMapView)
- Trip flights (add, view, delete flights per trip)
- Match planning (tickets acquired, accommodation, home base assignment, notes)
- Fetch live scores for trip matches

**Technical Details:**
- Backend: `/api/trips/*` endpoints
- Frontend: ItineraryContext for state management
- Trip data stored in User model
- Flights stored in trip.flights array

### 4. Match Recommendations
**Priority**: Medium  
**Status**: Implemented

**Requirements:**
- Personalized match recommendations based on:
  - User preferences (favorite teams, leagues, venues)
  - Trip context (dates, locations, existing matches)
  - Match quality indicators
  - User behavior history
- Recommendation scoring algorithm
- Filter recommendations by preferences
- Dismiss recommendations
- Add recommendations to trip

**Technical Details:**
- Backend: `/api/recommendations/trips/:tripId/recommendations`
- RecommendationService with weighted scoring
- Configurable recommendation weights (`config/recommendationWeights.js`)
- Client-side caching

### 5. Map Integration
**Priority**: High  
**Status**: Implemented

**Requirements:**
- Map view of search results (MapResultsScreen)
- Map view of trip itinerary (ItineraryMapScreen, TripMapView)
- Map view of memories (MemoriesMapScreen)
- Map-based home screen (SearchScreen with enableMapHomeScreen flag)
- Map search by bounds (MapSearchScreen)
- Venue location markers
- Home base markers on itinerary map
- Map search functionality
- Consistent map provider (Mapbox) across all views

**Technical Details:**
- Frontend: Mapbox integration via @rnmapbox/maps
- MapResultsScreen, ItineraryMapScreen, MemoriesMapScreen, MapSearchScreen
- Venue coordinates stored in database
- MapboxMapView component

### 6. Filtering System
**Priority**: High  
**Status**: Implemented

**Requirements:**
- Filter by league
- Filter by team
- Filter by date range
- Filter by location/distance
- Filter by match type
- Filter modal UI
- Filter state persistence
- Filter chips for active filters

**Technical Details:**
- Frontend: FilterContext for state management
- FilterModal, FilterSection, FilterAccordion, FilterChip, FilterIcon components

### 7. Memories
**Priority**: Medium  
**Status**: Implemented

**Requirements:**
- Save memories for attended matches
- Add photos to memories
- Edit memories
- View memories list
- View memories on map
- Share memories

**Technical Details:**
- Backend: `/api/memories/*` endpoints
- Frontend: MemoriesScreen, AddMemoryScreen, EditMemoryScreen
- Photo upload via Cloudinary

### 8. Attendance Tracking
**Priority**: Medium  
**Status**: Implemented

**Requirements:**
- Mark matches as attended
- View attended matches list
- Track attendance history
- Link memories to attended matches

**Technical Details:**
- Backend: `/api/attendance/*`, `/api/matches/attended` endpoints
- Frontend: AttendedMatchesScreen, AttendanceModal

### 9. Flight Search
**Priority**: Medium  
**Status**: Implemented

**Requirements:**
- Search flights by origin → destination (airport codes)
- Airport search and autocomplete
- Nearest airports by coordinates
- Date range selection (departure, optional return)
- Round-trip support
- Non-stop filter
- Price display with currency
- Integration with trip creation flow (AddFlightModal)
- Add flights to trips (by search or by flight number)
- Flight status lookup
- Flight lookup by number (origin, destination, date required)

**Technical Details:**
- Backend: `/api/transportation/flights/search`, `/api/transportation/airports/search`, `/api/transportation/airports/nearest`, `/api/transportation/flights/status`, `/api/transportation/flights/by-number`
- Amadeus API integration (AmadeusProvider)
- TransportationService orchestrates providers
- Frontend: FlightSearchTab (in SearchModal, LocationSearchModal), AddFlightModal

### 10. Transportation & Directions
**Priority**: Medium  
**Status**: Implemented (partial)

**Requirements:**
- Driving directions (Google Maps API)
- Walking directions (Google Maps API)
- Transit directions (train, bus, subway, tram)
- Inter-match travel times from home base to venue
- Travel time display on match cards (TravelTimeDisplay)
- Rail directions (placeholder — API not yet integrated)

**Technical Details:**
- Backend: `/api/transportation/directions/driving`, `/directions/walking`, `/directions/transit`, `/directions/rail`
- Trips: `/api/trips/:id/travel-times` (uses Google Directions API)
- Google API key required
- Frontend: TravelTimeDisplay component (driving, transit modes)

### 11. Home Base Management
**Priority**: Low  
**Status**: Implemented

**Requirements:**
- Add home base locations for trips
- Date range for each home base
- Calculate travel times from home base to matches
- Multiple home bases per trip
- Assign home base to match in planning modal
- Automatic home base selection based on match dates
- Home base markers on itinerary map

**Technical Details:**
- Backend: `/api/trips/:id/home-bases` (POST, PUT, DELETE)
- Trip model: homeBases subdocument array
- Frontend: HomeBaseSection, HomeBaseCard, HomeBaseSelector, MatchPlanningModal
- Travel times computed per home base

### 12. User Preferences & Profile
**Priority**: High  
**Status**: Implemented

**Requirements:**
- Favorite teams, leagues, venues
- Profile (firstName, lastName, avatar, timezone)
- Avatar upload (Cloudinary, rate-limited)
- Saved matches (heart/like)
- Default location
- League onboarding

**Technical Details:**
- Backend: `/api/preferences` (GET, profile/avatar, teams, leagues, venues, saved-matches)
- User model: preferences, profile
- Frontend: AccountScreen, preferences management

### 13. Feedback
**Priority**: Low  
**Status**: Implemented

**Requirements:**
- Submit user feedback (message, type: general/bug/feature/rating)
- Feedback stored with user info
- Metadata support

**Technical Details:**
- Backend: `/api/feedback` (POST)
- Feedback model
- Frontend: FeedbackScreen (from AccountScreen)

### 14. Cost Tracking
**Priority**: Low  
**Status**: Partially Implemented

**Requirements:**
- Track route cost history (origin–destination)
- Historical price data from flight searches
- Route cost history API
- Backend auto-updates on flight search

**Technical Details:**
- Backend: `/api/transportation/routes/cost-history`
- RouteCostHistory model
- TransportationService updates history on search
- Frontend: No dedicated UI yet (API ready)

### 15. Subscription & Tier Access
**Priority**: Medium  
**Status**: Implemented (backend)

**Requirements:**
- Subscription tiers: freemium, pro, planner
- Tier-based league access (TierAccess model)
- User subscription in User model

**Technical Details:**
- Backend: subscriptionService, TierAccess model
- User.subscription: tier, startDate, endDate, isActive

### 16. Admin
**Priority**: Low  
**Status**: Implemented

**Requirements:**
- Admin authentication (adminAuth middleware)
- Clear application cache
- Unmapped teams tracking
- Feedback management

**Technical Details:**
- Backend: `/api/admin/*` (clear-cache, unmapped-teams, etc.)

### 17. Natural Language & Chat Search
**Priority**: Medium  
**Status**: Implemented (feature-flagged)

**Requirements:**
- Chat-style natural language match search
- Search examples and suggestions
- Format results as match cards

**Technical Details:**
- Frontend: MessagesScreen (enableMessagesTab flag)
- naturalLanguageService
- Uses /api/search and match search APIs

### 18. Unified Search
**Priority**: Medium  
**Status**: Implemented (feature-flagged)

**Requirements:**
- Search leagues, teams, venues in one interface
- Recent searches
- Suggested items
- Favorite management (leagues, teams, venues)

**Technical Details:**
- Backend: `/api/search/unified`
- Frontend: UnifiedSearchScreen (enableUnifiedSearchTab flag)

## Planned Features

### 19. Train Search
**Priority**: Medium  
**Status**: Planned

**Requirements:**
- Search trains between match destinations
- Date/time constraints based on match schedule
- Show travel time and arrival relative to match time
- Integration with trip itinerary view
- Within-trip travel planning

**Technical Details:**
- Backend: Rail directions placeholder exists; train API not integrated
- TransportationService.searchTrains() throws "not yet implemented"

### 20. Date Flexibility Suggestions
**Priority**: Low  
**Status**: Planned

**Requirements:**
- Analyze user's date range + destination
- Check match availability for shifted dates (±1, ±7, ±14 days)
- Present recommendations with context
- Non-intrusive UI (banner, card, or modal)

**Technical Details:**
- Backend: Date shift analysis service
- Frontend: Date flexibility banner component

### 21. Notifications
**Priority**: Medium  
**Status**: Planned

**Requirements:**
- In-app push notifications
- Email notifications
- Match change alerts (date/time changes)
- Match reminders
- Price alerts
- User notification preferences

**Technical Details:**
- Backend: NotificationService, EmailService, PushNotificationService
- Frontend: Notification settings in AccountScreen
- Job scheduler for automated checks

### 22. Cost Analytics UI
**Priority**: Low  
**Status**: Planned

**Requirements:**
- Cost analytics per trip
- Price trend visualization
- User-facing cost history display

**Technical Details:**
- Backend: Route cost history API exists
- Frontend: Cost analytics components to be built

## Feature Flags

| Flag | Description | Default |
|------|-------------|---------|
| enableUnifiedSearchTab | Unified search tab in bottom navigation | false |
| enableMessagesTab | Messages/chat tab in bottom navigation | false |
| enableMapHomeScreen | Map-based home screen with location-based matches | true |

## Technical Requirements

### Backend
- Node.js with Express
- MongoDB database
- JWT authentication
- API-Sports integration for match data
- OpenAI integration for natural language processing
- Cloudinary for image storage
- Amadeus API for flight data
- Google Maps API for directions
- LocationIQ for location autocomplete
- SendGrid for email (planned)

### Frontend
- React Native with Expo
- React Navigation
- Context API for state management (AuthContext, ItineraryContext, FilterContext)
- Mapbox for maps (@rnmapbox/maps)
- Design tokens for consistent styling
- Testing with Jest and React Native Testing Library
- Bottom sheet (gorhom/bottom-sheet)

### Infrastructure
- Railway deployment
- Environment variable management
- CI/CD pipeline (GitHub Actions)
- Error tracking (Sentry)
- Security best practices (Helmet, rate limiting, CORS)

## Non-Functional Requirements

### Performance
- API response time < 2 seconds
- Map rendering < 1 second
- Image loading optimization
- Caching for frequently accessed data (matches, recommendations, travel times)

### Security
- Secure password storage
- JWT token expiration
- Rate limiting on API endpoints
- Input validation and sanitization
- HTTPS only

### Usability
- Intuitive navigation
- Consistent design system
- Accessibility support
- Offline capability (planned)

### Scalability
- Database indexing
- API rate limiting
- Caching strategy
- Modular architecture

## Version Requirements

All package versions must be pinned (no `^` or `~`). See `CONVENTIONS.md` for version pinning policy.

## References

- Detailed architecture: `ARCHITECTURE.md`
- User stories: `USER_STORIES.md`
- Coding conventions: `CONVENTIONS.md`
- Technical specs: `ai_agents/PHASE1_TECHNICAL_SPECS.md`
- Flight/Train architecture: `ai_agents/FLIGHT_TRAIN_SEARCH_ARCHITECTURE.md`
