# Match Search Flow - Complete Step-by-Step

## Overview
This document maps out how fixtures, venues, and teams are connected during a location-only search.

---

## 1. API-Football Fixture Response Structure

When we call `GET /fixtures?league=78&season=2025&from=2026-04-17&to=2026-04-20`, API-Football returns:

```json
{
  "response": [
    {
      "fixture": {
        "id": 1234567,
        "date": "2026-04-18T18:30:00+00:00",
        "venue": {
          "id": 700,              // ← API-Football venue ID
          "name": "Allianz Arena",
          "city": "Munich"
          // NOTE: API-Football fixture.venue does NOT include coordinates
        }
      },
      "teams": {
        "home": {
          "id": 157,              // ← API-Football team ID
          "name": "Bayern München" // ← API team name
        },
        "away": {
          "id": 165,
          "name": "Borussia Dortmund"
        }
      },
      "league": {
        "id": 78,
        "name": "Bundesliga",
        "country": "Germany"
      }
    }
  ]
}
```

**Key Points:**
- `fixture.venue.id` = API-Football venue ID (e.g., 700)
- `fixture.venue.name` = Venue name (e.g., "Allianz Arena")
- `fixture.venue.city` = City name
- **NO coordinates in fixture.venue** - we must look them up

---

## 2. Location-Only Search Flow (Step-by-Step)

### Step 1: User Search Request
```
User searches: Munich, 2026-04-17 to 2026-04-20
Frontend sends: GET /matches/search?neLat=48.387&neLng=11.825&swLat=47.887&swLng=11.325&dateFrom=2026-04-17&dateTo=2026-04-20
```

### Step 2: Get Relevant Leagues
```javascript
// Line 634: getRelevantLeagueIds(bounds)
// Returns: [78, 79, 135, ...] (Bundesliga, 2. Bundesliga, etc.)
```

### Step 3: Fetch Fixtures from API-Football
```javascript
// Lines 651-668: Parallel API calls for each league
axios.get('/fixtures', {
  params: { league: 78, season: 2025, from: '2026-04-17', to: '2026-04-20' }
})
// Returns: Array of fixtures with fixture.venue.id, fixture.venue.name, etc.
```

### Step 4: For Each Fixture - Venue Lookup (Cascade)

#### **Attempt 1: Venue by API ID** (Lines 715-765)
```javascript
const venue = match.fixture.venue;  // { id: 700, name: "Allianz Arena", city: "Munich" }

if (venue?.id) {
  // Step 4a: Fetch from API-Football (for image)
  apiVenueData = await getVenueFromApiFootball(venue.id);  // venue.id = 700
  
  // Step 4b: Look up in MongoDB by API ID
  localVenue = await venueService.getVenueByApiId(venue.id);  // venue.id = 700
  
  // MongoDB Venue Schema:
  // {
  //   apiId: 700,
  //   name: "Allianz Arena",
  //   city: "München",
  //   coordinates: [11.6201025, 48.2117736],  // ← We need this!
  //   location: { type: "Point", coordinates: [11.6201025, 48.2117736] }
  // }
  
  if (localVenue && localVenue.coordinates) {
    // ✅ SUCCESS: Use MongoDB venue with coordinates
    venueInfo = {
      id: 700,
      name: "Allianz Arena",
      coordinates: [11.6201025, 48.2117736]  // ← From MongoDB
    };
  }
}
```

**If this fails** (no MongoDB venue or no coordinates):

#### **Attempt 2: Venue by Name** (Lines 768-784)
```javascript
if (!venueInfo || !venueInfo.coordinates) {
  // Try to find venue by name in MongoDB
  byName = await venueService.getVenueByName("Allianz Arena", "Munich");
  
  // MongoDB Venue Query:
  // Venue.findOne({ 
  //   name: { $regex: /^Allianz Arena$/i },
  //   city: { $regex: /^Munich$/i }
  // })
  
  if (byName && byName.coordinates) {
    // ✅ SUCCESS: Found venue by name with coordinates
    venueInfo = {
      id: 700,
      name: "Allianz Arena",
      coordinates: [11.6201025, 48.2117736]  // ← From MongoDB
    };
  }
}
```

**If this fails** (venue not in MongoDB):

#### **Attempt 3: Team Fallback** (Lines 786-814)
```javascript
if (!venueInfo) {
  // Get home team name from fixture
  const homeTeamName = match.teams.home.name;  // "Bayern München"
  
  // Map API name to our DB name
  mappedHome = await teamService.mapApiNameToTeam("Bayern München");
  // Returns: "Bayern München" or "Bayern Munich" (normalized)
  
  // Find team in MongoDB
  team = await Team.findOne({
    $or: [
      { name: "Bayern München" },
      { apiName: "Bayern München" },
      { aliases: "Bayern München" }
    ]
  });
  
  // MongoDB Team Schema:
  // {
  //   name: "Bayern München",
  //   apiId: 157,
  //   venue: {
  //     name: "Allianz Arena",
  //     coordinates: [11.6201025, 48.2117736]  // ← We need this!
  //   }
  // }
  
  if (team?.venue?.coordinates) {
    // ✅ SUCCESS: Use team's venue coordinates
    venueInfo = {
      id: 700,
      name: team.venue.name,
      coordinates: team.venue.coordinates  // ← From Team document
    };
  } else {
    // ❌ FAILURE: No coordinates available
    venueInfo = {
      id: 700,
      name: "Allianz Arena",
      coordinates: null  // ← No coordinates = match will be filtered out
    };
  }
}
```

