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

Matches are scored on a point-based system. Higher scores indicate better recommendations.

### Base Score
- **Default**: 10 points
- **Minimum Threshold**: 30 points (below this, match is not recommended)

### Context-Based Scoring (Trip Recommendations)

#### Proximity Score (0-40 points)
Matches closer to existing trip venues score higher:
- Within 10 miles: 40 points
- Within 25 miles: 35 points
- Within 50 miles: 30 points
- Within 100 miles: 25 points
- Within 200 miles: 20 points
- Beyond 200 miles: 15 points

#### Temporal Score (0-30 points)
Matches on the target date score highest:
- Exact date: 30 points
- ±1 day: 25 points
- ±2 days: 20 points
- Beyond ±2 days: 10 points

#### League Quality Score (0-20 points)
Top-tier leagues score higher:
- Tier 1 (Premier League, La Liga, Serie A, Bundesliga, Ligue 1): 20 points
- Tier 2 (Championship, La Liga 2, etc.): 15 points
- Other leagues: 10 points

### Preference-Based Scoring

User preferences significantly boost match scores. All preference scores are multiplied by a "preference strength" factor (light: 0.5x, standard: 1.0x, strong: 1.5x).

#### Favorite Teams (0-75 points with strong preference)
- **Direct Match**: 50 points × preference strength
  - Awarded when one of the playing teams is in user's favorites
- **Same City**: 10 points × preference strength (future enhancement)
- **Same Country**: 5 points × preference strength (future enhancement)
- **Same League**: 15 points × preference strength (future enhancement)

#### Favorite Leagues (0-40 points with strong preference)
- **Direct Match**: 30 points × preference strength
  - Awarded when match is in a favorite league
- **Tier Bonus**: Additional 10 points for tier 1 favorite leagues

#### Favorite Venues (0-60 points with strong preference)
- **Direct Match**: 40 points × preference strength
  - Awarded when match is at a favorite venue
- **Proximity Bonus**: Additional points for matches near favorite venues (future enhancement)

### Bonuses

Additional points for special match characteristics:
- **Weekend Match**: +15 points (Saturday or Sunday)
- **High-Profile Match**: +25 points (big teams, derbies)
- **Derby Match**: +30 points
- **Cup Final**: +35 points
- **Near Default Location**: +40 points (if user has set default location)

### Penalties

Negative scores that reduce recommendation quality:
- **Already Saved**: -100 points (heavily penalized to avoid duplicates)
- **Recently Dismissed**: -30 points (user dismissed within last 7 days)
- **Recently Visited Venue**: -20 points (user recently visited this stadium)
- **Time Conflict**: -50 points (overlaps with existing trip match)

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

1. **Get User Preferences**
   - Favorite teams, leagues, venues
   - Default location
   - Recommendation radius

2. **League Selection**
   - Use favorite leagues if available
   - Fallback to leagues from active trips
   - Final fallback to popular leagues

3. **Match Fetching**
   - Fetch matches from selected leagues for next N days
   - Use API-Sports.io fixtures endpoint

4. **Scoring & Ranking**
   - Score each match including preference bonuses
   - Apply penalties for saved/dismissed matches
   - Sort by score
   - Return top N matches

## Preference Strength

Users can adjust how strongly preferences influence recommendations:

- **Light (0.5x multiplier)**: Preferences have minimal impact, more diverse results
- **Standard (1.0x multiplier)**: Default setting, balanced personalization
- **Strong (1.5x multiplier)**: Preferences heavily weighted, very focused results

This setting is stored in `user.preferences.preferenceStrength` (default: 'standard').

## Data Sources

### User Preferences
Stored in MongoDB User collection:
- `preferences.favoriteTeams`: Array of team references
- `preferences.favoriteLeagues`: Array of league API IDs (strings)
- `preferences.favoriteVenues`: Array of venue objects with `venueId`
- `preferences.preferenceStrength`: 'light' | 'standard' | 'strong'
- `preferences.recommendationRadius`: Maximum distance in miles (default: 400)

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

### High-Scoring Match (Favorite Team + Favorite League)
```
Base Score:              10
Favorite Team Playing:   50 × 1.0 (standard) = 50
Favorite League:         30 × 1.0 (standard) = 30
Tier 1 League Bonus:     +10
Weekend Bonus:           +15
Total:                   115 points ✅ (well above threshold)
```

### Medium-Scoring Match (Proximity Only)
```
Base Score:              10
Proximity (25 miles):    35
Temporal (exact date):   30
League Quality (Tier 1): 20
Total:                   95 points ✅
```

### Low-Scoring Match (Penalized)
```
Base Score:              10
Proximity:               20
Temporal:                25
League Quality:          15
Already Saved:           -100
Total:                   -30 points ❌ (below threshold, not recommended)
```

## Future Enhancements

1. **Machine Learning Integration**
   - Learn from user interactions to optimize weights
   - Predict match interest scores using historical data

2. **Advanced Venue Proximity**
   - Score matches near favorite venues (even if not exact match)
   - Consider travel time and accessibility

3. **Team Context Scoring**
   - Boost matches in same city/country as favorite teams
   - Consider rivalries and historic matchups

4. **Dynamic Preference Learning**
   - Automatically adjust preference strength based on user engagement
   - Suggest new favorite teams/leagues based on behavior

5. **Temporal Patterns**
   - Learn user's preferred match days/times
   - Adjust weekend/weekday bonuses per user

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
      "homeTeam": { "id": "33", "name": "Manchester United", "logo": "..." },
      "awayTeam": { "id": "50", "name": "Manchester City", "logo": "..." },
      "league": { "id": "39", "name": "Premier League", "logo": "..." },
      "venue": { "id": "556", "name": "Old Trafford", "city": "Manchester", ... },
      "date": "2025-06-15T15:00:00Z",
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
  "fromCache": false
}
```

