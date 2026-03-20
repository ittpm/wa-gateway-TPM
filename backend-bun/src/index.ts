import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { readFileSync, existsSync, appendFileSync } from 'fs';
import { join } from 'path';
import { Database as SqliteDatabase } from './storage/database.js';
import { Database as PostgresDatabase } from './storage/database-pg.js';
import { ConnectionManager } from './connection/manager.js';
import { QueueManager } from './queue/manager.js';
import { WebhookDispatcher } from './webhook/dispatcher.js';
import { setupRoutes } from './api/routes.js';
import { setupAuthRoutes, createDefaultUser } from './api/auth.js';
import { authenticateToken } from './middleware/auth.js';
import { loginLimiter, apiLimiter } from './middleware/ratelimit.js';
import { logger } from './utils/logger.js';
import { cleanupPort, startServerWithRetry } from './utils/port-utils.js';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '9090');
const HOST = process.env.HOST || '0.0.0.0';
const DB_TYPE = (process.env.DB_TYPE || 'sqlite').toLowerCase();

app.set('trust proxy', 1);

// Cleanup port sebelum start
await cleanupPort(PORT);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'upgrade-insecure-requests': null, // Disable: app runs on HTTP internally
    }
  },
  hsts: false, // Disable HSTS for HTTP environments
}));
app.use(compression());
app.use(cookieParser());

// Parse CORS origins from comma-separated string
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173', 'http://localhost:5174'];

// In development, allow all origins
const isDev = process.env.NODE_ENV === 'development';

app.use(cors({
  origin: isDev ? true : corsOrigins,
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Session-Token', 'Cache-Control', 'Pragma'],
  credentials: true,
  maxAge: 600 // 10 minutes
}));

// Differentiated request size limits per endpoint
app.use((req, res, next) => {
  const path = req.path;

  if (path.includes('messages/send') || path.includes('messages/bulk')) {
    express.json({ limit: '5mb' })(req, res, next);
  } else if (path.includes('templates') || path.includes('contacts')) {
    express.json({ limit: '500kb' })(req, res, next);
  } else if (path.includes('auth')) {
    express.json({ limit: '100kb' })(req, res, next);
  } else {
    express.json({ limit: '100kb' })(req, res, next);
  }
});

app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Timeout middleware (30s)
app.use((req, res, next) => {
  req.setTimeout(30000, () => {
    res.status(408).send('Request Timeout');
  });
  next();
});

// Apply rate limits
app.use('/api/v1/auth/login', loginLimiter);
app.use('/api', apiLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});

