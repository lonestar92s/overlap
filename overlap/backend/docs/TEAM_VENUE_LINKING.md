# How Teams are Linked to Venues

## Architecture Overview

Teams and venues use an **embedded document pattern** rather than a reference relationship. The `venue` field in the `Team` model is a **subdocument** that contains a denormalized copy of venue data, not a reference to a separate `Venue` document.

---

## Data Model

### Team Model Structure

```33:37:overlap/backend/src/models/Team.js
    venue: {
        name: String,
        capacity: Number,
        coordinates: [Number] // [longitude, latitude]
    },
```

**Key Points:**
- `venue` is an **embedded subdocument** (not a reference)
- It's **optional** - can be `null` or an object
- Contains: `name`, `capacity`, and `coordinates`
- No foreign key or reference to the `Venue` collection

### Venue Model Structure

The `Venue` collection is a **separate collection** with its own schema:

```1:93:overlap/backend/src/models/Venue.js
const mongoose = require('mongoose');

const venueSchema = new mongoose.Schema({
    venueId: {
        type: Number,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    aliases: [{
        type: String
    }],
    city: {
        type: String,
        required: true
    },
    country: {
        type: String,
        required: true
    },
    countryCode: {
        type: String,
        required: true,
        length: 2
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            required: false
        },
        coordinates: {
            type: [Number],
            required: false,
            validate: {
                validator: function(v) {
                    // Skip validation if value is not provided
                    if (!v || !Array.isArray(v)) {
                        return true;
                    }
                    // Validate only if coordinates are provided
                    return v.length === 2 &&
                           v[0] >= -180 && v[0] <= 180 && // longitude
                           v[1] >= -90 && v[1] <= 90;     // latitude
                },
                message: 'Coordinates must be [longitude, latitude] array with valid ranges'
            }
        }
    },
    address: {
        type: String
    },
    capacity: {
        type: Number,
        min: 0
    },
    surface: {
        type: String
    },
    image: {
        type: String
    },
    coordinates: {
        type: [Number],
        required: false,
        validate: {
            validator: function(v) {
                // Skip validation if value is not provided
                if (!v || !Array.isArray(v)) {
                    return true;
                }
                // Validate only if coordinates are provided
                return v.length === 2 &&
                       v[0] >= -180 && v[0] <= 180 && // longitude
                       v[1] >= -90 && v[1] <= 90;     // latitude
            },
            message: 'Coordinates must be [longitude, latitude] array with valid ranges'
        }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});
```

**Key Points:**
- `Venue` is a **separate collection** with full venue details
- Has both `coordinates` (array) and `location.coordinates` (GeoJSON Point)
- Contains more fields than the embedded team venue (address, surface, image, etc.)

---

## Linking Mechanisms

### 1. **Initial Import from API**

When teams are first imported from external APIs (API-Sports), venue data is embedded directly:

```218:227:overlap/backend/src/services/leagueOnboardingService.js
        let venueInfo = null;
        if (teamData.venue) {
            venueInfo = {
                name: teamData.venue.name || '',
                capacity: teamData.venue.capacity || null,
                coordinates: teamData.venue.lat && teamData.venue.lng 
                    ? [parseFloat(teamData.venue.lng), parseFloat(teamData.venue.lat)]
                    : null
            };
        }
```

**Process:**
1. Extract venue data from API response
2. Convert lat/lng to `[longitude, latitude]` array
3. Embed directly into team document
4. **No lookup** to Venue collection at this stage

### 2. **Manual Linking Scripts**

Several scripts exist to link teams to venues from the `Venue` collection:

#### A. `linkAllTeamVenues.js` - General Linking

This script searches the `Venue` collection and copies data to team documents:

