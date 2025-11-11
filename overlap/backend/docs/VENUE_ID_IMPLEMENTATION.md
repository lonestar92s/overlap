# Team VenueId Implementation

## Overview

Added `venueId` reference field to the Team model's venue subdocument to create a direct link between teams and venues in the Venue collection. This improves data consistency, makes linking more reliable, and helps alleviate the null venue issue.

## Changes Made

### 1. **Team Model Schema** (`src/models/Team.js`)
- Added `venueId: Number` field to the venue subdocument
- Added index on `venue.venueId` for efficient lookups

### 2. **Import Logic Updates**
Updated all import functions to set `venueId` when available:
- `src/services/leagueOnboardingService.js` - `importTeam()`
- `src/scripts/bulkImportLeaguesTeamsVenues.js` - `importTeam()`
- `src/scripts/importLigue2LigaMX.js` - `importTeam()`
- `src/routes/teams.js` - Team creation from API

**Logic:**
- If API provides `venue.id`, lookup existing venue by `venueId`
- If venue exists, use its data (more reliable, may have coordinates)
- If venue doesn't exist, set `venueId` for future linking
- If no `venue.id` from API, fallback to embedded data only

### 3. **Linking Scripts Updates**
Updated scripts to set `venueId` when matching venues:
- `src/scripts/linkAllTeamVenues.js` - Sets `venueId` when linking
- `src/scripts/linkLaLigaVenues.js` - Sets `venueId` when linking
- `src/scripts/fixMadridTeamVenues.js` - Sets `venueId` when fixing

### 4. **Runtime Match Processing**
Updated match processing to use `venueId` for venue lookup:
- `src/routes/matches.js` - Team venue fallback now checks `venueId` first
- `src/routes/search.js` - Team venue fallback now checks `venueId` first

**New Flow:**
1. If team has `venueId`, lookup venue from Venue collection
2. Use venue data from database (more reliable)
3. Fallback to embedded `team.venue.coordinates` if lookup fails
4. When geocoding succeeds, save venue and link team by `venueId`

### 5. **Migration Script**
Created `src/scripts/migrateTeamVenueIds.js` to backfill `venueId` for existing teams.

## How It Works

### Import Flow
```
API Response → teamData.venue.id
    ↓
Check Venue collection by venueId
    ↓
If found: Use venue data + set venueId ✅
If not found: Set venueId from API + embed data ✅
If no venue.id: Embed data only (no venueId) ⚠️
```

### Linking Flow
```
Team has venue but no venueId
    ↓
Search Venue collection by name/city
    ↓
If match found: Set venueId + copy data ✅
If no match: Keep venue data, no venueId ⚠️
```

### Runtime Lookup Flow
```
Match processing needs venue
    ↓
Team has venueId?
    ↓
Yes → Lookup Venue by venueId → Use venue data ✅
No → Use team.venue.coordinates (fallback) ✅
```

## Benefits

1. **Data Consistency**
   - Direct relationship between teams and venues
   - Single source of truth for venue data
   - Easier to propagate venue updates to teams

2. **More Reliable Linking**
   - Exact ID matching vs fuzzy name matching
   - Reduces linking errors
   - Clearer identification of unlinked teams

3. **Better Runtime Performance**
   - Can lookup venue by ID (fast)
   - Venue data from database is more reliable
   - Coordinates guaranteed if venue exists

4. **Easier Problem Identification**
   - Query: `Team.find({ 'venue.venueId': null })` to find teams needing venues
   - Clear flag for missing venue links
   - Better data quality monitoring

## Migration

### Running the Migration Script

To backfill `venueId` for existing teams:

```bash
cd overlap/backend
node src/scripts/migrateTeamVenueIds.js
```

**What it does:**
- Finds all teams with venue data but no `venueId`
- Attempts to match them to venues in Venue collection
- Sets `venueId` when match is found
- Generates report: `team-venue-id-migration-report.json`

**Strategies used:**
1. Exact venue name + country match
2. Partial venue name match
3. City + country match
4. Name variations (remove "Estadio", "Stadium", etc.)

### After Migration

1. **Run linking scripts** to link remaining teams:
   ```bash
   node src/scripts/linkAllTeamVenues.js
   node src/scripts/linkLaLigaVenues.js
   ```

2. **Monitor unlinked teams:**
   ```javascript
   // Find teams without venueId
   const unlinked = await Team.find({ 
       'venue.venueId': { $exists: false },
       venue: { $exists: true, $ne: null }
   });
   ```

## Usage Examples

### Query Teams by Venue
```javascript
// Find all teams using a specific venue
const teams = await Team.find({ 'venue.venueId': 123 });
```

### Update Venue and Propagate to Teams
```javascript
// Update venue coordinates
await Venue.updateOne(
    { venueId: 123 },
    { coordinates: [newLng, newLat] }
);

// Update all teams using this venue
await Team.updateMany(
    { 'venue.venueId': 123 },
    { 
        'venue.coordinates': [newLng, newLat],
        lastUpdated: new Date()
    }
);
```

### Find Teams Needing Venues
```javascript
// Teams with venues but no venueId (need linking)
const needLinking = await Team.find({
    venue: { $exists: true, $ne: null },
    'venue.venueId': { $exists: false }
});

// Teams with no venue at all
const noVenue = await Team.find({
    $or: [
        { venue: null },
        { venue: { $exists: false } }
    ]
});
```

## Backward Compatibility

✅ **Fully backward compatible:**
- `venueId` is optional (not required)
- Existing code using `team.venue.coordinates` still works
- Teams without `venueId` continue to function
- Embedded venue data is still used as fallback

## Next Steps

1. **Run migration script** to backfill existing teams
2. **Run linking scripts** to link remaining teams
3. **Monitor data quality** - track teams with null `venueId`
4. **Update venue data** - when venues are fixed, propagate to teams
5. **Consider making venueId required** in the future (after migration)

## Files Modified

- `src/models/Team.js` - Schema update
- `src/services/leagueOnboardingService.js` - Import logic
- `src/scripts/bulkImportLeaguesTeamsVenues.js` - Import logic
- `src/scripts/importLigue2LigaMX.js` - Import logic
- `src/routes/teams.js` - Team creation
- `src/scripts/linkAllTeamVenues.js` - Linking script
- `src/scripts/linkLaLigaVenues.js` - Linking script
- `src/scripts/fixMadridTeamVenues.js` - Fix script
- `src/routes/matches.js` - Match processing
- `src/routes/search.js` - Search processing

## Files Created

- `src/scripts/migrateTeamVenueIds.js` - Migration script
- `docs/VENUE_ID_IMPLEMENTATION.md` - This document

