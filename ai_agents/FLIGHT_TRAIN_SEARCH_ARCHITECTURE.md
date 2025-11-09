# Flight & Train Search Architecture Plan

**Date**: 2025-01-31  
**Role**: Senior React Native Architect  
**Focus**: Structure, Scalability, Performance, Integration Points

---

## Executive Summary

This document outlines the architectural plan for integrating flight and train search capabilities into the existing match-finding mobile application. The features are designed to:

1. **Flight Search**: Help users find flights for routes with best time/price optimization
2. **Date Flexibility Suggestions**: Intelligent date shifting recommendations (±1, ±7, ±14 days)
3. **Train Search**: Within-trip travel planning when users are already on a trip
4. **Inter-Match Travel**: Flight/train options between match destinations
5. **Cost Tracking**: Average cost analytics by route

**Key Principles**:
- ✅ Incremental, PR-sized implementations
- ✅ Reuse existing architecture patterns (Context API, service layer)
- ✅ Maintain separation of concerns
- ✅ Performance-first (caching, lazy loading)
- ✅ Scalable backend design

---

## Feature Requirements Analysis

### 1. Flight Search (Pre-Trip Planning)

**User Story**: "As a user, I want to search for flights, so that I can find the best time or price for a specific route."

**Key Requirements**:
- Search by origin → destination
- Date range selection
- Price comparison across dates
- Best time/price recommendations
- Integration with existing trip/itinerary system

**Context**: 
- **When**: Before trip starts (pre-trip planning)
- **Where**: Standalone search screen OR integrated into trip creation flow
- **Data Source**: External flight API (Amadeus, Skyscanner, etc.)

---

### 2. Date Flexibility Suggestions

**User Story**: "As a user, if I have a date range and destination in mind, I should be told if I can shift my dates by ±1, ±7, ±14 to see more matches or different matches."

**Key Requirements**:
- Analyze user's date range + destination
- Check match availability for shifted dates (±1, ±7, ±14 days)
- Present recommendations with context:
  - "Shifting by +7 days would add 3 more matches"
  - "Shifting by -14 days would save $200 on flights"
- Non-intrusive UI (banner, card, or modal)

**Context**:
- **When**: During search or trip creation
- **Trigger**: User selects date range + destination
- **Integration**: Needs access to match search results

---

### 3. Train Search (Within-Trip)

**User Story**: "Trains will be more specific for once a user is already on the trip."

**Key Requirements**:
- Search trains between match destinations
- Date/time constraints based on match schedule
- Show travel time and arrival relative to match time
- Integration with trip itinerary view

**Context**:
- **When**: User is viewing/editing an active trip
- **Where**: Within `TripOverviewScreen` or dedicated inter-match travel screen
- **Data Source**: Train API (Rail Europe, national rail APIs, etc.)

---

### 4. Flight Search Between Match Destinations

**User Story**: "Same can be said for flights between match destinations as well."

**Key Requirements**:
- Similar to train search but for flights
- Useful for longer distances (e.g., Madrid → London)
- Consider airport-to-venue travel time
- Show flight duration + ground transport time

**Context**:
- **When**: User is on an active trip
- **Where**: Within trip itinerary, between match locations
- **Use Case**: Multi-city trips spanning countries/regions

---

### 5. Average Cost Tracking

**User Story**: "Average cost of flight or train based on route."

**Key Requirements**:
- Track historical flight/train prices per route
- Display average cost in search results
- Show price trends (e.g., "Typically $450, currently $520")
- Help users understand if prices are high/low

**Context**:
- **When**: During search results display
- **Data**: Aggregated from past searches/user bookings
- **Storage**: Backend database (aggregated, not per-user)

---

### 6. Home Base Management

**User Story**: "As a user, I want to set my home base(s) for a trip, so that I can understand how long it will take to get from my accommodation to match venues."

**Key Requirements**:
- Support multiple home bases per trip (multi-city trips or multiple accommodations)
- Home base can be:
  - A city (general location)
  - A specific hotel/Airbnb (with address)
  - Multiple locations (e.g., "Staying in London Jan 15-18, Madrid Jan 19-22")
- Calculate travel time from home base to match venues
- Display travel time in match cards/itinerary
- Suggest optimal home base locations based on matches
- Integration with transportation search (trains/taxis/buses from home base)

**Context**:
- **When**: During trip creation or trip editing
- **Where**: Trip settings, trip overview screen
- **Use Case**: "I'm staying at Hotel X in London. How long to get to Emirates Stadium?"
- **Data Source**: Geocoding API (LocationIQ, Google Maps) for addresses, travel time APIs

**Example Use Cases**:
1. **Single Home Base**: User staying at one hotel for entire trip
   - Calculate travel time to all matches
   - Show "15 min by tube" or "30 min by taxi" for each match

2. **Multi-City Trip**: User staying in different cities
   - "London Jan 15-18" → Matches in London use London home base
   - "Madrid Jan 19-22" → Matches in Madrid use Madrid home base

3. **Multiple Accommodations**: User switching hotels mid-trip
   - "Hotel A Jan 15-17" → Matches on these dates use Hotel A
   - "Hotel B Jan 18-20" → Matches on these dates use Hotel B

---

## Architecture Overview

### High-Level System Design

```
┌─────────────────────────────────────────────────────────────┐
│                    Mobile App (React Native)                 │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │  FlightSearch    │  │  TrainSearch      │                 │
│  │  Screen          │  │  Screen           │                 │
│  └────────┬─────────┘  └────────┬──────────┘                 │
│           │                    │                              │
│  ┌────────▼────────────────────▼──────────┐                │
│  │  TransportationContext (NEW)            │                │
│  │  - Flight search state                  │                │
│  │  - Train search state                   │                │
│  │  - Cost tracking                        │                │
│  └────────┬────────────────────────────────┘                │
│           │                                                  │
│  ┌────────▼────────┐  ┌──────────────────┐                  │
│  │  ApiService     │  │  DateFlexibility │                  │
│  │  (extended)     │  │  Service         │                  │
│  └────────┬────────┘  └──────────────────┘                  │
└───────────┼──────────────────────────────────────────────────┘
            │
            │ HTTP/HTTPS
            │
┌───────────▼──────────────────────────────────────────────────┐
│                   Backend API (Express)                       │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐  ┌──────────────────┐                  │
│  │  /api/flights    │  │  /api/trains     │                  │
│  │  - search        │  │  - search        │                  │
│  │  - price-history │  │  - price-history │                  │
│  └────────┬─────────┘  └────────┬─────────┘                  │
│           │                      │                             │
│  ┌────────▼──────────────────────▼──────────┐               │
│  │  TransportationService                     │               │
│  │  - Flight API integration                  │               │
│  │  - Train API integration                   │               │
│  │  - Cost aggregation                        │               │
│  └────────┬──────────────────────────────────┘               │
│           │                                                  │
│  ┌────────▼──────────────────────────────────┐              │
│  │  External APIs                             │              │
│  │  - Amadeus / Skyscanner (Flights)          │              │
│  │  - Rail Europe / National APIs (Trains)    │              │
│  └───────────────────────────────────────────┘              │
│                                                               │
│  ┌──────────────────────────────────────────┐                │
│  │  MongoDB                                  │                │
│  │  - RouteCostHistory collection            │                │
│  │  - UserSearchHistory (optional)          │                │
│  └──────────────────────────────────────────┘                │
└───────────────────────────────────────────────────────────────┘
```

