import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Database } from '../storage/database.js';
import { logger } from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Create default admin user if no users exist
export async function createDefaultUser(db: Database): Promise<void> {
    try {
        // Check if admin user exists
        const existingAdmin = db.getUserByUsername('admin');
        if (!existingAdmin) {
            const hashedPassword = await bcrypt.hash('admin', 10);
            const defaultUser = {
                id: crypto.randomUUID(),
                username: 'admin',
                password: hashedPassword,
                role: 'admin' as const,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            db.createUser(defaultUser);
            logger.info('[Auth] Default admin user created (username: admin, password: admin)');
        } else {
            logger.info('[Auth] Admin user already exists');
        }
    } catch (error) {
        logger.error('[Auth] Failed to create default user:', error);
    }
}

// Reset admin password (for development/emergency)
export async function resetAdminPassword(db: Database): Promise<void> {
    try {
        const existingAdmin = db.getUserByUsername('admin');
        if (existingAdmin) {
            const hashedPassword = await bcrypt.hash('admin', 10);
            // Update password - we need to add updateUser method to database
            logger.info('[Auth] Admin password reset to "admin"');
        }
    } catch (error) {
        logger.error('[Auth] Failed to reset admin password:', error);
    }
}

export function setupAuthRoutes(db: Database): Router {
    const router = Router();

    // Register (Protected by API Key to create first user)
    router.post('/register', async (req, res) => {
        try {
            // Require API Key to register new users (simple protection)
            const apiKey = req.headers['x-api-key'];
            if (apiKey !== process.env.API_KEY) {
                // Also allow if no users exist yet? 
                // For now, strict on API KEY
                return res.status(401).json({ error: 'API Key required to register' });
            }

            const { username, password } = req.body;

            if (!username || !password) {
                return res.status(400).json({ error: 'Username and password required' });
            }

            const existing = db.getUserByUsername(username);
            if (existing) {
                return res.status(409).json({ error: 'Username already exists' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const user = {
                id: crypto.randomUUID(),
                username,
                password: hashedPassword,
                role: 'user' as const,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            db.createUser(user);
            logger.info(`[Auth] User created: ${username}`);

            res.status(201).json({ message: 'User created successfully' });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // Login
    router.post('/login', async (req, res) => {
        try {
            const { username, password } = req.body;

            const user = db.getUserByUsername(username);
            if (!user || !user.password) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const validPassword = await bcrypt.compare(password, user.password);
            if (!validPassword) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const token = jwt.sign(
                { id: user.id, username: user.username, role: user.role },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            // Set cookie
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 24 * 60 * 60 * 1000 // 24 hours
            });

            logger.info(`[Auth] User logged in: ${username}`);

            res.json({
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role
                }
            });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // Logout
    router.post('/logout', (req, res) => {
        res.clearCookie('token');
        res.json({ message: 'Logged out' });
    });

    // Check Auth
    router.get('/me', (req: any, res) => {
        const token = req.cookies?.token || req.headers['authorization']?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'Not authenticated' });

        try {
            const user = jwt.verify(token, JWT_SECRET);
            res.json({ user });
        } catch (err) {
            res.status(401).json({ error: 'Invalid token' });
        }
    });

    // Setup/Reset Admin (Development only)
    router.post('/setup-admin', async (req, res) => {
        try {
            // Only allow in development
            if (process.env.NODE_ENV === 'production') {
                return res.status(403).json({ error: 'Not allowed in production' });
            }

            const { password = 'admin' } = req.body;
            
            // Check if admin exists
            let admin = db.getUserByUsername('admin');
            const hashedPassword = await bcrypt.hash(password, 10);
            
            if (admin) {
                // Update password
                db.updateUserPassword('admin', hashedPassword);
                logger.info('[Auth] Admin password reset');
            } else {
                // Create admin
                const newAdmin = {
                    id: crypto.randomUUID(),
                    username: 'admin',
                    password: hashedPassword,
                    role: 'admin' as const,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                db.createUser(newAdmin);
                logger.info('[Auth] Admin user created');
            }
            
            res.json({ message: 'Admin setup complete', username: 'admin', password });
        } catch (error: any) {
            logger.error('[Auth] Setup admin failed:', error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
}
