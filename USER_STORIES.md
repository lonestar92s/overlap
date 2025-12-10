# User Stories

This document consolidates all user stories for the Flight Match Finder application.

## Core User Stories

### Match Search

**US-001: Search Matches by Team**
- **As a** user
- **I want to** search for matches by team name
- **So that** I can find matches for my favorite teams
- **Acceptance Criteria:**
  - Can search by home team
  - Can search by away team
  - Can search by any team
  - Results show team names and logos
  - Results include match date, time, venue, and league

**US-002: Search Matches by Date Range**
- **As a** user
- **I want to** search for matches within a date range
- **So that** I can plan trips around specific dates
- **Acceptance Criteria:**
  - Can select start and end dates
  - Results filtered to date range
  - Date picker is intuitive and accessible

**US-003: Search Matches by Location**
- **As a** user
- **I want to** search for matches near a location
- **So that** I can find matches when traveling
- **Acceptance Criteria:**
  - Can search by city name
  - Can specify distance radius
  - Results show matches within radius
  - Map view shows match locations

**US-004: Natural Language Search**
- **As a** user
- **I want to** search using natural language
- **So that** I can express complex search criteria easily
- **Acceptance Criteria:**
  - Can type queries like "Arsenal matches in London next month"
  - System understands team names, locations, dates
  - Results match query intent
  - Suggestions provided for unclear queries

**US-005: Multi-Query Search**
- **As a** user
- **I want to** search for a primary match plus additional matches
- **So that** I can plan multi-match trips efficiently
- **Acceptance Criteria:**
  - Can specify primary match (e.g., "Bayern Munich home")
  - Can request additional matches with different criteria
  - Can specify count (e.g., "2 other matches")
  - Can specify distance from primary match
  - Can specify different leagues for secondary matches

### Authentication

**US-006: User Registration**
- **As a** new user
- **I want to** create an account
- **So that** I can save trips and preferences
- **Acceptance Criteria:**
  - Can register with email and password
  - Password requirements are clear
  - Email validation
  - Success message on registration
  - Auto-login after registration

**US-007: User Login**
- **As a** registered user
- **I want to** log in to my account
- **So that** I can access my saved trips
- **Acceptance Criteria:**
  - Can log in with email and password
  - Error messages for invalid credentials
  - Remember me functionality
  - Secure token storage

**US-008: Password Reset**
- **As a** user
- **I want to** reset my password
- **So that** I can regain access if I forget it
- **Acceptance Criteria:**
  - Can request password reset via email
  - Reset link expires after set time
  - Can set new password
  - Confirmation message on success

### Trip Management

**US-009: Create Trip**
- **As a** user
- **I want to** create a trip with multiple matches
- **So that** I can plan my football travel itinerary
- **Acceptance Criteria:**
  - Can add matches to trip
  - Can name the trip
  - Can set trip dates
  - Can view trip overview
  - Trip saved to my account

**US-010: View Trip Overview**
- **As a** user
- **I want to** view my trip details
- **So that** I can see my planned itinerary
- **Acceptance Criteria:**
  - See all matches in trip
  - See match dates and times
  - See venues and locations
  - See trip on map
  - Can edit or delete trip

**US-011: Edit Trip**
- **As a** user
- **I want to** edit my trip
- **So that** I can update my itinerary
- **Acceptance Criteria:**
  - Can add matches to trip
  - Can remove matches from trip
  - Can change trip name
  - Can update trip dates
  - Changes saved automatically

**US-012: Share Trip**
- **As a** user
- **I want to** share my trip
- **So that** I can show friends my itinerary
- **Acceptance Criteria:**
  - Can generate shareable link
  - Link shows trip details
  - Can share via messaging apps
  - Shared view is read-only

### Recommendations