---

## Data Models

### Backend: RouteCostHistory Schema

```javascript
// models/RouteCostHistory.js
{
  route: {
    origin: {
      code: String,      // Airport/station code (e.g., "LHR", "MAD")
      city: String,      // City name
      country: String,   // Country code
      coordinates: { lat, lng }
    },
    destination: {
      code: String,
      city: String,
      country: String,
      coordinates: { lat, lng }
    }
  },
  type: String,           // "flight" | "train"
  currency: String,       // ISO currency code (e.g., "USD", "EUR", "GBP")
  statistics: {
    averagePrice: Number,
    minPrice: Number,
    maxPrice: Number,
    sampleCount: Number,  // Number of price points collected
    lastUpdated: Date
  },
  priceHistory: [{
    date: Date,
    price: Number,
    currency: String,     // Currency at time of recording
    source: String        // "user_search" | "api" | "aggregated"
  }],
  // Multi-currency support: store prices in multiple currencies
  priceHistoryMultiCurrency: [{
    date: Date,
    prices: {
      USD: Number,
      EUR: Number,
      GBP: Number
      // ... other currencies as needed
    },
    source: String
  }],
  createdAt: Date,
  updatedAt: Date
}
```

**Multi-Currency Handling**:
- Store prices in original currency + convert to base currency (USD) for aggregation
- Track currency conversion rates at time of recording
- Display prices in user's preferred currency (convert on-the-fly or store multiple currencies)
- When aggregating, normalize to base currency before calculating averages

### Backend: UserTransportationSearch Schema (Optional)

```javascript
// models/UserTransportationSearch.js
{
  userId: ObjectId,
  tripId: ObjectId,      // Optional - link to trip
  type: String,           // "flight" | "train"
  searchParams: {
    origin: { code, city, country },
    destination: { code, city, country },
    dateFrom: Date,
    dateTo: Date
  },
  results: [{
    price: Number,
    date: Date,
    duration: Number,
    provider: String,
    bookingUrl: String
  }],
  selectedOption: ObjectId,  // Which option user selected
  createdAt: Date
}
```

### Backend: Home Base Schema (Trip Model Extension)

**Update to existing Trip model** (`overlap/backend/src/models/User.js`):

```javascript
// Add to trip schema
trips: [{
  // ... existing fields (name, description, matches, etc.)
  
  homeBases: [{
    name: String,           // "Hotel X", "Airbnb in Shoreditch", "London"
    type: String,           // "city" | "hotel" | "airbnb" | "custom"
    address: {
      street: String,       // Optional - full address
      city: String,
      country: String,
      postalCode: String
    },
    coordinates: {
      lat: Number,
      lng: Number
    },
    dateRange: {
      from: Date,           // Start date for this home base
      to: Date              // End date for this home base
    },
    notes: String,          // User notes about this location
    createdAt: Date,
    updatedAt: Date
  }],
  
  // ... rest of trip schema
}]
```

**Note**: Home bases are date-ranged, allowing multiple accommodations over the course of a trip.

---

### Backend: TravelTimeCache Schema (Optional - for performance)

```javascript
// models/TravelTimeCache.js
{
  route: {
    origin: {
      coordinates: { lat: Number, lng: Number },
      address: String  // Optional - for display
    },
    destination: {
      coordinates: { lat: Number, lng: Number },
      address: String
    }
  },
  // Include time-of-day in cache key for accurate caching
  departureTime: {
    hour: Number,        // 0-23
    timeWindow: String   // "morning" | "afternoon" | "evening" | "night"
  },
  travelTimes: {
    walking: {
      duration: Number,     // minutes
      distance: Number,      // meters
      lastCalculated: Date
    },
    driving: {
      duration: Number,
      distance: Number,
      lastCalculated: Date
    },
    transit: {
      duration: Number,
      distance: Number,
      modes: [String],       // ["subway", "bus", "walk"]
      lastCalculated: Date
    },
    cycling: {
      duration: Number,
      distance: Number,
      lastCalculated: Date
    }
  },
  cachedAt: Date,
  expiresAt: Date
}
```

**Purpose**: Cache travel time calculations to avoid repeated API calls for same routes.

**Cache Key Strategy**:
- Cache key includes: `origin.coordinates + destination.coordinates + mode + timeWindow`
- Time windows: morning (6-12), afternoon (12-18), evening (18-22), night (22-6)
- Cache for 24 hours (traffic patterns are similar within same time window)
- If exact time not available, use closest time window

---

## Component Architecture

### New Components (Mobile App)

#### 1. `FlightSearchScreen.js`
**Location**: `screens/FlightSearchScreen.js`

**Responsibilities**:
- Origin/destination input (autocomplete)
- Date range picker
- Search execution
- Results display with price comparison
- Integration with trip creation

**State Management**:
- Use new `TransportationContext` (see below)
- Local UI state (loading, errors)

**Props**:
```javascript
{
  navigation: NavigationProp,
  route?: {
    params?: {
      tripId?: string,      // If searching for existing trip
      origin?: string,       // Pre-filled origin
      destination?: string, // Pre-filled destination
      dateFrom?: Date,      // Pre-filled dates
      dateTo?: Date
    }
  }
}
```

---

#### 2. `TrainSearchScreen.js`
**Location**: `screens/TrainSearchScreen.js`

**Responsibilities**:
- Similar to FlightSearchScreen but for trains
- Show travel time relative to match time
- Filter by arrival time constraints

**Context**: Only accessible when user has an active trip

---

#### 3. `DateFlexibilityBanner.js`
**Location**: `components/DateFlexibilityBanner.js`

**Responsibilities**:
- Display date shift suggestions
- Show match count differences
- Show price savings
- One-tap apply date shifts

**Props**:
```javascript
{
  currentDateRange: { from: Date, to: Date },
  destination: string,
  matchResults: Array,
  onDateShift: (shift: number) => void  // -14, -7, -1, +1, +7, +14
}
```

