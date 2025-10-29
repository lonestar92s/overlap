const mongoose = require('mongoose');
const League = require('../models/League');
require('dotenv').config();

// Hardcoded league data from mobile app's AVAILABLE_LEAGUES
const AVAILABLE_LEAGUES_DATA = [
  { id: 39, name: 'Premier League', country: 'England', coords: [52.3555, -1.1743] },
  { id: 40, name: 'Championship', country: 'England', coords: [52.3555, -1.1743] },
  { id: 41, name: 'League One', country: 'England', coords: [52.3555, -1.1743] },
  { id: 44, name: "Women's Super League", country: 'England', coords: [52.3555, -1.1743] },
  { id: 699, name: "Women's Championship", country: 'England', coords: [52.3555, -1.1743] },
  { id: 140, name: 'La Liga', country: 'Spain', coords: [40.4637, -3.7492] },
  { id: 78, name: 'Bundesliga', country: 'Germany', coords: [51.1657, 10.4515] },
  { id: 79, name: 'Bundesliga 2', country: 'Germany', coords: [51.1657, 10.4515] },
  { id: 218, name: 'Austrian Bundesliga', country: 'Austria', coords: [47.5162, 14.5501] },
  { id: 219, name: 'Austrian 2. Liga', country: 'Austria', coords: [47.5162, 14.5501] },
  { id: 211, name: 'Prva HNL', country: 'Croatia', coords: [45.1000, 15.2000] },
  { id: 135, name: 'Serie A', country: 'Italy', coords: [41.8719, 12.5674] },
  { id: 61, name: 'Ligue 1', country: 'France', coords: [46.6034, 1.8883] },
  { id: 2, name: 'Champions League', country: 'Europe', coords: null, isInternational: true },
  { id: 3, name: 'Europa League', country: 'Europe', coords: null, isInternational: true },
  { id: 848, name: 'Europa Conference League', country: 'Europe', coords: null, isInternational: true },
  { id: 94, name: 'Primeira Liga', country: 'Portugal', coords: [39.3999, -8.2245] },
  { id: 97, name: 'Taca da Liga', country: 'Portugal', coords: [39.3999, -8.2245] },
  { id: 88, name: 'Eredivisie', country: 'Netherlands', coords: [52.1326, 5.2913] },
  { id: 144, name: 'Jupiler Pro League', country: 'Belgium', coords: [50.5039, 4.4699] },
  { id: 203, name: 'Süper Lig', country: 'Turkey', coords: [38.9637, 35.2433] },
  { id: 307, name: 'Saudi Pro League', country: 'Saudi Arabia', coords: [23.8859, 45.0792] },
  { id: 253, name: 'Major League Soccer', country: 'USA', coords: [39.8283, -98.5795] },
  { id: 71, name: 'Série A', country: 'Brazil', coords: [-14.2350, -51.9253] },
  { id: 262, name: 'Liga MX', country: 'Mexico', coords: [23.6345, -102.5528] },
  { id: 188, name: 'Scottish Premiership', country: 'Scotland', coords: [56.4907, -4.2026] },
  { id: 207, name: 'Swiss Super League', country: 'Switzerland', coords: [46.8182, 8.2275] },
  { id: 244, name: 'Veikkausliiga', country: 'Finland', coords: [64.0, 26.0] },
  
  // International Competitions
  { id: 1, name: 'FIFA World Cup', country: 'International', coords: null, isInternational: true },
  { id: 4, name: 'European Championship', country: 'Europe', coords: null, isInternational: true },
  { id: 5, name: 'UEFA Nations League', country: 'Europe', coords: null, isInternational: true },
  { id: 6, name: 'Africa Cup of Nations', country: 'Africa', coords: null, isInternational: true },
  { id: 7, name: 'Asian Cup', country: 'Asia', coords: null, isInternational: true },
  { id: 8, name: 'World Cup - Women', country: 'International', coords: null, isInternational: true },
  { id: 9, name: 'Copa America', country: 'South America', coords: null, isInternational: true },
  { id: 10, name: 'Friendlies', country: 'International', coords: null, isInternational: true },
  { id: 13, name: 'Copa Libertadores', country: 'South America', coords: null, isInternational: true },
  { id: 15, name: 'FIFA Club World Cup', country: 'International', coords: null, isInternational: true },
  { id: 26, name: 'International Champions Cup', country: 'International', coords: null, isInternational: true },
  { id: 29, name: 'World Cup - Qualification Africa', country: 'Africa', coords: null, isInternational: true },
  { id: 30, name: 'World Cup - Qualification Asia', country: 'Asia', coords: null, isInternational: true },
  { id: 31, name: 'World Cup - Qualification CONCACAF', country: 'North America', coords: null, isInternational: true },
  { id: 32, name: 'World Cup - Qualification Europe', country: 'Europe', coords: null, isInternational: true },
  { id: 33, name: 'World Cup - Qualification Oceania', country: 'Oceania', coords: null, isInternational: true },
  { id: 34, name: 'World Cup - Qualification South America', country: 'South America', coords: null, isInternational: true },
  { id: 37, name: 'World Cup - Qualification Intercontinental Play-offs', country: 'International', coords: null, isInternational: true },
  { id: 1083, name: 'UEFA Women\'s Euro 2025', country: 'Europe', coords: null, isInternational: true }
];

