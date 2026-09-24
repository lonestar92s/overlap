const NL_QUERY_MAX_LENGTH = 250;
const NL_HOURLY_LIMIT = 8;
const NL_DAILY_LIMIT = 25;
const NL_HOUR_MS = 60 * 60 * 1000;
const NL_DAY_MS = 24 * 60 * 60 * 1000;

// Eval harness and integration tests authenticate as this user and would
// otherwise burn the shared daily allowance.
const NL_LIMIT_EXEMPT_USER_IDS = new Set(['507f1f77bcf86cd799439011']);

const MAP_SEARCH_MAX_DAYS = 31;
const MAP_SEARCH_MISS_LIMIT = 40;
const MAP_SEARCH_MISS_WINDOW_MS = 15 * 60 * 1000;

const mapSearchMissesByIp = new Map();

function isNlSearchLimitExempt(userId) {
    return NL_LIMIT_EXEMPT_USER_IDS.has(String(userId));
}

function evaluateNlSearchAdmission({ query, hourCount = 0, dayCount = 0, userId }) {
    const trimmed = typeof query === 'string' ? query.trim() : '';
    if (trimmed.length > NL_QUERY_MAX_LENGTH) {
        return {
            allowed: false,
            code: 'QUERY_TOO_LONG',
            message: `That search is too long. Keep it under ${NL_QUERY_MAX_LENGTH} characters.`,
            suggestions: ['Try a shorter search with a team, city, and date']
        };
    }

    if (isNlSearchLimitExempt(userId)) {
        return { allowed: true, query: trimmed };
    }

    if (dayCount >= NL_DAILY_LIMIT) {
        return {
            allowed: false,
            code: 'DAILY_LIMIT',
            message: `You've used all ${NL_DAILY_LIMIT} searches for today. Try again tomorrow.`,
            suggestions: []
        };
    }

    if (hourCount >= NL_HOURLY_LIMIT) {
        return {
            allowed: false,
            code: 'HOURLY_LIMIT',
            message: `You've used all ${NL_HOURLY_LIMIT} searches for this hour. Try again later.`,
            suggestions: []
        };
    }

    return { allowed: true, query: trimmed };
}

function inclusiveUtcDayCount(dateFrom, dateTo) {
    if (typeof dateFrom !== 'string' || typeof dateTo !== 'string') return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) return null;

    const start = Date.parse(`${dateFrom}T00:00:00Z`);
    const end = Date.parse(`${dateTo}T00:00:00Z`);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;

    return Math.round((end - start) / 86400000) + 1;
}

function mapSearchDateRangeError(dateFrom, dateTo) {
    const dayCount = inclusiveUtcDayCount(dateFrom, dateTo);
    if (dayCount == null || dayCount <= MAP_SEARCH_MAX_DAYS) return null;

    return {
        code: 'DATE_RANGE',
        message: `Map search covers up to ${MAP_SEARCH_MAX_DAYS} days at a time. Narrow the dates and try again.`
    };
}

function resetMapSearchMissLimiter() {
    mapSearchMissesByIp.clear();
}

function consumeMapSearchMiss(ip, now = Date.now()) {
    const key = ip || 'unknown';
    const cutoff = now - MAP_SEARCH_MISS_WINDOW_MS;
    const recent = (mapSearchMissesByIp.get(key) || []).filter((timestamp) => timestamp > cutoff);

    if (recent.length >= MAP_SEARCH_MISS_LIMIT) {
        mapSearchMissesByIp.set(key, recent);
        return {
            allowed: false,
            code: 'MAP_SEARCH_LIMIT',
            message: "You've searched the map a lot in a short time. Wait a few minutes and try again."
        };
    }

    recent.push(now);
    mapSearchMissesByIp.set(key, recent);
    return { allowed: true };
}

module.exports = {
    NL_QUERY_MAX_LENGTH,
    NL_HOURLY_LIMIT,
    NL_DAILY_LIMIT,
    NL_HOUR_MS,
    NL_DAY_MS,
    MAP_SEARCH_MAX_DAYS,
    MAP_SEARCH_MISS_LIMIT,
    MAP_SEARCH_MISS_WINDOW_MS,
    isNlSearchLimitExempt,
    evaluateNlSearchAdmission,
    inclusiveUtcDayCount,
    mapSearchDateRangeError,
    resetMapSearchMissLimiter,
    consumeMapSearchMiss
};
