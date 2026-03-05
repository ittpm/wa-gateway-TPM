import { Database as BunDatabase } from 'bun:sqlite';
import type { Session, Message, Webhook, WebhookLog, AntiBlockSettings, Stats, Template } from '../models/types.js';
import type { User } from '../models/user.js';
import { logger } from '../utils/logger.js';

export class Database {
  private db: BunDatabase | null = null;

  async init(): Promise<void> {
    const dbPath = process.env.DB_PATH || './data/wagateway.db';

    // Ensure data directory exists
    const fs = await import('fs');
    const path = await import('path');
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new BunDatabase(dbPath);
    this.migrate();
    logger.info('Database initialized with bun:sqlite');
  }

  private migrate(): void {
    if (!this.db) return;

    // Sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL DEFAULT 'default',
        name TEXT NOT NULL,
        phone TEXT,
        status TEXT DEFAULT 'disconnected',
        jid TEXT,
        token TEXT,
        api_key TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_active DATETIME,
        message_count INTEGER DEFAULT 0,
        device_info TEXT,
        platform TEXT,
        me_name TEXT
      )
    `);

    // Add new columns if they don't exist (Migration for existing DB)
    try { this.db.exec('ALTER TABLE sessions ADD COLUMN device_info TEXT'); } catch { }
    try { this.db.exec('ALTER TABLE sessions ADD COLUMN platform TEXT'); } catch { }
    try { this.db.exec('ALTER TABLE sessions ADD COLUMN me_name TEXT'); } catch { }
    // Migration: per-session API key
    try { this.db.exec('ALTER TABLE sessions ADD COLUMN api_key TEXT UNIQUE'); } catch { }
    try { this.db.exec('ALTER TABLE sessions ADD COLUMN user_id TEXT DEFAULT "default"'); } catch { }

    // Users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        to_number TEXT NOT NULL,
        message_type TEXT DEFAULT 'text',
        content TEXT,
        media_url TEXT,
        file_name TEXT,
        caption TEXT,
        latitude REAL,
        longitude REAL,
        contact_name TEXT,
        contact_phone TEXT,
        status TEXT DEFAULT 'pending',
        attempts INTEGER DEFAULT 0,
        error_msg TEXT,
        message_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        scheduled_at DATETIME,
        use_spintax INTEGER DEFAULT 0,
        delay_enabled INTEGER DEFAULT 1,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      )
    `);

    // Webhooks table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS webhooks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL DEFAULT 'default',
        url TEXT NOT NULL,
        secret TEXT,
        events TEXT,
        status TEXT DEFAULT 'active',
        last_triggered DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    try { this.db.exec('ALTER TABLE webhooks ADD COLUMN user_id TEXT DEFAULT "default"'); } catch { }

    // Webhook logs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS webhook_logs (
        id TEXT PRIMARY KEY,
        webhook_id TEXT,
        event_type TEXT,
        payload TEXT,
        success INTEGER,
        status_code INTEGER,
        response TEXT,
        error_msg TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (webhook_id) REFERENCES webhooks(id)
      )
    `);

    // Anti-block settings per user
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_antiblock_settings (
        user_id TEXT PRIMARY KEY,
        rate_limit_enabled INTEGER DEFAULT 1,
        messages_per_minute INTEGER DEFAULT 5,
        messages_per_hour INTEGER DEFAULT 50,
        burst_limit INTEGER DEFAULT 10,
        delay_enabled INTEGER DEFAULT 1,
        min_delay INTEGER DEFAULT 1,
        max_delay INTEGER DEFAULT 5,
        base_delay INTEGER DEFAULT 2,
        warmup_enabled INTEGER DEFAULT 1,
        warmup_days INTEGER DEFAULT 7,
        warmup_day1_limit INTEGER DEFAULT 10,
        warmup_day7_limit INTEGER DEFAULT 100,
        spintax_enabled INTEGER DEFAULT 1,
        number_filter_enabled INTEGER DEFAULT 1,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Contacts table - untuk menyimpan kontak dari WhatsApp
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        name TEXT,
        phone TEXT NOT NULL,
        jid TEXT NOT NULL,
        profile_pic_url TEXT,
        is_group INTEGER DEFAULT 0,
        is_synced INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
        UNIQUE(session_id, jid)
      )
    `);

    // Indexes
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_webhook_logs_timestamp ON webhook_logs(timestamp)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_contacts_session ON contacts(session_id)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_contacts_session ON contacts(session_id)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_contacts_jid ON contacts(jid)`);

    // Templates table with enhanced fields
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS templates (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL DEFAULT 'default',
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        variables TEXT,
        category TEXT DEFAULT 'general',
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migration: Add new columns to existing templates table
    try { this.db.exec('ALTER TABLE templates ADD COLUMN variables TEXT'); } catch { }
    try { this.db.exec('ALTER TABLE templates ADD COLUMN category TEXT DEFAULT "general"'); } catch { }
    try { this.db.exec('ALTER TABLE templates ADD COLUMN is_active INTEGER DEFAULT 1'); } catch { }
    try { this.db.exec('ALTER TABLE templates ADD COLUMN user_id TEXT DEFAULT "default"'); } catch { }

    // Auto-reply rules table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS auto_reply_rules (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        name TEXT NOT NULL,
        trigger_type TEXT DEFAULT 'contains',
        trigger_value TEXT NOT NULL,
        reply_message TEXT NOT NULL,
        use_ai INTEGER DEFAULT 0,
        ai_prompt TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      )
    `);

    // Auto-reply settings per session
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS auto_reply_settings (
        session_id TEXT PRIMARY KEY,
        auto_reply_enabled INTEGER DEFAULT 0,
        auto_reject_unknown INTEGER DEFAULT 0,
        unknown_contact_message TEXT,
        reply_cooldown INTEGER DEFAULT 5,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      )
    `);

    // Global settings key-value store
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS global_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Analytics - hourly stats
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS analytics_hourly (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        hour TEXT NOT NULL,
        sent INTEGER DEFAULT 0,
        failed INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      )
    `);

    // Contact sync log
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS contact_sync_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        sync_type TEXT,
        contacts_count INTEGER DEFAULT 0,
        success INTEGER DEFAULT 1,
        error_msg TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      )
    `);

    // New indexes
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_auto_reply_session ON auto_reply_rules(session_id)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_analytics_hourly ON analytics_hourly(hour)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_contact_sync_session ON contact_sync_logs(session_id)`);
  }

  // Session methods
  // Generate a unique API key for a session
  private generateApiKey(sessionId: string): string {
    const prefix = 'wak';
    const shortId = sessionId.replace(/-/g, '').substring(0, 6);
    const random = crypto.randomUUID().replace(/-/g, '');
    return `${prefix}_${shortId}_${random}`;
  }

  createSession(session: Omit<Session, 'createdAt' | 'updatedAt'>): Session {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    const apiKey = session.apiKey || this.generateApiKey(session.id);

    this.db.run(`
      INSERT INTO sessions (id, user_id, name, phone, status, jid, api_key, created_at, updated_at, message_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [session.id, session.userId, session.name, session.phone || null, session.status, session.jid || null, apiKey, now, now, 0]);

    return {
      ...session,
      apiKey,
      createdAt: new Date(now),
      updatedAt: new Date(now),
      messageCount: 0
    };
  }

  getSession(id: string): Session | null {
    if (!this.db) return null;

    const row = this.db.query('SELECT * FROM sessions WHERE id = ?').get(id) as any;

    if (!row) return null;

    return this.mapSession(row);
  }

  getAllSessions(userId?: string): Session[] {
    if (!this.db) return [];

    let query = 'SELECT * FROM sessions';
    const params: any[] = [];
    if (userId) {
      query += ' WHERE user_id = ?';
      params.push(userId);
    }
    query += ' ORDER BY created_at DESC';

    const rows = this.db.query(query).all(...params) as any[];

    return rows.map(row => this.mapSession(row));
  }

  updateSession(session: Partial<Session> & { id: string }): void {
    if (!this.db) return;

    const sets: string[] = [];
    const values: any[] = [];

    if (session.name !== undefined) { sets.push('name = ?'); values.push(session.name); }
    if (session.phone !== undefined) { sets.push('phone = ?'); values.push(session.phone); }
    if (session.status !== undefined) { sets.push('status = ?'); values.push(session.status); }
    if (session.jid !== undefined) { sets.push('jid = ?'); values.push(session.jid); }
    if (session.deviceInfo !== undefined) { sets.push('device_info = ?'); values.push(session.deviceInfo); }
    if (session.platform !== undefined) { sets.push('platform = ?'); values.push(session.platform); }
    if (session.meName !== undefined) { sets.push('me_name = ?'); values.push(session.meName); }
    if (session.lastActive !== undefined) { sets.push('last_active = ?'); values.push(session.lastActive.toISOString()); }
    if (session.messageCount !== undefined) { sets.push('message_count = ?'); values.push(session.messageCount); }
    if (session.apiKey !== undefined) { sets.push('api_key = ?'); values.push(session.apiKey); }

    sets.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(session.id);

    this.db.run(`UPDATE sessions SET ${sets.join(', ')} WHERE id = ?`, values);
  }

  // Look up a session by its per-session API key
  getSessionByApiKey(apiKey: string): Session | null {
    if (!this.db) return null;
    const row = this.db.query('SELECT * FROM sessions WHERE api_key = ?').get(apiKey) as any;
    if (!row) return null;
    return this.mapSession(row);
  }

  // Regenerate the API key for a session
  regenerateSessionApiKey(sessionId: string): string {
    if (!this.db) throw new Error('Database not initialized');
    const newKey = this.generateApiKey(sessionId);
    this.db.run('UPDATE sessions SET api_key = ?, updated_at = ? WHERE id = ?',
      [newKey, new Date().toISOString(), sessionId]);
    return newKey;
  }

  deleteSession(id: string): void {
    if (!this.db) return;
    this.db.run('DELETE FROM sessions WHERE id = ?', [id]);
  }

  createContact(contact: { id: string; sessionId: string; name?: string; phone: string; jid: string; profilePicUrl?: string; isGroup?: boolean }): void {
    if (!this.db) return;

    const now = new Date().toISOString();

    this.db.run(`
      INSERT OR REPLACE INTO contacts (id, session_id, name, phone, jid, profile_pic_url, is_group, is_synced, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `, [
      contact.id,
      contact.sessionId,
      contact.name || null,
      contact.phone,
      contact.jid,
      contact.profilePicUrl || null,
      contact.isGroup ? 1 : 0,
      now,
      now
    ]);
  }

  // Batch insert contacts for high performance sync
  bulkUpsertContacts(contacts: Array<{ id: string; sessionId: string; name?: string; phone: string; jid: string; profilePicUrl?: string; isGroup?: boolean }>): void {
    if (!this.db || contacts.length === 0) return;

    const now = new Date().toISOString();

    const insertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO contacts (id, session_id, name, phone, jid, profile_pic_url, is_group, is_synced, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `);

    try {
      this.db.transaction(() => {
        for (const contact of contacts) {
          insertStmt.run([
            contact.id,
            contact.sessionId,
            contact.name ? contact.name : null,
            contact.phone,
            contact.jid,
            contact.profilePicUrl ? contact.profilePicUrl : null,
            contact.isGroup ? 1 : 0,
            now,
            now
          ] as any);
        }
      })();
    } catch (error) {
      logger.error('Error during bulkUpsertContacts:', error);
    }
  }

  getContacts(sessionId: string, search?: string): any[] {
    if (!this.db) return [];

    let query = 'SELECT * FROM contacts WHERE session_id = ?';
    const params: any[] = [sessionId];

    if (search) {
      query += ' AND (name LIKE ? OR phone LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY name ASC, phone ASC';

    return this.db.query(query).all(...params) as any[];
  }

  getContactsCount(sessionId: string): number {
    if (!this.db) return 0;

    const result = this.db.query('SELECT COUNT(*) as count FROM contacts WHERE session_id = ?').get(sessionId) as any;
    return result?.count || 0;
  }

  deleteContactsBySession(sessionId: string): void {
    if (!this.db) return;
    this.db.run('DELETE FROM contacts WHERE session_id = ?', [sessionId]);
  }

  getContactByJid(sessionId: string, jid: string): any | null {
    if (!this.db) return null;

    return this.db.query('SELECT * FROM contacts WHERE session_id = ? AND jid = ?').get(sessionId, jid) as any;
  }

  updateContact(id: string, updates: { name?: string; profilePicUrl?: string }): void {
    if (!this.db) return;

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }

    if (updates.profilePicUrl !== undefined) {
      fields.push('profile_pic_url = ?');
      values.push(updates.profilePicUrl);
    }

    if (fields.length > 0) {
      fields.push('updated_at = ?');
      values.push(new Date().toISOString());
      values.push(id);

      this.db.run(`UPDATE contacts SET ${fields.join(', ')} WHERE id = ?`, values);
    }
  }

  // Message methods
  createMessage(message: Omit<Message, 'id' | 'createdAt' | 'updatedAt' | 'attempts'>): Message {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    this.db.run(`
      INSERT INTO messages (id, session_id, to_number, message_type, content, media_url, file_name,
        caption, latitude, longitude, contact_name, contact_phone, status, attempts, created_at,
        updated_at, scheduled_at, use_spintax, delay_enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, message.sessionId, message.to, message.type, message.content || null,
      message.mediaUrl || null, message.fileName || null, message.caption || null,
      message.latitude || null, message.longitude || null, message.contactName || null,
      message.contactPhone || null, message.status, 0, now, now,
      message.scheduledAt?.toISOString() || null, message.useSpintax ? 1 : 0, message.delayEnabled ? 1 : 0
    ]);

    return { ...message, id, createdAt: new Date(now), updatedAt: new Date(now), attempts: 0 };
  }

  getMessagesByStatus(status: string, limit: number = 100): Message[] {
    if (!this.db) return [];

    const rows = this.db.query('SELECT * FROM messages WHERE status = ? ORDER BY created_at ASC LIMIT ?').all(status, limit) as any[];

    return rows.map(row => this.mapMessage(row));
  }

  updateMessage(message: Partial<Message> & { id?: string, messageId?: string }): void {
    if (!this.db) return;

    const sets: string[] = [];
    const values: any[] = [];

    if (message.status !== undefined) { sets.push('status = ?'); values.push(message.status); }
    if (message.attempts !== undefined) { sets.push('attempts = ?'); values.push(message.attempts); }
    if (message.error !== undefined) { sets.push('error_msg = ?'); values.push(message.error); }
    // FIX: also persist the WA message_id returned after a successful send
    if (message.messageId !== undefined) { sets.push('message_id = ?'); values.push(message.messageId); }

    sets.push('updated_at = ?');
    values.push(new Date().toISOString());

    if (message.id && message.id !== 'UNKNOWN') {
      values.push(message.id);
      this.db.run(`UPDATE messages SET ${sets.join(', ')} WHERE id = ?`, values);
    } else if (message.messageId) {
      values.push(message.messageId);
      this.db.run(`UPDATE messages SET ${sets.join(', ')} WHERE message_id = ?`, values);
    }
  }

  deleteMessagesByStatus(status: string): void {
    if (!this.db) return;
    this.db.run('DELETE FROM messages WHERE status = ?', [status]);
  }

  getQueueStats(): Record<string, number> {
    if (!this.db) return {};

    try {
      const rows = this.db.query('SELECT status, COUNT(*) as count FROM messages GROUP BY status').all() as any[];

      const stats: Record<string, number> = {};
      for (const row of rows) {
        stats[row.status] = row.count;
      }
      return stats;
    } catch (error) {
      logger.error('Database query error in getQueueStats:', error);
      return {};
    }
  }

  getMessagesCountInTimeRange(sessionId: string, startTime: Date, endTime: Date): number {
    if (!this.db) return 0;

    try {
      const result = this.db.query(
        'SELECT COUNT(*) as count FROM messages WHERE session_id = ? AND status = ? AND created_at BETWEEN ? AND ?'
      ).get(sessionId, 'completed', startTime.toISOString(), endTime.toISOString()) as any;

      return result?.count || 0;
    } catch (error) {
      logger.error('Database query error in getMessagesCountInTimeRange:', error);
      return 0;
    }
  }

  getMessagesCount(sessionId: string, status: string): number {
    if (!this.db) return 0;

    try {
      const result = this.db.query(
        'SELECT COUNT(*) as count FROM messages WHERE session_id = ? AND status = ?'
      ).get(sessionId, status) as any;

      return result?.count || 0;
    } catch (error) {
      logger.error('Database query error in getMessagesCount:', error);
      return 0;
    }
  }

  getSessionById(id: string): Session | null {
    if (!this.db) return null;

    const row = this.db.query('SELECT * FROM sessions WHERE id = ?').get(id) as any;
    if (!row) return null;

    return this.mapSession(row);
  }

  getMessages(filters: {
    sessionId?: string;
    status?: string;
    limit?: number;
    offset?: number;
    search?: string;
    userId?: string;
  }): { messages: Message[]; total: number } {
    if (!this.db) return { messages: [], total: 0 };

    let query = 'SELECT * FROM messages WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as count FROM messages WHERE 1=1';
    const params: any[] = [];
    const countParams: any[] = [];

    if (filters.userId) {
      query += ' AND session_id IN (SELECT id FROM sessions WHERE user_id = ?)';
      countQuery += ' AND session_id IN (SELECT id FROM sessions WHERE user_id = ?)';
      params.push(filters.userId);
      countParams.push(filters.userId);
    }

    if (filters.sessionId) {
      query += ' AND session_id = ?';
      countQuery += ' AND session_id = ?';
      params.push(filters.sessionId);
      countParams.push(filters.sessionId);
    }

    if (filters.status) {
      query += ' AND status = ?';
      countQuery += ' AND status = ?';
      params.push(filters.status);
      countParams.push(filters.status);
    }

    if (filters.search) {
      query += ' AND (content LIKE ? OR to_number LIKE ?)';
      countQuery += ' AND (content LIKE ? OR to_number LIKE ?)';
      const searchPattern = `%${filters.search}%`;
      params.push(searchPattern, searchPattern);
      countParams.push(searchPattern, searchPattern);
    }

    query += ' ORDER BY created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
      if (filters.offset) {
        query += ' OFFSET ?';
        params.push(filters.offset);
      }
    }

    const rows = this.db.query(query).all(...params) as any[];
    const total = (this.db.query(countQuery).get(...countParams) as any).count;

    return {
      messages: rows.map(row => this.mapMessage(row)),
      total
    };
  }

  // Webhook methods
  createWebhook(webhook: Omit<Webhook, 'createdAt' | 'updatedAt'>): Webhook {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();

    this.db.run(`
      INSERT INTO webhooks (id, user_id, url, secret, events, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [webhook.id, webhook.userId, webhook.url, webhook.secret || null, webhook.events.join(','), webhook.status, now, now]);

    return { ...webhook, createdAt: new Date(now), updatedAt: new Date(now) };
  }

  getAllWebhooks(userId?: string): Webhook[] {
    if (!this.db) return [];

    let query = 'SELECT * FROM webhooks';
    const params: any[] = [];
    if (userId) {
      query += ' WHERE user_id = ?';
      params.push(userId);
    }
    query += ' ORDER BY created_at DESC';

    const rows = this.db.query(query).all(...params) as any[];

    return rows.map(row => this.mapWebhook(row));
  }

  deleteWebhook(id: string): void {
    if (!this.db) return;
    this.db.run('DELETE FROM webhooks WHERE id = ?', [id]);
  }

  updateWebhook(webhook: Partial<Webhook> & { id: string }): void {
    if (!this.db) return;

    const sets: string[] = [];
    const values: any[] = [];

    if (webhook.url !== undefined) { sets.push('url = ?'); values.push(webhook.url); }
    if (webhook.secret !== undefined) { sets.push('secret = ?'); values.push(webhook.secret); }
    if (webhook.events !== undefined) { sets.push('events = ?'); values.push(webhook.events.join(',')); }
    if (webhook.status !== undefined) { sets.push('status = ?'); values.push(webhook.status); }
    if (webhook.lastTriggered !== undefined) { sets.push('last_triggered = ?'); values.push(webhook.lastTriggered.toISOString()); }

    sets.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(webhook.id);

    this.db.run(`UPDATE webhooks SET ${sets.join(', ')} WHERE id = ?`, values);
  }

  createWebhookLog(log: Omit<WebhookLog, 'timestamp'>): void {
    if (!this.db) return;

    this.db.run(`
      INSERT INTO webhook_logs (id, webhook_id, event_type, payload, success, status_code, response, error_msg, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [log.id, log.webhookId, log.event, log.payload, log.success ? 1 : 0,
    log.statusCode || null, log.response || null, log.error || null, new Date().toISOString()]);
  }

  getWebhookLogs(limit: number = 100): WebhookLog[] {
    if (!this.db) return [];

    const rows = this.db.query('SELECT * FROM webhook_logs ORDER BY timestamp DESC LIMIT ?').all(limit) as any[];

    return rows.map(row => this.mapWebhookLog(row));
  }

  getAntiBlockSettings(userId: string): AntiBlockSettings {
    if (!this.db) {
      return this.getDefaultAntiBlockSettings(userId);
    }

    const row = this.db.query('SELECT * FROM user_antiblock_settings WHERE user_id = ?').get(userId) as any;

    if (!row) {
      return this.getDefaultAntiBlockSettings(userId);
    }

    return this.mapAntiBlockSettings(row);
  }

  private getDefaultAntiBlockSettings(userId: string): AntiBlockSettings {
    return {
      userId,
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
      updatedAt: new Date()
    };
  }

  updateAntiBlockSettings(settings: Partial<AntiBlockSettings> & { userId: string }): void {
    if (!this.db) return;

    // Ensure settings exist first
    const existing = this.getAntiBlockSettings(settings.userId);
    if (!existing) {
      this.db.run(`INSERT INTO user_antiblock_settings (user_id) VALUES (?)`, [settings.userId]);
    }

    const sets: string[] = [];
    const values: any[] = [];

    if (settings.rateLimitEnabled !== undefined) { sets.push('rate_limit_enabled = ?'); values.push(settings.rateLimitEnabled ? 1 : 0); }
    if (settings.messagesPerMinute !== undefined) { sets.push('messages_per_minute = ?'); values.push(settings.messagesPerMinute); }
    if (settings.messagesPerHour !== undefined) { sets.push('messages_per_hour = ?'); values.push(settings.messagesPerHour); }
    if (settings.burstLimit !== undefined) { sets.push('burst_limit = ?'); values.push(settings.burstLimit); }
    if (settings.delayEnabled !== undefined) { sets.push('delay_enabled = ?'); values.push(settings.delayEnabled ? 1 : 0); }
    if (settings.minDelay !== undefined) { sets.push('min_delay = ?'); values.push(settings.minDelay); }
    if (settings.maxDelay !== undefined) { sets.push('max_delay = ?'); values.push(settings.maxDelay); }
    if (settings.warmupEnabled !== undefined) { sets.push('warmup_enabled = ?'); values.push(settings.warmupEnabled ? 1 : 0); }
    if (settings.warmupDays !== undefined) { sets.push('warmup_days = ?'); values.push(settings.warmupDays); }
    if (settings.spintaxEnabled !== undefined) { sets.push('spintax_enabled = ?'); values.push(settings.spintaxEnabled ? 1 : 0); }
    if (settings.numberFilterEnabled !== undefined) { sets.push('number_filter_enabled = ?'); values.push(settings.numberFilterEnabled ? 1 : 0); }

    if (sets.length === 0) return;

    sets.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(settings.userId);

    this.db.run(`UPDATE user_antiblock_settings SET ${sets.join(', ')} WHERE user_id = ?`, values);
  }

  // Stats
  getStats(): Stats {
    if (!this.db) {
      return { totalSessions: 0, activeSessions: 0, messagesSent: 0, messagesQueued: 0, messagesDelivered: 0, messagesFailed: 0 };
    }

    const totalSessions = (this.db.query('SELECT COUNT(*) as count FROM sessions').get() as any).count;
    const activeSessions = (this.db.query("SELECT COUNT(*) as count FROM sessions WHERE status = 'connected'").get() as any).count;
    const messagesSent = (this.db.query('SELECT COUNT(*) as count FROM messages').get() as any).count;
    const messagesQueued = (this.db.query("SELECT COUNT(*) as count FROM messages WHERE status = 'pending'").get() as any).count;
    const messagesDelivered = (this.db.query("SELECT COUNT(*) as count FROM messages WHERE status = 'completed'").get() as any).count;
    const messagesFailed = (this.db.query("SELECT COUNT(*) as count FROM messages WHERE status = 'failed'").get() as any).count;

    return { totalSessions, activeSessions, messagesSent, messagesQueued, messagesDelivered, messagesFailed };
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // User methods
  createUser(user: User): void {
    if (!this.db) return;

    const now = new Date().toISOString();

    this.db.run(`
      INSERT INTO users (id, username, password, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [user.id, user.username, user.password || '', user.role || 'user', now, now]);
  }

  getUserByUsername(username: string): User | null {
    if (!this.db) return null;

    const row = this.db.query('SELECT * FROM users WHERE username = ?').get(username) as any;

    if (!row) return null;

    return this.mapUser(row);
  }

  getUserById(id: string): User | null {
    if (!this.db) return null;

    const row = this.db.query('SELECT * FROM users WHERE id = ?').get(id) as any;

    if (!row) return null;

    return this.mapUser(row);
  }

  updateUserPassword(username: string, hashedPassword: string): void {
    if (!this.db) return;

    const now = new Date().toISOString();
    this.db.run(`
      UPDATE users SET password = ?, updated_at = ? WHERE username = ?
    `, [hashedPassword, now, username]);
  }

  updateUserPasswordById(id: string, hashedPassword: string): void {
    if (!this.db) return;

    const now = new Date().toISOString();
    this.db.run(`
      UPDATE users SET password = ?, updated_at = ? WHERE id = ?
    `, [hashedPassword, now, id]);
  }

  getAllUsers(): User[] {
    if (!this.db) return [];
    const rows = this.db.query('SELECT id, username, role, created_at, updated_at FROM users ORDER BY created_at ASC').all() as any[];
    return rows.map(row => ({
      id: row.id,
      username: row.username,
      role: row.role,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }));
  }

  deleteUser(id: string): void {
    if (!this.db) return;
    this.db.run('DELETE FROM users WHERE id = ?', [id]);
  }

  updateUserRole(id: string, role: string): void {
    if (!this.db) return;
    const now = new Date().toISOString();
    this.db.run('UPDATE users SET role = ?, updated_at = ? WHERE id = ?', [role, now, id]);
  }


  // Mappers
  private mapUser(row: any): User {
    return {
      id: row.id,
      username: row.username,
      password: row.password,
      role: row.role,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private mapSession(row: any): Session {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      phone: row.phone,
      status: row.status,
      jid: row.jid,
      token: row.token,
      apiKey: row.api_key,
      deviceInfo: row.device_info,
      platform: row.platform,
      meName: row.me_name,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      lastActive: row.last_active ? new Date(row.last_active) : undefined,
      messageCount: row.message_count
    };
  }

  private mapMessage(row: any): Message {
    return {
      id: row.id,
      sessionId: row.session_id,
      to: row.to_number,
      type: row.message_type,
      content: row.content,
      mediaUrl: row.media_url,
      fileName: row.file_name,
      caption: row.caption,
      latitude: row.latitude,
      longitude: row.longitude,
      contactName: row.contact_name,
      contactPhone: row.contact_phone,
      status: row.status,
      attempts: row.attempts,
      error: row.error_msg,
      messageId: row.message_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      scheduledAt: row.scheduled_at ? new Date(row.scheduled_at) : undefined,
      useSpintax: !!row.use_spintax,
      delayEnabled: !!row.delay_enabled
    };
  }

  // Template methods

  getTemplates(userId?: string): Template[] {
    if (!this.db) return [];

    let query = 'SELECT * FROM templates';
    const params: any[] = [];
    if (userId) {
      query += ' WHERE user_id = ?';
      params.push(userId);
    }
    query += ' ORDER BY name ASC';

    const rows = this.db.query(query).all(...params) as any[];

    return rows.map(row => this.mapTemplate(row));
  }

  getTemplate(id: string): Template | null {
    if (!this.db) return null;

    const row = this.db.query('SELECT * FROM templates WHERE id = ?').get(id) as any;

    if (!row) return null;

    return this.mapTemplate(row);
  }



  deleteTemplate(id: string): void {
    if (!this.db) return;
    this.db.run('DELETE FROM templates WHERE id = ?', [id]);
  }

  private mapTemplate(row: any): Template {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      content: row.content,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private mapWebhook(row: any): Webhook {
    return {
      id: row.id,
      userId: row.user_id,
      url: row.url,
      secret: row.secret,
      events: row.events ? row.events.split(',') : [],
      status: row.status,
      lastTriggered: row.last_triggered ? new Date(row.last_triggered) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private mapWebhookLog(row: any): WebhookLog {
    return {
      id: row.id,
      webhookId: row.webhook_id,
      event: row.event_type,
      payload: row.payload,
      success: !!row.success,
      statusCode: row.status_code,
      response: row.response,
      error: row.error_msg,
      timestamp: new Date(row.timestamp)
    };
  }

  private mapAntiBlockSettings(row: any): AntiBlockSettings {
    return {
      userId: row.user_id,
      rateLimitEnabled: !!row.rate_limit_enabled,
      messagesPerMinute: row.messages_per_minute,
      messagesPerHour: row.messages_per_hour,
      burstLimit: row.burst_limit,
      delayEnabled: !!row.delay_enabled,
      minDelay: row.min_delay,
      maxDelay: row.max_delay,
      baseDelay: row.base_delay,
      warmupEnabled: !!row.warmup_enabled,
      warmupDays: row.warmup_days,
      warmupDay1Limit: row.warmup_day1_limit,
      warmupDay7Limit: row.warmup_day7_limit,
      spintaxEnabled: !!row.spintax_enabled,
      numberFilterEnabled: !!row.number_filter_enabled,
      updatedAt: new Date(row.updated_at)
    };
  }

  // Enhanced Template methods
  createTemplate(template: any): void {
    if (!this.db) return;
    const now = new Date().toISOString();
    this.db.run(`
      INSERT INTO templates (id, user_id, name, content, variables, category, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [template.id, template.userId || 'default', template.name, template.content,
    JSON.stringify(template.variables || []),
    template.category || 'general',
    template.isActive !== false ? 1 : 0,
      now, now]);
  }

  updateTemplate(id: string, updates: any): void {
    if (!this.db) return;
    const sets: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) { sets.push('name = ?'); values.push(updates.name); }
    if (updates.content !== undefined) { sets.push('content = ?'); values.push(updates.content); }
    if (updates.variables !== undefined) { sets.push('variables = ?'); values.push(JSON.stringify(updates.variables)); }
    if (updates.category !== undefined) { sets.push('category = ?'); values.push(updates.category); }
    if (updates.isActive !== undefined) { sets.push('is_active = ?'); values.push(updates.isActive ? 1 : 0); }

    if (sets.length === 0) return;

    sets.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    this.db.run(`UPDATE templates SET ${sets.join(', ')} WHERE id = ?`, values);
  }

  // Auto-reply methods
  createAutoReplyRule(rule: any): void {
    if (!this.db) return;
    const now = new Date().toISOString();
    this.db.run(`
      INSERT INTO auto_reply_rules (id, session_id, name, trigger_type, trigger_value, reply_message, use_ai, ai_prompt, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [rule.id, rule.sessionId, rule.name, rule.triggerType, rule.triggerValue,
    rule.replyMessage, rule.useAI ? 1 : 0, rule.aiPrompt || null,
    rule.isActive !== false ? 1 : 0, now, now]);
  }

  updateAutoReplyRule(id: string, updates: any): void {
    if (!this.db) return;
    const sets: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) { sets.push('name = ?'); values.push(updates.name); }
    if (updates.triggerType !== undefined) { sets.push('trigger_type = ?'); values.push(updates.triggerType); }
    if (updates.triggerValue !== undefined) { sets.push('trigger_value = ?'); values.push(updates.triggerValue); }
    if (updates.replyMessage !== undefined) { sets.push('reply_message = ?'); values.push(updates.replyMessage); }
    if (updates.useAI !== undefined) { sets.push('use_ai = ?'); values.push(updates.useAI ? 1 : 0); }
    if (updates.aiPrompt !== undefined) { sets.push('ai_prompt = ?'); values.push(updates.aiPrompt); }
    if (updates.isActive !== undefined) { sets.push('is_active = ?'); values.push(updates.isActive ? 1 : 0); }

    if (sets.length === 0) return;

    sets.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    this.db.run(`UPDATE auto_reply_rules SET ${sets.join(', ')} WHERE id = ?`, values);
  }

  deleteAutoReplyRule(id: string): void {
    if (!this.db) return;
    this.db.run('DELETE FROM auto_reply_rules WHERE id = ?', [id]);
  }

  getAllAutoReplyRules(): any[] {
    if (!this.db) return [];
    const rows = this.db.query('SELECT * FROM auto_reply_rules').all() as any[];
    return rows.map(row => ({
      id: row.id,
      sessionId: row.session_id,
      name: row.name,
      triggerType: row.trigger_type,
      triggerValue: row.trigger_value,
      replyMessage: row.reply_message,
      useAI: !!row.use_ai,
      aiPrompt: row.ai_prompt,
      isActive: !!row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }));
  }

  updateAutoReplySettings(settings: any): void {
    if (!this.db) return;
    const now = new Date().toISOString();
    this.db.run(`
      INSERT OR REPLACE INTO auto_reply_settings 
      (session_id, auto_reply_enabled, auto_reject_unknown, unknown_contact_message, reply_cooldown, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [settings.sessionId, settings.autoReplyEnabled ? 1 : 0,
    settings.autoRejectUnknown ? 1 : 0,
    settings.unknownContactMessage || '',
    settings.replyCooldown || 5, now]);
  }

  getAllAutoReplySettings(): any[] {
    if (!this.db) return [];
    const rows = this.db.query('SELECT * FROM auto_reply_settings').all() as any[];
    return rows.map(row => ({
      sessionId: row.session_id,
      autoReplyEnabled: !!row.auto_reply_enabled,
      autoRejectUnknown: !!row.auto_reject_unknown,
      unknownContactMessage: row.unknown_contact_message,
      replyCooldown: row.reply_cooldown,
      updatedAt: new Date(row.updated_at)
    }));
  }

  getAutoReplySettings(sessionId: string): any {
    if (!this.db) return null;
    const row = this.db.query('SELECT * FROM auto_reply_settings WHERE session_id = ?').get(sessionId) as any;
    if (!row) return null;
    return {
      sessionId: row.session_id,
      autoReplyEnabled: !!row.auto_reply_enabled,
      autoRejectUnknown: !!row.auto_reject_unknown,
      unknownContactMessage: row.unknown_contact_message,
      replyCooldown: row.reply_cooldown,
      updatedAt: new Date(row.updated_at)
    };
  }

  // Global Settings methods
  updateGlobalSettings(settings: Record<string, string | number | boolean>): void {
    if (!this.db) return;
    const now = new Date().toISOString();
    
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO global_settings (key, value, updated_at)
      VALUES (?, ?, ?)
    `);

    this.db.transaction(() => {
      for (const [key, value] of Object.entries(settings)) {
        stmt.run(key, String(value), now);
      }
    })();
  }

  getGlobalSettings(): Record<string, any> {
    if (!this.db) return {};
    const rows = this.db.query('SELECT key, value FROM global_settings').all() as { key: string, value: string }[];
    const settings: Record<string, any> = {};
    for (const row of rows) {
      if (row.value === 'true') settings[row.key] = true;
      else if (row.value === 'false') settings[row.key] = false;
      else if (!isNaN(Number(row.value)) && row.value.trim() !== '') settings[row.key] = Number(row.value);
      else settings[row.key] = row.value;
    }
    return settings;
  }

  // Analytics methods
  recordHourlyStats(sessionId: string | null, sent: number, failed: number): void {
    if (!this.db) return;
    const hour = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
    this.db.run(`
      INSERT INTO analytics_hourly (session_id, hour, sent, failed)
      VALUES (?, ?, ?, ?)
      ON CONFLICT DO UPDATE SET
        sent = sent + excluded.sent,
        failed = failed + excluded.failed
    `, [sessionId, hour, sent, failed]);
  }

  getHourlyActivity(sessionId?: string, hours: number = 24, userId?: string): any[] {
    if (!this.db) return [];
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString().slice(0, 13);

    let query = 'SELECT hour, SUM(sent) as sent, SUM(failed) as failed FROM analytics_hourly WHERE hour >= ?';
    const params: any[] = [since];

    if (userId) {
      query += ' AND session_id IN (SELECT id FROM sessions WHERE user_id = ?)';
      params.push(userId);
    }

    if (sessionId) {
      query += ' AND session_id = ?';
      params.push(sessionId);
    }

    query += ' GROUP BY hour ORDER BY hour ASC';

    const rows = this.db.query(query).all(...params) as any[];
    return rows.map(row => ({
      hour: row.hour,
      sent: row.sent || 0,
      failed: row.failed || 0
    }));
  }

  getTotalMessagesCount(userId?: string): number {
    if (!this.db) return 0;
    if (userId) {
      const result = this.db.query('SELECT COUNT(*) as count FROM messages WHERE session_id IN (SELECT id FROM sessions WHERE user_id = ?)').get(userId) as any;
      return result?.count || 0;
    }
    const result = this.db.query('SELECT COUNT(*) as count FROM messages').get() as any;
    return result?.count || 0;
  }

  getMessagesCountToday(userId?: string): number {
    if (!this.db) return 0;
    const today = new Date().toISOString().split('T')[0];
    
    if (userId) {
      const result = this.db.query(
        "SELECT COUNT(*) as count FROM messages WHERE DATE(created_at) = ? AND session_id IN (SELECT id FROM sessions WHERE user_id = ?)"
      ).get(today, userId) as any;
      return result?.count || 0;
    }

    const result = this.db.query(
      "SELECT COUNT(*) as count FROM messages WHERE DATE(created_at) = ?"
    ).get(today) as any;
    return result?.count || 0;
  }

  getMessageStats(sessionId?: string, days: number = 7, userId?: string): any {
    if (!this.db) return { total: 0, pending: 0, processing: 0, completed: 0, failed: 0, bySession: {}, byDate: {} };

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    let whereClause = 'WHERE created_at >= ?';
    const params: any[] = [since];

    if (userId) {
      whereClause += ' AND session_id IN (SELECT id FROM sessions WHERE user_id = ?)';
      params.push(userId);
    }

    if (sessionId) {
      whereClause += ' AND session_id = ?';
      params.push(sessionId);
    }

    const total = (this.db.query(`SELECT COUNT(*) as count FROM messages ${whereClause}`).get(...params) as any)?.count || 0;
    const pending = (this.db.query(`SELECT COUNT(*) as count FROM messages ${whereClause} AND status = 'pending'`).get(...params) as any)?.count || 0;
    const processing = (this.db.query(`SELECT COUNT(*) as count FROM messages ${whereClause} AND status = 'processing'`).get(...params) as any)?.count || 0;
    const completed = (this.db.query(`SELECT COUNT(*) as count FROM messages ${whereClause} AND status = 'completed'`).get(...params) as any)?.count || 0;
    const failed = (this.db.query(`SELECT COUNT(*) as count FROM messages ${whereClause} AND status = 'failed'`).get(...params) as any)?.count || 0;

    const bySession: Record<string, number> = {};
    const byDate: Record<string, number> = {};

    return { total, pending, processing, completed, failed, bySession, byDate };
  }
}
