import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger.js';
import type { Request } from 'express';

// Strict limit for login endpoints (Brute force protection)
// 20 attempts per 5 minutes per IP (development friendly)
export const loginLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 20, // 20 attempts
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req, res) => {
        // Skip rate limit in development
        return process.env.NODE_ENV === 'development';
    },
    message: { error: 'Too many login attempts, please try again after 5 minutes' },
    handler: (req, res, next, options) => {
        logger.warn(`[RateLimit] Login limit exceeded for IP: ${req.socket?.remoteAddress}`);
        res.status(options.statusCode).json(options.message);
    }
});

// General API limit
// 300 requests per minute per User (if logged in) or IP
export const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 300, // Increased for development
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req, res) => {
        // Skip rate limit in development
        return process.env.NODE_ENV === 'development';
    },
    keyGenerator: (req: Request) => {
        // @ts-ignore
        // Use socket remoteAddress to bypass express-rate-limit's static analysis check for req.ip
        if (req.user?.id) return req.user.id;
        return req.socket?.remoteAddress || 'unknown';
    },
    // Disable validation to suppress the IPv6 bypass warning from express-rate-limit
    // when using custom keyGenerator with req.ip
    validate: {
        xForwardedForHeader: false,
        default: true,
        trustProxy: false,
        ip: false
    },
    message: { error: 'Too many requests, please slow down' },
    handler: (req, res, next, options) => {
        // @ts-ignore
        const key = req.user?.id || req.socket?.remoteAddress;
        logger.warn(`[RateLimit] API limit exceeded for: ${key}`);
        res.status(options.statusCode).json(options.message);
    }
});

// Webhook dispatch rate limiting (prevent DOS to external services)
export const webhookLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 1000, // Max 1000 webhook calls per minute
    keyGenerator: (req: Request) => {
        // Group by webhook ID if available, fallback to IP
        return req.body?.webhookId || req.socket?.remoteAddress || 'unknown';
    },
    // Disable validation to suppress the IPv6 bypass warning
    validate: {
        xForwardedForHeader: false,
        default: true,
        trustProxy: false,
        ip: false
    },
    skip: (req, res) => {
        // Only apply to webhook endpoints
        return !req.path.includes('/webhooks');
    }
});
