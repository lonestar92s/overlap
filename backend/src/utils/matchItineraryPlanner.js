const { DateTime } = require('luxon');

/**
 * Weekend = Friday 17:00 through Sunday 23:59:59.999 in ianaTimeZone.
 * If anchor is Mon–Thu, uses the upcoming Friday of that week.
 * If anchor is Fri–Sun, uses the Friday of that same weekend.
 *
 * @param {string} ianaTimeZone - IANA zone (e.g. Europe/London)
 * @param {string} weekendAnchorLocalDate - YYYY-MM-DD (calendar date in that zone)
 * @returns {{ start: import('luxon').DateTime, end: import('luxon').DateTime, dateFrom: string, dateTo: string }}
 */
function weekendRangeFromAnchor(ianaTimeZone, weekendAnchorLocalDate) {
    const anchor = DateTime.fromISO(weekendAnchorLocalDate, { zone: ianaTimeZone });
    if (!anchor.isValid) {
        throw new Error(`Invalid weekendAnchorLocalDate or timezone: ${weekendAnchorLocalDate} ${ianaTimeZone}`);
    }
    const wd = anchor.weekday; // Monday=1 … Sunday=7
    let friday;
    if (wd < 5) {
        friday = anchor.plus({ days: 5 - wd });
    } else {
        friday = anchor.minus({ days: wd - 5 });
    }
    const start = friday.set({ hour: 17, minute: 0, second: 0, millisecond: 0 });
    const end = start
        .plus({ days: 2 })
        .set({ hour: 23, minute: 59, second: 59, millisecond: 999 });
    return {
        start,
        end,
        dateFrom: start.toISODate(),
        dateTo: end.toISODate()
    };
}

function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function estimateTravelMinutes(km, minutesPerKm) {
    return Math.ceil(km * minutesPerKm);
}

function legFeasible(prev, next, opts) {
    const { maxTravelMinutesBetweenMatches, fixedBufferMinutes, minutesPerKm } = opts;
    const km = haversineKm(prev.lat, prev.lng, next.lat, next.lng);
    const travelM = estimateTravelMinutes(km, minutesPerKm);
    if (travelM > maxTravelMinutesBetweenMatches) {
        return { ok: false, reason: 'travel_cap', travelM, km };
    }
    const gapMin = (next.kickoffMs - prev.kickoffMs) / 60000;
    if (gapMin < travelM + fixedBufferMinutes) {
        return { ok: false, reason: 'insufficient_gap', travelM, gapMin, km };
    }
    return { ok: true, travelM, gapMin, km };
}

function maxMatchesOnAnyLocalDay(chain, ianaTimeZone) {
    const counts = {};
    for (const node of chain) {
        const ymd = DateTime.fromMillis(node.kickoffMs, { zone: ianaTimeZone }).toISODate();
        counts[ymd] = (counts[ymd] || 0) + 1;
    }
    return Math.max(...Object.values(counts));
}

function canAddToChain(chain, next, opts) {
    if (chain.length === 0) {
        return true;
    }
    const leg = legFeasible(chain[chain.length - 1], next, opts);
    if (!leg.ok) {
        return false;
    }
    if (opts.maxLegsPerDay && opts.maxLegsPerDay > 0) {
        const trial = chain.concat(next);
        if (maxMatchesOnAnyLocalDay(trial, opts.ianaTimeZone) > opts.maxLegsPerDay) {
            return false;
        }
    }
    return true;
}

/**
 * Collect itineraries (ordered match chains) satisfying travel + per-day caps.
 * @param {Array} matches - Transformed matches from performSearch
 * @param {object} opts
 * @param {string} opts.ianaTimeZone
 * @param {number} opts.windowStartMs
 * @param {number} opts.windowEndMs
 * @param {number} opts.minMatches
 * @param {number} [opts.maxMatches=6]
 * @param {number} opts.maxTravelMinutesBetweenMatches
 * @param {number} opts.fixedBufferMinutes
 * @param {number} opts.minutesPerKm
 * @param {number} [opts.maxLegsPerDay=2]
 * @param {number} [opts.maxItineraries=10]
 * @param {number} [opts.nowMs=Date.now()] - fixtures with kickoff strictly before this are excluded (for tests)
 */
