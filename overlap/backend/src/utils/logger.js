/**
 * Logger utility
 * Provides environment-aware logging that doesn't leak sensitive information in production
 */

const isDevelopment = process.env.NODE_ENV !== 'production';
const isProduction = process.env.NODE_ENV === 'production';

// Sanitize sensitive data from logs
const sanitizeForLogging = (data) => {
    if (!data) return data;
    
    if (typeof data === 'string') {
        // Remove potential tokens/secrets
        return data
            .replace(/Bearer\s+[\w-]+\.[\w-]+\.[\w-]+/gi, 'Bearer [REDACTED]')
            .replace(/password["\s:=]+[^,\s}]+/gi, 'password: [REDACTED]')
            .replace(/token["\s:=]+[^,\s}]+/gi, 'token: [REDACTED]')
            .replace(/secret["\s:=]+[^,\s}]+/gi, 'secret: [REDACTED]');
    }
    
    if (typeof data === 'object') {
        const sanitized = { ...data };
        const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'authorization', 'authToken'];
        
        for (const key of sensitiveKeys) {
            if (sanitized[key]) {
                sanitized[key] = '[REDACTED]';
            }
        }
        
        return sanitized;
    }
    
    return data;
};

const logger = {
    /**
     * Log informational messages (only in development)
     */
    log: (...args) => {
        if (isDevelopment) {
            console.log(...args);
        }
    },

    /**
     * Log warnings (always logged, but sanitized in production)
     */
    warn: (...args) => {
        if (isProduction) {
            console.warn(...args.map(arg => sanitizeForLogging(arg)));
        } else {
            console.warn(...args);
        }
    },

    /**
     * Log errors (always logged, but sanitized in production)
     * In production, should also send to Sentry
     */
    error: (...args) => {
        if (isProduction) {
            // In production, sanitize and send to error reporting
            const sanitized = args.map(arg => sanitizeForLogging(arg));
            console.error('[ERROR]', ...sanitized);
            
            // Send to Sentry if available
            try {
                const Sentry = require('@sentry/node');
                if (Sentry && args[0] instanceof Error) {
                    Sentry.captureException(args[0]);
                } else {
                    Sentry.captureMessage(sanitized.join(' '), 'error');
                }
            } catch (e) {
                // Sentry not available, ignore
            }
        } else {
            console.error(...args);
        }
    },

    /**
     * Log debug messages (only in development)
     */
    debug: (...args) => {
        if (isDevelopment) {
            console.debug(...args);
        }
    },

    /**
     * Log info messages (always logged, sanitized in production)
     */
    info: (...args) => {
        if (isProduction) {
            console.info(...args.map(arg => sanitizeForLogging(arg)));
        } else {
            console.info(...args);
        }
    }
};

module.exports = logger;

