const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });

async function checkDataFreshness() {
    try {
        console.log('🔍 Starting data freshness check...');
        await mongoose.connect(process.env.MONGODB_URI);
        
        const leagueService = require('../src/services/leagueService');
        
        // Check major leagues
        const majorLeagues = [
            { id: '39', name: 'Premier League', country: 'England' },
            { id: '78', name: 'Bundesliga', country: 'Germany' },
            { id: '140', name: 'La Liga', country: 'Spain' },
            { id: '135', name: 'Serie A', country: 'Italy' },
            { id: '61', name: 'Ligue 1', country: 'France' }
        ];
        
        const issues = [];
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        
        for (const league of majorLeagues) {
            try {
                const dbLeague = await leagueService.getLeagueById(league.id);
                
                // Determine expected season
                let expectedSeason;
                if (currentMonth >= 8) {
                    expectedSeason = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
                } else {
                    expectedSeason = `${currentYear - 1}-${currentYear.toString().slice(-2)}`;
                }
                
                const currentSeasonInDB = dbLeague?.season?.start ? 
                    `${new Date(dbLeague.season.start).getFullYear()}-${new Date(dbLeague.season.end).getFullYear().toString().slice(-2)}` : 
                    'Unknown';
                
                // Check for season mismatch
                if (currentSeasonInDB !== expectedSeason) {
                    issues.push({
                        league: league.name,
                        type: 'season_mismatch',
                        severity: 'high',
                        message: `Season mismatch: DB has ${currentSeasonInDB}, expected ${expectedSeason}`
                    });
                }
                
                // Check last update
                const daysSinceUpdate = dbLeague?.updatedAt ? 
                    Math.floor((Date.now() - new Date(dbLeague.updatedAt)) / (1000 * 60 * 60 * 24)) : 
                    999;
                
                if (daysSinceUpdate > 30) {
                    issues.push({
                        league: league.name,
                        type: 'stale_data',
                        severity: 'medium',
                        message: `League data not updated for ${daysSinceUpdate} days`
                    });
                }
                
                console.log(`✅ ${league.name}: Season ${currentSeasonInDB}, ${daysSinceUpdate} days since update`);
                
            } catch (error) {
                issues.push({
                    league: league.name,
                    type: 'error',
                    severity: 'high',
                    message: `Error checking league: ${error.message}`
                });
            }
        }
        
        // Report results
        console.log(`\n📊 Data Freshness Check Results:`);
        console.log(`✅ Checked: ${majorLeagues.length} leagues`);
        console.log(`⚠️  Issues found: ${issues.length}`);
        
        if (issues.length > 0) {
            console.log('\n🚨 Issues Detected:');
            issues.forEach(issue => {
                const severity = issue.severity === 'high' ? '🔴' : 
                               issue.severity === 'medium' ? '🟡' : '🟢';
                console.log(`  ${severity} ${issue.league}: ${issue.message}`);
            });
            
            // In a real implementation, you could:
            // - Send email notifications to admins
            // - Post to Slack/Discord
            // - Create admin dashboard alerts
            // - Log to monitoring system
            
            console.log('\n💡 Recommended Actions:');
            const highSeverityIssues = issues.filter(i => i.severity === 'high');
            if (highSeverityIssues.length > 0) {
                console.log('  • Check API-Sports for new season data');
                console.log('  • Update league configurations in database');
                console.log('  • Verify external API connectivity');
            }
            
            const staleDataIssues = issues.filter(i => i.type === 'stale_data');
            if (staleDataIssues.length > 0) {
                console.log('  • Refresh league data from API');
                console.log('  • Check automated data sync processes');
            }
        } else {
            console.log('🎉 All leagues are up to date!');
        }
        
        // Season transition alerts
        if (currentMonth === 7) {
            console.log('\n🏁 Season Transition Alert:');
            console.log('  • New football seasons starting soon!');
            console.log('  • Check for updated team rosters');
            console.log('  • Verify new fixture data availability');
        }
        
        if (currentMonth === 1) {
            console.log('\n⚽ Mid-Season Check:');
            console.log('  • Winter transfer window active');
            console.log('  • Check for squad updates');
        }
        
        process.exit(issues.length > 0 ? 1 : 0); // Exit code indicates if issues found
        
    } catch (error) {
        console.error('❌ Error during data freshness check:', error);
        process.exit(1);
    }
}

console.log('⚽ Football Data Freshness Monitor');
console.log('==================================');
checkDataFreshness(); 