---

#### 4. `InterMatchTravelCard.js`
**Location**: `components/InterMatchTravelCard.js`

**Responsibilities**:
- Display between two matches in trip itinerary
- Show flight/train options
- Time constraints (arrive before match, leave after previous match)
- Quick booking links

**Props**:
```javascript
{
  fromMatch: Match,
  toMatch: Match,
  onSearch: () => void
}
```

**Integration**: Embedded in `TripOverviewScreen` between match cards

---

#### 5. `HomeBaseManager.js`
**Location**: `components/HomeBaseManager.js`

**Responsibilities**:
- Display list of home bases for a trip
- Add/edit/delete home bases
- Date range selection for each home base
- Address autocomplete (using LocationIQ/Google Maps)
- Show which matches use which home base

**Props**:
```javascript
{
  tripId: string,
  homeBases: Array<HomeBase>,
  matches: Array<Match>,
  onHomeBaseAdded: (homeBase) => void,
  onHomeBaseUpdated: (id, updates) => void,
  onHomeBaseDeleted: (id) => void
}
```

**UI Pattern**:
```
┌─────────────────────────────────┐
│  🏠 Home Bases                   │
│                                 │
│  📍 London (Jan 15-18)          │
│     Hotel X, 123 Main St        │
│     3 matches nearby             │
│     [Edit] [Delete]             │
│                                 │
│  📍 Madrid (Jan 19-22)           │
│     Airbnb in Centro            │
│     2 matches nearby            │
│     [Edit] [Delete]             │
│                                 │
│  [+ Add Home Base]              │
└─────────────────────────────────┘
```

---

#### 6. `HomeBaseSelector.js`
**Location**: `components/HomeBaseSelector.js`

**Responsibilities**:
- Modal/component for adding/editing a home base
- Address input with autocomplete
- Date range picker
- Type selector (city, hotel, Airbnb, custom)
- Map picker for location selection

**Props**:
```javascript
{
  visible: boolean,
  homeBase?: HomeBase,  // Optional - for editing
  tripDateRange: { from: Date, to: Date },
  onSave: (homeBase) => void,
  onCancel: () => void
}
```

---

#### 7. `TravelTimeDisplay.js`
**Location**: `components/TravelTimeDisplay.js`

**Responsibilities**:
- Display travel time from home base to venue
- Show multiple transport options (walking, driving, transit)
- Show distance
- Quick action: "Get directions"

**Props**:
```javascript
{
  from: { coordinates: { lat, lng }, address: string },
  to: { coordinates: { lat, lng }, address: string },
  matchDate: Date,
  matchTime: string,
  travelTimes: {
    walking?: { duration: number, distance: number },
    driving?: { duration: number, distance: number },
    transit?: { duration: number, distance: number }
  },
  onGetDirections: () => void
}
```

**UI Pattern**:
```
┌─────────────────────────────────┐
│  🚶 15 min walk (1.2 km)        │
│  🚗 8 min drive (2.5 km)        │
│  🚇 12 min transit              │
│                                 │
│  [Get Directions]               │
└─────────────────────────────────┘
```

**Integration**: Displayed in `MatchCard` or `TripOverviewScreen` for each match.

---

#### 8. `HomeBaseRecommendation.js`
**Location**: `components/HomeBaseRecommendation.js`

**Responsibilities**:
- Suggest optimal home base locations based on matches
- Show "If you stay here, you'll be X minutes from all matches"
- Calculate centroid of match venues
- Suggest nearby hotels/areas

**Props**:
```javascript
{
  matches: Array<Match>,
  onSelectLocation: (location) => void
}
```

---

### Context Provider Hierarchy

**Location**: `App.js` or root component

**Provider Structure**:
```javascript
<AuthProvider>
  <ItineraryProvider>
    <FilterProvider>
      <TransportationProvider>
        {children}
      </TransportationProvider>
    </FilterProvider>
  </ItineraryProvider>
</AuthProvider>
```

**Context Responsibilities**:
- **ItineraryContext**: Manages trips, matches, and **home bases** (home bases are trip data)
- **TransportationContext**: Manages flight/train search state and travel time caching
- **FilterContext**: Manages match filters (leagues, teams, etc.)

**Note**: Home base CRUD operations are in `ItineraryContext`. `TransportationContext` only handles travel time fetching/caching.

---

### New Context: TransportationContext

**Location**: `contexts/TransportationContext.js`

**Purpose**: Centralized state management for flight/train searches and travel time caching

**State Structure**:
```javascript
{
  // Flight search state
  flightSearch: {
    origin: null,
    destination: null,
    dateFrom: null,
    dateTo: null,
    returnDate: null,
    passengers: 1,
    class: "economy",
    filters: {
      maxStops: null,
      maxPrice: null,
      airlines: []
    },
    results: [],
    pagination: {
      page: 1,
      total: 0,
      hasMore: false
    },
    loading: false,
    error: null,
    lastSearchParams: null
  },
  
  // Train search state
  trainSearch: {
    origin: null,
    destination: null,
    date: null,
    time: null,
    arrivalBy: null,
    passengers: 1,
    results: [],
    pagination: {
      page: 1,
      total: 0,
      hasMore: false
    },
    loading: false,
    error: null,
    lastSearchParams: null
  },
  
  // Cost tracking
  routeCosts: {
    // Cached route cost data
    // Format: { "LHR-MAD": { averagePrice: 450, currency: "USD", ... } }
  }
}
```

**Actions**:
- `searchFlights(params)` - Search flights with filters
- `searchTrains(params)` - Search trains
- `getRouteCost(route, currency?)` - Get route cost (with optional currency conversion)
- `clearSearch(type)` - Clear search results
- `setFilters(type, filters)` - Update search filters
- `loadMoreResults(type)` - Pagination support

**Implementation Pattern**: Use `useReducer` (following architecture recommendations)

**Note**: Home base state management is handled in `ItineraryContext` since home bases are part of trip data. `TransportationContext` only handles travel time fetching/caching.

---

## Backend API Design

### Flight Search Endpoint

**Route**: `GET /api/transportation/flights/search`

**Query Parameters**:
```javascript
{
  origin: string,        // Airport code or city
  destination: string,  // Airport code or city
  dateFrom: string,     // ISO date string
  dateTo: string,       // ISO date string (optional for one-way)
  returnDate?: string,  // Optional for round-trip
  passengers?: number,  // Default: 1
  class?: string        // "economy" | "business" | "first"
}
```

