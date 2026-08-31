const NlSearchLog = require('../models/NlSearchLog');

const VALID_SOURCES = new Set(['ask_agent_modal', 'messages_screen', 'map_results', 'unknown']);

function normalizeSource(source) {
    if (typeof source === 'string' && VALID_SOURCES.has(source)) {
        return source;
    }
    return 'unknown';
}

function extractTeamNames(parsed) {
    if (!parsed || typeof parsed !== 'object') return [];
    const names = [];
    if (parsed.primary?.teams) {
        parsed.primary.teams.forEach((team) => names.push(team?.name || team));
    }
    const anyTeams = parsed.teams?.any || (Array.isArray(parsed.teams) ? parsed.teams : []);
    anyTeams.forEach((team) => names.push(team?.name || team));
    return names.filter(Boolean).slice(0, 20);
}

function extractLeagueNames(parsed) {
    if (!parsed || typeof parsed !== 'object') return [];
    const leagues = parsed.leagues || parsed.primary?.leagues || [];
    return leagues
        .map((league) => {
            if (league == null) return null;
            if (typeof league === 'string' || typeof league === 'number') return String(league);
            return league.name || league.apiId || league.id || null;
        })
        .filter(Boolean)
        .slice(0, 20);
}

function buildParsedSummary(responseBody = {}) {
    const parsed = responseBody.parsed;
    if (!parsed || typeof parsed !== 'object') {
        return {};
    }

    if (responseBody.isMultiQuery || parsed.primary) {
        return {
            isMultiQuery: true,
            primary: {
                teams: parsed.primary?.teams || [],
                matchType: parsed.primary?.matchType || null
            },
            secondary: {
                count: parsed.secondary?.count ?? null,
                maxDistance: parsed.secondary?.maxDistance ?? null,
                leagues: parsed.secondary?.leagues || []
            },
            relationship: parsed.relationship || null
        };
    }

    return {
        isMultiQuery: false,
        teams: extractTeamNames(parsed),
        leagues: extractLeagueNames(parsed),
        location: parsed.location
            ? {
                  city: parsed.location.city || null,
                  country: parsed.location.country || null
              }
            : null,
        dateRange: parsed.dateRange || null,
        matchTypes: parsed.matchTypes || (parsed.matchType ? [parsed.matchType] : [])
    };
}

function extractMatchIds(responseBody = {}) {
    const ids = [];
    const matches = responseBody.matches;

    if (Array.isArray(matches)) {
        matches.forEach((match) => {
            const id = match?.fixture?.id ?? match?.id;
            if (id != null) ids.push(String(id));
        });
    } else if (matches && typeof matches === 'object') {
        const primaryId = matches.primary?.fixture?.id ?? matches.primary?.id;
        if (primaryId != null) ids.push(String(primaryId));
        if (Array.isArray(matches.secondary)) {
            matches.secondary.forEach((match) => {
                const id = match?.fixture?.id ?? match?.id;
                if (id != null) ids.push(String(id));
            });
        }
    }

    return [...new Set(ids)].slice(0, 50);
}

function attachNlSearchResponseLogger(req, res, startedAt) {
    const queueLog = (body) => {
        const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
        if (!query || !req.user?._id) return;

        recordNlSearchLog({
            userId: req.user._id,
            query,
            source: req.body.source,
            conversationTurns: Array.isArray(req.body.conversationHistory) ? req.body.conversationHistory.length : 0,
            durationMs: Date.now() - startedAt,
            responseBody: body
        }).catch((error) => {
            console.error('[nlSearchLog] failed to persist:', error.message);
        });
    };

    const wrapJson = (jsonFn) => (body) => {
        queueLog(body);
        return jsonFn.call(res, body);
    };

    const originalJson = res.json.bind(res);
    res.json = wrapJson(originalJson);

    const originalStatus = res.status.bind(res);
    res.status = function status(code) {
        const statusRes = originalStatus(code);
        const originalStatusJson = statusRes.json.bind(statusRes);
        statusRes.json = wrapJson(originalStatusJson);
        return statusRes;
    };
}

async function recordNlSearchLog({
    userId,
    query,
    source,
    conversationTurns = 0,
    durationMs = null,
    responseBody = {}
}) {
    await NlSearchLog.create({
        userId,
        query,
        source: normalizeSource(source),
        success: responseBody.success === true,
        isMultiQuery: responseBody.isMultiQuery === true,
        intent: responseBody.intent || null,
        matchCount: Number.isFinite(Number(responseBody.count)) ? Number(responseBody.count) : 0,
        missingFields: Array.isArray(responseBody.missingFields) ? responseBody.missingFields : [],
        confidence: Number.isFinite(Number(responseBody.confidence)) ? Number(responseBody.confidence) : null,
        code: responseBody.code || null,
        message: typeof responseBody.message === 'string' ? responseBody.message.slice(0, 2000) : null,
        parsedSummary: buildParsedSummary(responseBody),
        matchIds: extractMatchIds(responseBody),
        conversationTurns,
        durationMs
    });
}

module.exports = {
    attachNlSearchResponseLogger,
    recordNlSearchLog,
    buildParsedSummary,
    extractMatchIds,
    normalizeSource
};
