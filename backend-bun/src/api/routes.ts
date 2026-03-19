import { Router, type Express, type Request, type Response } from 'express';
import type { Database } from '../storage/database.js';
import type { ConnectionManager } from '../connection/manager.js';
import type { QueueManager } from '../queue/manager.js';
import type { WebhookDispatcher } from '../webhook/dispatcher.js';
import { SessionPool } from '../connection/session-pool.js';
import { logger } from '../utils/logger.js';
import { ensureUploadDir, ensureScheduledUploadDir, getFileType, validateFile } from '../middleware/upload.js';
import { writeFile } from 'fs/promises';
import { join } from 'path';

import { validate, sendMessageSchema, bulkMessageSchema, webhookSchema, sessionSchema, templateSchema } from '../middleware/validation.js';
import { webhookLimiter } from '../middleware/ratelimit.js';

// Store QR refresh intervals
// Store QR refresh intervals
const qrIntervals: Map<string, NodeJS.Timeout> = new Map();

// Cleanup intervals on shutdown
process.on('SIGINT', () => {
  logger.info('Clearing QR refresh intervals...');
  for (const interval of qrIntervals.values()) {
    clearInterval(interval);
  }
  process.exit(0);
});

import { createAuthMiddleware } from '../middleware/auth.js';

export function setupRoutes(
  app: Express,
  db: Database,
  connectionManager: ConnectionManager,
  queueManager: QueueManager,
  webhookDispatcher: WebhookDispatcher
): void {
  const router = Router();
  const sessionPool = new SessionPool(db, connectionManager);

  // Apply auth middleware with db for per-session API key support
  router.use(createAuthMiddleware(db));



  // ========== SESSIONS ==========
  router.get('/sessions', async (req, res) => {
    const isAdmin = (req as any).user?.role === 'admin';
    const userId = isAdmin ? (req as any).user.id : undefined;
    
    const sessions = (await db.getAllSessions(userId)).map(s => {
      const conn = connectionManager.getSession(s.id);
      const contactsCount = db.getContactsCount ? db.getContactsCount(s.id) : 0;
      return {
        ...s,
        token: conn?.token || null,
        apiKey: s.apiKey || null,
        browser: 'WhatsApp Web',
        contactsCount,
        contactsSyncStatus: conn?.contactsSyncStatus || 'idle',
        contactsSyncProgress: conn?.contactsSyncProgress || 0,
        contactsSyncTotal: conn?.contactsSyncTotal || 0
      };
    });
    res.json(sessions);
  });

  router.post('/sessions', validate(sessionSchema), async (req, res) => {
    try {
      const { name } = req.body;
      const userId = (req as any).user?.id || 'default';
      // Validation handled by middleware

      const conn = await connectionManager.createSession(name, userId);

      // Clear existing interval if any
      const existingInterval = qrIntervals.get(conn.id);
      if (existingInterval) {
        clearInterval(existingInterval);
      }

      // Start QR refresh
      const interval = connectionManager.startQRRefresh(conn.id, (qrCode) => {
        // QR akan otomatis update via polling
      });
      qrIntervals.set(conn.id, interval);

      res.status(201).json({
        id: conn.id,
        name,
        status: 'connecting',
        token: conn.token,
        apiKey: (db as any).getSessionById ? ((await (db as any).getSessionById(conn.id))?.apiKey || null) : null,
        qrCode: conn.qrCode,
        message: 'Session created. QR code will be available shortly.'
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Helper
  const isValidUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  // Get QR Code (dengan auto-refresh)
  router.get('/sessions/:id/qr', (req, res) => {
    if (!isValidUUID(req.params.id)) {
      return res.status(400).json({ error: 'Invalid session ID format. Must be a valid UUID.' });
    }

    const conn = connectionManager.getSession(req.params.id);
    if (!conn) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const hasQR = conn.qrCode && conn.qrCode.startsWith('data:image');

    res.json({
      qrCode: conn.qrCode,
      status: conn.status,
      updatedAt: conn.qrUpdateTime,
      hasQR: hasQR
    });
  });

  router.delete('/sessions/:id', async (req, res) => {
    if (!isValidUUID(req.params.id)) {
      return res.status(400).json({ error: 'Invalid session ID format' });
    }

    try {
      // Clear interval
      const interval = qrIntervals.get(req.params.id);
      if (interval) {
        clearInterval(interval);
        qrIntervals.delete(req.params.id);
      }

      await connectionManager.deleteSession(req.params.id);
      res.json({ message: 'Session deleted' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/sessions/:id/reconnect', async (req, res) => {
    if (!isValidUUID(req.params.id)) {
      return res.status(400).json({ error: 'Invalid session ID format' });
    }

    try {
      await connectionManager.reconnectSession(req.params.id);
      res.json({ message: 'Reconnecting...' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/sessions/:id/logout', async (req, res) => {
    if (!isValidUUID(req.params.id)) {
      return res.status(400).json({ error: 'Invalid session ID format' });
    }

    try {
      await connectionManager.logoutSession(req.params.id);
      res.json({ message: 'Logged out' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Force refresh status session dari WhatsApp server
  router.post('/sessions/:id/refresh', async (req, res) => {
    if (!isValidUUID(req.params.id)) {
      return res.status(400).json({ error: 'Invalid session ID format' });
    }

    try {
      const result = await connectionManager.forceRefreshStatus(req.params.id);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Regenerate per-session API key ──────────────────────────────────────
  router.post('/sessions/:id/regenerate-key', async (req, res) => {
    if (!isValidUUID(req.params.id)) {
      return res.status(400).json({ error: 'Invalid session ID format' });
    }
    try {
      const session = await db.getSession(req.params.id);
      if (!session) return res.status(404).json({ error: 'Session not found' });
      // fallback to connectionManager for apiKey regeneration if available
      const newKey = (db as any).regenerateSessionApiKey ? (db as any).regenerateSessionApiKey(req.params.id) : session.apiKey;
      logger.info(`[API] API key regenerated for session: ${req.params.id}`);
      res.json({ apiKey: newKey, message: 'API key berhasil di-regenerate' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== MESSAGES ==========
  router.post('/messages/send', validate(sendMessageSchema), async (req, res) => {
    try {
      const { to, type, message, mediaUrl, caption, useSpintax, delay, scheduledAt: scheduledAtRaw, contactName, contactPhone } = req.body;
      // Allow sessionId from body OR from per-session API key context
      const sessionId = req.body.sessionId || (req as any).sessionApiKeyId;

      logger.info(`[API] Received send message request: sessionId=${sessionId}, to=${to}, type=${type}`);

      if (!sessionId) {
        return res.status(400).json({ error: 'sessionId is required' });
      }

      // Cek session valid
      const session = connectionManager.getSession(sessionId);
      if (!session) {
        logger.warn(`[API] Session not found: ${sessionId}`);
        return res.status(404).json({ error: 'Session not found' });
      }

      if (session.status !== 'connected') {
        logger.warn(`[API] Session not connected: ${sessionId}, status=${session.status}`);
        return res.status(400).json({ error: `Session not connected (status: ${session.status})` });
      }

      // Parse scheduledAt
      let scheduledAt: Date | undefined = undefined;
      if (scheduledAtRaw) {
        scheduledAt = new Date(scheduledAtRaw);
        if (isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
          return res.status(400).json({ error: 'scheduledAt harus berupa waktu di masa depan yang valid' });
        }
      }

      logger.info(`[API] Adding message to queue for session ${sessionId}`);

      const msg = await queueManager.addMessage({
        sessionId,
        to,
        type: type || 'text',
        content: message || '',
        mediaUrl: req.body.media || req.body.mediaUrl,
        caption,
        status: scheduledAt ? 'scheduled' : 'pending',
        useSpintax: useSpintax || false,
        delayEnabled: delay !== false && !scheduledAt,
        scheduledAt,
        contactName,
        contactPhone
      });

      logger.info(`[API] Message queued: ${msg.id}`);

      res.status(202).json({
        messageId: msg.id,
        status: 'queued',
        message: 'Pesan telah ditambahkan ke antrean'
      });
    } catch (error: any) {
      logger.error('[API] Error sending message:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ========== SEND MEDIA/FILE UPLOAD ==========
  // Send message with file upload (media/image/document)
  router.post('/messages/send-media', async (req, res) => {
    try {
      // Parse multipart form data
      const contentType = req.headers['content-type'] || '';
      if (!contentType.includes('multipart/form-data')) {
        return res.status(400).json({ error: 'Content-Type must be multipart/form-data' });
      }

      // Read raw body
      const chunks: Buffer[] = [];
      for await (const chunk of req as any) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      // Parse multipart
      const boundary = contentType.split('boundary=')[1];
      if (!boundary) {
        return res.status(400).json({ error: 'No boundary found' });
      }

      const { fields, files } = parseMultipartForm(buffer, boundary);

      // Validate required fields
      const sessionId = fields.sessionId;
      const to = fields.to;
      const caption = fields.caption || '';

      if (!sessionId || !to) {
        return res.status(400).json({ error: 'sessionId and to are required' });
      }

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Check session - use forceRefreshStatus untuk mendapatkan status yang akurat
      const statusCheck = await connectionManager.forceRefreshStatus(sessionId);
      if (!statusCheck || statusCheck.status === 'not_found') {
        return res.status(404).json({ error: 'Session not found' });
      }
      if (!statusCheck.isConnected) {
        return res.status(400).json({ error: `Session not connected: ${statusCheck.reason || statusCheck.status}` });
      }

      // Process file
      const file = files[0];
      const validation = validateFile(file);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      // Save file
      const uploadDir = await ensureUploadDir();
      const fileExt = file.originalname.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = join(uploadDir, fileName);

      await writeFile(filePath, file.buffer);
      logger.info(`[Upload] File saved: ${fileName} (${file.size} bytes)`);

      // Determine message type
      const fileType = getFileType(file.mimetype);
      let messageType = 'document';
      if (fileType === 'image') messageType = 'image';
      else if (fileType === 'video') messageType = 'video';
      else if (fileType === 'audio') messageType = 'audio';

      // Add to queue with file path
      const msg = await queueManager.addMessage({
        sessionId,
        to,
        type: messageType as any,
        content: caption,
        mediaUrl: filePath, // Local file path
        caption,
        status: 'pending',
        useSpintax: false,
        delayEnabled: true
      });

      res.status(202).json({
        messageId: msg.id,
        status: 'queued',
        fileName: file.originalname,
        fileType: messageType,
        message: 'File uploaded and queued for sending'
      });

    } catch (error: any) {
      logger.error('[API] Error sending media:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ========== UPLOAD FILE FOR SCHEDULED MESSAGE ==========
  // Upload attachment + jadwalkan pengiriman (tanpa perlu URL eksternal)
  router.post('/messages/upload-scheduled', async (req, res) => {
    try {
      const contentType = req.headers['content-type'] || '';
      if (!contentType.includes('multipart/form-data')) {
        return res.status(400).json({ error: 'Content-Type must be multipart/form-data' });
      }

      // Read raw body
      const chunks: Buffer[] = [];
      for await (const chunk of req as any) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      // Parse multipart
      const boundary = contentType.split('boundary=')[1];
      if (!boundary) {
        return res.status(400).json({ error: 'No boundary found' });
      }

      const { fields, files } = parseMultipartForm(buffer, boundary);

      const sessionId = fields.sessionId;
      const to = fields.to;
      const caption = fields.caption || '';
      const scheduledAtRaw = fields.scheduledAt;

      if (!sessionId || !to) {
        return res.status(400).json({ error: 'sessionId and to are required' });
      }

      if (!scheduledAtRaw) {
        return res.status(400).json({ error: 'scheduledAt is required for scheduled upload' });
      }

      const scheduledAt = new Date(scheduledAtRaw);
      if (isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
        return res.status(400).json({ error: 'scheduledAt harus berupa waktu di masa depan yang valid' });
      }

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Check session
      const session = connectionManager.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      if (session.status !== 'connected') {
        return res.status(400).json({ error: `Session not connected (status: ${session.status})` });
      }

      // Validate file
      const file = files[0];
      const validation = validateFile(file);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      // Save to ./uploads/scheduled/
      const scheduledDir = await ensureScheduledUploadDir();
      const fileExt = file.originalname.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = join(scheduledDir, fileName);

      await writeFile(filePath, file.buffer);
      logger.info(`[Upload-Scheduled] File saved: ${fileName} (${file.size} bytes), scheduled at ${scheduledAt.toISOString()}`);

      // Determine message type
      const fileType = getFileType(file.mimetype);
      let messageType = 'document';
      if (fileType === 'image') messageType = 'image';
      else if (fileType === 'video') messageType = 'video';
      else if (fileType === 'audio') messageType = 'audio';

      // Add to queue with scheduledAt
      const msg = await queueManager.addMessage({
        sessionId,
        to,
        type: messageType as any,
        content: caption,
        mediaUrl: filePath,
        caption,
        status: 'scheduled', // FIX: must be 'scheduled' not 'pending' so the scheduler cron job picks it up at the right time
        useSpintax: false,
        delayEnabled: false,
        scheduledAt
      });

      logger.info(`[Upload-Scheduled] Message queued: ${msg.id}, scheduled at ${scheduledAt.toISOString()}`);

      res.status(202).json({
        messageId: msg.id,
        status: 'scheduled',
        fileName: file.originalname,
        fileType: messageType,
        scheduledAt: scheduledAt.toISOString(),
        message: `File disimpan dan akan dikirim pada ${scheduledAt.toLocaleString('id-ID')}`
      });

    } catch (error: any) {
      logger.error('[API] Error uploading scheduled media:', error);
      res.status(500).json({ error: error.message });
    }
  });


  router.get('/messages', async (req, res) => {
    try {
      const { sessionId, status, search, page, limit } = req.query;

      const pageNum = parseInt(page as string) || 1;
      const limitNum = parseInt(limit as string) || 20;
      const offset = (pageNum - 1) * limitNum;

      const result = await db.getMessages({
        sessionId: sessionId as string,
        status: status as string,
        search: search as string,
        limit: limitNum,
        offset,
        userId: (req as any).user?.role === 'admin' ? (req as any).user.id : undefined
      });

      res.json({
        data: result.messages,
        pagination: {
          total: result.total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(result.total / limitNum)
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/messages/presence', async (req, res) => {
    try {
      const { sessionId, to, type } = req.body;

      const session = connectionManager.getSession(sessionId);
      if (!session || session.status !== 'connected') {
        return res.status(400).json({ error: 'Session not connected' });
      }

      await connectionManager.sendPresenceUpdate(sessionId, to, type || 'composing');
      res.json({ message: 'Presence updated' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/messages/bulk', validate(bulkMessageSchema), async (req, res) => {
    try {
      const { sessionId, recipients, message, useSpintax, delay } = req.body;

      const queuedIds: string[] = [];

      for (const recipient of recipients) {
        const msg = await queueManager.addMessage({
          sessionId,
          to: recipient,
          type: 'text',
          content: message,
          status: 'pending',
          useSpintax: useSpintax || false,
          delayEnabled: delay !== false
        });
        queuedIds.push(msg.id);
      }

      res.status(202).json({
        queued: queuedIds.length,
        messageIds: queuedIds,
        status: 'queued',
        message: `${queuedIds.length} pesan ditambahkan ke antrean`
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== MULTI-DEVICE: AUTO SEND ==========
  // Send message with auto session selection (round-robin)
  router.post('/messages/send-auto', validate(sendMessageSchema), async (req, res) => {
    try {
      const { to, type, message, mediaUrl, caption, useSpintax, delay } = req.body;

      logger.info(`[API] Auto-send request: to=${to}`);

      // Get best available session (round-robin)
      const session = sessionPool.getBestSession();
      if (!session) {
        return res.status(503).json({
          error: 'No active sessions available. Please connect at least one WhatsApp session.'
        });
      }

      logger.info(`[API] Using session: ${session.id} (${session.phone || 'no phone'})`);

      const msg = await queueManager.addMessage({
        sessionId: session.id,
        to,
        type: type || 'text',
        content: message || '',
        mediaUrl: req.body.media || req.body.mediaUrl,
        caption,
        status: 'pending',
        useSpintax: useSpintax || false,
        delayEnabled: delay !== false
      });

      logger.info(`[API] Message queued: ${msg.id} via session ${session.id}`);

      res.status(202).json({
        messageId: msg.id,
        status: 'queued',
        sessionId: session.id,
        sessionPhone: session.phone,
        message: 'Pesan telah ditambahkan ke antrean'
      });
    } catch (error: any) {
      logger.error('[API] Error in auto-send:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ========== MULTI-DEVICE: SESSION POOL ==========
  // Get session pool status and stats
  router.get('/pool/status', (req, res) => {
    const stats = sessionPool.getStats();
    res.json(stats);
  });

  // Get all active sessions
  router.get('/pool/sessions', (req, res) => {
    const sessions = sessionPool.getActiveSessions();
    res.json(sessions);
  });

  // Get best session info
  router.get('/pool/best-session', (req, res) => {
    const session = sessionPool.getBestSession();
    if (!session) {
      return res.status(503).json({ error: 'No active sessions available' });
    }
    res.json(session);
  });

  // Validate session token
  router.post('/pool/validate', (req, res) => {
    const { sessionId, token } = req.body;
    if (!sessionId || !token) {
      return res.status(400).json({ error: 'sessionId and token required' });
    }
    const isValid = sessionPool.validateSessionToken(sessionId, token);
    res.json({ valid: isValid });
  });

  // ========== QUEUE ==========
  router.get('/queue', async (req, res) => {
    const isAdmin = (req as any).user?.role === 'admin';
    const userId = isAdmin ? (req as any).user.id : undefined;

    const pending = await db.getMessagesByStatus('pending', 100, userId);
    const processing = await db.getMessagesByStatus('processing', 100, userId);
    const scheduled = await db.getMessagesByStatus('scheduled', 500, userId);
    res.json([...pending, ...processing, ...scheduled]);
  });

  router.get('/queue/stats', async (req, res) => {
    const isAdmin = (req as any).user?.role === 'admin';
    const userId = isAdmin ? (req as any).user.id : undefined;

    const stats = await queueManager.getStats(userId);
    res.json(stats);
  });

  router.post('/queue/pause', (req, res) => {
    if ((req as any).user?.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmin can pause the global queue' });
    }
    queueManager.pause();
    res.json({ paused: true, message: 'Antrean dijeda' });
  });

  router.post('/queue/resume', (req, res) => {
    if ((req as any).user?.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmin can resume the global queue' });
    }
    queueManager.resume();
    res.json({ paused: false, message: 'Antrean dilanjutkan' });
  });

  router.post('/queue/retry', async (req, res) => {
    const isAdmin = (req as any).user?.role === 'admin';
    const userId = isAdmin ? (req as any).user.id : undefined;

    await queueManager.retryFailed(userId);
    res.json({ message: 'Mencoba ulang pesan yang gagal' });
  });

  router.delete('/queue', async (req, res) => {
    const status = req.query.status as string || 'completed';
    const isAdmin = (req as any).user?.role === 'admin';
    const userId = isAdmin ? (req as any).user.id : undefined;

    await queueManager.clear(status, userId);
    res.json({ message: `Antrean ${status} dibersihkan` });
  });

  // ========== AUTO-REPLY ==========
  router.get('/autoreply/rules', (req, res) => {
    const sessionId = req.query.sessionId as string;
    const rules = db.getAllAutoReplyRules?.().filter(r => !sessionId || r.sessionId === sessionId) || [];
    res.json(rules);
  });

  router.post('/autoreply/rules', (req, res) => {
    try {
      const rule = db.createAutoReplyRule?.(req.body);
      res.status(201).json(rule);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.put('/autoreply/rules/:id', (req, res) => {
    try {
      db.updateAutoReplyRule?.(req.params.id, req.body);
      res.json({ message: 'Rule updated' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.delete('/autoreply/rules/:id', (req, res) => {
    try {
      db.deleteAutoReplyRule?.(req.params.id);
      res.json({ message: 'Rule deleted' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/autoreply/settings/:sessionId', (req, res) => {
    const settings = db.getAutoReplySettings?.(req.params.sessionId);
    res.json(settings || {
      sessionId: req.params.sessionId,
      autoReplyEnabled: false,
      autoRejectUnknown: false,
      unknownContactMessage: '',
      replyCooldown: 5
    });
  });

  router.post('/autoreply/settings', (req, res) => {
    try {
      db.updateAutoReplySettings?.(req.body);
      res.json({ message: 'Settings updated' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== TEMPLATES (duplicate set, optional routing) ==========
  router.get('/templates', async (req, res) => {
    const userId = (req as any).user?.id || 'default';
    const templates = await db.getTemplates?.(userId) || [];
    res.json(templates);
  });

  router.get('/templates/:id', async (req, res) => {
    const template = await db.getTemplate?.(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.json(template);
  });

  router.post('/templates', async (req, res) => {
    try {
      const template = await db.createTemplate?.(req.body);
      res.status(201).json(template);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.put('/templates/:id', async (req, res) => {
    try {
      await db.updateTemplate?.(req.params.id, req.body);
      res.json({ message: 'Template updated' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.delete('/templates/:id', async (req, res) => {
    try {
      await db.deleteTemplate?.(req.params.id);
      res.json({ message: 'Template deleted' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Preview template with variables
  router.post('/templates/:id/preview', async (req, res) => {
    try {
      const template = await db.getTemplate?.(req.params.id);
      if (!template) return res.status(404).json({ error: 'Template not found' });

      const { variables } = req.body;
      let rendered = template.content;

      for (const [key, value] of Object.entries(variables || {})) {
        rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
      }

      res.json({ preview: rendered, template });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/messages/send-template', async (req, res) => {
    try {
      const { templateId, to, variables, sessionId } = req.body;

      const template = await db.getTemplate?.(templateId);
      if (!template) return res.status(404).json({ error: 'Template not found' });

      let content = template.content;
      for (const [key, value] of Object.entries(variables || {})) {
        content = content.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
      }

      const targetSessionId = sessionId || sessionPool.getBestSession()?.id;
      if (!targetSessionId) {
        return res.status(503).json({ error: 'No active sessions' });
      }

      const msg = await queueManager.addMessage({
        sessionId: targetSessionId,
        to,
        type: 'text',
        content,
        status: 'pending',
        useSpintax: false,
        delayEnabled: true
      });

      res.status(202).json({
        messageId: msg.id,
        status: 'queued',
        renderedMessage: content
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== ANALYTICS ==========
  router.get('/analytics/dashboard', async (req, res) => {
    try {
      const userId = (req as any).user?.id || 'default';
      const isAdmin = (req as any).user?.role === 'admin';
      const queryUserId = isAdmin ? userId : undefined;

      const userSessions = await db.getAllSessions?.(queryUserId) || [];
      const [totalMessages, messagesToday] = await Promise.all([
        db.getTotalMessagesCount?.(queryUserId) || 0,
        db.getMessagesCountToday?.(queryUserId) || 0
      ]);
      const summary = {
        totalSessions: userSessions.length,
        activeSessions: userSessions.filter(s => s.status === 'connected').length,
        totalMessages,
        messagesToday,
        sessionStats: sessionPool.getStats()
      };
      res.json(summary);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/analytics/messages', async (req, res) => {
    try {
      const sessionId = req.query.sessionId as string;
      const days = parseInt(req.query.days as string) || 7;
      const isAdmin = (req as any).user?.role === 'admin';
      const userId = (req as any).user?.id;
      const stats = await db.getMessageStats?.(sessionId, days, isAdmin ? userId : undefined);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/analytics/hourly', async (req, res) => {
    try {
      const sessionId = req.query.sessionId as string;
      const hours = parseInt(req.query.hours as string) || 24;
      const isAdmin = (req as any).user?.role === 'admin';
      const userId = (req as any).user?.id;
      const activity = await db.getHourlyActivity?.(sessionId, hours, isAdmin ? userId : undefined);
      res.json(activity);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== AI CHAT ==========
  router.post('/ai/chat', async (req, res) => {
    try {
      const { message, context, history } = req.body;

      // Dynamic import to avoid loading if not needed
      const { AIService } = await import('../services/ai-service.js');
      const ai = new AIService(db);

      if (!ai.isConfigured()) {
        return res.status(503).json({
          error: 'AI not configured. Set KIMI_API_KEY in .env'
        });
      }

      const response = await ai.chat(message, context, history);
      if (!response) {
        return res.status(500).json({ error: 'AI request failed' });
      }

      res.json(response);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Generate AI reply for WhatsApp
  router.post('/ai/generate-reply', async (req, res) => {
    try {
      const { incomingMessage, businessContext, tone } = req.body;

      const { AIService } = await import('../services/ai-service.js');
      const ai = new AIService(db);

      if (!ai.isConfigured()) {
        return res.status(503).json({
          error: 'AI not configured. Set KIMI_API_KEY in .env'
        });
      }

      const reply = await ai.generateReply(incomingMessage, businessContext, tone);
      res.json({ reply });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== WEBHOOKS ==========
  // Apply webhook rate limiting
  router.use('/webhooks', webhookLimiter);

  router.get('/webhooks', async (req, res) => {
    const userId = (req as any).user?.id || 'default';
    const webhooks = await db.getAllWebhooks(userId);
    res.json(webhooks);
  });

  router.post('/webhooks', validate(webhookSchema), async (req, res) => {
    try {
      const { url, secret, events } = req.body;

      const webhook = await db.createWebhook({
        id: crypto.randomUUID(),
        userId: (req as any).user?.id || 'default',
        url,
        secret,
        events: Array.isArray(events) ? events : [events],
        status: 'active'
      });

      res.status(201).json(webhook);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.delete('/webhooks/:id', async (req, res) => {
    await db.deleteWebhook(req.params.id);
    res.json({ message: 'Webhook dihapus' });
  });

  router.get('/webhooks/logs', (req, res) => {
    const logs = (db as any).getWebhookLogs ? (db as any).getWebhookLogs(100) : [];
    res.json(logs);
  });

  // ========== STATS ==========
  router.get('/stats', async (req, res) => {
    const isAdmin = (req as any).user?.role === 'admin';
    const userId = isAdmin ? (req as any).user.id : undefined;

    const stats = await db.getStats(userId);
    res.json(stats);
  });

  router.get('/stats/activity', async (req, res) => {
    try {
      const isAdmin = (req as any).user?.role === 'admin';
      const userId = isAdmin ? (req as any).user.id : undefined;

      const activity = await db.getHourlyActivity?.(undefined, 24, userId) || [];
      
      const data = activity.map(a => {
        // hour is in format YYYY-MM-DDTHH
        const dateObj = new Date(a.hour + ':00:00Z');
        const hourStr = dateObj.getHours().toString().padStart(2, '0');
        
        return {
          time: `${hourStr}:00`,
          sent: a.sent + a.failed, // sent attempts
          delivered: a.sent,       // successful
          failed: a.failed
        };
      });

      // If no data, provide an empty skeleton
      if (data.length === 0) {
         for (let i = 0; i < 24; i++) {
           data.push({
             time: `${i}:00`,
             sent: 0,
             delivered: 0,
             failed: 0
           });
         }
      }
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== ANTI-BLOCK ==========
  router.get('/antiblock/settings', async (req, res) => {
    const userId = (req as any).user?.id || 'default';
    const settings = await db.getAntiBlockSettings(userId);
    res.json(settings);
  });

  router.post('/antiblock/settings', async (req, res) => {
    const userId = (req as any).user?.id || 'default';
    await db.updateAntiBlockSettings({ ...req.body, userId });
    const settings = await db.getAntiBlockSettings(userId);
    res.json(settings);
  });

  router.post('/antiblock/settings/reset', async (req, res) => {
    const userId = (req as any).user?.id || 'default';
    await db.updateAntiBlockSettings({
      rateLimitEnabled: true,
      messagesPerMinute: 5,
      messagesPerHour: 50,
      burstLimit: 10,
      delayEnabled: true,
      minDelay: 1,
      maxDelay: 5,
      baseDelay: 2,
      warmupEnabled: true,
      warmupDays: 7,
      warmupDay1Limit: 10,
      warmupDay7Limit: 100,
      spintaxEnabled: true,
      numberFilterEnabled: true,
      userId
    });
    const settings = await db.getAntiBlockSettings(userId);
    res.json(settings);
  });

  // ========== TEMPLATES (main routes) ==========
  router.get('/templates', async (req, res) => {
    const userId = (req as any).user?.id || 'default';
    const templates = await db.getTemplates(userId);
    res.json(templates);
  });

  router.post('/templates', validate(templateSchema), async (req, res) => {
    try {
      const { name, content } = req.body;
      const userId = (req as any).user?.id || 'default';

      const template = await db.createTemplate({
        id: crypto.randomUUID(),
        userId,
        name,
        content
      });

      res.status(201).json(template);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.put('/templates/:id', async (req, res) => {
    try {
      const { name, content } = req.body;
      await db.updateTemplate(req.params.id, { name, content });
      const template = await db.getTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
      res.json(template);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.delete('/templates/:id', async (req, res) => {
    await db.deleteTemplate(req.params.id);
    res.json({ message: 'Template deleted' });
  });

  // ========== CONTACTS ==========
  router.get('/contacts', (req, res) => {
    // TODO: Global contacts endpoint if needed, distinct from session contacts
    res.status(501).json({ error: 'Not implemented. Use /sessions/:id/contacts' });
  });

  router.get('/sessions/:id/contacts', async (req, res) => {
    try {
      if (!isValidUUID(req.params.id)) {
        return res.status(400).json({ error: 'Invalid session ID format' });
      }

      const sessionId = req.params.id;
      const search = req.query.search as string;
      const limit = parseInt(req.query.limit as string) || 500;

      const conn = connectionManager.getSession(sessionId);
      if (!conn) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Query langsung ke PostgreSQL (async)
      const [contacts, count] = await Promise.all([
        db.getContacts(sessionId, search),
        db.getContactsCountAsync(sessionId)
      ]);

      res.json({
        total: count,
        syncStatus: conn.contactsSyncStatus,
        contacts: contacts.slice(0, limit).map(c => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          jid: c.jid,
          isGroup: !!c.isGroup,
          updatedAt: c.updatedAt
        }))
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Trigger manual contact sync (with rate limiting)
  router.post('/sessions/:id/contacts/sync', async (req, res) => {
    try {
      if (!isValidUUID(req.params.id)) {
        return res.status(400).json({ error: 'Invalid session ID format' });
      }

      const sessionId = req.params.id;

      const conn = connectionManager.getSession(sessionId);
      if (!conn) {
        return res.status(404).json({ error: 'Session not found' });
      }

      if (conn.status !== 'connected') {
        return res.status(400).json({ error: 'Session not connected' });
      }

      // Check rate limit for manual sync
      if (!connectionManager.isManualSyncAllowed(sessionId)) {
        return res.status(429).json({
          error: 'Sync too frequent. Please wait 30 seconds between manual syncs.',
          syncStatus: conn.contactsSyncStatus,
          total: connectionManager.getContactsCount(sessionId)
        });
      }

      // Record manual sync time
      connectionManager.recordManualSync(sessionId);

      await connectionManager.syncChatsHistory(sessionId);

      const count = connectionManager.getContactsCount(sessionId);
      res.json({
        message: 'Contact sync triggered',
        total: count,
        syncStatus: conn.contactsSyncStatus
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== GROUPS ==========
  router.get('/sessions/:id/groups', async (req, res) => {
    try {
      if (!isValidUUID(req.params.id)) {
        return res.status(400).json({ error: 'Invalid session ID format' });
      }

      const sessionId = req.params.id;
      // Query langsung ke DB, filter group (jid @g.us)
      const contacts = await db.getContacts(sessionId);
      const groups = contacts
        .filter(c => c.jid && c.jid.endsWith('@g.us'))
        .map(g => ({
          id: g.id,
          name: g.name,
          jid: g.jid,
          participantCount: 0
        }));

      res.json(groups);

    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== GLOBAL SETTINGS ==========
  router.get('/settings', async (req: any, res) => {
    try {
      if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'superadmin')) {
         return res.status(403).json({ error: 'Require explicit admin access' });
      }
      const settings = await db.getGlobalSettings?.();
      res.json(settings || {});
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/settings', async (req: any, res) => {
    try {
      if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'superadmin')) {
         return res.status(403).json({ error: 'Require explicit admin access' });
      }

      const newSettings = { ...req.body };
      
      if (req.user.role !== 'superadmin') {
        delete newSettings.sumopodApiKey;
        delete newSettings.sumopodModel;
        delete newSettings.geminiApiKey;
        delete newSettings.geminiModel;
      }

      await db.updateGlobalSettings?.(newSettings);
      res.json({ message: 'Global settings updated successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== API INFO / DOCS ==========
  router.get('/', (req, res) => {
    res.json({
      name: 'WA Gateway API',
      version: '1.0.0',
      endpoints: {
        sessions: {
          'GET /api/v1/sessions': 'Daftar semua session',
          'POST /api/v1/sessions': 'Buat session baru (dapat token)',
          'GET /api/v1/sessions/:id/qr': 'Ambil QR code (auto-refresh)',
          'DELETE /api/v1/sessions/:id': 'Hapus session',
          'POST /api/v1/sessions/:id/reconnect': 'Reconnect session',
          'POST /api/v1/sessions/:id/logout': 'Logout session',
          'POST /api/v1/sessions/:id/refresh': 'Refresh status session dari WhatsApp'
        },
        messages: {
          'POST /api/v1/messages/send': 'Kirim pesan (pilih session manual)',
          'POST /api/v1/messages/send-auto': 'Kirim pesan (auto pilih session aktif) - RECOMMENDED',
          'POST /api/v1/messages/send-template': 'Kirim pesan menggunakan template',
          'POST /api/v1/messages/bulk': 'Kirim bulk message',
          'POST /api/v1/messages/presence': 'Set typing/presence status'
        },
        'multi-device': {
          'GET /api/v1/pool/status': 'Status session pool (total, aktif, dll)',
          'GET /api/v1/pool/sessions': 'Daftar semua session aktif',
          'GET /api/v1/pool/best-session': 'Info session terbaik untuk kirim',
          'POST /api/v1/pool/validate': 'Validasi session token'
        },
        'auto-reply': {
          'GET /api/v1/autoreply/rules': 'Daftar auto-reply rules',
          'POST /api/v1/autoreply/rules': 'Buat auto-reply rule baru',
          'PUT /api/v1/autoreply/rules/:id': 'Update auto-reply rule',
          'DELETE /api/v1/autoreply/rules/:id': 'Hapus auto-reply rule',
          'GET /api/v1/autoreply/settings/:sessionId': 'Ambil auto-reply settings',
          'POST /api/v1/autoreply/settings': 'Update auto-reply settings'
        },
        templates: {
          'GET /api/v1/templates': 'Daftar templates',
          'GET /api/v1/templates/:id': 'Detail template',
          'POST /api/v1/templates': 'Buat template baru',
          'PUT /api/v1/templates/:id': 'Update template',
          'DELETE /api/v1/templates/:id': 'Hapus template',
          'POST /api/v1/templates/:id/preview': 'Preview template dengan variabel'
        },
        analytics: {
          'GET /api/v1/analytics/dashboard': 'Dashboard summary',
          'GET /api/v1/analytics/messages': 'Statistik pesan',
          'GET /api/v1/analytics/hourly': 'Aktivitas per jam'
        },
        'ai-integration': {
          'POST /api/v1/ai/chat': 'Chat dengan AI Kimi',
          'POST /api/v1/ai/generate-reply': 'Generate reply otomatis dengan AI'
        },
        queue: {
          'GET /api/v1/queue': 'Lihat antrean',
          'GET /api/v1/queue/stats': 'Statistik antrean',
          'POST /api/v1/queue/pause': 'Jeda antrean',
          'POST /api/v1/queue/resume': 'Lanjutkan antrean',
          'POST /api/v1/queue/retry': 'Coba ulang yang gagal'
        },
        webhooks: {
          'GET /api/v1/webhooks': 'Daftar webhook',
          'POST /api/v1/webhooks': 'Tambah webhook',
          'DELETE /api/v1/webhooks/:id': 'Hapus webhook'
        },
        contacts: {
          'GET /api/v1/sessions/:id/contacts': 'Ambil daftar kontak dari session',
          'POST /api/v1/sessions/:id/contacts/sync': 'Trigger manual sync kontak dari WhatsApp'
        },
        groups: {
          'GET /api/v1/sessions/:id/groups': 'Ambil daftar grup'
        },
        antiblock: {
          'GET /api/v1/antiblock/settings': 'Pengaturan anti-block',
          'POST /api/v1/antiblock/settings': 'Update pengaturan'
        },
        settings: {
          'GET /api/v1/settings': 'Ambil semua pengaturan global',
          'POST /api/v1/settings': 'Update pengaturan global (Superadmin only)'
        }
      },
      antiBlockFeatures: {
        rateLimiting: 'Batasi pesan per menit/jam',
        randomDelay: 'Jeda acak antar pesan',
        warmupMode: 'Mode pemanasan untuk nomor baru',
        spintax: 'Variasi pesan otomatis',
        browserRandomization: 'Acak browser/user-agent'
      }
    });
  });

  // Mount router
  app.use('/api/v1', router);
}

// Helper function to parse multipart form data
interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

function parseMultipartForm(buffer: Buffer, boundary: string): { fields: Record<string, string>; files: UploadedFile[] } {
  const result = { fields: {} as Record<string, string>, files: [] as UploadedFile[] };
  const boundaryBuffer = Buffer.from(`--${boundary}`);

  let start = buffer.indexOf(boundaryBuffer);

  while (start !== -1) {
    let end = buffer.indexOf(boundaryBuffer, start + boundaryBuffer.length);
    if (end === -1) break;

    const part = buffer.slice(start + boundaryBuffer.length, end);
    const headerEnd = part.indexOf('\r\n\r\n');

    if (headerEnd !== -1) {
      const header = part.slice(0, headerEnd).toString();
      const data = part.slice(headerEnd + 4, part.length - 2);

      const nameMatch = header.match(/name="([^"]+)"/);
      const filenameMatch = header.match(/filename="([^"]+)"/);
      const contentTypeMatch = header.match(/Content-Type: (.+)/i);

      if (nameMatch) {
        const name = nameMatch[1];

        if (filenameMatch && contentTypeMatch) {
          result.files.push({
            fieldname: name,
            originalname: filenameMatch[1],
            encoding: 'binary',
            mimetype: contentTypeMatch[1].trim(),
            buffer: data,
            size: data.length
          });
        } else {
          result.fields[name] = data.toString();
        }
      }
    }

    start = end;
  }

  return result;
}
