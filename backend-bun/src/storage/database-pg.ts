import pg from 'pg';
const { Pool } = pg;
import type { Session, Message, Webhook, WebhookLog, AntiBlockSettings, Stats, Template } from '../models/types.js';
import type { User } from '../models/user.js';
import { logger } from '../utils/logger.js';

export class Database {
  private pool: pg.Pool | null = null;
  private dbName = 'wagateway';

  async init(): Promise<void> {
    const config = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'wagateway',
    };

    this.pool = new Pool(config);
    this.dbName = config.database;

    // Test connection
    try {
      const client = await this.pool.connect();
      client.release();
      logger.info('PostgreSQL database connected successfully');
    } catch (error: any) {
      logger.error('Failed to connect to PostgreSQL:', error.message);
      logger.info('Make sure PostgreSQL is running and database exists.');
      logger.info('To create database, run: createdb wagateway');
      throw error;
    }

    this.migrate();
    logger.info('Database initialized with PostgreSQL');
  }

  private async migrate(): Promise<void> {
    if (!this.pool) return;

    const client = await this.pool.connect();
    try {
      // Sessions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL DEFAULT 'default',
          name TEXT NOT NULL,
          phone TEXT,
          status TEXT DEFAULT 'disconnected',
          jid TEXT,
          token TEXT,
          api_key TEXT UNIQUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_active TIMESTAMP,
          message_count INTEGER DEFAULT 0,
          device_info TEXT,
          platform TEXT,
          me_name TEXT
        )
      `);

      // Users table
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT DEFAULT 'user',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Messages table
      await client.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          session_id TEXT,
          to_number TEXT NOT NULL,
          message_type TEXT DEFAULT 'text',
          content TEXT,
          media_url TEXT,
          file_name TEXT,
          caption TEXT,
          latitude DOUBLE PRECISION,
          longitude DOUBLE PRECISION,
          contact_name TEXT,
          contact_phone TEXT,
          status TEXT DEFAULT 'pending',
          attempts INTEGER DEFAULT 0,
          error_msg TEXT,
          message_id TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          scheduled_at TIMESTAMP,
          use_spintax INTEGER DEFAULT 0,
          delay_enabled INTEGER DEFAULT 1,
          FOREIGN KEY (session_id) REFERENCES sessions(id)
        )
      `);

      // Add indexes for better performance
      await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)`);

      // Webhooks table
      await client.query(`
        CREATE TABLE IF NOT EXISTS webhooks (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL DEFAULT 'default',
          url TEXT NOT NULL,
          secret TEXT,
          events TEXT,
          status TEXT DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_triggered TIMESTAMP
        )
      `);

      // Webhook logs table
      await client.query(`
        CREATE TABLE IF NOT EXISTS webhook_logs (
          id TEXT PRIMARY KEY,
          webhook_id TEXT,
          event_type TEXT,
          payload TEXT,
          success INTEGER DEFAULT 0,
          status_code INTEGER,
          response TEXT,
          error_msg TEXT,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (webhook_id) REFERENCES webhooks(id)
        )
      `);

      // User antiblock settings table
      await client.query(`
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
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Global settings table
      await client.query(`
        CREATE TABLE IF NOT EXISTS global_settings (
          key TEXT PRIMARY KEY,
          value TEXT,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Templates table
      await client.query(`
        CREATE TABLE IF NOT EXISTS templates (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL DEFAULT 'default',
          name TEXT NOT NULL,
          content TEXT NOT NULL,
          variables TEXT,
          category TEXT DEFAULT 'general',
          is_active INTEGER DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Auto-reply rules table
      await client.query(`
        CREATE TABLE IF NOT EXISTS auto_reply_rules (
          id TEXT PRIMARY KEY,
          session_id TEXT,
          name TEXT NOT NULL,
          trigger_type TEXT NOT NULL,
          trigger_value TEXT NOT NULL,
          reply_message TEXT NOT NULL,
          use_ai INTEGER DEFAULT 0,
          ai_prompt TEXT,
          is_active INTEGER DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (session_id) REFERENCES sessions(id)
        )
      `);

      // Auto-reply settings table
      await client.query(`
        CREATE TABLE IF NOT EXISTS auto_reply_settings (
          session_id TEXT PRIMARY KEY,
          auto_reply_enabled INTEGER DEFAULT 0,
          auto_reject_unknown INTEGER DEFAULT 0,
          unknown_contact_message TEXT,
          reply_cooldown INTEGER DEFAULT 5,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (session_id) REFERENCES sessions(id)
        )
      `);

      // Analytics hourly table
      await client.query(`
        CREATE TABLE IF NOT EXISTS analytics_hourly (
          session_id TEXT,
          hour TEXT NOT NULL,
          sent INTEGER DEFAULT 0,
          failed INTEGER DEFAULT 0,
          PRIMARY KEY (session_id, hour),
          FOREIGN KEY (session_id) REFERENCES sessions(id)
        )
      `);

      logger.info('PostgreSQL migration completed');
    } catch (error) {
      logger.error('Migration error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // ============ Helper Methods ============
  private query(text: string, params: any[] = []): pg.QueryResult<any> {
    if (!this.pool) throw new Error('Database not initialized');
    return this.pool.query(text, params);
  }

  // ============ Session Methods ============
  createSession(session: Session): Session {
    const now = new Date().toISOString();
    this.query(
      `INSERT INTO sessions (id, user_id, name, phone, status, jid, token, api_key, device_info, platform, me_name, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [session.id, session.userId, session.name, session.phone, session.status, session.jid, session.token, 
       session.apiKey, session.deviceInfo, session.platform, session.meName, now, now]
    );
    return session;
  }

  getSession(id: string): Session | null {
    const result = this.query('SELECT * FROM sessions WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.mapSession(result.rows[0]);
  }

  getAllSessions(userId?: string): Session[] {
    let query = 'SELECT * FROM sessions';
    const params: any[] = [];
    if (userId) {
      query += ' WHERE user_id = $1';
      params.push(userId);
    }
    query += ' ORDER BY created_at DESC';
    const result = this.query(query, params);
    return result.rows.map(row => this.mapSession(row));
  }

  updateSession(session: Partial<Session> & { id: string }): void {
    const sets: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (session.status !== undefined) { sets.push(`status = $${idx++}`); values.push(session.status); }
    if (session.phone !== undefined) { sets.push(`phone = $${idx++}`); values.push(session.phone); }
    if (session.jid !== undefined) { sets.push(`jid = $${idx++}`); values.push(session.jid); }
    if (session.token !== undefined) { sets.push(`token = $${idx++}`); values.push(session.token); }
    if (session.lastActive !== undefined) { sets.push(`last_active = $${idx++}`); values.push(session.lastActive?.toISOString()); }
    if (session.messageCount !== undefined) { sets.push(`message_count = $${idx++}`); values.push(session.messageCount); }
    if (session.deviceInfo !== undefined) { sets.push(`device_info = $${idx++}`); values.push(session.deviceInfo); }
    if (session.platform !== undefined) { sets.push(`platform = $${idx++}`); values.push(session.platform); }
    if (session.meName !== undefined) { sets.push(`me_name = $${idx++}`); values.push(session.meName); }

    sets.push(`updated_at = $${idx++}`);
    values.push(new Date().toISOString());
    values.push(session.id);

    this.query(`UPDATE sessions SET ${sets.join(', ')} WHERE id = $${idx}`, values);
  }

  deleteSession(id: string): void {
    this.query('DELETE FROM sessions WHERE id = $1', [id]);
  }

  // ============ Message Methods ============
  createMessage(message: Omit<Message, 'id' | 'createdAt' | 'updatedAt' | 'attempts'>): Message {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const msg = {
      ...message,
      id,
      attempts: 0,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };

    this.query(
      `INSERT INTO messages (id, session_id, to_number, message_type, content, media_url, file_name, caption, latitude, longitude, contact_name, contact_phone, status, attempts, error_msg, message_id, created_at, updated_at, scheduled_at, use_spintax, delay_enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
      [msg.id, msg.sessionId, msg.to, msg.type, msg.content, msg.mediaUrl, msg.fileName, msg.caption,
       msg.latitude, msg.longitude, msg.contactName, msg.contactPhone, msg.status || 'pending', 0,
       msg.error || null, msg.messageId || null, now, now, msg.scheduledAt?.toISOString() || null, msg.useSpintax ? 1 : 0, msg.delayEnabled ? 1 : 0]
    );

    return msg;
  }

  getMessagesByStatus(status: string, limit: number = 100, userId?: string): Message[] {
    let query = 'SELECT * FROM messages WHERE status = $1';
    const params: any[] = [status];

    if (userId) {
      query += ' AND session_id IN (SELECT id FROM sessions WHERE user_id = $2)';
      params.push(userId);
    }
    query += ' ORDER BY created_at ASC LIMIT $' + (params.length + 1);
    params.push(limit);

    const result = this.query(query, params);
    return result.rows.map(row => this.mapMessage(row));
  }

  updateMessage(message: Partial<Message> & { id?: string, messageId?: string }): void {
    if (!this.db) return;
    
    const sets: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (message.status !== undefined) { sets.push(`status = $${idx++}`); values.push(message.status); }
    if (message.attempts !== undefined) { sets.push(`attempts = $${idx++}`); values.push(message.attempts); }
    if (message.error !== undefined) { sets.push(`error_msg = $${idx++}`); values.push(message.error); }
    if (message.messageId !== undefined) { sets.push(`message_id = $${idx++}`); values.push(message.messageId); }

    sets.push(`updated_at = $${idx++}`);
    values.push(new Date().toISOString());

    if (message.id) {
      values.push(message.id);
      this.query(`UPDATE messages SET ${sets.join(', ')} WHERE id = $${idx}`, values);
    } else if (message.messageId) {
      values.push(message.messageId);
      this.query(`UPDATE messages SET ${sets.join(', ')} WHERE message_id = $${idx}`, values);
    }
  }

  deleteMessagesByStatus(status: string, userId?: string): void {
    if (!this.pool) return;
    
    if (status === 'all') {
      if (userId) {
        this.query('DELETE FROM messages WHERE session_id IN (SELECT id FROM sessions WHERE user_id = $1)', [userId]);
      } else {
        this.query('DELETE FROM messages');
      }
      return;
    }

    if (userId) {
      this.query('DELETE FROM messages WHERE status = $1 AND session_id IN (SELECT id FROM sessions WHERE user_id = $2)', [status, userId]);
      return;
    }

    this.query('DELETE FROM messages WHERE status = $1', [status]);
  }

  getMessagesCountInTimeRange(sessionId: string, startTime: Date, endTime: Date): number {
    const result = this.query(
      'SELECT COUNT(*) as count FROM messages WHERE session_id = $1 AND status = $2 AND created_at BETWEEN $3 AND $4',
      [sessionId, 'completed', startTime.toISOString(), endTime.toISOString()]
    );
    return result.rows[0]?.count || 0;
  }

  getMessagesCount(sessionId: string, status: string): number {
    const result = this.query(
      'SELECT COUNT(*) as count FROM messages WHERE session_id = $1 AND status = $2',
      [sessionId, status]
    );
    return result.rows[0]?.count || 0;
  }

  getMessages(filters: {
    sessionId?: string;
    status?: string;
    limit?: number;
    offset?: number;
    search?: string;
    userId?: string;
  }): { messages: Message[]; total: number } {
    let query = 'SELECT * FROM messages WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as count FROM messages WHERE 1=1';
    const params: any[] = [];
    const countParams: any[] = [];

    if (filters.userId) {
      query += ' AND session_id IN (SELECT id FROM sessions WHERE user_id = $' + (params.length + 1) + ')';
      countQuery += ' AND session_id IN (SELECT id FROM sessions WHERE user_id = $' + (countParams.length + 1) + ')';
      params.push(filters.userId);
      countParams.push(filters.userId);
    }

    if (filters.sessionId) {
      query += ' AND session_id = $' + (params.length + 1);
      countQuery += ' AND session_id = $' + (countParams.length + 1);
      params.push(filters.sessionId);
      countParams.push(filters.sessionId);
    }

    if (filters.status) {
      query += ' AND status = $' + (params.length + 1);
      countQuery += ' AND status = $' + (countParams.length + 1);
      params.push(filters.status);
      countParams.push(filters.status);
    }

    if (filters.search) {
      query += ' AND (content LIKE $' + (params.length + 1) + ' OR to_number LIKE $' + (params.length + 2) + ')';
      countQuery += ' AND (content LIKE $' + (countParams.length + 1) + ' OR to_number LIKE $' + (countParams.length + 2) + ')';
      const searchPattern = `%${filters.search}%`;
      params.push(searchPattern, searchPattern);
      countParams.push(searchPattern, searchPattern);
    }

    query += ' ORDER BY created_at DESC';

    if (filters.limit) {
      query += ' LIMIT $' + (params.length + 1);
      params.push(filters.limit);
      if (filters.offset) {
        query += ' OFFSET $' + (params.length + 1);
        params.push(filters.offset);
      }
    }

    const rows = this.query(query, params);
    const total = this.query(countQuery, countParams);

    return {
      messages: rows.rows.map(row => this.mapMessage(row)),
      total: total.rows[0]?.count || 0
    };
  }

  // ============ User Methods ============
  createUser(user: User): void {
    const now = new Date().toISOString();
    this.query(
      `INSERT INTO users (id, username, password, role, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)`,
      [user.id, user.username, user.password, user.role || 'user', now, now]
    );
  }

  getUserByUsername(username: string): User | null {
    const result = this.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) return null;
    return this.mapUser(result.rows[0]);
  }

  getUserById(id: string): User | null {
    const result = this.query('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.mapUser(result.rows[0]);
  }

  updateUserPassword(username: string, hashedPassword: string): void {
    const now = new Date().toISOString();
    this.query('UPDATE users SET password = $1, updated_at = $2 WHERE username = $3', [hashedPassword, now, username]);
  }

  updateUserPasswordById(id: string, hashedPassword: string): void {
    const now = new Date().toISOString();
    this.query('UPDATE users SET password = $1, updated_at = $2 WHERE id = $3', [hashedPassword, now, id]);
  }

  getAllUsers(): User[] {
    const result = this.query('SELECT id, username, role, created_at, updated_at FROM users ORDER BY created_at ASC');
    return result.rows.map(row => ({
      id: row.id,
      username: row.username,
      role: row.role,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }));
  }

  deleteUser(id: string): void {
    this.query('DELETE FROM users WHERE id = $1', [id]);
  }

  updateUserRole(id: string, role: string): void {
    const now = new Date().toISOString();
    this.query('UPDATE users SET role = $1, updated_at = $2 WHERE id = $3', [role, now, id]);
  }

  // ============ AntiBlock Settings ============
  getAntiBlockSettings(userId: string): AntiBlockSettings {
    const result = this.query('SELECT * FROM user_antiblock_settings WHERE user_id = $1', [userId]);
    if (result.rows.length === 0) {
      return this.getDefaultAntiBlockSettings(userId);
    }
    return this.mapAntiBlockSettings(result.rows[0]);
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
    const sets: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (settings.rateLimitEnabled !== undefined) { sets.push(`rate_limit_enabled = $${idx++}`); values.push(settings.rateLimitEnabled ? 1 : 0); }
    if (settings.messagesPerMinute !== undefined) { sets.push(`messages_per_minute = $${idx++}`); values.push(settings.messagesPerMinute); }
    if (settings.messagesPerHour !== undefined) { sets.push(`messages_per_hour = $${idx++}`); values.push(settings.messagesPerHour); }
    if (settings.burstLimit !== undefined) { sets.push(`burst_limit = $${idx++}`); values.push(settings.burstLimit); }
    if (settings.delayEnabled !== undefined) { sets.push(`delay_enabled = $${idx++}`); values.push(settings.delayEnabled ? 1 : 0); }
    if (settings.minDelay !== undefined) { sets.push(`min_delay = $${idx++}`); values.push(settings.minDelay); }
    if (settings.maxDelay !== undefined) { sets.push(`max_delay = $${idx++}`); values.push(settings.maxDelay); }
    if (settings.warmupEnabled !== undefined) { sets.push(`warmup_enabled = $${idx++}`); values.push(settings.warmupEnabled ? 1 : 0); }
    if (settings.warmupDays !== undefined) { sets.push(`warmup_days = $${idx++}`); values.push(settings.warmupDays); }
    if (settings.spintaxEnabled !== undefined) { sets.push(`spintax_enabled = $${idx++}`); values.push(settings.spintaxEnabled ? 1 : 0); }
    if (settings.numberFilterEnabled !== undefined) { sets.push(`number_filter_enabled = $${idx++}`); values.push(settings.numberFilterEnabled ? 1 : 0); }

    if (sets.length === 0) return;

    sets.push(`updated_at = $${idx++}`);
    values.push(new Date().toISOString());
    values.push(settings.userId);

    // Use upsert
    this.query(`INSERT INTO user_antiblock_settings (user_id, ${sets.slice(0, -1).map((s, i) => s.replace('=$' + (i + 1), '')).join(', ')})
       VALUES ($1, ${sets.slice(0, -1).map((_, i) => '$' + (i + 2)).join(', ')})
       ON CONFLICT (user_id) DO UPDATE SET ${sets.join(', ')}`, values);
  }

  // ============ Stats ============
  async getStats(userId?: string): Promise<Stats> {
    let sessionWhere = userId ? `WHERE user_id = $1` : '';
    let messageWhere = userId ? 'WHERE session_id IN (SELECT id FROM sessions WHERE user_id = $1)' : '';
    
    const totalSessions = userId 
      ? (await this.query(`SELECT COUNT(*) as count FROM sessions ${sessionWhere}`, [userId])).rows[0]?.count || 0
      : (await this.query(`SELECT COUNT(*) as count FROM sessions`)).rows[0]?.count || 0;
    
    const activeSessions = userId
      ? (await this.query(`SELECT COUNT(*) as count FROM sessions ${sessionWhere} AND status = 'connected'`, [userId])).rows[0]?.count || 0
      : (await this.query(`SELECT COUNT(*) as count FROM sessions WHERE status = 'connected'`)).rows[0]?.count || 0;

    const messagesSent = userId
      ? (await this.query(`SELECT COUNT(*) as count FROM messages ${messageWhere}`, [userId])).rows[0]?.count || 0
      : (await this.query(`SELECT COUNT(*) as count FROM messages`)).rows[0]?.count || 0;

    const messagesQueued = userId
      ? (await this.query(`SELECT COUNT(*) as count FROM messages ${messageWhere} AND status = 'pending'`, [userId])).rows[0]?.count || 0
      : (await this.query(`SELECT COUNT(*) as count FROM messages WHERE status = 'pending'`)).rows[0]?.count || 0;

    const messagesDelivered = userId
      ? (await this.query(`SELECT COUNT(*) as count FROM messages ${messageWhere} AND status = 'completed'`, [userId])).rows[0]?.count || 0
      : (await this.query(`SELECT COUNT(*) as count FROM messages WHERE status = 'completed'`)).rows[0]?.count || 0;

    const messagesFailed = userId
      ? (await this.query(`SELECT COUNT(*) as count FROM messages ${messageWhere} AND status = 'failed'`, [userId])).rows[0]?.count || 0
      : (await this.query(`SELECT COUNT(*) as count FROM messages WHERE status = 'failed'`)).rows[0]?.count || 0;

    return { totalSessions, activeSessions, messagesSent, messagesQueued, messagesDelivered, messagesFailed };
  }

  getQueueStats(userId?: string): Record<string, number> {
    let query = 'SELECT status, COUNT(*) as count FROM messages';
    const params: any[] = [];
    
    if (userId) {
      query += ' WHERE session_id IN (SELECT id FROM sessions WHERE user_id = $1)';
      params.push(userId);
    }
    query += ' GROUP BY status';
    
    const result = this.query(query, params);
    const stats: Record<string, number> = {};
    for (const row of result.rows) {
      stats[row.status] = parseInt(row.count);
    }
    return stats;
  }

  close(): void {
    if (this.pool) {
      this.pool.end();
      this.pool = null;
    }
  }

  // ============ Mappers ============
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

  // ============ Other Methods (Simplified for PostgreSQL) ============
  // Add remaining methods as needed for templates, webhooks, etc.
  
  // Template methods
  getTemplates(userId?: string): Template[] {
    let query = 'SELECT * FROM templates';
    const params: any[] = [];
    if (userId) {
      query += ' WHERE user_id = $1';
      params.push(userId);
    }
    query += ' ORDER BY name ASC';
    const result = this.query(query, params);
    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      content: row.content,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }));
  }

  getTemplate(id: string): Template | null {
    const result = this.query('SELECT * FROM templates WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      content: row.content,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  deleteTemplate(id: string): void {
    this.query('DELETE FROM templates WHERE id = $1', [id]);
  }

  // Webhook methods
  createWebhook(webhook: Omit<Webhook, 'createdAt' | 'updatedAt'>): Webhook {
    const now = new Date().toISOString();
    this.query(
      `INSERT INTO webhooks (id, user_id, url, secret, events, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [webhook.id, webhook.userId, webhook.url, webhook.secret || null, webhook.events.join(','), webhook.status, now, now]
    );
    return { ...webhook, createdAt: new Date(now), updatedAt: new Date(now) };
  }

  getAllWebhooks(userId?: string): Webhook[] {
    let query = 'SELECT * FROM webhooks';
    const params: any[] = [];
    if (userId) {
      query += ' WHERE user_id = $1';
      params.push(userId);
    }
    query += ' ORDER BY created_at DESC';
    const result = this.query(query, params);
    return result.rows.map(row => this.mapWebhook(row));
  }

  deleteWebhook(id: string): void {
    this.query('DELETE FROM webhooks WHERE id = $1', [id]);
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

  // Analytics
  getHourlyActivity(sessionId?: string, hours: number = 24, userId?: string): any[] {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString().slice(0, 13);
    let query = 'SELECT hour, SUM(sent) as sent, SUM(failed) as failed FROM analytics_hourly WHERE hour >= $1';
    const params: any[] = [since];

    if (userId) {
      query += ' AND session_id IN (SELECT id FROM sessions WHERE user_id = $' + (params.length + 1) + ')';
      params.push(userId);
    }
    if (sessionId) {
      query += ' AND session_id = $' + (params.length + 1) + ')';
      params.push(sessionId);
    }
    query += ' GROUP BY hour ORDER BY hour ASC';

    const result = this.query(query, params);
    return result.rows.map(row => ({
      hour: row.hour,
      sent: parseInt(row.sent) || 0,
      failed: parseInt(row.failed) || 0
    }));
  }

  getTotalMessagesCount(userId?: string): number {
    let query = 'SELECT COUNT(*) as count FROM messages';
    const params: any[] = [];
    if (userId) {
      query += ' WHERE session_id IN (SELECT id FROM sessions WHERE user_id = $1)';
      params.push(userId);
    }
    const result = this.query(query, params);
    return result.rows[0]?.count || 0;
  }

  getMessagesCountToday(userId?: string): number {
    const today = new Date().toISOString().split('T')[0];
    let query = "SELECT COUNT(*) as count FROM messages WHERE DATE(created_at) = $1";
    const params: any[] = [today];
    if (userId) {
      query += " AND session_id IN (SELECT id FROM sessions WHERE user_id = $2)";
      params.push(userId);
    }
    const result = this.query(query, params);
    return result.rows[0]?.count || 0;
  }

  getMessageStats(sessionId?: string, days: number = 7, userId?: string): any {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    let whereClause = 'WHERE created_at >= $1';
    const params: any[] = [since];

    if (userId) {
      whereClause += ' AND session_id IN (SELECT id FROM sessions WHERE user_id = $' + (params.length + 1) + ')';
      params.push(userId);
    }
    if (sessionId) {
      whereClause += ' AND session_id = $' + (params.length + 1) + ')';
      params.push(sessionId);
    }

    const total = (this.query(`SELECT COUNT(*) as count FROM messages ${whereClause}`, params)).rows[0]?.count || 0;
    const pending = (this.query(`SELECT COUNT(*) as count FROM messages ${whereClause} AND status = 'pending'`, params)).rows[0]?.count || 0;
    const processing = (this.query(`SELECT COUNT(*) as count FROM messages ${whereClause} AND status = 'processing'`, params)).rows[0]?.count || 0;
    const completed = (this.query(`SELECT COUNT(*) as count FROM messages ${whereClause} AND status = 'completed'`, params)).rows[0]?.count || 0;
    const failed = (this.query(`SELECT COUNT(*) as count FROM messages ${whereClause} AND status = 'failed'`, params)).rows[0]?.count || 0;

    return { total, pending, processing, completed, failed, bySession: {}, byDate: {} };
  }

  // Global Settings
  updateGlobalSettings(settings: Record<string, string | number | boolean>): void {
    const now = new Date().toISOString();
    for (const [key, value] of Object.entries(settings)) {
      this.query(
        `INSERT INTO global_settings (key, value, updated_at) VALUES ($1, $2, $3)
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = $3`,
        [key, String(value), now]
      );
    }
  }

  getGlobalSettings(): Record<string, any> {
    const result = this.query('SELECT key, value FROM global_settings');
    const settings: Record<string, any> = {};
    for (const row of result.rows) {
      if (row.value === 'true') settings[row.key] = true;
      else if (row.value === 'false') settings[row.key] = false;
      else if (!isNaN(Number(row.value)) && row.value.trim() !== '') settings[row.key] = Number(row.value);
      else settings[row.key] = row.value;
    }
    return settings;
  }
}