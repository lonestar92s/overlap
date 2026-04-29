# Recommendation System Architecture

This document outlines how our personalized match recommendation system works, including the scoring algorithm, preference integration, and API endpoints.

## Overview

Our recommendation system provides personalized match suggestions based on:
- User preferences (favorite teams, leagues, venues)
- Trip context (dates, locations, existing matches)
- Match quality indicators (league tier, venue capacity, temporal alignment)
- User behavior (previously saved matches, dismissed recommendations)

## System Components

### 1. Recommendation Service (`recommendationService.js`)

The core service that generates recommendations for trips. It handles:
- Date-based match discovery
- Proximity filtering
- Conflict detection (time overlaps)
- Preference-weighted scoring

### 2. Scoring Weights (`config/recommendationWeights.js`)

Centralized configuration file defining all scoring weights and multipliers. This allows easy tuning without code changes.

### 3. API Endpoints

#### Trip Recommendations
- **Endpoint**: `GET /api/recommendations/trips/:tripId/recommendations`
- **Purpose**: Get recommendations for specific trip dates
- **Authentication**: Required
- **Response**: Array of recommended matches with reasons and scores

#### General Recommendations
- **Endpoint**: `GET /api/matches/recommended`
- **Purpose**: Get personalized match recommendations for the next N days
- **Authentication**: Required
- **Query Parameters**:
  - `limit` (default: 10): Maximum number of recommendations
  - `days` (default: 30): Look ahead window in days

## Scoring Algorithm

Matches are scored on a point-based system. Higher scores indicate better recommendations. Only matches with positive scores are shown.

### Base Score
- **Default**: +10 points (every match starts with this)
- **Minimum Threshold**: 0 (matches with score > 0 are shown)

### Preference-Based Scoring

#### Favorite Teams (+50 points)
- Highest individual bonus factor
- Awarded when one of the playing teams matches a user's favorite team
- Multiple favorite teams can contribute (each adds +50)

#### Favorite Leagues (+30 points)
- Awarded when the match is in one of the user's favorite leagues
- If user has favorite leagues, those leagues are prioritized in search, plus popular leagues are included for diversity

#### Favorite Venues (+40 points)
- Awarded when the match is at one of the user's favorite venues

### Location-Based Scoring

#### Default Location Proximity (up to +40 points)
- Based on distance from user's default location (if set)
- Formula: `max(0, 40 - (distance / 10))`
- Only applies if within user's recommendation radius (default: 400 miles)
- Closer matches score higher (e.g., 0 miles = 40 points, 10 miles = 30 points, 40+ miles = 0 points)

### Trip-Based Scoring

