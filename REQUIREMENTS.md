# Requirements

This document consolidates all feature requirements for the Flight Match Finder application.

## Core Features

### 1. Match Search
**Priority**: High  
**Status**: Implemented

**Requirements:**
- Search matches by team (home/away/any)
- Search by date range
- Search by location with distance radius
- Search by league
- Natural language search support
- Multi-query search (primary match + secondary matches with different criteria)
- Filter by match type (home/away)
- Real-time match data from API-Sports

**Technical Details:**
- Backend: `/api/matches/search` endpoint
- Natural language parsing via OpenAI
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
- Edit trip details
- Delete trips
- Save matches to trips
- Trip sharing functionality
- Trip countdown widget
- Map view of trip matches

**Technical Details:**
- Backend: `/api/trips/*` endpoints
- Frontend: ItineraryContext for state management
- Trip data stored in User model

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

**Technical Details:**
- Backend: `/api/recommendations/*` endpoints
- RecommendationService with weighted scoring
- Configurable recommendation weights

### 5. Map Integration
**Priority**: High  
**Status**: Implemented

**Requirements:**
- Map view of search results
- Map view of trip itinerary
- Map view of memories
- Venue location markers
- Map search functionality
- Consistent map provider (Mapbox) across all views

**Technical Details:**
- Frontend: Mapbox integration via @rnmapbox/maps
- MapResultsScreen, ItineraryMapScreen, MemoriesMapScreen
- Venue coordinates stored in database

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
- FilterModal component
- FilterChip components for display

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
- Backend: `/api/attendance/*` endpoints
- Frontend: AttendedMatchesScreen

## Planned Features

### 9. Flight Search
**Priority**: Medium  
**Status**: Planned

**Requirements:**
- Search flights by origin → destination
- Date range selection
- Price comparison across dates
- Best time/price recommendations
- Integration with trip creation flow
- External API integration (Amadeus)

**Technical Details:**
- Backend: Amadeus API integration
- Frontend: FlightSearchTab component
- AddFlightModal for trip integration

### 10. Train Search
**Priority**: Medium  
**Status**: Planned

**Requirements:**
- Search trains between match destinations
- Date/time constraints based on match schedule
- Show travel time and arrival relative to match time
- Integration with trip itinerary view
- Within-trip travel planning

**Technical Details:**
- Backend: Train API integration
- Frontend: TrainSearchScreen component
- Integration with TripOverviewScreen

### 11. Date Flexibility Suggestions
**Priority**: Low  
**Status**: Planned

**Requirements:**
- Analyze user's date range + destination
- Check match availability for shifted dates (±1, ±7, ±14 days)
- Present recommendations with context:
  - "Shifting by +7 days would add 3 more matches"
  - "Shifting by -14 days would save $200 on flights"
- Non-intrusive UI (banner, card, or modal)

**Technical Details:**
- Backend: Date shift analysis service
- Frontend: Date flexibility banner component

### 12. Home Base Management
**Priority**: Low  
**Status**: Planned

**Requirements:**
- Add home base locations for trips
- Date range for each home base
- Calculate travel times from home base to matches
- Multiple home bases per trip
- Automatic home base selection based on match dates

**Technical Details:**
- Backend: Home base storage in trip model
- Frontend: HomeBaseManager, HomeBaseSelector components
- Travel time calculation service

### 13. Inter-Match Travel
**Priority**: Low  
**Status**: Planned

**Requirements:**
- Show flight/train options between match destinations
- Consider airport-to-venue travel time
- Show flight duration + ground transport time
- Integration with trip itinerary

**Technical Details:**
- Backend: Inter-match travel calculation
- Frontend: TravelTimeDisplay component

### 14. Notifications
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

### 15. Cost Tracking
**Priority**: Low  
**Status**: Planned

**Requirements:**
- Track average costs by route
- Historical cost data
- Cost analytics per trip
- Price trend visualization

**Technical Details:**
- Backend: RouteCostHistory model
- Frontend: Cost analytics components

## Technical Requirements

### Backend
- Node.js with Express
- MongoDB database
- JWT authentication
- API-Sports integration for match data
- OpenAI integration for natural language processing
- Cloudinary for image storage
- SendGrid for email
- Amadeus API for flight data (planned)

### Frontend
- React Native with Expo
- React Navigation
- Context API for state management
- Mapbox for maps
- Design tokens for consistent styling
- Testing with Jest and React Native Testing Library

### Infrastructure
- Railway deployment
- Environment variable management
- CI/CD pipeline
- Error tracking (Sentry)
- Security best practices

## Non-Functional Requirements

### Performance
- API response time < 2 seconds
- Map rendering < 1 second
- Image loading optimization
- Caching for frequently accessed data

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


