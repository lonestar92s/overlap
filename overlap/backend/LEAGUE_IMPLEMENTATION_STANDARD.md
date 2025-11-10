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

## Implementation Process

### Step 1: Add League to Backend Import Script

Add the league to `bulkImportLeaguesTeamsVenues.js` in the `MAJOR_LEAGUES` array:

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

### Step 3: Add League to Mobile App

Add the league to `mobile-app/data/leagues.js` in the `LEAGUES` array:

```javascript
export const LEAGUES = [
    // ... existing leagues ...
    { id: '62', name: 'Ligue 2', country: 'France', countryCode: 'FR', tier: 2 },
    { id: '262', name: 'Liga MX', country: 'Mexico', countryCode: 'MX', tier: 1 },
];
```

**Note:** The `id` should be a string (e.g., `'62'`) in the mobile app.

### Step 4: Run the Import Script

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

### Step 5: Verify Implementation

After running the script, verify:

1. **Database Check**
   - League exists in MongoDB `leagues` collection
   - Teams are associated with the league
   - Venues have coordinates

2. **Mobile App Check**
   - League appears in league picker
   - Search works for teams in the league
   - Map markers appear for venues

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

- **Import Script**: `overlap/backend/src/scripts/bulkImportLeaguesTeamsVenues.js`
- **Mobile App Data**: `mobile-app/data/leagues.js`
- **League Model**: `overlap/backend/src/models/League.js` 