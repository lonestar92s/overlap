# League Implementation Standard

This document outlines the **current automated approach** for implementing new leagues in the Flight Match Finder application.

## Overview

The league implementation process is now **fully automated**. The system automatically:
- Fetches league data from API-Football
- Fetches all teams for the league
- Fetches venue data with coordinates
- Geocodes venues if coordinates are missing (using LocationIQ)
- Imports everything into MongoDB

**No manual venue data preparation is required.**

## Bulk Onboarding All Leagues

You can now onboard **all available leagues** from API-Football in one operation using the bulk onboarding script.

### Quick Start: Onboard All Leagues

```bash
cd overlap/backend
node src/scripts/onboardAllLeagues.js
```

This script will:
1. Fetch all active leagues from API-Football for the current season
2. Filter for leagues with fixture coverage
3. Onboard each league (league, teams, venues) using the automated onboarding service
4. Handle rate limiting automatically (2 second delays between leagues)
5. Provide a comprehensive summary of created/updated records

**Prerequisites:**
- MongoDB connection configured (`MONGO_PUBLIC_URL`, `MONGODB_URI`, or `MONGO_URL`)
- API-Football API key (`API_SPORTS_KEY`)
- Optional: LocationIQ API key (`LOCATIONIQ_API_KEY`) for geocoding venues

**Note:** This process can take a while (potentially hours) depending on the number of leagues. The script processes leagues sequentially to respect API rate limits.

### Dynamic League Loading

After onboarding leagues to MongoDB, the system now uses **dynamic league loading** from the database** instead of hardcoded lists:

- **Backend**: All league queries use `League.find()` from MongoDB
- **Subscription Service**: Fetches accessible leagues from database (cached for 1 hour)
- **Match Search**: Uses database queries for fallback/popular leagues
- **Mobile App**: Uses `/api/leagues/relevant` endpoint (with hardcoded fallback)
- **No Rate Limiting**: Once in MongoDB, all operations use database queries (no API calls)

This means:
- ✅ New leagues automatically appear in search results
- ✅ No code changes needed when adding leagues
- ✅ Matches from new leagues automatically show on the map
- ✅ Subscription filtering works automatically

## Implementation Process

### Option 1: Bulk Onboard All Leagues (Recommended)

Use the bulk onboarding script to automatically fetch and onboard all available leagues:

```bash
cd overlap/backend
node src/scripts/onboardAllLeagues.js
```

This is the recommended approach as it:
- Automatically discovers all available leagues
- Requires no manual configuration
- Ensures comprehensive coverage

### Option 2: Onboard Individual Leagues via Admin Dashboard

1. Access the Admin Dashboard in the web app
2. Navigate to the "League Onboarding" tab
3. Enter:
   - League ID (from API-Football)
   - League Name
   - Country
   - Country Code (optional, auto-detected)
   - Tier (default: 1)
4. Click "Onboard League"

The system will automatically fetch teams, venues, and geocode coordinates.

### Option 3: Manual Script-Based Onboarding (Legacy)

For specific leagues, you can still add them to `bulkImportLeaguesTeamsVenues.js` in the `MAJOR_LEAGUES` array:

```javascript
const MAJOR_LEAGUES = [
    // ... existing leagues ...
    { id: 62, name: 'Ligue 2', country: 'France', countryCode: 'FR', tier: 2 },
    { id: 262, name: 'Liga MX', country: 'Mexico', countryCode: 'MX', tier: 1 },
];
```

**Required fields:**
- `id`: API-Football league ID (numeric)
- `name`: Full league name
- `country`: Country name
- `countryCode`: ISO 2-letter country code
- `tier`: League tier (1 = top division, 2 = second division, etc.)

### Step 2: Add Short Name Mapping

Add the league's short name to the `getShortName()` function in the same file:

```javascript
function getShortName(leagueName) {
    const mapping = {
        // ... existing mappings ...
        'Ligue 2': 'FL2',
        'Liga MX': 'LMX',
    };
    return mapping[leagueName] || leagueName.substring(0, 3).toUpperCase();
}
```

