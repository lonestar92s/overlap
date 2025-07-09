# League Implementation Standard

This document outlines the standard approach for implementing new leagues in the Flight Match Finder application, based on our successful implementation of the Premier League and Bundesliga.

## Data Structure

### League Data Format
```javascript
{
    apiId: '78',                // Unique API identifier
    name: 'Bundesliga',         // Full league name
    shortName: 'BL1',          // Short identifier
    country: 'Germany',        // Country name
    countryCode: 'DE',         // ISO country code
    tier: 1,                   // League tier (1 for top division)
    emblem: 'https://...',     // League logo URL
    season: {
        start: '2025-08-01',
        end: '2026-05-31',
        current: true
    }
}
```

### Team Data Format
```javascript
{
    apiId: 'team_id_2023',     // Unique API identifier
    name: 'Official Team Name', // Primary team name
    aliases: [                 // ALL possible name variations
        'Common Name',
        'Historical Name',
        'Local Name',
        'International Name'
    ],
    code: 'BTM',              // 3-letter team code
    founded: 1900,            // Founding year
    country: 'Country Name',   // Team's country
    city: 'City Name',        // Team's home city
    venue: {
        name: 'Stadium Name',
        city: 'City Name',
        coordinates: [longitude, latitude], // REQUIRED
        capacity: 50000
    }
}
```

## Implementation Process

### 1. Data Preparation
- [ ] Gather complete league information
- [ ] Collect all teams in the league
- [ ] Verify venue coordinates using Google Maps
- [ ] Compile list of team name variations
- [ ] Verify city and country information

### 2. Database Setup
```javascript
// Add league definition to LEAGUES_DATA
const LEAGUES_DATA = [
    {
        apiId: 'league_id',
        name: 'League Name',
        // ... other league data
    }
];

// Add venue mappings
const VENUE_LEAGUES = [
    { 
        venues: LEAGUE_VENUES,
        leagueApiId: 'league_id'
    }
];
```

### 3. Venue Lookup Process
The system follows this sequence for venue lookups:

1. **MongoDB Direct Lookup**
   ```javascript
   const venueByName = await venueService.getVenueByName(venueName, city);
   ```

2. **Team Mapping Fallback**
   ```javascript
   const mappedTeamName = await teamService.mapApiNameToTeam(teamName);
   const team = await Team.findOne({ 
       $or: [
           { name: mappedTeamName },
           { aliases: mappedTeamName }
       ]
   });
   ```

3. **Venue Service Backup**
   ```javascript
   const venueData = await venueService.getVenueForTeam(mappedTeamName);
   ```

### 4. Required Testing

Before considering a league implementation complete, verify:

1. **Data Integrity**
   - [ ] All teams have correct venue coordinates
   - [ ] City names are accurate (not team names)
   - [ ] All common team name variations are included
   - [ ] No undefined or null values in required fields

2. **Functionality**
   - [ ] Map markers appear for all teams
   - [ ] Distance calculations work correctly
   - [ ] Search works with all team name variations
   - [ ] Venue information displays correctly

3. **Edge Cases**
   - [ ] Teams with multiple venues
   - [ ] Teams sharing venues
   - [ ] Teams with recent venue changes
   - [ ] Special characters in names

## Example Implementation

Here's a complete example using Bundesliga:

```javascript
// League definition
{
    apiId: '78',
    name: 'Bundesliga',
    shortName: 'BL1',
    country: 'Germany',
    countryCode: 'DE',
    tier: 1
}

// Team example (Bayern Munich)
{
    apiId: 'bayern_2023',
    name: 'FC Bayern München',
    aliases: [
        'Bayern Munich',
        'Bayern München',
        'Bayern',
        'FCB'
    ],
    code: 'BAY',
    founded: 1900,
    country: 'Germany',
    city: 'Munich',
    venue: {
        name: 'Allianz Arena',
        city: 'Munich',
        coordinates: [11.624722, 48.218889],
        capacity: 75000
    }
}
```

## Common Issues and Solutions

1. **Missing Coordinates**
   - ❌ Never leave coordinates as null
   - ✅ Always verify coordinates with Google Maps
   - ✅ Use [longitude, latitude] format

2. **Name Variations**
   - ❌ Don't rely on single name format
   - ✅ Include all common variations in aliases
   - ✅ Consider international and local names

3. **City Names**
   - ❌ Don't use team names as city names
   - ✅ Use official city names
   - ✅ Be consistent with city naming

4. **Data Updates**
   - ❌ Don't hardcode temporary data
   - ✅ Use the venue service for updates
   - ✅ Implement proper cache invalidation

## Maintenance

- Update venue data when teams change stadiums
- Review and update team aliases periodically
- Monitor for any data inconsistencies
- Keep league season information current

## Reference Implementations

- Premier League (ID: 39)
- Bundesliga (ID: 78)

These leagues serve as our gold standard for implementation. Refer to their setup when implementing new leagues. 