**Response**:
```javascript
{
  success: true,
  results: [
    {
      id: string,
      origin: { code, name, city },
      destination: { code, name, city },
      departure: { date, time, airport },
      arrival: { date, time, airport },
      duration: number,  // minutes
      price: {
        currency: string,
        amount: number,
        formatted: string
      },
      airline: { name, logo },
      stops: number,
      bookingUrl: string,
      // Cost context
      averagePrice: number,  // Historical average
      priceDifference: number, // Difference from average
      isGoodDeal: boolean
    }
  ],
  priceRange: {
    min: number,
    max: number,
    average: number
  }
}
```

**Note**: Date flexibility suggestions are provided by a separate endpoint (`/api/transportation/date-flexibility`) to maintain separation of concerns. Frontend can call both endpoints in parallel if needed.

---

### Train Search Endpoint

**Route**: `GET /api/transportation/trains/search`

**Query Parameters**:
```javascript
{
  origin: string,        // Station code or city
  destination: string,  // Station code or city
  date: string,         // ISO date string
  time?: string,        // Preferred departure time (HH:mm)
  arrivalBy?: string,   // Must arrive before this time
  passengers?: number
}
```

**Response**: Similar structure to flights, but with train-specific fields:
- `trainNumber`
- `trainType` (high-speed, regional, etc.)
- `stations` (intermediate stops)

---

### Date Flexibility Endpoint

**Route**: `GET /api/transportation/date-flexibility`

**Query Parameters**:
```javascript
{
  destination: string,  // City or coordinates
  dateFrom: string,
  dateTo: string,
  leagues?: string[],   // Optional: filter by leagues
  teams?: string[]      // Optional: filter by teams
}
```

**Response**:
```javascript
{
  success: true,
  currentMatches: number,
  suggestions: [
    {
      shiftDays: number,      // -14, -7, -1, +1, +7, +14
      newDateRange: {
        from: string,
        to: string
      },
      matchCount: number,
      matchDifference: number, // How many more/less matches
      priceImpact: {
        flightSavings: number,  // Estimated savings
        isSignificant: boolean
      },
      recommendation: string
    }
  ]
}
```

**Implementation**: 
- **Performance Strategy**:
  - Batch match search API calls in parallel (Promise.all) for all 7 date shifts (±1, ±7, ±14 days + current)
  - Implement request queuing to respect rate limits
  - Cache intermediate match search results (15 minutes TTL) to avoid duplicate calls
  - Add timeout (5 seconds per request) with fallback to cached data
  - If some requests fail, return partial results with error indicators
- **Calculation Logic**:
  - Aggregate results from all date shifts
  - Calculate match count differences vs. current date range
  - Estimate price impact by querying route cost history for shifted dates
  - Rank suggestions by: match count increase, price savings, user preferences

---

### Route Cost History Endpoint

**Route**: `GET /api/transportation/route-cost/:origin/:destination`

**Query Parameters**:
```javascript
{
  currency?: string  // Optional - convert to user's preferred currency (default: USD)
}
```

**Response**:
```javascript
{
  success: true,
  route: {
    origin: { code, city },
    destination: { code, city }
  },
  type: "flight" | "train",
  currency: string,  // Currency of returned prices
  statistics: {
    averagePrice: number,
    minPrice: number,
    maxPrice: number,
    sampleCount: number,
    lastUpdated: string
  },
  currentPrice: number,  // If recent search available
  priceTrend: "up" | "down" | "stable",
  // Multi-currency support
  pricesInOtherCurrencies: {
    USD: number,
    EUR: number,
    GBP: number
  }
}
```

---

### Home Base Endpoints

#### Add/Update Home Base

**Route**: `POST /api/trips/:tripId/home-bases`  
**Route**: `PUT /api/trips/:tripId/home-bases/:homeBaseId`

**Request Body**:
```javascript
{
  name: string,              // "Hotel X", "Airbnb in Shoreditch"
  type: string,              // "city" | "hotel" | "airbnb" | "custom"
  address: {
    street: string,          // Optional
    city: string,
    country: string,
    postalCode: string       // Optional
  },
  coordinates: {              // Optional - will geocode if missing
    lat: number,
    lng: number
  },
  dateRange: {
    from: string,            // ISO date string
    to: string               // ISO date string
  },
  notes: string              // Optional
}
```

**Response**:
```javascript
{
  success: true,
  homeBase: {
    _id: string,
    name: string,
    type: string,
    address: { ... },
    coordinates: { lat, lng },
    dateRange: { from, to },
    notes: string,
    createdAt: string,
    updatedAt: string
  }
}
```

**Implementation**:
- **Geocoding**:
  - If coordinates not provided, geocode address using LocationIQ/Google Maps
  - Validate geocoding result (ensure coordinates are valid)
  - If geocoding fails, require user to provide coordinates manually or select from map
- **Date Range Validation**:
  - Home base date range must overlap with trip dates
  - Warn if multiple home bases have overlapping date ranges (but allow - user might have multiple accommodations)
  - Auto-suggest date ranges based on match dates (group matches by date clusters)
- **Type Validation**:
  - `city`: Only city name required
  - `hotel`/`airbnb`: Require at least city + name, prefer full address
  - `custom`: Any format, but coordinates or address required
- **Location Validation**:
  - Validate coordinates are valid (lat: -90 to 90, lng: -180 to 180)
  - Warn if location is very far from all matches (> 50 km) - suggest checking address
  - If no matches yet, skip distance validation

---

#### Delete Home Base

**Route**: `DELETE /api/trips/:tripId/home-bases/:homeBaseId`

**Response**:
```javascript
{
  success: true,
  message: "Home base deleted successfully"
}
```

---

#### Get Travel Times

**Route**: `GET /api/trips/:tripId/travel-times`

**Query Parameters**:
```javascript
{
  matchId?: string,          // Optional - get travel time for specific match
  homeBaseId?: string        // Optional - get travel time from specific home base
}
```

**Response**:
```javascript
{
  success: true,
  travelTimes: [
    {
      matchId: string,
      match: {
        id: string,
        date: string,
        venue: { name, coordinates }
      },
      homeBase: {
        id: string,
        name: string,
        coordinates: { lat, lng }
      },
      routes: [
        {
          mode: "walking" | "driving" | "transit" | "cycling",
          duration: number,      // minutes
          distance: number,      // meters
          directions: string,     // "Head north on Main St..."
          estimatedArrival: string // ISO datetime
        }
      ],
      recommendedRoute: {
        mode: string,
        duration: number,
        reason: string          // "Fastest" | "Most convenient" | "Cheapest"
      }
    }
  ]
}
```

**Implementation**:
- Use Google Maps Directions API or Mapbox Directions API
- Calculate travel times for all matches from applicable home bases
- Cache results in `TravelTimeCache` collection
- Consider match time when recommending routes (e.g., if match is at 8 PM, prefer transit over walking)

