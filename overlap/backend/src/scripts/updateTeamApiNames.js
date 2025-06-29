const mongoose = require('mongoose');
const teamService = require('../services/teamService');

// Import the hardcoded team name mapping from matches.js
const TEAM_NAME_MAPPING = {
    // Premier League
    'Liverpool': 'Liverpool FC',
    'Arsenal': 'Arsenal FC',
    'Chelsea': 'Chelsea FC',
    'Manchester United': 'Manchester United FC',
    'Manchester City': 'Manchester City FC',
    'Tottenham': 'Tottenham Hotspur FC',
    'Newcastle': 'Newcastle United FC',
    'Aston Villa': 'Aston Villa FC',
    'West Ham': 'West Ham United FC',
    'Brighton': 'Brighton & Hove Albion FC',
    'Crystal Palace': 'Crystal Palace FC',
    'Fulham': 'Fulham FC',
    'Brentford': 'Brentford FC',
    'Nottingham Forest': 'Nottingham Forest FC',
    'Everton': 'Everton FC',
    'Wolverhampton Wanderers': 'Wolverhampton Wanderers FC',
    'Bournemouth': 'AFC Bournemouth',
    'Leicester': 'Leicester City FC',
    'Southampton': 'Southampton FC',
    'Ipswich': 'Ipswich Town FC',
    
    // Championship
    'West Bromwich Albion': 'West Bromwich Albion FC',
    'Norwich': 'Norwich City FC',
    'Hull City': 'Hull City AFC',
    'Coventry': 'Coventry City FC',
    'Sunderland': 'Sunderland AFC',
    'Preston': 'Preston North End FC',
    'Middlesbrough': 'Middlesbrough FC',
    'Stoke City': 'Stoke City FC',
    'Bristol City': 'Bristol City FC',
    'Cardiff': 'Cardiff City FC',
    'Birmingham': 'Birmingham City FC',
    'Watford': 'Watford FC',
    'Plymouth': 'Plymouth Argyle FC',
    
    // La Liga
    'Real Madrid': 'Real Madrid CF',
    'Barcelona': 'FC Barcelona',
    'Atletico Madrid': 'Atlético de Madrid',
    'Sevilla': 'Sevilla FC',
    'Real Betis': 'Real Betis',
    'Valencia': 'Valencia CF',
    'Villarreal': 'Villarreal CF',
    'Athletic Club': 'Athletic Bilbao',
    'Real Sociedad': 'Real Sociedad',
    'Celta Vigo': 'RC Celta de Vigo',
    'Espanyol': 'RCD Espanyol',
    'Getafe': 'Getafe CF',
    'Osasuna': 'CA Osasuna',
    'Rayo Vallecano': 'Rayo Vallecano',
    'Alaves': 'Deportivo Alavés',
    'Las Palmas': 'UD Las Palmas',
    'Girona': 'Girona FC',
    'Mallorca': 'RCD Mallorca',
    'Leganes': 'CD Leganés',
    'Valladolid': 'Real Valladolid CF',
    
    // Bundesliga
    'Bayern Munich': 'FC Bayern München',
    'Borussia Dortmund': 'Borussia Dortmund',
    'RB Leipzig': 'RB Leipzig',
    'Bayer Leverkusen': 'Bayer 04 Leverkusen',
    'Eintracht Frankfurt': 'Eintracht Frankfurt',
    'Wolfsburg': 'VfL Wolfsburg',
    'Borussia Monchengladbach': 'Borussia Mönchengladbach',
    'Union Berlin': '1. FC Union Berlin',
    'Freiburg': 'SC Freiburg',
    'Stuttgart': 'VfB Stuttgart',
    'Hoffenheim': 'TSG 1899 Hoffenheim',
    'Mainz': '1. FSV Mainz 05',
    'Augsburg': 'FC Augsburg',
    'Werder Bremen': 'SV Werder Bremen',
    'Heidenheim': '1. FC Heidenheim 1846',
    'Darmstadt': 'SV Darmstadt 98',
    'Bochum': 'VfL Bochum 1848',
    'Koln': '1. FC Köln',
    
    // Serie A
    'Juventus': 'Juventus FC',
    'AC Milan': 'AC Milan',
    'Inter': 'Inter Milan',
    'Napoli': 'SSC Napoli',
    'AS Roma': 'AS Roma',
    'Lazio': 'SS Lazio',
    'Atalanta': 'Atalanta BC',
    'Fiorentina': 'ACF Fiorentina',
    'Bologna': 'Bologna FC 1909',
    'Torino': 'Torino FC',
    'Cagliari': 'Cagliari Calcio',
    'Parma': 'Parma Calcio 1913',
    'Verona': 'Hellas Verona FC',
    'Como': 'Como 1907',
    'Udinese': 'Udinese Calcio',
    'Lecce': 'US Lecce',
    'Genoa': 'Genoa CFC',
    'Empoli': 'Empoli FC',
    'Monza': 'AC Monza',
    'Venezia': 'Venezia FC',
    
    // Ligue 1
    'Paris Saint Germain': 'Paris Saint-Germain FC',
    'Marseille': 'Olympique de Marseille',
    'Lyon': 'Olympique Lyonnais',
    'Monaco': 'AS Monaco FC',
    'Lille': 'LOSC Lille',
    'Nice': 'OGC Nice',
    'Rennes': 'Stade Rennais FC',
    'Strasbourg': 'RC Strasbourg Alsace',
    'Nantes': 'FC Nantes',
    'Montpellier': 'Montpellier HSC',
    'Lens': 'RC Lens',
    'Brest': 'Stade Brestois 29',
    'Reims': 'Stade de Reims',
    'Toulouse': 'Toulouse FC',
    'Le Havre': 'Le Havre AC',
    'Metz': 'FC Metz',
    'Clermont Foot': 'Clermont Foot 63',
    'Angers': 'Angers SCO',
    
    // Brazilian Serie A
    'Bahia': 'EC Bahia',
    'Fluminense': 'Fluminense FC',
    'Flamengo': 'CR Flamengo',
    'Palmeiras': 'SE Palmeiras',
    'Sao Paulo': 'São Paulo FC',
    'Internacional': 'SC Internacional',
    'Atletico-MG': 'CA Mineiro',
    'Vasco DA Gama': 'CR Vasco da Gama',
    'Gremio': 'Grêmio FBPA',
    'Corinthians': 'SC Corinthians Paulista',
    'Fortaleza EC': 'Fortaleza EC',
    'Santos': 'Santos FC',
    'Cruzeiro': 'Cruzeiro EC',
    'Vitoria': 'EC Vitória',
    'RB Bragantino': 'RB Bragantino',
    'Ceara': 'Ceará SC',
    'Botafogo': 'Botafogo FR',
    'Mirassol': 'Mirassol FC',
    'Juventude': 'EC Juventude',
    'Sport Recife': 'Sport Recife',
    
    // Eredivisie (Dutch League)
    'Ajax': 'AFC Ajax',
    'PSV': 'PSV',
    'Feyenoord': 'Feyenoord Rotterdam',
    'AZ Alkmaar': 'AZ',
    'FC Twente': 'FC Twente \'65',
    'Vitesse': 'Vitesse Arnhem',
    'FC Utrecht': 'FC Utrecht',
    'SC Heerenveen': 'SC Heerenveen',
    'Sparta Rotterdam': 'Sparta Rotterdam',
    'NEC Nijmegen': 'NEC',
    'PEC Zwolle': 'PEC Zwolle',
    'Go Ahead Eagles': 'Go Ahead Eagles',
    'Almere City': 'Almere City FC',
    'Excelsior': 'Excelsior Rotterdam',
    'Heracles': 'Heracles Almelo',
    'RKC Waalwijk': 'RKC Waalwijk',
    'Fortuna Sittard': 'Fortuna Sittard',
    'FC Volendam': 'FC Volendam',
    'FC Groningen': 'FC Groningen',
    'Willem II': 'Willem II Tilburg',
    'NAC Breda': 'NAC Breda',

    // Primeira Liga (Portuguese League)
    'Benfica': 'SL Benfica',
    'Porto': 'FC Porto',
    'Sporting CP': 'Sporting CP',
    'Braga': 'SC Braga',
    'Vitoria Guimaraes': 'Vitória SC',
    'Rio Ave': 'Rio Ave FC',
    'Moreirense': 'Moreirense FC',
    'Famalicao': 'FC Famalicão',
    'Gil Vicente': 'Gil Vicente FC',
    'Casa Pia': 'Casa Pia AC',
    'Boavista': 'Boavista FC',
    'Estoril': 'GD Estoril Praia',
    'Arouca': 'FC Arouca',
    'Santa Clara': 'CD Santa Clara',
    'Nacional': 'CD Nacional',
    'Farense': 'SC Farense',
    'Estrela Amadora': 'CF Estrela da Amadora',
    'AVS': 'AVS Futebol SAD',

    // MLS
    'Atlanta United FC': 'Atlanta United FC',
    'Austin': 'Austin FC',
    'Charlotte': 'Charlotte FC',
    'Chicago Fire': 'Chicago Fire FC',
    'FC Cincinnati': 'FC Cincinnati',
    'Colorado Rapids': 'Colorado Rapids',
    'Columbus Crew': 'Columbus Crew',
    'DC United': 'D.C. United',
    'FC Dallas': 'FC Dallas',
    'Houston Dynamo': 'Houston Dynamo FC',
    'Inter Miami': 'Inter Miami CF',
    'Los Angeles FC': 'Los Angeles FC',
    'Los Angeles Galaxy': 'LA Galaxy',
    'Minnesota United FC': 'Minnesota United FC',
    'CF Montreal': 'CF Montréal',
    'Nashville SC': 'Nashville SC',
    'New England Revolution': 'New England Revolution',
    'New York City FC': 'New York City FC',
    'New York Red Bulls': 'New York Red Bulls',
    'Orlando City SC': 'Orlando City SC',
    'Philadelphia Union': 'Philadelphia Union',
    'Portland Timbers': 'Portland Timbers',
    'Real Salt Lake': 'Real Salt Lake',
    'San Jose Earthquakes': 'San Jose Earthquakes',
    'Seattle Sounders': 'Seattle Sounders FC',
    'Sporting Kansas City': 'Sporting Kansas City',
    'St. Louis City': 'St. Louis City SC',
    'Toronto FC': 'Toronto FC',
    'Vancouver Whitecaps': 'Vancouver Whitecaps FC',
    'San Diego': 'San Diego FC',

    // Swiss Super League
    'FC Zurich': 'FC Zurich',
    'Young Boys': 'BSC Young Boys',
    'Basel': 'FC Basel 1893',
    'Servette': 'Servette FC',
    'Lugano': 'FC Lugano',
    'St. Gallen': 'FC ST. Gallen',
    'Luzern': 'FC Luzern',
    'Sion': 'FC Sion',
    'Grasshopper': 'Grasshoppers',
    'Lausanne': 'Lausanne',
    'Winterthur': 'FC Winterthur',
    'Thun': 'FC Thun'
};

async function updateTeamApiNames() {
    try {
        console.log('🚀 Starting API name update for teams...');
        
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/overlap');
        console.log('✅ Connected to MongoDB');

        // Update teams with API names
        const result = await teamService.updateTeamsWithApiNames(TEAM_NAME_MAPPING);
        
        console.log(`\n🎉 API name update completed!`);
        console.log(`✅ Successfully updated: ${result.updated} teams`);
        console.log(`❌ Errors: ${result.errors}`);

        if (result.updated > 0) {
            console.log('\n🧹 Clearing team service cache...');
            teamService.clearCache();
        }

        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
        
    } catch (error) {
        console.error('❌ Error updating team API names:', error);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    updateTeamApiNames().catch(console.error);
}

module.exports = { updateTeamApiNames, TEAM_NAME_MAPPING }; 