For users with active trips (trips with matches that haven't ended yet):

#### Proximity to Trip Venues (0-40 points)
Matches closer to venues in active trips score higher:
- Within 10 miles: +40 points
- Within 25 miles: +35 points
- Within 50 miles: +30 points
- Within 100 miles: +25 points
- Within 200 miles: +20 points
- Beyond 200 miles: +15 points
- Uses the closest venue from any active trip

#### Temporal Alignment with Trip Dates (0-30 points)
Matches that align with trip dates score higher:
- Match within trip date range: +30 points
- Matches exact trip start/end date: +30 points
- Within 1 day of trip: +25 points
- Within 2 days of trip: +20 points
- Within 3 days of trip: +15 points
- Uses the best alignment from any active trip (no double-counting)

#### Time Conflict Penalty (-50 points)
- Applied if the match overlaps with an existing trip match
- Overlap defined as: same day and within 3 hours of an existing trip match

### Bonuses

Additional points for special match characteristics:
- **Weekend Match**: +15 points (Saturday or Sunday)
- **High-Profile Match**: +25 points (big teams: Manchester United, Manchester City, Liverpool, Arsenal, Chelsea, Tottenham, Real Madrid, Barcelona, Atletico Madrid, Bayern Munich, Borussia Dortmund, Juventus, AC Milan, Inter Milan, PSG, Ajax, PSV)

### Penalties

Negative scores that reduce recommendation quality:
- **Already Saved**: -100 points (heavily penalized to avoid duplicates)
- **Recently Dismissed**: -30 points (user dismissed within last 7 days)
- **Recently Visited Venue**: -20 points (user recently visited this stadium)
- **Time Conflict**: -50 points (overlaps with existing trip match - same day, within 3 hours)

### League Diversity

To ensure diverse results across multiple leagues, the system:
1. **First Pass**: Distributes matches across leagues (1-2 top matches per league)
2. **Second Pass**: Fills remaining slots with highest scoring matches regardless of league
3. **Final Sort**: Sorts all matches by score while maintaining diversity

This prevents a single league (e.g., if it's the only favorite) from dominating all recommendations.

## Recommendation Flow

### Trip Recommendations

1. **Identify Trip Context**
   - Extract trip date range from saved matches
   - Find days without matches
   - Get venue coordinates from existing trip matches

2. **Match Discovery**
   - Search for matches on target dates (±1 day for flexibility)
   - Filter by subscription tier (exclude restricted leagues)
   - Filter by proximity to trip venues (within user's recommendation radius)

3. **Conflict Detection**
   - Remove matches that conflict with existing trip matches (same day, within 3 hours)

4. **Scoring & Ranking**
   - Score each match using the algorithm above
   - Include user preferences (favorite teams, leagues, venues)
   - Sort by score descending
   - Select top match for each day without matches

5. **Alternative Dates**
   - Generate alternative dates (±1, ±2 days) if match is flexible

6. **Caching**
   - Cache results for 24 hours
   - Invalidate cache when user interacts with recommendations or updates trip

### General Recommendations

1. **Get User Preferences & Context**
   - Favorite teams, leagues, venues
   - Default location and recommendation radius
   - Active trips (trips with matches that haven't ended)
   - Recently saved matches
   - Recently visited stadiums
   - Recently dismissed recommendations

2. **League Selection**
   - If user has favorite leagues:
     - Convert MongoDB IDs to API IDs via League collection lookup
     - **Always include popular leagues** for diversity (Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Eredivisie, Primeira Liga, etc.)
     - Deduplicate league IDs
   - Else if user has active trips:
     - Extract leagues from trip matches
     - Convert league names/IDs to API IDs via League collection lookup
     - Fallback to popular leagues if lookup fails
   - Else:
     - Use popular leagues as default

3. **Match Fetching**
   - Fetch matches from selected leagues for next N days (default: 30)
   - Use API-Sports.io fixtures endpoint
   - Aggregate matches from all leagues in parallel
   - Filter out invalid or empty responses

4. **Scoring & Ranking**
   - For each match, calculate score including:
     - Base score (+10)
     - Favorite teams bonus (+50 per match)
     - Favorite leagues bonus (+30)
     - Favorite venues bonus (+40)
     - Default location proximity (0-40 points)
     - **Trip proximity** (0-40 points) - if active trips exist
     - **Trip temporal alignment** (0-30 points) - if active trips exist
     - Weekend bonus (+15)
     - High-profile match bonus (+25)
   - Apply penalties:
     - Recently visited stadium (-20)
     - Already saved (-100)
     - Recently dismissed (-30)
     - **Time conflict** (-50) - if overlaps with trip match
   - Filter matches with score > 0
   - Apply league diversity algorithm to ensure results from multiple leagues
   - Sort by score (descending)
   - Return top N matches (default: 10)

5. **Result Transformation**
   - Transform matches to API-Sports format expected by frontend:
     - `fixture.venue` structure with name, city, country, coordinates
     - `teams.home` and `teams.away` structure
     - Include recommendation score and reasons
   - Handle venue data with multiple fallbacks:
     - Primary: Database venue lookup by API ID
     - Secondary: API match data (fixture.venue or match.venue)
     - Fallback: "Unknown Venue" if all lookups fail

## Current Implementation Status

### Implemented Features ✅
- Base scoring system
- Favorite teams, leagues, and venues scoring
- Default location proximity scoring (formula-based)
- **Trip proximity scoring** (matches near trip venues)
- **Trip temporal alignment** (matches aligned with trip dates)
- **Time conflict detection** (penalizes overlapping matches)
- Weekend and high-profile match bonuses
- Penalties for saved, dismissed, and recently visited matches
- League diversity algorithm (ensures results from multiple leagues)
- Venue data transformation with multiple fallbacks
- Comprehensive logging for debugging

### Future Enhancements 🚧
1. **Preference Strength Multiplier**
   - Currently: Fixed point values
   - Planned: Configurable multiplier (light: 0.5x, standard: 1.0x, strong: 1.5x)
   - Will allow users to adjust how strongly preferences influence recommendations

2. **Advanced Venue Proximity**
   - Score matches near favorite venues (even if not exact match)
   - Consider travel time and accessibility

3. **Team Context Scoring**
   - Boost matches in same city/country as favorite teams
   - Consider rivalries and historic matchups

4. **League Quality/Tier Scoring**
   - Currently: Not implemented
   - Planned: Bonus points for tier 1 leagues (Premier League, La Liga, etc.)

5. **Derby/Cup Final Detection**
   - Currently: Only detects high-profile teams
   - Planned: Specific bonuses for derbies and cup finals

## Data Sources

### User Preferences
Stored in MongoDB User collection:
- `preferences.favoriteTeams`: Array of team references (MongoDB ObjectIds)
- `preferences.favoriteLeagues`: Array of league API IDs (strings)
- `preferences.favoriteVenues`: Array of venue objects with `venueId` (strings)
- `preferences.defaultLocation`: Object with `city`, `country`, and `coordinates` [lng, lat]
- `preferences.recommendationRadius`: Maximum distance in miles (default: 400)
- `preferences.defaultSearchRadius`: Default search radius in miles (default: 100)

### Active Trips
Stored in `user.trips` array:
- Each trip contains `name`, `description`, `matches` array
- Each match in trip contains: `matchId`, `homeTeam`, `awayTeam`, `league`, `venue`, `venueData`, `date`
- Active trips are those where the last match date is in the future

### Match Data
Fetched from API-Sports.io:
- League information
- Team details
- Venue information
- Match fixtures with dates/times

### Venue Coordinates
- Primary source: Local MongoDB Venue collection (geocoded via LocationIQ)
- Fallback: API-Sports venue data (may not include coordinates)

## Caching Strategy

### Trip Recommendations
- **Cache Key**: `recommendations:${userId}:${subscriptionTier}:${tripId}:${tripContentHash}`
- **TTL**: 24 hours
- **Invalidation**: On recommendation interaction, trip update, or preference change

### General Recommendations
- **Cache Key**: `recommended_matches_${userId}_${days}_${limit}`
- **TTL**: 1 hour (shorter due to more dynamic nature)
- **Invalidation**: On preference change or manual cache clear

## Example Scores

### High-Scoring Match (Favorite Team + Trip Alignment)
```
Base Score:                      +10
Favorite Team Playing:           +50
Trip Temporal (within range):    +30
Trip Proximity (12 miles):       +35
Weekend Bonus:                   +15
Total:                           140 points ✅
```

### High-Scoring Match (Favorite Team + Favorite League + Location)
```
Base Score:                      +10
Favorite Team Playing:           +50
Favorite League:                 +30
Default Location (5 miles):      +35
High-Profile Match:              +25
Weekend Bonus:                   +15
Total:                           165 points ✅
```

### Medium-Scoring Match (Trip Proximity + Temporal)
```
Base Score:                      +10
Trip Proximity (50 miles):       +30
Trip Temporal (within 1 day):    +25
Weekend Bonus:                   +15
Total:                           80 points ✅
```

### Low-Scoring Match (Penalized)
```
Base Score:                      +10
Default Location (30 miles):     +10
Already Saved:                   -100
Total:                           -80 points ❌ (filtered out)
```

### Match with Time Conflict
```
Base Score:                      +10
Favorite League:                 +30
Trip Temporal (within range):    +30
Time Conflict:                   -50
Total:                           20 points ✅ (still shown, but penalized)
```


## Testing & Tuning

The scoring weights in `recommendationWeights.js` can be adjusted without code changes. Monitor:
- Average recommendation scores
- User engagement rates (saves, dismissals)
- Match relevance (user feedback)

A/B testing different weight configurations can help optimize the system.

## API Response Format

### Trip Recommendations
```json
{
  "success": true,
  "recommendations": [
    {
      "matchId": "12345",
      "recommendedForDate": "2025-06-15",
      "match": { /* match object */ },
      "reason": "Near your Old Trafford match (12 miles away)",
      "proximity": "12 miles from Old Trafford",
      "score": 125,
      "alternativeDates": ["2025-06-14", "2025-06-16"]
    }
  ],
  "tripId": "abc123",
  "generatedAt": "2025-01-15T10:30:00Z",
  "cached": false
}
```

### General Recommendations
```json
{
  "success": true,
  "matches": [
    {
      "id": "12345",
      "fixture": {
        "id": "12345",
        "date": "2025-06-15T15:00:00Z",
        "status": {},
        "venue": {
          "id": "556",
          "name": "Old Trafford",
          "city": "Manchester",
          "country": "England",
          "coordinates": [-2.2914, 53.4631]
        }
      },
      "teams": {
        "home": {
          "id": "33",
          "name": "Manchester United",
          "logo": "..."
        },
        "away": {
          "id": "50",
          "name": "Manchester City",
          "logo": "..."
        }
      },
      "league": {
        "id": "39",
        "name": "Premier League",
        "logo": "..."
      },
      "score": {},
      "recommendationScore": 115,
      "recommendationReasons": [
        "Your favorite team Manchester United is playing",
        "From your favorite league: Premier League",
        "Weekend match"
      ]
    }
  ],
  "totalFound": 245,
  "personalized": true,
  "dateRange": { "from": "2025-01-15", "to": "2025-02-14" },
  "leagues": ["39", "140", "135"],
  "fromCache": false,
  "cachedAt": "2025-01-15T10:30:00Z"
}
```