---

#### Suggest Home Base Locations

**Route**: `GET /api/trips/:tripId/home-bases/suggestions`

**Response**:
```javascript
{
  success: true,
  suggestions: [
    {
      location: {
        name: string,          // "Central London", "Centro Madrid"
        coordinates: { lat, lng },
        address: string
      },
      score: number,           // 0-100, how optimal this location is
      averageTravelTime: number, // Average minutes to all matches
      maxTravelTime: number,    // Maximum minutes to any match
      matchCount: number,       // How many matches are nearby
      reasoning: string,        // "Centrally located, 15 min avg to all matches"
      nearbyHotels: [           // Optional - if API available
        {
          name: string,
          distance: number,     // meters
          priceRange: string    // "$$" | "$$$"
        }
      ]
    }
  ]
}
```

**Implementation**:
- **Date-Range Aware Logic**:
  - Group matches by date clusters (matches within 3 days of each other)
  - For each date cluster, calculate centroid of match venues
  - Suggest one home base per date cluster (if clusters are far apart)
  - Or suggest one "optimal" home base if all matches are close together (< 50 km radius)
- **Location Optimization**:
  - Find optimal location that minimizes average travel time to matches in cluster
  - Consider city boundaries and major transportation hubs
  - Prefer locations near public transport (metro/subway stations)
  - Avoid suggesting locations > 50 km from any match
- **Hotel Integration**:
  - Optionally integrate with hotel search APIs (Booking.com, Airbnb)
  - Show nearby hotels within 2 km of suggested location
  - Filter by price range if user preference available

---

## Integration Points

### 1. SearchScreen Integration

**Location**: `screens/SearchScreen.js`

**Integration Point**: Add "Find Flights" button when user has:
- Selected destination
- Selected date range
- No matches yet (or matches found)

**UI Pattern**: 
```
┌─────────────────────────────────┐
│  [Search for Matches]           │
│                                 │
│  💡 Found 5 matches              │
│  ✈️ Find flights to Madrid      │  ← NEW
│                                 │
│  [View Results]                 │
└─────────────────────────────────┘
```

**Implementation**:
- Add button that navigates to `FlightSearchScreen` with pre-filled params
- Show flight cost average if available

---

### 2. TripOverviewScreen Integration

**Location**: `screens/TripOverviewScreen.js`

**Integration Point**: Between match cards, show inter-match travel options

**UI Pattern**:
```
┌─────────────────────────────────┐
│  Match 1: Real Madrid vs Barca  │
│  Jan 15, 2025, 8:00 PM          │
└─────────────────────────────────┘
        ↓
┌─────────────────────────────────┐
│  🚄 Travel: Madrid → London     │
│  Options: 2 trains, 1 flight    │
│  [View Options]                  │  ← NEW
└─────────────────────────────────┘
        ↓
┌─────────────────────────────────┐
│  Match 2: Arsenal vs Chelsea    │
│  Jan 18, 2025, 3:00 PM          │
└─────────────────────────────────┘
```

**Implementation**:
- Add `InterMatchTravelCard` between consecutive matches
- **Time Constraint Calculation**:
  - **Minimum Buffer Times**:
    - Same city: 2 hours between matches (account for match duration ~90 min + travel + buffer)
    - Different cities: 4 hours minimum (account for inter-city travel)
    - Overnight: If match ends after 10 PM and next match is before 2 PM next day in different city → suggest overnight accommodation
  - **Travel Window**:
    - Departure: After previous match ends + 30 min buffer
    - Arrival: Before next match starts - 1 hour buffer (to account for venue arrival, security, etc.)
  - **"Too Tight" Warning**:
    - If calculated travel time + buffer exceeds available time → show warning
    - Suggest alternative: "Consider removing one match or adjusting dates"
- Show quick search button with pre-filled constraints

---

### 3. Date Flexibility Banner Integration

**Location**: `screens/SearchScreen.js` (after search results)

**Trigger**: Show when:
- User has date range + destination
- Search returned matches
- Alternative date ranges have different match counts or prices

**UI Pattern**:
```
┌─────────────────────────────────┐
│  💡 Try shifting dates?         │
│                                 │
│  +7 days: +3 matches, -$50     │
│  -7 days: -2 matches, +$100    │
│                                 │
│  [Apply +7 days] [Dismiss]     │
└─────────────────────────────────┘
```

**Implementation**:
- Call `/api/transportation/date-flexibility` after match search
- Display `DateFlexibilityBanner` component
- One-tap apply shifts date range and re-searches

---

### 4. Home Base Integration in TripOverviewScreen

**Location**: `screens/TripOverviewScreen.js`

**Integration Points**:

#### A. Home Base Section in Header
Show current home bases with quick access:

```
┌─────────────────────────────────┐
│  Trip: London Football Tour     │
│  5 matches • 2 home bases        │
│                                 │
│  🏠 London (Jan 15-18)          │
│     Madrid (Jan 19-22)          │
│     [Manage Home Bases]         │  ← NEW
└─────────────────────────────────┘
```

#### B. Travel Time in Match Cards
Display travel time from relevant home base:

```
┌─────────────────────────────────┐
│  Arsenal vs Chelsea             │
│  Jan 18, 2025, 3:00 PM         │
│  Emirates Stadium, London      │
│                                 │
│  🏠 From Hotel X:               │  ← NEW
│     🚶 15 min walk              │
│     🚗 8 min drive              │
│     🚇 12 min transit           │
│                                 │
│  [Get Directions]               │  ← NEW
└─────────────────────────────────┘
```

#### C. Home Base Management Modal
Accessible from trip settings or header button:

```
┌─────────────────────────────────┐
│  Manage Home Bases               │
│                                 │
│  📍 London (Jan 15-18)          │
│     Hotel X, 123 Main St        │
│     3 matches nearby            │
│     [Edit] [Delete]             │
│                                 │
│  📍 Madrid (Jan 19-22)           │
│     Airbnb in Centro            │
│     2 matches nearby            │
│     [Edit] [Delete]             │
│                                 │
│  [+ Add Home Base]              │
│  [💡 Suggest Location]          │  ← NEW
└─────────────────────────────────┘
```

**Implementation**:
- Add home base section to trip header
- Integrate `TravelTimeDisplay` into `MatchCard` component
- Add "Manage Home Bases" button that opens `HomeBaseManager` modal
- Fetch travel times on trip load (lazy load for performance)
- Show loading state while calculating travel times

---

### 5. Home Base in Trip Creation Flow

**Location**: `screens/TripOverviewScreen.js` (when creating new trip)