```33:108:overlap/backend/src/scripts/linkAllTeamVenues.js
        for (const team of teams) {
            try {
                // Skip if already has venue with coordinates
                if (team.venue && team.venue.coordinates && Array.isArray(team.venue.coordinates) && team.venue.coordinates.length === 2) {
                    alreadyLinked++;
                    continue;
                }

                // Try to find venue by team name
                let venue = null;
                
                // Strategy 1: Search by team name in venue name
                venue = await Venue.findOne({
                    name: { $regex: new RegExp(team.name, 'i') },
                    country: team.country
                });

                // Strategy 2: Search by city if venue not found
                if (!venue && team.city) {
                    venue = await Venue.findOne({
                        city: { $regex: new RegExp(team.city, 'i') },
                        country: team.country
                    });
                }

                // Strategy 3: Search by team name variations (remove FC, remove common suffixes)
                if (!venue) {
                    const teamNameVariations = [
                        team.name,
                        team.name.replace(/\s*FC\s*/gi, ''),
                        team.name.replace(/\s*CF\s*/gi, ''),
                        team.name.replace(/\s*AC\s*/gi, ''),
                        team.name.replace(/\s*United\s*/gi, ''),
                        team.name.replace(/\s*City\s*/gi, '')
                    ].filter((v, i, arr) => arr.indexOf(v) === i); // Remove duplicates

                    for (const variation of teamNameVariations) {
                        venue = await Venue.findOne({
                            name: { $regex: new RegExp(variation, 'i') },
                            country: team.country
                        });
                        if (venue) break;
                    }
                }

                if (venue) {
                    // Check if venue has coordinates
                    const coords = venue.coordinates || venue.location?.coordinates;
                    
                    if (coords && Array.isArray(coords) && coords.length === 2) {
                        // Update team with venue data
                        team.venue = {
                            name: venue.name,
                            coordinates: coords,
                            capacity: venue.capacity || null
                        };
                        
                        // Also update city if missing
                        if (!team.city && venue.city) {
                            team.city = venue.city;
                        }

                        await team.save();
                        linked++;
```

**Linking Strategies:**
1. **Exact name match** - Search venue name containing team name
2. **City match** - If no name match, search by city
3. **Name variations** - Try variations (remove "FC", "CF", "AC", "United", "City")

#### B. `linkLaLigaVenues.js` - League-Specific Linking

Similar process but with a predefined mapping for La Liga teams:

```6:25:overlap/backend/src/scripts/linkLaLigaVenues.js
// Mapping of team names to venue names (for cases where names don't match exactly)
const TEAM_VENUE_MAPPING = {
    'Barcelona': ['Camp Nou', 'Spotify Camp Nou'],
    'Real Madrid': ['Santiago Bernabéu', 'Estadio Santiago Bernabéu'],
    'Atletico Madrid': ['Wanda Metropolitano', 'Metropolitano'],
    'Valencia': ['Mestalla', 'Estadio de Mestalla'],
    'Villarreal': ['Estadio de la Cerámica', 'Cerámica'],
    'Sevilla': ['Ramón Sánchez-Pizjuán', 'Estadio Ramón Sánchez Pizjuán'],
    'Celta Vigo': ['Balaídos', 'Abanca-Balaídos'],
    'Levante': ['Estadi Ciutat de València'],
    'Espanyol': ['RCDE Stadium', 'Estadi Cornellà-El Prat'],
    'Athletic Club': ['San Mamés', 'Estadio San Mamés'],
    'Real Betis': ['Benito Villamarín', 'Estadio Benito Villamarín'],
    'Getafe': ['Coliseum', 'Estadio Coliseum'],
    'Girona': ['Montilivi', 'Estadi Municipal de Montilivi'],
    'Real Sociedad': ['Reale Arena', 'Anoeta'],
    'Rayo Vallecano': ['Vallecas', 'Estadio de Vallecas'],
    'Elche': ['Martínez Valero', 'Estadio Manuel Martínez Valero'],
    'Mallorca': ['Son Moix', 'Estadi Mallorca Son Moix']
};
```

#### C. `fixMadridTeamVenues.js` - Specific Team Fixes

Manual fixes for specific teams:

```22:41:overlap/backend/src/scripts/fixMadridTeamVenues.js
        // Fix Real Madrid - should be Estadio Santiago Bernabéu
        const realMadrid = await Team.findOne({ name: /real madrid/i });
        const bernabeu = await Venue.findOne({ 
            name: { $regex: /santiago bernab/i },
            city: /madrid/i
        });

        if (realMadrid && bernabeu && bernabeu.coordinates) {
            console.log(`🔧 Fixing Real Madrid`);
            console.log(`   Current venue: ${realMadrid.venue?.name || 'None'}`);
            console.log(`   Correct venue: ${bernabeu.name}`);
            console.log(`   Coordinates: [${bernabeu.coordinates[0]}, ${bernabeu.coordinates[1]}]`);
            
            realMadrid.venue = {
                name: bernabeu.name,
                coordinates: bernabeu.coordinates
            };
            await realMadrid.save();
            console.log(`   ✅ Updated Real Madrid\n`);
        }
```

