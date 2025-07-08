const mongoose = require('mongoose');
const Team = require('../models/Team');

const teamNameMapping = {
    // Premier League teams
    'Arsenal': 'Arsenal FC',
    'Aston Villa': 'Aston Villa FC',
    'Bournemouth': 'AFC Bournemouth',
    'Brentford': 'Brentford FC',
    'Brighton': 'Brighton & Hove Albion FC',
    'Chelsea': 'Chelsea FC',
    'Crystal Palace': 'Crystal Palace FC',
    'Everton': 'Everton FC',
    'Fulham': 'Fulham FC',
    'Liverpool': 'Liverpool FC',
    'Luton': 'Luton Town FC',
    'Manchester City': 'Manchester City FC',
    'Manchester United': 'Manchester United FC',
    'Newcastle': 'Newcastle United FC',
    'Nottingham Forest': 'Nottingham Forest FC',
    'Sheffield Utd': 'Sheffield United FC',
    'Tottenham': 'Tottenham Hotspur FC',
    'West Ham': 'West Ham United FC',
    'Wolves': 'Wolverhampton Wanderers FC',

    // La Liga teams
    'Atletico Madrid': 'Atlético de Madrid',
    'Athletic Club': 'Athletic Club',
    'Villarreal': 'Villarreal CF',
    'Sevilla': 'Sevilla FC',
    'Real Betis': 'Real Betis',
    'Real Sociedad': 'Real Sociedad',
    'Osasuna': 'CA Osasuna',
    'Valencia': 'Valencia CF',
    'Celta Vigo': 'RC Celta de Vigo',
    'Espanyol': 'RCD Espanyol',
    'Real Madrid': 'Real Madrid CF',
    'Alaves': 'Deportivo Alavés',
    'Girona': 'Girona FC',
    'Barcelona': 'FC Barcelona',
    'Levante': 'Levante UD',
    'Mallorca': 'RCD Mallorca',
    'Getafe': 'Getafe CF',
    'Rayo Vallecano': 'Rayo Vallecano',
    'Elche': 'Elche CF',
    'Oviedo': 'Real Oviedo',

    // Championship teams
    'Watford': 'Watford FC',
    'Birmingham': 'Birmingham City FC',
    'Blackburn': 'Blackburn Rovers FC',
    'Bristol City': 'Bristol City FC',
    'Cardiff': 'Cardiff City FC',
    'Coventry': 'Coventry City FC',
    'Huddersfield': 'Huddersfield Town FC',
    'Hull': 'Hull City FC',
    'Ipswich': 'Ipswich Town FC',
    'Leeds': 'Leeds United FC',
    'Leicester': 'Leicester City FC',
    'Middlesbrough': 'Middlesbrough FC',
    'Millwall': 'Millwall FC',
    'Norwich': 'Norwich City FC',
    'Plymouth': 'Plymouth Argyle FC',
    'Preston': 'Preston North End FC',
    'QPR': 'Queens Park Rangers FC',
    'Rotherham': 'Rotherham United FC',
    'Sheffield Wed': 'Sheffield Wednesday FC',
    'Southampton': 'Southampton FC',
    'Stoke': 'Stoke City FC',
    'Sunderland': 'Sunderland AFC',
    'Swansea': 'Swansea City AFC',
    'West Brom': 'West Bromwich Albion FC',

    // League One teams
    'Barnsley': 'Barnsley FC',
    'Blackpool': 'Blackpool FC',
    'Bolton': 'Bolton Wanderers FC',
    'Bristol Rovers': 'Bristol Rovers FC',
    'Burton': 'Burton Albion FC',
    'Cambridge': 'Cambridge United FC',
    'Carlisle': 'Carlisle United FC',
    'Charlton': 'Charlton Athletic FC',
    'Cheltenham': 'Cheltenham Town FC',
    'Derby': 'Derby County FC',
    'Exeter': 'Exeter City FC',
    'Fleetwood': 'Fleetwood Town FC',
    'Leyton Orient': 'Leyton Orient FC',
    'Lincoln': 'Lincoln City FC',
    'Northampton': 'Northampton Town FC',
    'Oxford': 'Oxford United FC',
    'Peterborough': 'Peterborough United FC',
    'Port Vale': 'Port Vale FC',
    'Portsmouth': 'Portsmouth FC',
    'Reading': 'Reading FC',
    'Shrewsbury': 'Shrewsbury Town FC',
    'Stevenage': 'Stevenage FC',
    'Wigan': 'Wigan Athletic FC',
    'Wycombe': 'Wycombe Wanderers FC',

    // MLS teams
    'Atlanta United FC': 'Atlanta United FC',
    'Austin': 'Austin FC',
    'Charlotte': 'Charlotte FC',
    'Chicago Fire': 'Chicago Fire FC',
    'Colorado Rapids': 'Colorado Rapids',
    'Columbus Crew': 'Columbus Crew SC',
    'DC United': 'D.C. United',
    'FC Cincinnati': 'FC Cincinnati',
    'FC Dallas': 'FC Dallas',
    'Houston Dynamo': 'Houston Dynamo FC',
    'Inter Miami': 'Inter Miami CF',
    'LA Galaxy': 'LA Galaxy',
    'Los Angeles FC': 'Los Angeles FC',
    'Minnesota United': 'Minnesota United FC',
    'Montreal Impact': 'CF Montréal',
    'Nashville SC': 'Nashville SC',
    'New England': 'New England Revolution',
    'New York City': 'New York City FC',
    'New York RB': 'New York Red Bulls',
    'Orlando City': 'Orlando City SC',
    'Philadelphia Union': 'Philadelphia Union',
    'Portland Timbers': 'Portland Timbers',
    'Real Salt Lake': 'Real Salt Lake',
    'San Jose Earthquakes': 'San Jose Earthquakes',
    'Seattle Sounders': 'Seattle Sounders FC',
    'Sporting Kansas City': 'Sporting Kansas City',
    'St. Louis City SC': 'St. Louis City SC',
    'Toronto FC': 'Toronto FC',
    'Vancouver Whitecaps': 'Vancouver Whitecaps FC',

    // Bundesliga teams
    'Bayern München': 'FC Bayern München',
    'SC Freiburg': 'SC Freiburg',
    'VfL Wolfsburg': 'VfL Wolfsburg',
    'Borussia Mönchengladbach': 'Borussia Mönchengladbach',
    'FSV Mainz 05': '1. FSV Mainz 05',
    '1. FC Heidenheim': '1. FC Heidenheim',
    'Union Berlin': '1. FC Union Berlin',
    'FC St. Pauli': 'FC St. Pauli',
    '1.FC Köln': '1. FC Köln',
    '1899 Hoffenheim': 'TSG 1899 Hoffenheim',
    'Bayer Leverkusen': 'Bayer 04 Leverkusen',
    'Borussia Dortmund': 'Borussia Dortmund',
    'Eintracht Frankfurt': 'Eintracht Frankfurt',
    'FC Augsburg': 'FC Augsburg',
    'Hamburger SV': 'Hamburger SV',
    'RB Leipzig': 'RB Leipzig',
    'VfB Stuttgart': 'VfB Stuttgart',
    'Werder Bremen': 'SV Werder Bremen',
};

async function updateTeamApiNames() {
    try {
        await mongoose.connect('mongodb://localhost:27017/overlap');
        console.log('Connected to MongoDB');

        let updated = 0;
        let errors = 0;

        for (const [apiName, teamName] of Object.entries(teamNameMapping)) {
            try {
                const result = await Team.updateOne(
                    { name: teamName },
                    { 
                        $set: { apiName: apiName },
                        $addToSet: { aliases: apiName }
                    }
                );

                if (result.modifiedCount > 0) {
                    console.log(`✅ Updated ${teamName} with API name: ${apiName}`);
                    updated++;
                } else {
                    console.log(`⚠️ No changes for ${teamName} (API: ${apiName})`);
                }
            } catch (error) {
                console.error(`❌ Error updating ${teamName}:`, error.message);
                errors++;
            }
        }

        console.log('\n📊 Summary:');
        console.log(`✅ Successfully updated: ${updated} teams`);
        console.log(`❌ Errors: ${errors}`);

    } catch (error) {
        console.error('Database connection error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

updateTeamApiNames(); 