const axios = require('axios');
const https = require('https');

const API_SPORTS_BASE_URL = 'https://v3.football.api-sports.io';
const API_SPORTS_KEY = process.env.API_SPORTS_KEY || '0ab95ca9f7baeb6fd551af7ca41ed8d2';

class ApiSportsService {
    constructor() {
        this.httpsAgent = new https.Agent({
            rejectUnauthorized: false
        });
        this.queue = [];
        this.activeCount = 0;
        this.nextStartAt = 0;
        this.blockedUntil = 0;
        this.drainTimer = null;
        this.minuteLimit = this.parsePositiveInt(process.env.API_SPORTS_RATE_LIMIT_PER_MINUTE) || 300;
        this.utilization = this.parseUtilization(process.env.API_SPORTS_RATE_LIMIT_UTILIZATION);
        this.maxConcurrentOverride = this.parsePositiveInt(process.env.API_SPORTS_MAX_CONCURRENT);
        this.lastKnownRemainingPerMinute = null;
        this.lastKnownRemainingPerDay = null;
        this.stats = {
            scheduledRequests: 0,
            completedRequests: 0,
            rateLimitedResponses: 0,
            lastRateLimitedAt: null
        };
        this.recalculateRateWindow();
    }

    parsePositiveInt(value) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            return null;
        }
        return Math.floor(parsed);
    }

    parseUtilization(value) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1) {
            return 0.93;
        }
        return parsed;
    }

    recalculateRateWindow() {
        const effectivePerMinute = Math.max(1, Math.floor(this.minuteLimit * this.utilization));
        this.effectivePerMinute = effectivePerMinute;
        this.minIntervalMs = Math.max(50, Math.ceil(60000 / effectivePerMinute));
        const autoConcurrent = Math.max(1, Math.min(12, Math.ceil(effectivePerMinute / 30)));
        this.maxConcurrent = this.maxConcurrentOverride || autoConcurrent;
    }

    updateRateLimitFromHeaders(headers = {}) {
        const limitHeader = headers['x-ratelimit-limit'] || headers['X-RateLimit-Limit'];
        const parsedLimit = this.parsePositiveInt(limitHeader);
        if (parsedLimit && parsedLimit !== this.minuteLimit) {
            this.minuteLimit = parsedLimit;
            this.recalculateRateWindow();
        }
        const remainingPerMinute = this.parsePositiveInt(headers['x-ratelimit-remaining'] || headers['X-RateLimit-Remaining']);
        if (remainingPerMinute != null) {
            this.lastKnownRemainingPerMinute = remainingPerMinute;
        }
        const remainingPerDay = this.parsePositiveInt(headers['x-ratelimit-requests-remaining']);
        if (remainingPerDay != null) {
            this.lastKnownRemainingPerDay = remainingPerDay;
        }
    }

    applyRateLimitBackoff(headers = {}) {
        const retryAfterHeader = headers['retry-after'];
        const retryAfterSeconds = this.parsePositiveInt(retryAfterHeader);
        const fallbackBackoffMs = Math.max(15000, this.minIntervalMs * this.maxConcurrent * 4);
        const backoffMs = retryAfterSeconds ? retryAfterSeconds * 1000 : fallbackBackoffMs;
        this.stats.rateLimitedResponses += 1;
        this.stats.lastRateLimitedAt = new Date().toISOString();
        this.blockedUntil = Math.max(this.blockedUntil, Date.now() + backoffMs);
    }

    async get(path, options = {}) {
        return this.schedule(async () => {
            try {
                const response = await axios.get(`${API_SPORTS_BASE_URL}${path}`, {
                    params: options.params,
                    timeout: options.timeout || 10000,
                    httpsAgent: this.httpsAgent,
                    headers: {
                        'x-apisports-key': API_SPORTS_KEY,
                        ...(options.headers || {})
                    }
                });
                this.updateRateLimitFromHeaders(response.headers);
                this.stats.completedRequests += 1;
                return response;
            } catch (error) {
                if (error?.response?.headers) {
                    this.updateRateLimitFromHeaders(error.response.headers);
                }
                if (error?.response?.status === 429) {
                    this.applyRateLimitBackoff(error.response.headers || {});
                }
                this.stats.completedRequests += 1;
                throw error;
            }
        });
    }

    schedule(task) {
        return new Promise((resolve, reject) => {
            this.stats.scheduledRequests += 1;
            this.queue.push({ task, resolve, reject });
            this.drainQueue();
        });
    }

    scheduleDrain(delayMs) {
        if (this.drainTimer) {
            return;
        }
        this.drainTimer = setTimeout(() => {
            this.drainTimer = null;
            this.drainQueue();
        }, Math.max(0, delayMs));
    }

    drainQueue() {
        while (this.queue.length > 0 && this.activeCount < this.maxConcurrent) {
            const now = Date.now();
            const earliestStart = Math.max(this.nextStartAt, this.blockedUntil);
            if (now < earliestStart) {
                this.scheduleDrain(earliestStart - now);
                return;
            }
            const nextItem = this.queue.shift();
            this.activeCount += 1;
            this.nextStartAt = now + this.minIntervalMs;
            Promise.resolve()
                .then(() => nextItem.task())
                .then(result => nextItem.resolve(result))
                .catch(error => nextItem.reject(error))
                .finally(() => {
                    this.activeCount -= 1;
                    this.drainQueue();
                });
        }
        if (this.queue.length > 0 && this.activeCount < this.maxConcurrent) {
            const earliestStart = Math.max(this.nextStartAt, this.blockedUntil);
            this.scheduleDrain(earliestStart - Date.now());
        }
    }

    getLimiterState() {
        return {
            minuteLimit: this.minuteLimit,
            utilization: this.utilization,
            effectivePerMinute: this.effectivePerMinute,
            minIntervalMs: this.minIntervalMs,
            maxConcurrent: this.maxConcurrent,
            activeCount: this.activeCount,
            queuedRequests: this.queue.length,
            blockedForMs: Math.max(0, this.blockedUntil - Date.now()),
            nextStartInMs: Math.max(0, this.nextStartAt - Date.now()),
            remainingPerMinute: this.lastKnownRemainingPerMinute,
            remainingPerDay: this.lastKnownRemainingPerDay,
            scheduledRequests: this.stats.scheduledRequests,
            completedRequests: this.stats.completedRequests,
            rateLimitedResponses: this.stats.rateLimitedResponses,
            lastRateLimitedAt: this.stats.lastRateLimitedAt
        };
    }
}

module.exports = new ApiSportsService();
