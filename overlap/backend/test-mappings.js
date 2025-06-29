const venueService = require('./src/services/venueService');

// Copy the exact mapping from routes/matches.js
const TEAM_NAME_MAPPING = {
    // Premier League
    'Liverpool': 'Liverpool FC',
    'Arsenal': 'Arsenal FC',
    'Chelsea': 'Chelsea FC',
    'Manchester United': 'Manchester United FC',
    'Manchester City': 'Manchester City FC',
    
    // Eredivisie (Dutch League)
    'Ajax': 'AFC Ajax',
    'PSV': 'PSV',
    'Feyenoord': 'Feyenoord Rotterdam',
    'AZ Alkmaar': 'AZ',
    
    // Primeira Liga (Portuguese League)
    'Benfica': 'SL Benfica',
    'Porto': 'FC Porto',
    'Sporting CP': 'Sporting CP',
    'Braga': 'SC Braga',
    'Vitoria Guimaraes': 'Vitória SC',
};

function mapTeamName(apiSportsName) {
    return TEAM_NAME_MAPPING[apiSportsName] || apiSportsName;
}

async function testMappings() {
    console.log('🔍 Testing Complete Mapping Pipeline with Database\n');

    const testTeams = [
        'Ajax',           // Should map to AFC Ajax
        'PSV',            // Should map to PSV  
        'Feyenoord',      // Should map to Feyenoord Rotterdam
        'Benfica',        // Should map to SL Benfica
        'Porto',          // Should map to FC Porto
        'Arsenal',        // Should map to Arsenal FC
        'Liverpool',      // Should map to Liverpool FC
        'Unknown Team'    // Should not map
    ];

    let successful = 0;

    for (const apiTeamName of testTeams) {
        const mappedName = mapTeamName(apiTeamName);
        try {
            const venue = await venueService.getVenueForTeam(mappedName);
            
            if (venue) {
                console.log(`✅ ${apiTeamName} → ${mappedName} → ${venue.name} (${venue.city})`);
                successful++;
            } else {
                console.log(`❌ ${apiTeamName} → ${mappedName} → Not found in database`);
            }
        } catch (error) {
            console.log(`❌ ${apiTeamName} → ${mappedName} → Error: ${error.message}`);
        }
    }

    console.log('\n📊 Summary:');
    console.log(`Total teams tested: ${testTeams.length}`);
    console.log(`Successfully mapped: ${successful}/${testTeams.length} (${(successful/testTeams.length*100).toFixed(1)}%)`);

    // Test the "Johan Cruijff Arena" issue specifically
    console.log('\n🏟️  Testing Ajax specifically:');
    const ajaxMapped = mapTeamName('Ajax');
    try {
        const ajaxVenue = await venueService.getVenueForTeam(ajaxMapped);
        console.log(`API name: Ajax`);
        console.log(`Mapped to: ${ajaxMapped}`);
        console.log(`Venue: ${ajaxVenue ? ajaxVenue.name : 'Not found'}`);
        console.log(`City: ${ajaxVenue ? ajaxVenue.city : 'Unknown'}`);
        console.log(`Country: ${ajaxVenue ? ajaxVenue.country : 'Netherlands (from league mapping)'}`);
    } catch (error) {
        console.log(`Error testing Ajax: ${error.message}`);
    }

    // Show database stats
    console.log('\n📈 Database Stats:');
    try {
        const stats = await venueService.getCacheStats();
        console.log(`Teams in database: ${stats.teamCount}`);
        console.log(`Venues in database: ${stats.venueCount}`);
        console.log(`Cache hits: ${stats.cacheHits}`);
        console.log(`Cache misses: ${stats.cacheMisses}`);
    } catch (error) {
        console.log(`Error getting stats: ${error.message}`);
    }
}

// Run the test
testMappings().catch(console.error); 