import { type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';
import type { Database } from '../storage/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        username: string;
        role: string;
    };
    sessionToken?: string;
    // Set when authenticated via per-session API key
    sessionApiKeyId?: string;
}

/**
 * Build the auth middleware. Accepts an optional db instance to enable
 * per-session API key validation. Call as:
 *   app.use(createAuthMiddleware(db))
 * or (backward-compat, no per-session key support):
 *   app.use(authenticateToken)
 */
export function createAuthMiddleware(db?: Database) {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        const authHeader = req.headers['authorization'];
        const token = req.cookies?.token || authHeader?.split(' ')[1];
        const apiKey = req.headers['x-api-key'] as string | undefined;

        // 1. JWT token (Frontend login) → full admin access
        if (token) {
            jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
                if (err) {
                    logger.warn(`[Auth] Invalid token: ${err.message}`);
                    return res.status(403).json({ error: 'Invalid or expired token' });
                }
                req.user = user;
                next();
            });
            return;
        }

        // 2. Global API Key from .env → full admin access (backward-compat)
        if (apiKey && apiKey === process.env.API_KEY) {
            req.user = { id: 'system', username: 'system', role: 'admin' };
            return next();
        }

        // 3. Per-session API Key (wak_...) → scoped access to that session only
        if (apiKey && apiKey.startsWith('wak_') && db) {
            const session = db.getSessionByApiKey(apiKey);
            if (session) {
                req.user = { id: 'session', username: `session:${session.name}`, role: 'session' };
                req.sessionApiKeyId = session.id;
                logger.debug(`[Auth] Session API key accepted for session: ${session.id}`);
                return next();
            }
            logger.warn(`[Auth] Invalid session API key attempt: ${apiKey.substring(0, 15)}...`);
            return res.status(401).json({ error: 'Invalid session API key' });
        }

        // 4. Legacy session token (wag_...) — kept for backward compatibility
        const sessionToken = authHeader?.split(' ')[1] || req.headers['x-session-token'] as string | undefined;
        if (sessionToken && sessionToken.startsWith('wag_')) {
            req.sessionToken = sessionToken;
            return next();
        }

        return res.status(401).json({ error: 'Authentication required' });
    };
}

// Backward-compatible export (no per-session key support)
export const authenticateToken = createAuthMiddleware();

export const requireRole = (role: string) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user || (req.user.role !== role && req.user.role !== 'admin')) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
};