### Step 3: Run the Import Script (if using Option 3)

Execute the bulk import script to populate MongoDB:

```bash
cd overlap/backend
node src/scripts/bulkImportLeaguesTeamsVenues.js
```

The script will:
1. Connect to MongoDB (uses `MONGO_PUBLIC_URL` or `MONGODB_URI` env var)
2. Import/update the league definition
3. Fetch all teams from API-Football
4. Import/update teams with league associations
5. Import/update venues (with automatic geocoding if needed)
6. Print a summary of created/updated records

### Step 4: Verify Implementation

After running the script, verify:

1. **Database Check**
   - League exists in MongoDB `leagues` collection
   - Teams are associated with the league
   - Venues have coordinates

2. **Mobile App Check**
   - League appears in league picker (if using API endpoint)
   - Search works for teams in the league
   - Map markers appear for venues
   - Matches from the league appear in search results

**Note:** The mobile app uses `/api/leagues/relevant` endpoint which dynamically loads leagues from MongoDB. Hardcoded league files (`mobile-app/data/leagues.js`) are now fallback only.

## Data Structure

### League Schema (MongoDB)
```javascript
{
    apiId: '62',                    // String version of API ID
    name: 'Ligue 2',               // Full league name
    shortName: 'FL2',              // Short identifier
    country: 'France',             // Country name
    countryCode: 'FR',             // ISO country code
    tier: 2,                       // League tier
    emblem: 'https://media.api-sports.io/football/leagues/62.png',
    season: {
        start: '2025-08-01',       // Auto-calculated based on current date
        end: '2026-05-31',
        current: true
    },
    isActive: true,
    lastUpdated: Date
}
```

### Team Schema (MongoDB)
Teams are automatically fetched and include:
- `apiId`: Team ID from API-Football
- `name`: Official team name
- `code`: 3-letter team code
- `country`, `city`: Location info
- `venue`: Venue info with coordinates (if available)
- `leagues`: Array of league associations
- `apiSource`: 'api-sports'

### Venue Schema (MongoDB)
Venues are automatically fetched and geocoded:
- `venueId`: Venue ID from API-Football
- `name`: Stadium name
- `city`, `country`: Location
- `coordinates`: [longitude, latitude] (auto-geocoded if missing)
- `location`: GeoJSON Point for MongoDB queries
- `capacity`: Stadium capacity

## API-Football League IDs

Common league IDs (verify on API-Football documentation):
- Premier League: 39
- Championship: 40
- Ligue 1: 61
- **Ligue 2: 62** ← New
- La Liga: 140
- Bundesliga: 78
- Serie A: 135
- **Liga MX: 262** ← New

## Environment Variables

Required for the import script:
- `API_SPORTS_KEY`: API-Football API key
- `MONGO_PUBLIC_URL` or `MONGODB_URI`: MongoDB connection string
- `LOCATIONIQ_API_KEY`: (Optional) For geocoding venues without coordinates

## Troubleshooting

### League Not Appearing
- Check that league ID is correct in API-Football
- Verify the league is active in the current season
- Check MongoDB connection

### Missing Venue Coordinates
- Script automatically geocodes using LocationIQ if `LOCATIONIQ_API_KEY` is set
- If geocoding fails, coordinates will be `null` (may need manual fix)

### Teams Not Importing
- Check API rate limits
- Verify league ID is correct
- Check API response for errors in console

## Migration from Old Process

The old manual process (using hardcoded venue data) is deprecated. All new leagues should use the automated `bulkImportLeaguesTeamsVenues.js` script.

## Reference

- **Bulk Onboarding Script**: `overlap/backend/src/scripts/onboardAllLeagues.js` (recommended)
- **Individual League Onboarding**: Admin Dashboard → League Onboarding tab
- **Legacy Import Script**: `overlap/backend/src/scripts/bulkImportLeaguesTeamsVenues.js`
- **Onboarding Service**: `overlap/backend/src/services/leagueOnboardingService.js`
- **League Model**: `overlap/backend/src/models/League.js`
- **Mobile App Data** (fallback): `mobile-app/data/leagues.js` 