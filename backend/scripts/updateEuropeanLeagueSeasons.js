/**
 * One-time script: set 2026-2027 season (Aug 2026 – May 2027) on European split-season leagues.
 *
 * Usage: node scripts/updateEuropeanLeagueSeasons.js [seasonYear]
 * Default seasonYear: 2026
 */
const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });

const League = require('../src/models/League');

const EUROPEAN_SPLIT_SEASON_LEAGUE_IDS = [
    '39', '140', '78', '135', '61', '62', // Top 5 + Ligue 2
    '94', '88', '144', '203', '188', '207', // Other European
    '2', '3', '848' // UEFA competitions
];

async function updateEuropeanLeagueSeasons() {
    const seasonYear = parseInt(process.argv[2] || '2026', 10);
    if (!Number.isInteger(seasonYear) || seasonYear < 2000 || seasonYear > 2100) {
        console.error('Invalid season year. Use a 4-digit year, e.g. 2026');
        process.exit(1);
    }

    const seasonStart = `${seasonYear}-08-01`;
    const seasonEnd = `${seasonYear + 1}-05-31`;

    await mongoose.connect(process.env.MONGODB_URI);

    const result = await League.updateMany(
        { apiId: { $in: EUROPEAN_SPLIT_SEASON_LEAGUE_IDS } },
        {
            $set: {
                'season.start': seasonStart,
                'season.end': seasonEnd,
                'season.current': true
            }
        }
    );

    const updated = await League.find({ apiId: { $in: EUROPEAN_SPLIT_SEASON_LEAGUE_IDS } })
        .select('apiId name season')
        .lean();

    console.log(`Updated ${result.modifiedCount} league(s) to ${seasonYear}-${String(seasonYear + 1).slice(-2)} (${seasonStart} → ${seasonEnd})`);
    updated.forEach((league) => {
        console.log(`  ${league.apiId} ${league.name}: ${league.season.start} → ${league.season.end}`);
    });

    await mongoose.disconnect();
}

updateEuropeanLeagueSeasons().catch((err) => {
    console.error(err);
    process.exit(1);
});
