const { getVenueForTeam } = require('./src/data/venues');

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

console.log('🔍 Testing Complete Mapping Pipeline\n');

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

testTeams.forEach(apiTeamName => {
    const mappedName = mapTeamName(apiTeamName);
    const venue = getVenueForTeam(mappedName);
    
    if (venue) {
        console.log(`✅ ${apiTeamName} → ${mappedName} → ${venue.stadium} (${venue.location})`);
    } else {
        console.log(`❌ ${apiTeamName} → ${mappedName} → Not found in venues`);
    }
});

console.log('\n📊 Summary:');
console.log(`Total teams tested: ${testTeams.length}`);
const successful = testTeams.filter(team => {
    const mapped = mapTeamName(team);
    return getVenueForTeam(mapped) !== null;
}).length;
console.log(`Successfully mapped: ${successful}/${testTeams.length} (${(successful/testTeams.length*100).toFixed(1)}%)`);

// Test the "Johan Cruijff Arena" issue specifically
console.log('\n🏟️  Testing Ajax specifically:');
const ajaxMapped = mapTeamName('Ajax');
const ajaxVenue = getVenueForTeam(ajaxMapped);
console.log(`API name: Ajax`);
console.log(`Mapped to: ${ajaxMapped}`);
console.log(`Venue: ${ajaxVenue ? ajaxVenue.stadium : 'Not found'}`);
console.log(`City: ${ajaxVenue ? ajaxVenue.location : 'Unknown'}`);
console.log(`Country: Netherlands (from league mapping)`); 