### Step 5: Filter by Bounds (Lines 836-884)
```javascript
if (venueInfo.coordinates) {
  const [lon, lat] = venueInfo.coordinates;  // [11.6201025, 48.2117736]
  
  // Check if coordinates are within search bounds
  if (isWithinBounds(venueInfo.coordinates, bounds)) {
    // ✅ Match included
    shouldInclude = true;
  } else {
    // ❌ Match filtered out (outside bounds)
    matchesFilteredOut++;
  }
} else {
  // ❌ Match excluded (no coordinates)
  matchesWithoutCoords++;
}
```

### Step 6: Return Transformed Match
```javascript
if (shouldInclude) {
  transformedMatches.push({
    id: 1234567,
    fixture: {
      id: 1234567,
      date: "2026-04-18T18:30:00+00:00",
      venue: {
        id: 700,
        name: "Allianz Arena",
        city: "Munich",
        coordinates: [11.6201025, 48.2117736]  // ← Final coordinates
      }
    },
    teams: {
      home: { id: 157, name: "Bayern München" },
      away: { id: 165, name: "Borussia Dortmund" }
    },
    league: {
      id: 78,
      name: "Bundesliga",
      country: "Germany"
    }
  });
}
```

---

## 3. Data Connections Diagram

```
API-Football Fixture
├── fixture.venue.id (700) ──────────┐
├── fixture.venue.name ("Allianz Arena")
└── teams.home.name ("Bayern München") ─┐
                                        │
                                        │
MongoDB Collections:                   │
                                        │
Venue Collection                       │
├── apiId: 700 ────────────────────────┘
├── name: "Allianz Arena"
└── coordinates: [11.6201025, 48.2117736]
                                        │
Team Collection                        │
├── name: "Bayern München" ───────────┘
├── apiId: 157
└── venue: {
      name: "Allianz Arena",
      coordinates: [11.6201025, 48.2117736]
    }
```

---

## 4. Lookup Priority Order

1. **Venue by API ID** (Primary)
   - `venueService.getVenueByApiId(fixture.venue.id)`
   - Fastest, most reliable
   - Requires venue to be imported with correct `apiId`

2. **Venue by Name** (Fallback #1)
   - `venueService.getVenueByName(fixture.venue.name, fixture.venue.city)`
   - Handles duplicate venue records
   - Case-insensitive matching

3. **Team Venue** (Fallback #2)
   - `Team.findOne({ name: mappedHome }).venue.coordinates`
   - Used when venue lookup fails
   - **This is what we fixed for Bayern Munich**

4. **API-Football Venue Data** (Fallback #3)
   - `getVenueFromApiFootball(venue.id)`
   - May or may not have coordinates
   - Used for venue image

---

## 5. Why Bayern Munich Was Missing

**Before Fix:**
```
Fixture → venue.id = 700
  ↓
Attempt 1: getVenueByApiId(700) → ❌ Not found or no coordinates
  ↓
Attempt 2: getVenueByName("Allianz Arena") → ❌ Not found
  ↓
Attempt 3: Team lookup → Team found, but team.venue = null ❌
  ↓
Result: venueInfo.coordinates = null → Match filtered out
```

**After Fix:**
```
Fixture → venue.id = 700
  ↓
Attempt 1: getVenueByApiId(700) → ❌ Not found or no coordinates
  ↓
Attempt 2: getVenueByName("Allianz Arena") → ❌ Not found
  ↓
Attempt 3: Team lookup → Team found, team.venue.coordinates = [11.6201025, 48.2117736] ✅
  ↓
Result: venueInfo.coordinates = [11.6201025, 48.2117736] → Match included
```

---

## 6. Key Takeaways

1. **API-Football fixtures don't include coordinates** - we must look them up
2. **Three-tier fallback system** ensures we get coordinates when possible
3. **Team.venue is critical** - it's the last resort before filtering out matches
4. **Venue lookup by API ID is fastest** - but requires proper data import
5. **Name-based lookup handles duplicates** - same stadium, different venue IDs

---

## 7. Data Requirements

For a match to appear on the map, we need coordinates from **at least one** of:

1. ✅ **Venue Collection** with `apiId` matching `fixture.venue.id`
2. ✅ **Venue Collection** with `name` matching `fixture.venue.name`
3. ✅ **Team Collection** with `venue.coordinates` populated

**Best Practice:** All three should be populated for maximum reliability.

