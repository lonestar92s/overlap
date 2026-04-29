/**
 * League filter helpers for performSearch (NL/OpenAI often passes apiId "39" as name).
 */

/**
 * True when filter token matches fixture league by api id or by substring on name.
 * @param {number|string} leagueApiId - API-Sports league id on the fixture
 * @param {string} leagueNameLower - lowercased league name from API
 * @param {string} filterToken - user/model filter: "39", "Premier League", etc.
 */
function matchesLeagueFilterToken(leagueApiId, leagueNameLower, filterToken) {
    const t = String(filterToken).trim();
    if (!t) {
        return false;
    }
    if (/^\d+$/.test(t)) {
        return String(leagueApiId) === t;
    }
    return leagueNameLower.includes(t.toLowerCase());
}

/**
 * When fixtures were already fetched only for the same league id(s) the user asked for,
 * skip redundant per-row league filtering (cheaper; avoids id-vs-name bugs).
 * @param {string[]} leagues - filter list from parsed query (names and/or numeric ids)
 * @param {string[]|number[]} competitions - league ids used for API fixtures requests
 */
function shouldSkipLeagueFilter(leagues, competitions) {
    if (!leagues || leagues.length === 0 || !competitions || competitions.length === 0) {
        return false;
    }
    const allNumeric = leagues.every((l) => /^\d+$/.test(String(l).trim()));
    if (!allNumeric) {
        return false;
    }
    const filterIds = new Set(leagues.map((l) => String(l).trim()));
    const compIds = new Set(competitions.map((c) => String(c)));
    if (filterIds.size !== compIds.size) {
        return false;
    }
    for (const id of filterIds) {
        if (!compIds.has(id)) {
            return false;
        }
    }
    return true;
}

module.exports = {
    matchesLeagueFilterToken,
    shouldSkipLeagueFilter
};