function findFeasibleItineraries(matches, opts) {
    const {
        ianaTimeZone,
        windowStartMs,
        windowEndMs,
        minMatches,
        maxMatches = 6,
        maxTravelMinutesBetweenMatches,
        fixedBufferMinutes,
        minutesPerKm,
        maxLegsPerDay = 2,
        maxItineraries = 10,
        nowMs = Date.now()
    } = opts;

    const now = typeof nowMs === 'number' && Number.isFinite(nowMs) ? nowMs : Date.now();

    const normalized = [];
    for (const m of matches) {
        const date = m.fixture?.date;
        const coords = m.fixture?.venue?.coordinates;
        if (!date || !coords || !Array.isArray(coords) || coords.length !== 2) {
            continue;
        }
        const kickoffMs = new Date(date).getTime();
        if (Number.isNaN(kickoffMs)) {
            continue;
        }
        if (kickoffMs < now) {
            continue;
        }
        if (kickoffMs < windowStartMs || kickoffMs > windowEndMs) {
            continue;
        }
        const [lng, lat] = coords;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            continue;
        }
        normalized.push({
            match: m,
            id: m.id,
            kickoffMs,
            lat,
            lng
        });
    }

    normalized.sort((a, b) => a.kickoffMs - b.kickoffMs);

    const itineraries = [];
    const plannerOpts = {
        ianaTimeZone,
        maxTravelMinutesBetweenMatches,
        fixedBufferMinutes,
        minutesPerKm,
        maxLegsPerDay
    };

    function extend(chain, startNextIdx) {
        if (itineraries.length >= maxItineraries) {
            return;
        }
        if (chain.length >= minMatches) {
            itineraries.push(chain.map((n) => n.match));
        }
        if (chain.length >= maxMatches) {
            return;
        }
        for (let i = startNextIdx; i < normalized.length; i++) {
            const cand = normalized[i];
            if (!canAddToChain(chain, cand, plannerOpts)) {
                continue;
            }
            extend(chain.concat(cand), i + 1);
        }
    }

    for (let i = 0; i < normalized.length; i++) {
        extend([normalized[i]], i + 1);
    }

    const scored = itineraries.map((itin) => {
        let totalTravel = 0;
        const nodes = itin.map((m) => {
            const c = m.fixture?.venue?.coordinates;
            const kickoffMs = new Date(m.fixture.date).getTime();
            return { kickoffMs, lat: c[1], lng: c[0] };
        });
        for (let k = 1; k < nodes.length; k++) {
            const km = haversineKm(nodes[k - 1].lat, nodes[k - 1].lng, nodes[k].lat, nodes[k].lng);
            totalTravel += estimateTravelMinutes(km, minutesPerKm);
        }
        const ends = nodes.map((n) => n.kickoffMs);
        let tightestGap = Infinity;
        for (let k = 1; k < ends.length; k++) {
            tightestGap = Math.min(tightestGap, (ends[k] - ends[k - 1]) / 60000);
        }
        return { matches: itin, matchCount: itin.length, totalTravelMinutesEstimate: totalTravel, tightestGapMinutes: tightestGap };
    });

    scored.sort((a, b) => {
        if (b.matchCount !== a.matchCount) {
            return b.matchCount - a.matchCount;
        }
        if (a.totalTravelMinutesEstimate !== b.totalTravelMinutesEstimate) {
            return a.totalTravelMinutesEstimate - b.totalTravelMinutesEstimate;
        }
        return b.tightestGapMinutes - a.tightestGapMinutes;
    });

    return {
        itineraries: scored.slice(0, maxItineraries),
        candidateFixturesInWindow: normalized.length
    };
}

module.exports = {
    weekendRangeFromAnchor,
    haversineKm,
    findFeasibleItineraries
};