**US-013: Get Match Recommendations**
- **As a** user
- **I want to** receive personalized match recommendations
- **So that** I can discover matches I might like
- **Acceptance Criteria:**
  - Recommendations based on my preferences
  - Recommendations consider my trip dates
  - Can see why matches were recommended
  - Can save recommended matches to trip

**US-014: Set Preferences**
- **As a** user
- **I want to** set my favorite teams and leagues
- **So that** I get better recommendations
- **Acceptance Criteria:**
  - Can add favorite teams
  - Can add favorite leagues
  - Can add favorite venues
  - Preferences affect recommendations
  - Can update preferences anytime

### Map Features

**US-015: View Matches on Map**
- **As a** user
- **I want to** see matches on a map
- **So that** I can understand geographic distribution
- **Acceptance Criteria:**
  - Map shows match locations
  - Can tap markers for match details
  - Map is interactive and responsive
  - Consistent map provider across all views

**US-016: Map Search**
- **As a** user
- **I want to** search for matches on a map
- **So that** I can find matches in specific areas
- **Acceptance Criteria:**
  - Can search by location on map
  - Can set search radius
  - Results show on map
  - Can filter results

### Memories

**US-017: Save Match Memory**
- **As a** user
- **I want to** save memories from matches I attended
- **So that** I can remember my experiences
- **Acceptance Criteria:**
  - Can add memory for attended match
  - Can add photos to memory
  - Can add notes
  - Can view memories later
  - Memories linked to match

**US-018: View Memories**
- **As a** user
- **I want to** view my saved memories
- **So that** I can relive my match experiences
- **Acceptance Criteria:**
  - Can see list of all memories
  - Can see memories on map
  - Can view memory details
  - Can edit or delete memories

### Filtering

**US-019: Filter Search Results**
- **As a** user
- **I want to** filter search results
- **So that** I can narrow down matches
- **Acceptance Criteria:**
  - Can filter by league
  - Can filter by team
  - Can filter by date range
  - Can filter by location
  - Active filters shown as chips
  - Can clear all filters

## Planned User Stories

### Flight Search

**US-020: Search Flights**
- **As a** user
- **I want to** search for flights
- **So that** I can find the best time or price for a route
- **Acceptance Criteria:**
  - Can search by origin and destination
  - Can select date range
  - Can see price comparison
  - Can see best time/price recommendations
  - Can add flight to trip

**US-021: Date Flexibility Suggestions**
- **As a** user
- **If I have** a date range and destination in mind
- **I should be told** if I can shift my dates by ±1, ±7, ±14 days
- **So that** I can see more matches or save money
- **Acceptance Criteria:**
  - Suggestions show match count changes
  - Suggestions show price differences
  - Can apply suggested date shifts
  - Non-intrusive UI

### Train Search

**US-022: Search Trains Between Matches**
- **As a** user
- **I want to** search for trains between match destinations
- **So that** I can plan travel within my trip
- **Acceptance Criteria:**
  - Can search trains between matches
  - Results consider match schedule
  - Shows travel time and arrival time
  - Can add train to trip itinerary

### Home Base

**US-023: Add Home Base**
- **As a** user
- **I want to** add a home base for my trip
- **So that** I can see travel times from my accommodation
- **Acceptance Criteria:**
  - Can add home base location
  - Can set date range for home base
  - Can add multiple home bases
  - Travel times calculated automatically

### Notifications

**US-024: Receive Match Change Notifications**
- **As a** user
- **I want to** receive notifications when saved matches change
- **So that** I can adjust my plans
- **Acceptance Criteria:**
  - Notified of date changes
  - Notified of time changes
  - Can choose notification preferences
  - Can receive in-app and email notifications

## User Story Format

All user stories follow this format:
- **As a** [user type]
- **I want to** [action]
- **So that** [benefit]

With acceptance criteria that define when the story is complete.

## References

- Requirements: `REQUIREMENTS.md`
- Architecture: `ARCHITECTURE.md`
- Wireframes: `ai_agents/WIREFRAMES.md`