**Integration Point**: After adding matches, prompt user to add home base:

```
┌─────────────────────────────────┐
│  ✅ Added 5 matches to trip     │
│                                 │
│  💡 Add where you're staying?    │
│  This helps calculate travel    │
│  times to matches.              │
│                                 │
│  [+ Add Home Base]              │
│  [Skip for now]                 │
└─────────────────────────────────┘
```

**Implementation**:
- Show prompt after first match is added
- Allow user to skip (can add later)
- Navigate to `HomeBaseSelector` when "Add Home Base" is pressed

---

## Service Layer Architecture

### TransportationService (Backend)

**Location**: `overlap/backend/src/services/transportationService.js`

**Responsibilities**:
- Flight API integration (Amadeus, Skyscanner, etc.)
- Train API integration (Rail Europe, national APIs)
- Price aggregation and caching
- Route cost history management

**Structure**:
```javascript
class TransportationService {
  // Flight methods
  async searchFlights(params) {
    // 1. Check cache
    // 2. Call external API
    // 3. Enrich with cost history
    // 4. Cache results
    // 5. Update route cost history
  }
  
  // Train methods
  async searchTrains(params) {
    // Similar structure
  }
  
  // Cost tracking
  async getRouteCost(origin, destination, type) {
    // Query RouteCostHistory collection
  }
  
  async updateRouteCost(origin, destination, type, price) {
    // Update/insert into RouteCostHistory
  }
  
  // Date flexibility
  async analyzeDateFlexibility(params) {
    // Call match search for each date shift
    // Aggregate results
    // Calculate recommendations
  }
  
  // Home base travel times
  async calculateTravelTimes(tripId, matchId, homeBaseId) {
    // 1. Get trip, match, and home base data
    // 2. Check cache for existing travel times
    // 3. Call Google Maps/Mapbox Directions API
    // 4. Calculate multiple route options (walking, driving, transit)
    // 5. Cache results
    // 6. Return travel times
  }
  
  async suggestHomeBaseLocations(tripId) {
    // 1. Get all matches in trip
    // 2. Calculate centroid of match venues
    // 3. Find optimal locations (minimize average travel time)
    // 4. Optionally fetch nearby hotels
    // 5. Return suggestions with scores
  }
}
```

**Third-Party API Integration**:
- Use adapter pattern for multiple providers
- Implement fallback chains (primary → secondary API)
- **Error Handling Strategy**:
  - **API Failures**:
    - Network errors: Retry 3 times with exponential backoff (1s, 2s, 4s)
    - Rate limit exceeded: Queue request, return "Service busy, please try again"
    - Invalid API key: Log error, return user-friendly "Service configuration error"
    - API timeout: Return cached data if available, otherwise "Request timed out"
  - **Partial Failures**:
    - If flight search succeeds but train search fails: Return flight results with note "Train search unavailable"
    - If some date shifts fail in date flexibility: Return partial results with error indicators
    - If some travel times fail: Return successful ones, mark failed ones as "Unable to calculate"
  - **Degraded Mode**:
    - If external API completely unavailable: Return cached data with "Last updated: [timestamp]"
    - Show clear indicators when data is stale (> 24 hours old)
    - Allow user to force refresh (bypass cache)
- Rate limiting and error handling (see detailed strategy above)
- Mock data for development (use local JSON files or mock service)

---

## Performance & Scalability Considerations

### 1. Caching Strategy

**Frontend**:
- Cache flight/train search results (1 hour TTL)
- Cache route cost data (24 hour TTL)
- Store in `TransportationContext` or AsyncStorage

**Backend**:
- Cache external API responses (15-30 minutes)
- Cache route cost aggregations (1 hour)
- Use Redis or in-memory cache

**Database**:
- Index `RouteCostHistory` on `route.origin.code` + `route.destination.code`
- Aggregate cost statistics periodically (background job)

---

### 2. API Rate Limiting

**External APIs**:
- **Flight/Train APIs**:
  - Implement request queuing with exponential backoff
  - Batch requests where possible (if API supports)
  - Respect API rate limits (track requests per minute/hour)
  - Queue overflow: If queue exceeds 100 requests, reject new requests with "Service busy" message
- **Google Maps Directions API**:
  - Rate limit: 40 requests/second, 25,000 requests/day (free tier)
  - Use batch requests for multiple routes (up to 25 routes per batch)
  - Implement request queue with priority (user-initiated > background)
  - Fallback strategy: If rate limit exceeded, use cached data or return "Unable to calculate" message
  - Consider Mapbox as alternative (different rate limits: 600 requests/minute)