async function migrateAvailableLeagues() {
    try {
        // Connect to Railway MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('📦 Connected to Railway MongoDB');

        let createdCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;

        for (const leagueData of AVAILABLE_LEAGUES_DATA) {
            try {
                // Check if league already exists
                const existingLeague = await League.findOne({ apiId: leagueData.id.toString() });
                
                if (existingLeague) {
                    // Update existing league with new data
                    existingLeague.name = leagueData.name;
                    existingLeague.shortName = getShortName(leagueData.name);
                    existingLeague.country = leagueData.country;
                    existingLeague.countryCode = getCountryCode(leagueData.country);
                    existingLeague.tier = getTierFromLeague(leagueData.name);
                    existingLeague.emblem = `https://media.api-sports.io/football/leagues/${leagueData.id}.png`;
                    existingLeague.isActive = true;
                    existingLeague.lastUpdated = new Date();
                    
                    await existingLeague.save();
                    console.log(`🔄 Updated league: ${leagueData.name}`);
                    updatedCount++;
                } else {
                    // Create new league
                    const league = new League({
                        apiId: leagueData.id.toString(),
                        name: leagueData.name,
                        shortName: getShortName(leagueData.name),
                        country: leagueData.country,
                        countryCode: getCountryCode(leagueData.country),
                        tier: getTierFromLeague(leagueData.name),
                        emblem: `https://media.api-sports.io/football/leagues/${leagueData.id}.png`,
                        season: {
                            start: '2025-08-01',
                            end: '2026-05-31',
                            current: true
                        },
                        isActive: true
                    });
                    
                    await league.save();
                    console.log(`✅ Created league: ${leagueData.name}`);
                    createdCount++;
                }
            } catch (error) {
                console.error(`❌ Error processing league ${leagueData.name}:`, error.message);
                skippedCount++;
            }
        }

        console.log('\n📊 Migration Summary:');
        console.log(`✅ Created: ${createdCount} leagues`);
        console.log(`🔄 Updated: ${updatedCount} leagues`);
        console.log(`⏭️  Skipped: ${skippedCount} leagues`);
        console.log(`📈 Total processed: ${createdCount + updatedCount + skippedCount} leagues`);

        // Show final count
        const totalLeagues = await League.countDocuments();
        console.log(`\n🏆 Total leagues in Railway MongoDB: ${totalLeagues}`);

        console.log('\n✨ Available leagues migration completed!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Disconnected from Railway MongoDB');
        process.exit(0);
    }
}

