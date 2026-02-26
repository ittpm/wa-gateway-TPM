import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Database } from '../storage/database.js';
import { logger } from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Create default superadmin user if no users exist
export async function createDefaultUser(db: Database): Promise<void> {
    try {
        const existingAdmin = db.getUserByUsername('admin');
        if (!existingAdmin) {
            const hashedPassword = await bcrypt.hash('admin', 10);
            const defaultUser = {
                id: crypto.randomUUID(),
                username: 'admin',
                password: hashedPassword,
                role: 'superadmin' as const,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            db.createUser(defaultUser);
            logger.info('[Auth] Default superadmin user created (username: admin, password: admin)');
        } else {
            // Upgrade existing admin to superadmin if still 'admin' or 'user' role
            if (existingAdmin.role === 'admin' || (existingAdmin.role as string) === 'user') {
                db.updateUserRole(existingAdmin.id, 'superadmin');
                logger.info('[Auth] Existing admin user upgraded to superadmin role');
            } else {
                logger.info('[Auth] Superadmin user already exists');
            }
        }
    } catch (error) {
        logger.error('[Auth] Failed to create default user:', error);
    }
}

// Middleware to check if user is superadmin
function requireSuperadmin(req: any, res: any, next: any) {
    if (!req.user || req.user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Akses ditolak. Hanya Superadmin yang dapat melakukan tindakan ini.' });
    }
    next();
}

export function setupAuthRoutes(db: Database): Router {
    const router = Router();

    // Login
    router.post('/login', async (req, res) => {
        try {
            const { username, password } = req.body;

            const user = db.getUserByUsername(username);
            if (!user || !user.password) {
                return res.status(401).json({ error: 'Username atau password salah' });
            }

            const validPassword = await bcrypt.compare(password, user.password);
            if (!validPassword) {
                return res.status(401).json({ error: 'Username atau password salah' });
            }

            const token = jwt.sign(
                { id: user.id, username: user.username, role: user.role },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 24 * 60 * 60 * 1000
            });

            logger.info(`[Auth] User logged in: ${username} (${user.role})`);

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

    // ============ USER MANAGEMENT (Superadmin only) ============

    // Get all users
    router.get('/users', (req: any, res) => {
        try {
            // Auth check inline
            const token = req.cookies?.token || req.headers['authorization']?.split(' ')[1];
            if (!token) return res.status(401).json({ error: 'Tidak terautentikasi' });
            const decoded: any = jwt.verify(token, JWT_SECRET);
            if (decoded.role !== 'superadmin') return res.status(403).json({ error: 'Akses ditolak. Hanya Superadmin.' });

            const users = db.getAllUsers();
            res.json(users);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // Create new user (superadmin only)
    router.post('/users', async (req: any, res) => {
        try {
            const token = req.cookies?.token || req.headers['authorization']?.split(' ')[1];
            if (!token) return res.status(401).json({ error: 'Tidak terautentikasi' });
            const decoded: any = jwt.verify(token, JWT_SECRET);
            if (decoded.role !== 'superadmin') return res.status(403).json({ error: 'Akses ditolak. Hanya Superadmin.' });

            const { username, password, role = 'admin' } = req.body;

            if (!username || !password) {
                return res.status(400).json({ error: 'Username dan password wajib diisi' });
            }

            if (!['superadmin', 'admin'].includes(role)) {
                return res.status(400).json({ error: 'Role tidak valid. Pilih superadmin atau admin.' });
            }

            const existing = db.getUserByUsername(username);
            if (existing) {
                return res.status(409).json({ error: 'Username sudah digunakan' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const user = {
                id: crypto.randomUUID(),
                username,
                password: hashedPassword,
                role: role as 'superadmin' | 'admin',
                createdAt: new Date(),
                updatedAt: new Date()
            };

            db.createUser(user);
            logger.info(`[Auth] User created: ${username} (${role}) by ${decoded.username}`);

            res.status(201).json({ message: 'User berhasil dibuat', username, role });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // Delete user (superadmin only)
    router.delete('/users/:id', async (req: any, res) => {
        try {
            const token = req.cookies?.token || req.headers['authorization']?.split(' ')[1];
            if (!token) return res.status(401).json({ error: 'Tidak terautentikasi' });
            const decoded: any = jwt.verify(token, JWT_SECRET);
            if (decoded.role !== 'superadmin') return res.status(403).json({ error: 'Akses ditolak. Hanya Superadmin.' });

            const { id } = req.params;

            // Prevent deleting own account
            if (id === decoded.id) {
                return res.status(400).json({ error: 'Tidak bisa menghapus akun sendiri' });
            }

            const user = db.getUserById(id);
            if (!user) {
                return res.status(404).json({ error: 'User tidak ditemukan' });
            }

            db.deleteUser(id);
            logger.info(`[Auth] User deleted: ${user.username} by ${decoded.username}`);

            res.json({ message: 'User berhasil dihapus' });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // Update user role (superadmin only)
    router.put('/users/:id/role', async (req: any, res) => {
        try {
            const token = req.cookies?.token || req.headers['authorization']?.split(' ')[1];
            if (!token) return res.status(401).json({ error: 'Tidak terautentikasi' });
            const decoded: any = jwt.verify(token, JWT_SECRET);
            if (decoded.role !== 'superadmin') return res.status(403).json({ error: 'Akses ditolak. Hanya Superadmin.' });

            const { id } = req.params;
            const { role } = req.body;

            if (!['superadmin', 'admin'].includes(role)) {
                return res.status(400).json({ error: 'Role tidak valid' });
            }

            if (id === decoded.id) {
                return res.status(400).json({ error: 'Tidak bisa mengubah role akun sendiri' });
            }

            const user = db.getUserById(id);
            if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });

            db.updateUserRole(id, role);
            logger.info(`[Auth] User ${user.username} role changed to ${role} by ${decoded.username}`);

            res.json({ message: 'Role berhasil diubah' });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // Change password (superadmin can change anyone, admin changes own only)
    router.put('/users/:id/password', async (req: any, res) => {
        try {
            const token = req.cookies?.token || req.headers['authorization']?.split(' ')[1];
            if (!token) return res.status(401).json({ error: 'Tidak terautentikasi' });
            const decoded: any = jwt.verify(token, JWT_SECRET);

            const { id } = req.params;
            const { newPassword } = req.body;

            // Admin can only change their own password
            if (decoded.role !== 'superadmin' && id !== decoded.id) {
                return res.status(403).json({ error: 'Akses ditolak' });
            }

            if (!newPassword || newPassword.length < 6) {
                return res.status(400).json({ error: 'Password minimal 6 karakter' });
            }

            const user = db.getUserById(id);
            if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });

            const hashedPassword = await bcrypt.hash(newPassword, 10);
            db.updateUserPasswordById(id, hashedPassword);
            logger.info(`[Auth] Password changed for user ${user.username}`);

            res.json({ message: 'Password berhasil diubah' });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    // Setup/Reset Admin (Development only)
    router.post('/setup-admin', async (req, res) => {
        try {
            if (process.env.NODE_ENV === 'production') {
                return res.status(403).json({ error: 'Not allowed in production' });
            }

            const { password = 'admin' } = req.body;
            let admin = db.getUserByUsername('admin');
            const hashedPassword = await bcrypt.hash(password, 10);

            if (admin) {
                db.updateUserPassword('admin', hashedPassword);
                logger.info('[Auth] Admin password reset');
            } else {
                const newAdmin = {
                    id: crypto.randomUUID(),
                    username: 'admin',
                    password: hashedPassword,
                    role: 'superadmin' as const,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                db.createUser(newAdmin);
                logger.info('[Auth] Superadmin user created');
            }

            res.json({ message: 'Admin setup complete', username: 'admin', password });
        } catch (error: any) {
            logger.error('[Auth] Setup admin failed:', error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
}