### 3. **Runtime Linking During Match Processing**

When processing matches, the system can dynamically link teams to venues and update team records:

```971:978:overlap/backend/src/routes/matches.js
                                    // Also update team if it exists
                                    if (team && !team.venue?.coordinates) {
                                        if (!team.venue) team.venue = {};
                                        team.venue.name = venueName;
                                        team.venue.coordinates = geocodedCoords;
                                        team.city = venueCity;
                                        await team.save();
                                        console.log(`💾 Updated team ${team.name} with venue coordinates`);
                                    }
```

**Process:**
1. During match transformation, if team venue is missing
2. Attempt geocoding based on venue name/city
3. If successful, **update the team document** with geocoded coordinates
4. This creates a permanent link for future use

---

## Linking Flow Diagram

```
┌─────────────────┐
│  External API   │
│  (API-Sports)   │
└────────┬────────┘
         │
         │ teamData.venue
         ▼
┌─────────────────┐
│  Team Import    │
│  (Initial)      │
└────────┬────────┘
         │
         │ Embed venue subdocument
         ▼
┌─────────────────┐      ┌─────────────────┐
│  Team Document  │      │  Venue Document │
│  (teams)        │      │  (venues)        │
│                 │      │                 │
│  venue: {       │      │  - venueId      │
│    name: "...", │      │  - name         │
│    coords: [...]│      │  - coordinates  │
│  }              │      │  - city         │
└────────┬────────┘      │  - country      │
         │               │  - ...          │
         │               └─────────────────┘
         │                      │
         │                      │ Linking Scripts
         │                      │ (linkAllTeamVenues,
         │                      │  linkLaLigaVenues)
         │                      │
         │                      ▼
         │               ┌─────────────────┐
         │               │  Find Venue by  │
         │               │  Name/City      │
         │               └────────┬────────┘
         │                        │
         │                        │ Copy venue data
         │                        │ to team.venue
         │                        │
         └────────────────────────┘
                  │
                  ▼
         ┌─────────────────┐
         │  Updated Team   │
         │  with Venue     │
         └─────────────────┘
```

---

## Key Characteristics

### 1. **Denormalized Data**
- Venue data is **copied** into team documents, not referenced
- This allows fast reads (no joins needed)
- But requires keeping data in sync manually

### 2. **No Foreign Key Relationship**
- There's **no database-level relationship** between teams and venues
- Linking is done through **application logic** (scripts, runtime updates)
- Matching is done by **name/city similarity**, not IDs

### 3. **One-Way Data Flow**
- Data flows from `Venue` collection → `Team.venue` subdocument
- Updates to `Venue` collection **do not automatically** update team documents
- Manual scripts must be run to sync changes

### 4. **Multiple Linking Strategies**
- **Name matching** (exact, partial, variations)
- **City matching** (fallback)
- **Predefined mappings** (for known mismatches)
- **Geocoding** (runtime fallback)

---

## Common Issues

### 1. **Teams with Null Venues**
- Teams can exist without venue data
- No automatic linking on team creation
- Requires manual script execution

### 2. **Stale Data**
- If a venue is updated in the `Venue` collection, team documents are not automatically updated
- Must re-run linking scripts to sync

### 3. **Name Mismatches**
- Team names and venue names don't always match
- Requires manual mapping or fuzzy matching
- Some teams may never be linked automatically

### 4. **Missing Coordinates**
- Venues may exist but lack coordinates
- Teams linked to venues without coordinates still can't be used for geographic searches
- Requires geocoding step

---

## Best Practices

1. **Run Linking Scripts Regularly**
   - After importing new teams
   - After updating venue data
   - As part of data quality maintenance

2. **Monitor Unlinked Teams**
   - Track teams with null venues
   - Identify patterns in linking failures
   - Create specific mappings for common cases

3. **Geocode During Match Processing**
   - Use runtime geocoding as fallback
   - Update team records when geocoding succeeds
   - Reduces need for manual intervention

4. **Consider Migration to References**
   - For better data consistency
   - Automatic updates when venues change
   - But requires refactoring existing code

