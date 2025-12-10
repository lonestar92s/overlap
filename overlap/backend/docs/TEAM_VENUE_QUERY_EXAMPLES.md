# Team Venue Query Examples

Quick reference for querying teams by venue status using `venueId`.

## Basic Usage

### In a Script

```javascript
const mongoose = require('mongoose');
const Team = require('../models/Team');
require('dotenv').config();

async function findTeams() {
    await mongoose.connect(process.env.MONGO_PUBLIC_URL);
    
    // Find teams with no venueId
    const teams = await Team.find({ 'venue.venueId': null });
    
    console.log(`Found ${teams.length} teams`);
    
    await mongoose.disconnect();
}
```

### In a Route/API Endpoint

```javascript
const Team = require('../models/Team');

router.get('/teams/needing-venues', async (req, res) => {
    try {
        const teams = await Team.find({ 
            'venue.venueId': null 
        }).select('name country city venue');
        
        res.json({ count: teams.length, teams });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

### In a Service

```javascript
const Team = require('../models/Team');

class TeamService {
    async getTeamsNeedingVenueLinking() {
        return await Team.find({
            venue: { $exists: true, $ne: null },
            'venue.venueId': { $exists: false }
        });
    }
}
```

## Common Query Patterns

### 1. Teams with no venueId (needs linking)

```javascript
// Option A: Explicitly null
const teams = await Team.find({ 'venue.venueId': null });

// Option B: Field doesn't exist (more accurate for new schema)
const teams = await Team.find({ 
    'venue.venueId': { $exists: false },
    venue: { $exists: true, $ne: null }
});

// Option C: Either null or doesn't exist
const teams = await Team.find({
    $or: [
        { 'venue.venueId': null },
        { 'venue.venueId': { $exists: false } }
    ],
    venue: { $exists: true, $ne: null }
});
```

### 2. Teams with venueId (successfully linked)

```javascript
const teams = await Team.find({
    'venue.venueId': { $exists: true, $ne: null }
});
```

### 3. Teams with no venue at all

```javascript
const teams = await Team.find({
    $or: [
        { venue: null },
        { venue: { $exists: false } }
    ]
});
```

### 4. Teams with venueId but no coordinates

```javascript
const teams = await Team.find({
    'venue.venueId': { $exists: true, $ne: null },
    $or: [
        { 'venue.coordinates': { $exists: false } },
        { 'venue.coordinates': null },
        { 'venue.coordinates': [] }
    ]
});
```

### 5. Teams using a specific venue

```javascript
const venueId = 123;
const teams = await Team.find({ 'venue.venueId': venueId });
```

### 6. Teams with venues in a specific country

```javascript
const teams = await Team.find({
    'venue.venueId': { $exists: true, $ne: null },
    country: 'Spain'
});
```

## Advanced Queries

### Count teams by status

```javascript
const stats = {
    withVenueId: await Team.countDocuments({ 
        'venue.venueId': { $exists: true, $ne: null } 
    }),
    needingLinking: await Team.countDocuments({ 
        venue: { $exists: true, $ne: null },
        'venue.venueId': { $exists: false }
    }),
    noVenue: await Team.countDocuments({ 
        $or: [
            { venue: null },
            { venue: { $exists: false } }
        ]
    })
};
```

### Find and update pattern

```javascript
// Find teams needing venueId
const teams = await Team.find({
    venue: { $exists: true, $ne: null },
    'venue.venueId': { $exists: false }
});

// Process each team
for (const team of teams) {
    // Find matching venue
    const venue = await Venue.findOne({
        name: team.venue.name,
        country: team.country
    });
    
    if (venue) {
        team.venue.venueId = venue.venueId;
        await team.save();
    }
}
```

### Aggregation example

```javascript
const stats = await Team.aggregate([
    {
        $group: {
            _id: {
                hasVenueId: { $cond: [
                    { $and: [
                        { $ne: ['$venue.venueId', null] },
                        { $ne: ['$venue.venueId', undefined] }
                    ]},
                    'withVenueId',
                    'noVenueId'
                ]}
            },
            count: { $sum: 1 }
        }
    }
]);
```

## Running the Example Script

```bash
cd overlap/backend
node src/scripts/findTeamsByVenueStatus.js
```

This will show you:
- Teams needing venue linking
- Teams with no venue
- Teams with venueId (successfully linked)
- Teams needing coordinates

## Tips

1. **Use `.lean()` for read-only queries** (faster, returns plain objects):
   ```javascript
   const teams = await Team.find({ 'venue.venueId': null }).lean();
   ```

2. **Use `.select()` to limit fields** (faster queries):
   ```javascript
   const teams = await Team.find({ 'venue.venueId': null })
       .select('name country city venue');
   ```

3. **Use `.limit()` for large result sets**:
   ```javascript
   const teams = await Team.find({ 'venue.venueId': null })
       .limit(100);
   ```

4. **Check both null and $exists: false** for maximum compatibility:
   ```javascript
   const teams = await Team.find({
       $or: [
           { 'venue.venueId': null },
           { 'venue.venueId': { $exists: false } }
       ]
   });
   ```


