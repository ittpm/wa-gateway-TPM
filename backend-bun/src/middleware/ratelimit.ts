import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger.js';
import type { Request } from 'express';

// Konfigurasi Rate Limiting dari Environment Variables
const LOGIN_MAX_ATTEMPTS = parseInt(process.env.RATE_LOGIN_MAX || '20');
const LOGIN_WINDOW_MS = parseInt(process.env.RATE_LOGIN_WINDOW || '300000'); // 5 menit

const API_MAX_REQUESTS = parseInt(process.env.RATE_API_MAX || '300');
const API_WINDOW_MS = parseInt(process.env.RATE_API_WINDOW || '60000'); // 1 menit

const WEBHOOK_MAX_REQUESTS = parseInt(process.env.RATE_WEBHOOK_MAX || '1000');

// Strict limit for login endpoints (Brute force protection)
export const loginLimiter = rateLimit({
    windowMs: LOGIN_WINDOW_MS, 
    max: LOGIN_MAX_ATTEMPTS, 
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req, res) => {
        return process.env.NODE_ENV === 'development';
    },
    message: { error: 'Too many login attempts, please try again after 5 minutes' },
    handler: (req, res, next, options) => {
        logger.warn(`[RateLimit] Login limit exceeded for IP: ${req.socket?.remoteAddress}`);
        res.status(options.statusCode).json(options.message);
    }
});

// General API limit - based on User ID if logged in, otherwise IP address
export const apiLimiter = rateLimit({
    windowMs: API_WINDOW_MS, 
    max: API_MAX_REQUESTS, 
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req, res) => {
        return process.env.NODE_ENV === 'development';
    },
    keyGenerator: (req: Request) => {
        if (req.user?.id) return req.user.id;
        return req.socket?.remoteAddress || 'unknown';
    },
    validate: {
        xForwardedForHeader: false,
        default: true,
        trustProxy: false,
        ip: false
    },
    message: { error: 'Too many requests, please slow down. Consider upgrading your plan for higher limits.' },
    handler: (req, res, next, options) => {
        const key = req.user?.id || req.socket?.remoteAddress;
        logger.warn(`[RateLimit] API limit exceeded for: ${key} (Limit: ${API_MAX_REQUESTS} req/${API_WINDOW_MS/1000}s)`);
        res.status(options.statusCode).json(options.message);
    }
});

// Webhook dispatch rate limiting (prevent DOS to external services)
export const webhookLimiter = rateLimit({
    windowMs: 60 * 1000, 
    max: WEBHOOK_MAX_REQUESTS, 
    keyGenerator: (req: Request) => {
        return req.body?.webhookId || req.socket?.remoteAddress || 'unknown';
    },
    validate: {
        xForwardedForHeader: false,
        default: true,
        trustProxy: false,
        ip: false
    },
    skip: (req, res) => {
        return !req.path.includes('/webhooks');
    }
});

// Export rate limit config for monitoring
export const rateLimitConfig = {
    login: {
        maxAttempts: LOGIN_MAX_ATTEMPTS,
        windowMs: LOGIN_WINDOW_MS
    },
    api: {
        maxRequests: API_MAX_REQUESTS,
        windowMs: API_WINDOW_MS
    },
    webhook: {
        maxRequests: WEBHOOK_MAX_REQUESTS
    }
};

logger.info(`[RateLimit] Configuration: Login ${LOGIN_MAX_ATTEMPTS}/${LOGIN_WINDOW_MS/1000}s, API ${API_MAX_REQUESTS}/${API_WINDOW_MS/1000}s, Webhook ${WEBHOOK_MAX_REQUESTS}/min`);
