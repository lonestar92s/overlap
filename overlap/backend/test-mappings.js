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
                successful++;
            } else {
            }
        } catch (error) {
        }
    }
    // Test the "Johan Cruijff Arena" issue specifically
    const ajaxMapped = mapTeamName('Ajax');
    try {
        const ajaxVenue = await venueService.getVenueForTeam(ajaxMapped);
    } catch (error) {
    }
    // Show database stats
    try {
        const stats = await venueService.getCacheStats();
    } catch (error) {
    }
}
// Run the test
testMappings().catch(console.error); 