// Helper function to get short name
function getShortName(leagueName) {
    const shortNameMapping = {
        'Premier League': 'EPL',
        'Championship': 'ELC',
        'League One': 'EL1',
        'Women\'s Super League': 'WSL',
        'Women\'s Championship': 'WC',
        'La Liga': 'LL',
        'Bundesliga': 'BL1',
        'Bundesliga 2': 'BL2',
        'Austrian Bundesliga': 'ABL',
        'Austrian 2. Liga': 'A2L',
        'Prva HNL': 'HNL',
        'Serie A': 'SA',
        'Ligue 1': 'FL1',
        'Champions League': 'UCL',
        'Europa League': 'UEL',
        'Europa Conference League': 'UECL',
        'Primeira Liga': 'PPL',
        'Taca da Liga': 'TDL',
        'Eredivisie': 'DED',
        'Jupiler Pro League': 'JPL',
        'Süper Lig': 'TSL',
        'Saudi Pro League': 'SPL',
        'Major League Soccer': 'MLS',
        'Série A': 'BSA',
        'Liga MX': 'LMX',
        'Scottish Premiership': 'SPL',
        'Swiss Super League': 'SSL',
        'Veikkausliiga': 'VL',
        'FIFA World Cup': 'WC',
        'European Championship': 'EC',
        'UEFA Nations League': 'UNL',
        'Africa Cup of Nations': 'AFCON',
        'Asian Cup': 'AC',
        'World Cup - Women': 'WWC',
        'Copa America': 'CA',
        'Friendlies': 'FR',
        'Copa Libertadores': 'CL',
        'FIFA Club World Cup': 'CWC',
        'International Champions Cup': 'ICC',
        'World Cup - Qualification Africa': 'WCQ-AF',
        'World Cup - Qualification Asia': 'WCQ-AS',
        'World Cup - Qualification CONCACAF': 'WCQ-NA',
        'World Cup - Qualification Europe': 'WCQ-EU',
        'World Cup - Qualification Oceania': 'WCQ-OC',
        'World Cup - Qualification South America': 'WCQ-SA',
        'World Cup - Qualification Intercontinental Play-offs': 'WCQ-IC',
        'UEFA Women\'s Euro 2025': 'WEURO25'
    };
    return shortNameMapping[leagueName] || leagueName.substring(0, 3).toUpperCase();
}

// Helper function to get country code
function getCountryCode(country) {
    const countryMapping = {
        'England': 'GB',
        'Spain': 'ES',
        'Germany': 'DE',
        'France': 'FR',
        'Italy': 'IT',
        'Portugal': 'PT',
        'Netherlands': 'NL',
        'Belgium': 'BE',
        'Austria': 'AT',
        'Croatia': 'HR',
        'Turkey': 'TR',
        'Saudi Arabia': 'SA',
        'USA': 'US',
        'Brazil': 'BR',
        'Mexico': 'MX',
        'Scotland': 'GB',
        'Switzerland': 'CH',
        'Finland': 'FI',
        'Europe': 'INT',
        'International': 'INT',
        'Africa': 'INT',
        'Asia': 'INT',
        'South America': 'INT',
        'North America': 'INT',
        'Oceania': 'INT'
    };
    return countryMapping[country] || 'INT';
}

// Helper function to determine tier
function getTierFromLeague(leagueName) {
    if (leagueName.includes('Championship') || leagueName.includes('2.') || leagueName.includes('Segunda')) {
        return 2;
    } else if (leagueName.includes('League One') || leagueName.includes('3.')) {
        return 3;
    } else if (leagueName.includes('Women')) {
        return 1; // Women's leagues are tier 1
    } else {
        return 1; // Default to tier 1
    }
}

// Run the migration
if (require.main === module) {
    migrateAvailableLeagues();
}

module.exports = { migrateAvailableLeagues, AVAILABLE_LEAGUES_DATA };
