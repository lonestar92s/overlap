const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });
async function checkDataFreshness() {
    try {
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
        if (issues.length > 0) {
            issues.forEach(issue => {
                const severity = issue.severity === 'high' ? '🔴' : 
                               issue.severity === 'medium' ? '🟡' : '🟢';
            });
            // In a real implementation, you could:
            // - Send email notifications to admins
            // - Post to Slack/Discord
            // - Create admin dashboard alerts
            // - Log to monitoring system
            const highSeverityIssues = issues.filter(i => i.severity === 'high');
            if (highSeverityIssues.length > 0) {
            }
            const staleDataIssues = issues.filter(i => i.type === 'stale_data');
            if (staleDataIssues.length > 0) {
            }
        } else {
        }
        // Season transition alerts
        if (currentMonth === 7) {
        }
        if (currentMonth === 1) {
        }
        process.exit(issues.length > 0 ? 1 : 0); // Exit code indicates if issues found
    } catch (error) {
        console.error('❌ Error during data freshness check:', error);
        process.exit(1);
    }
}
checkDataFreshness(); 