// Serve API Documentation
app.get('/docs', (req, res) => {
  try {
    const docsPath = join(process.cwd(), '..', 'docs', 'API-DOKUMENTASI.md');
    if (existsSync(docsPath)) {
      const content = readFileSync(docsPath, 'utf-8');
      res.setHeader('Content-Type', 'text/html');
      res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>WA Gateway API Documentation</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    pre { background: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
    h1, h2, h3 { color: #333; }
    h1 { border-bottom: 2px solid #25D366; padding-bottom: 10px; }
    h2 { border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-top: 30px; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background: #25D366; color: white; }
    tr:nth-child(even) { background: #f9f9f9; }
    .method { color: #fff; padding: 4px 8px; border-radius: 4px; font-weight: bold; }
    .get { background: #61affe; }
    .post { background: #49cc90; }
    .put { background: #fca130; }
    .delete { background: #f93e3e; }
  </style>
</head>
<body>
  <h1>📚 WA Gateway API Documentation</h1>
  <div id="content"></div>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <script>
    document.getElementById('content').innerHTML = marked.parse(${JSON.stringify(content)});
  </script>
</body>
</html>
      `);
    } else {
      res.redirect('/api/v1');
    }
  } catch (error) {
    res.redirect('/api/v1');
  }
});

async function main() {
  try {
    logger.info('╔════════════════════════════════════════════════════════╗');
    logger.info('║     WA Gateway - Bun + Baileys Edition                 ║');
    logger.info('║           Anti-Block Ready v1.0.0                      ║');
    logger.info('╚════════════════════════════════════════════════════════╝');

    // Initialize database
    let db;
    if (DB_TYPE === 'postgresql' || DB_TYPE === 'postgres' || DB_TYPE === 'pg') {
      logger.info('Using PostgreSQL database');
      db = new PostgresDatabase();
    } else {
      logger.info('Using SQLite database (default)');
      db = new SqliteDatabase();
    }
    await db.init();
    logger.info('✓ Database connected');

    // Create default admin user
    await createDefaultUser(db);

    // Initialize connection manager (WhatsApp)
    const connectionManager = new ConnectionManager(db);
    await connectionManager.init();
    logger.info('✓ Connection manager initialized');

    // Initialize webhook dispatcher
    const webhookDispatcher = new WebhookDispatcher(db);
    logger.info('✓ Webhook dispatcher initialized');

    // Initialize queue manager
    const queueManager = new QueueManager(db, connectionManager, webhookDispatcher);
    await queueManager.init();
    logger.info('✓ Message queue initialized');

    // Setup message handler for incoming messages
    connectionManager.setMessageHandler((msg) => {
      webhookDispatcher.dispatch('message.received', msg);
    });

    connectionManager.setMessageStatusHandler((status) => {
      webhookDispatcher.dispatch('message.status', status);
    });

    // Setup API routes
    const authRouter = setupAuthRoutes(db);
    app.use('/api/v1/auth', authRouter);

    // Serve uploaded files (media attachments)
    const uploadsPath = join(process.cwd(), 'uploads');
    app.use('/uploads', express.static(uploadsPath, {
      maxAge: '1d',
      etag: true,
    }));

    setupRoutes(app, db, connectionManager, queueManager, webhookDispatcher);

    // Log 404s
    app.use('*', (req, res) => {
      logger.warn(`[404] Not Found: ${req.method} ${req.originalUrl}`);
      res.status(404).json({ error: 'Not Found' });
    });

    // Global Error Handler
    app.use((err: any, req: any, res: any, next: any) => {
      logger.error('[Global Error]', err);
      try { appendFileSync('global_error.log', `[${new Date().toISOString()}] ${err.stack || err}\n`); } catch (e) { }
      res.status(500).json({ error: 'Internal Server Error', message: err.message });
    });

    // Start server dengan retry
    const server = await startServerWithRetry(app, PORT, HOST);

    // Slowloris protection (additional layer)
    server.timeout = 30000;        // 30 seconds
    server.keepAliveTimeout = 5000; // 5 seconds
    server.headersTimeout = 10000;  // 10 seconds

    // Graceful shutdown (SIGTERM)
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, gracefully shutting down...');
      server.close(() => {
        logger.info('Server closed');
        queueManager.stop();
        process.exit(0);
      });
    });

    // Graceful shutdown (SIGINT — Ctrl+C)
    process.on('SIGINT', async () => {
      logger.info('\n👋 Shutting down gracefully...');
      await queueManager.stop();
      await connectionManager.stop();
      db.close();
      process.exit(0);
    });

    // Global error handlers — jangan biarkan server crash
    process.on('uncaughtException', (error: any) => {
      if (error?.message?.includes('Connection Closed') ||
        error?.message?.includes('connection closed') ||
        error?.output?.statusCode === 428 ||
        error?.isBoom) {
        logger.warn('⚠️ Baileys connection error (handled):', error.message);
        return;
      }
      logger.error('⚠️ Uncaught Exception:', error);
    });

    process.on('unhandledRejection', (reason: any, promise) => {
      if (reason?.message?.includes('Connection Closed') ||
        reason?.message?.includes('connection closed') ||
        reason?.output?.statusCode === 428 ||
        reason?.isBoom) {
        logger.warn('⚠️ Baileys connection rejection (handled):', reason.message);
        return;
      }
      logger.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