- **Geocoding APIs**:
  - Cache geocoding results indefinitely (addresses don't change)
  - Batch geocode requests when possible

**Internal APIs**:
- Rate limit `/api/transportation/*` endpoints:
  - 10 requests/minute per user (prevents abuse)
  - 100 requests/hour per user (hard limit)
  - Exempt authenticated users from some limits
- Prevent abuse of expensive external API calls:
  - Track API costs per user
  - Implement daily/monthly limits per user
  - Show usage warnings if approaching limits

---

### 3. Lazy Loading

**Mobile App**:
- Load flight/train options on-demand (when user expands inter-match travel card)
- Don't pre-fetch all inter-match options for large trips
- Use pagination for search results

---

### 4. Data Aggregation

**Route Cost History**:
- Aggregate prices daily/weekly (background job)
- Store rolling averages (last 30/90 days)
- Prune old price history data (>1 year)

---

## Incremental Implementation Plan

### Phase 1: Foundation (Week 1-2)

**Goal**: Set up basic infrastructure

1. **Backend**:
   - Create `TransportationService` skeleton
   - Create `RouteCostHistory` model
   - Set up `/api/transportation` routes (empty implementations)
   - Add environment variables for flight/train API keys

2. **Mobile App**:
   - Create `TransportationContext` with `useReducer`
   - Create `FlightSearchScreen` (UI only, no API calls)
   - Add navigation route for flight search

**Deliverable**: PR #1 - Infrastructure setup

---

### Phase 2: Flight Search - Basic (Week 3-4)

**Goal**: Implement basic flight search

1. **Backend**:
   - Integrate flight API (start with one provider, e.g., Amadeus)
   - Implement `/api/transportation/flights/search`
   - Add error handling and rate limiting
   - Basic caching

2. **Mobile App**:
   - Connect `FlightSearchScreen` to API
   - Display search results
   - Add loading/error states
   - Extend existing `ApiService` class with new methods (don't create separate service)
   - Add methods: `searchFlights()`, `searchTrains()`, `getRouteCost()`

**Deliverable**: PR #2 - Basic flight search

---

### Phase 3: Cost Tracking (Week 5)

**Goal**: Add route cost history

1. **Backend**:
   - Implement route cost aggregation
   - Update cost history on each search
   - Implement `/api/transportation/route-cost/:origin/:destination`
   - Background job for cost aggregation

2. **Mobile App**:
   - Display average prices in search results
   - Show "Good Deal" badges
   - Add cost context to flight cards

**Deliverable**: PR #3 - Cost tracking

---

### Phase 4: Date Flexibility (Week 6)

**Goal**: Implement date shift suggestions

1. **Backend**:
   - Implement `/api/transportation/date-flexibility`
   - Integrate with match search API
   - Calculate match count differences
   - Estimate price impacts

2. **Mobile App**:
   - Create `DateFlexibilityBanner` component
   - Integrate into `SearchScreen`
   - Add one-tap date shift application

**Deliverable**: PR #4 - Date flexibility

---

### Phase 5: Train Search (Week 7-8)

**Goal**: Implement train search for within-trip travel

1. **Backend**:
   - Integrate train API
   - Implement `/api/transportation/trains/search`
   - Add train-specific filtering (arrival time constraints)

2. **Mobile App**:
   - Create `TrainSearchScreen`
   - **Access Control**: Only accessible when user has an active trip (check `ItineraryContext`)
   - Integrate into `TripOverviewScreen`
   - Add inter-match travel cards
   - **Entry Points**:
     - Flight search: Available always (standalone screen or trip-integrated)
     - Train search: Only within trip context (from `TripOverviewScreen` or inter-match travel card)

**Deliverable**: PR #5 - Train search

---

### Phase 6: Inter-Match Travel (Week 9)

**Goal**: Show travel options between matches

1. **Backend**:
   - Add endpoint for inter-match travel search
   - Calculate time constraints automatically

2. **Mobile App**:
   - Create `InterMatchTravelCard` component
   - Integrate into `TripOverviewScreen`
   - Show flight and train options side-by-side

**Deliverable**: PR #6 - Inter-match travel

---

### Phase 7: Home Base Management (Week 10-11)

**Goal**: Implement home base feature for trip planning

1. **Backend**:
   - Update Trip model to include `homeBases` array
   - Implement `/api/trips/:id/home-bases` endpoints (CRUD)
   - Implement `/api/trips/:id/travel-times` endpoint
   - Integrate Google Maps/Mapbox Directions API
   - Create `TravelTimeCache` model for performance (with time-of-day support)
   - Implement geocoding for addresses
   - Add validation rules (type validation, date range validation, location validation)

2. **Mobile App**:
   - **State Management**: Add home base methods to `ItineraryContext`:
     - `addHomeBase(tripId, homeBase)`
     - `updateHomeBase(tripId, homeBaseId, updates)`
     - `deleteHomeBase(tripId, homeBaseId)`
     - `getHomeBasesForTrip(tripId)`
   - Create `HomeBaseManager` component
   - Create `HomeBaseSelector` component
   - Create `TravelTimeDisplay` component
   - Integrate into `TripOverviewScreen`
   - Add travel time display to `MatchCard`
   - Add "Manage Home Bases" UI
   - Handle edge cases: no home base for date, missing coordinates, API failures

**Deliverable**: PR #7 - Home base management

---

### Phase 8: Home Base Recommendations (Week 12)

**Goal**: Suggest optimal home base locations

1. **Backend**:
   - Implement `/api/trips/:id/home-bases/suggestions`
   - Calculate centroid of match venues
   - Find optimal locations (minimize travel time)
   - Optionally integrate hotel search APIs

2. **Mobile App**:
   - Create `HomeBaseRecommendation` component
   - Add suggestion UI to home base manager
   - Show reasoning for recommendations

**Deliverable**: PR #8 - Home base recommendations

---

### Phase 9: Polish & Optimization (Week 13)

**Goal**: Performance optimization and UX improvements

1. **Performance**:
   - Implement caching strategies for travel times
   - Add request debouncing
   - Optimize API calls
   - Batch travel time calculations

2. **UX**:
   - Add loading skeletons
   - Improve error messages
   - Add empty states
   - Add analytics tracking
   - Optimize map rendering

**Deliverable**: PR #9 - Polish & optimization

---

## Third-Party API Considerations

### Flight APIs

**Options**:
1. **Amadeus** (Recommended)
   - Pros: Comprehensive, good documentation, free tier
   - Cons: Rate limits on free tier
   - Pricing: Free tier → Paid tiers

2. **Skyscanner**
   - Pros: Aggregates multiple providers
   - Cons: Requires affiliate partnership
   - Pricing: Revenue share model

3. **Kiwi.com**
   - Pros: Good for budget airlines
   - Cons: Less comprehensive than Amadeus

**Recommendation**: Start with Amadeus, add Skyscanner as fallback

---

### Train APIs

**Options**:
1. **Rail Europe API**
   - Pros: Covers major European routes
   - Cons: Limited to Europe
   - Pricing: Contact for pricing

2. **National Rail APIs** (UK, Germany, etc.)
   - Pros: Free/public APIs
   - Cons: Country-specific, need multiple integrations

3. **Trainline API**
   - Pros: European coverage
   - Cons: Requires partnership

**Recommendation**: Start with Rail Europe for Europe, add national APIs incrementally

---

### Implementation Strategy

**Adapter Pattern**:
```javascript
// services/transportationService.js
class TransportationService {
  constructor() {
    this.flightProviders = [
      new AmadeusProvider(),
      new SkyscannerProvider() // Fallback
    ];
    
    this.trainProviders = [
      new RailEuropeProvider(),
      new NationalRailProvider()
    ];
  }
  
  async searchFlights(params) {
    for (const provider of this.flightProviders) {
      try {
        return await provider.search(params);
      } catch (error) {
        console.error(`${provider.name} failed:`, error);
        continue; // Try next provider
      }
    }
    throw new Error('All flight providers failed');
  }
}
```

---

## Security Considerations

### API Keys

**Backend Only**:
- Never expose flight/train API keys to mobile app
- Store keys in environment variables
- Use different keys for dev/prod

**Environment Variables**:
```bash
# Backend .env
AMADEUS_API_KEY=xxx
AMADEUS_API_SECRET=xxx
RAIL_EUROPE_API_KEY=xxx
```

---

### User Data Privacy

**Search History**:
- Optional: Store user search history (with consent)
- Allow users to opt-out
- Clear history on account deletion

**Booking Links**:
- External booking URLs should open in browser
- Use secure redirects
- Don't store booking credentials

---

## Testing Strategy

### Unit Tests

**Backend**:
- `TransportationService` methods
- Route cost aggregation logic
- Date flexibility calculations

**Mobile App**:
- `TransportationContext` reducer
- Date shift calculations
- Component rendering

---

### Integration Tests

**Backend**:
- Flight API integration (mock external API)
- Train API integration
- End-to-end search flow

**Mobile App**:
- Search flow (flight/train)
- Date flexibility banner
- Inter-match travel cards

---

### Manual Testing Checklist

- [ ] Flight search with valid params
- [ ] Flight search with invalid params (error handling)
- [ ] Date flexibility suggestions
- [ ] Train search from trip itinerary
- [ ] Inter-match travel display
- [ ] Cost tracking accuracy
- [ ] **Home base CRUD operations**
- [ ] **Travel time calculation accuracy**
- [ ] **Home base date range validation**
- [ ] **Multiple home bases per trip**
- [ ] **Travel time display in match cards**
- [ ] **Home base suggestions**
- [ ] Caching behavior
- [ ] Offline/network error handling

---

## Success Metrics

### Performance
- Flight search response time: < 3 seconds
- Train search response time: < 2 seconds
- Date flexibility calculation: < 5 seconds
- Cache hit rate: > 60%

### User Engagement
- % of users who use flight search after match search
- % of users who apply date flexibility suggestions
- % of users who view inter-match travel options
- **% of trips with home bases configured**
- **% of users who use travel time information**
- **Average number of home bases per multi-city trip**

### Business
- Cost per API call (track external API usage)
- Conversion rate (searches → bookings, if applicable)

---

## Open Questions & Decisions Needed

1. **Booking Integration**:
   - Direct booking vs. redirect to external sites?
   - Affiliate partnerships?

2. **Pricing**:
   - How to handle API costs?
   - Free tier limits?
   - Premium features?

3. **Data Retention**:
   - **Search History**: 
     - Per-user search history: 90 days (opt-in, user can delete anytime)
     - Global aggregated data: Indefinite (anonymized, for cost tracking)
   - **Route Cost History**: 
     - Keep price history for 1 year
     - Aggregate older data into monthly averages
     - Prune data older than 2 years
   - **Travel Time Cache**: 
     - Keep for 30 days (addresses don't change, but traffic patterns might)
     - Prune expired cache entries daily

4. **International Coverage**:
   - Start with Europe only?
   - Expand to other regions?

5. **Train vs. Flight Priority**:
   - **Decision Logic**:
     - Show **trains only** if: distance < 500 km AND same country/region (e.g., London-Paris, Madrid-Barcelona)
     - Show **flights only** if: distance > 800 km OR different continents
     - Show **both trains and flights** if: distance 500-800 km (let user choose)
     - User preference: Allow toggle to show only trains or only flights
   - **Distance Calculation**: Use straight-line distance between venue cities (not exact coordinates)
   - **Regional Considerations**: 
     - Europe: Prefer trains for < 500 km
     - North America: Prefer flights for > 300 km (less train infrastructure)
     - Asia: Case-by-case (high-speed rail in some regions)

6. **Home Base Data Sources**:
   - Use Google Maps Directions API or Mapbox?
   - Integrate hotel booking APIs (Booking.com, Airbnb)?
   - Cost considerations for Directions API calls?

7. **Travel Time Accuracy**:
   - How often to refresh cached travel times?
   - Consider traffic/real-time data?
   - Time-of-day variations?

---

## Next Steps

1. **Review this plan** with team
2. **Choose flight/train API providers**
3. **Set up API accounts** and get keys
4. **Create Phase 1 PR** (infrastructure)
5. **Iterate incrementally** following the plan

---

## Conclusion

This architecture plan provides a scalable, maintainable foundation for flight and train search features. The incremental approach allows for:

- ✅ Small, reviewable PRs
- ✅ Early user feedback
- ✅ Risk mitigation (can pause at any phase)
- ✅ Performance optimization at each step

The design follows existing patterns in the codebase (Context API, service layer) and integrates seamlessly with the current match search and trip management features.

---

## Home Base Feature Details

### Travel Time Calculation Logic

**When to Calculate**:
- On trip load (lazy load - only calculate for visible matches)
- When home base is added/updated
- When match is added to trip
- On demand (when user expands match card)

**Which Home Base to Use**:
1. Find all home bases with date ranges that include the match date
2. If multiple home bases match, use priority order (NOT based on travel time - that's circular):
   - **Priority 1**: Most specific type (hotel/Airbnb > custom > city)
   - **Priority 2**: Longest duration (most "stable" home base - indicates primary accommodation)
   - **Priority 3**: Straight-line distance (use coordinates, not travel time) - only as tiebreaker
3. If no home base matches match date:
   - Default to city center of match venue's city
   - Show warning: "No home base configured for this date"
4. Calculate travel times AFTER home base is selected (not used for selection)

**Transportation Modes**:
- **Walking**: For distances < 2 km
- **Driving**: For distances > 2 km or when user prefers
- **Transit**: For urban areas with public transport
- **Cycling**: Optional, for shorter distances

**API Integration**:
- Use Google Maps Directions API or Mapbox Directions API
- Cache results to reduce API calls
- Consider real-time traffic for driving (if available)
- Cache for 24 hours (traffic patterns don't change much)

### Home Base Validation

**Date Range Validation**:
- Home base date range must overlap with trip dates
- Warn if multiple home bases have overlapping date ranges
- Auto-suggest date ranges based on match dates

**Location Validation**:
- Geocode address if coordinates not provided
- Validate coordinates are valid (lat: -90 to 90, lng: -180 to 180)
- Warn if location is very far from all matches (> 50 km)

### Performance Optimizations

**Caching Strategy**:
- Cache travel times for 24 hours (same route, same time of day)
- Batch calculate travel times for all matches in one API call (if possible)
- Pre-calculate travel times in background job (nightly)

**Lazy Loading**:
- Only calculate travel times for visible matches
- Load travel times when user expands match card
- Show loading state while calculating

**API Rate Limiting**:
- Google Maps Directions API: 40 requests/second, 25,000 requests/day
- Implement request queuing with exponential backoff for bulk calculations
- Use batch requests where possible (up to 25 routes per batch)
- **Error Handling for Travel Times**:
  - If no home base matches match date: Default to city center, show warning
  - If home base has no coordinates: Use city center, prompt user to add address
  - If venue has no coordinates: Use straight-line distance estimate, show "Approximate"
  - If Directions API returns no route: Show "Unable to calculate route - may be unreachable"
  - If API rate limit exceeded: Use cached data if available, otherwise show "Service temporarily unavailable"
  - If network error: Show cached data if available, otherwise show "Unable to calculate - check connection"

