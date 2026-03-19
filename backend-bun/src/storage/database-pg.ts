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
      user: process.env.DB_USER || 'wagatewayuser',
      password: process.env.DB_PASSWORD || 'wagateway2024',
      database: process.env.DB_NAME || 'wagateway',
      max: 20,                  // max pool size
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
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

    await this.migrate();
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
          session_id TEXT NOT NULL,
          to_number TEXT NOT NULL,
          message_type TEXT NOT NULL,
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
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          scheduled_at TIMESTAMPTZ,
          use_spintax INTEGER DEFAULT 0,
          delay_enabled INTEGER DEFAULT 1,
          FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        )
      `);
      
      // FIX: Migrate naive TIMESTAMP columns to TIMESTAMPTZ with UTC base timezone to prevent timezone shifts
      await client.query(`
        ALTER TABLE messages
        ALTER COLUMN scheduled_at TYPE TIMESTAMPTZ USING scheduled_at AT TIME ZONE 'UTC',
        ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
        ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';
      `).catch(e => logger.warn('Migration warnings for TIMESTAMPTZ (ignored if already applied):', e.message));

      // Indexes for performance
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
          FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
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
          FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
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
          FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
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
          FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        )
      `);

      // Contacts table
      await client.query(`
        CREATE TABLE IF NOT EXISTS contacts (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          name TEXT,
          phone TEXT,
          jid TEXT NOT NULL,
          is_group INTEGER DEFAULT 0,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        )
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_contacts_session_id ON contacts(session_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_contacts_jid ON contacts(session_id, jid)`);
      
      // FIX: Retroactively repair bad contact names that defaulted to phone string
      await client.query(`
        UPDATE contacts 
        SET name = NULL 
        WHERE name = phone;
      `);

      // Migration: Tambah UNIQUE constraint pada (session_id, jid) jika belum ada
      // Ini diperlukan agar ON CONFLICT (session_id, jid) berfungsi untuk update nama kontak
      try {
        await client.query(`
          ALTER TABLE contacts ADD CONSTRAINT contacts_session_jid_unique UNIQUE (session_id, jid)
        `);
        logger.info('Added UNIQUE constraint on contacts(session_id, jid)');
      } catch (e: any) {
        // Constraint sudah ada — tidak masalah
        if (!e.message?.includes('already exists')) {
          logger.warn('contacts unique constraint migration warning:', e.message);
        }
      }

      logger.info('PostgreSQL migration completed');
    } catch (error) {
      logger.error('Migration error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // ============ Helper Methods ============
  private async query(text: string, params: any[] = []): Promise<pg.QueryResult<any>> {
    if (!this.pool) throw new Error('Database not initialized');
    return await this.pool.query(text, params);
  }

  // ============ Session Methods ============
  async createSession(session: Session): Promise<Session> {
    const now = new Date().toISOString();
    await this.query(
      `INSERT INTO sessions (id, user_id, name, phone, status, jid, token, api_key, device_info, platform, me_name, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [session.id, session.userId, session.name, session.phone, session.status, session.jid, session.token,
       session.apiKey, session.deviceInfo, session.platform, session.meName, now, now]
    );
    return session;
  }

  async getSession(id: string): Promise<Session | null> {
    const result = await this.query('SELECT * FROM sessions WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.mapSession(result.rows[0]);
  }

  async getAllSessions(userId?: string): Promise<Session[]> {
    let sql = 'SELECT * FROM sessions';
    const params: any[] = [];
    if (userId) {
      sql += ' WHERE user_id = $1';
      params.push(userId);
    }
    sql += ' ORDER BY created_at DESC';
    const result = await this.query(sql, params);
    return result.rows.map(row => this.mapSession(row));
  }

  async updateSession(session: Partial<Session> & { id: string }): Promise<void> {
    const sets: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (session.status !== undefined) { sets.push(`status = $${idx++}`); values.push(session.status); }
    if (session.phone !== undefined) { sets.push(`phone = $${idx++}`); values.push(session.phone); }
    if (session.jid !== undefined) { sets.push(`jid = $${idx++}`); values.push(session.jid); }
    if (session.token !== undefined) { sets.push(`token = $${idx++}`); values.push(session.token); }
    if (session.apiKey !== undefined) { sets.push(`api_key = $${idx++}`); values.push(session.apiKey); }
    if (session.lastActive !== undefined) { sets.push(`last_active = $${idx++}`); values.push(session.lastActive?.toISOString()); }
    if (session.messageCount !== undefined) { sets.push(`message_count = $${idx++}`); values.push(session.messageCount); }
    if (session.deviceInfo !== undefined) { sets.push(`device_info = $${idx++}`); values.push(session.deviceInfo); }
    if (session.platform !== undefined) { sets.push(`platform = $${idx++}`); values.push(session.platform); }
    if (session.meName !== undefined) { sets.push(`me_name = $${idx++}`); values.push(session.meName); }

    if (sets.length === 0) return;
    sets.push(`updated_at = $${idx++}`);
    values.push(new Date().toISOString());
    values.push(session.id);

    await this.query(`UPDATE sessions SET ${sets.join(', ')} WHERE id = $${idx}`, values);
  }

  async deleteSession(id: string): Promise<void> {
    await this.query('DELETE FROM sessions WHERE id = $1', [id]);
  }

  async getSessionByApiKey(apiKey: string): Promise<Session | null> {
    const result = await this.query('SELECT * FROM sessions WHERE api_key = $1', [apiKey]);
    if (result.rows.length === 0) return null;
    return this.mapSession(result.rows[0]);
  }

  // ============ Message Methods ============
  async createMessage(message: Omit<Message, 'id' | 'createdAt' | 'updatedAt' | 'attempts'>): Promise<Message> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const msg = {
      ...message,
      id,
      attempts: 0,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };

    await this.query(
      `INSERT INTO messages (id, session_id, to_number, message_type, content, media_url, file_name, caption, latitude, longitude, contact_name, contact_phone, status, attempts, error_msg, message_id, created_at, updated_at, scheduled_at, use_spintax, delay_enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
      [msg.id, msg.sessionId, msg.to, msg.type, msg.content, msg.mediaUrl, msg.fileName, msg.caption,
       msg.latitude, msg.longitude, msg.contactName, msg.contactPhone, msg.status || 'pending', 0,
       msg.error || null, msg.messageId || null, now, now, msg.scheduledAt?.toISOString() || null, msg.useSpintax ? 1 : 0, msg.delayEnabled ? 1 : 0]
    );

    return msg;
  }

  async getMessagesByStatus(status: string, limit: number = 100, userId?: string): Promise<Message[]> {
    let sql = 'SELECT * FROM messages WHERE status = $1';
    const params: any[] = [status];

    if (userId) {
      sql += ' AND session_id IN (SELECT id FROM sessions WHERE user_id = $2)';
      params.push(userId);
    }
    sql += ' ORDER BY created_at ASC LIMIT $' + (params.length + 1);
    params.push(limit);

    const result = await this.query(sql, params);
    return result.rows.map(row => this.mapMessage(row));
  }

  async updateMessage(message: Partial<Message> & { id?: string, messageId?: string }): Promise<void> {
    if (!this.pool) return;

    const sets: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (message.status !== undefined) { sets.push(`status = $${idx++}`); values.push(message.status); }
    if (message.attempts !== undefined) { sets.push(`attempts = $${idx++}`); values.push(message.attempts); }
    if (message.error !== undefined) { sets.push(`error_msg = $${idx++}`); values.push(message.error); }
    if (message.messageId !== undefined) { sets.push(`message_id = $${idx++}`); values.push(message.messageId); }

    if (sets.length === 0) return;
    sets.push(`updated_at = $${idx++}`);
    values.push(new Date().toISOString());

    if (message.id) {
      values.push(message.id);
      await this.query(`UPDATE messages SET ${sets.join(', ')} WHERE id = $${idx}`, values);
    } else if (message.messageId) {
      values.push(message.messageId);
      await this.query(`UPDATE messages SET ${sets.join(', ')} WHERE message_id = $${idx}`, values);
    }
  }

  async deleteMessagesByStatus(status: string, userId?: string): Promise<void> {
    if (!this.pool) return;

    if (status === 'all') {
      if (userId) {
        await this.query('DELETE FROM messages WHERE session_id IN (SELECT id FROM sessions WHERE user_id = $1)', [userId]);
      } else {
        await this.query('DELETE FROM messages');
      }
      return;
    }

    if (userId) {
      await this.query('DELETE FROM messages WHERE status = $1 AND session_id IN (SELECT id FROM sessions WHERE user_id = $2)', [status, userId]);
      return;
    }

    await this.query('DELETE FROM messages WHERE status = $1', [status]);
  }

  async getMessagesCountInTimeRange(sessionId: string, startTime: Date, endTime: Date): Promise<number> {
    const result = await this.query(
      'SELECT COUNT(*) as count FROM messages WHERE session_id = $1 AND status = $2 AND created_at BETWEEN $3 AND $4',
      [sessionId, 'completed', startTime.toISOString(), endTime.toISOString()]
    );
    return parseInt(result.rows[0]?.count) || 0;
  }

  async getMessagesCount(sessionId: string, status: string): Promise<number> {
    const result = await this.query(
      'SELECT COUNT(*) as count FROM messages WHERE session_id = $1 AND status = $2',
      [sessionId, status]
    );
    return parseInt(result.rows[0]?.count) || 0;
  }

  async getMessages(filters: {
    sessionId?: string;
    status?: string;
    limit?: number;
    offset?: number;
    search?: string;
    userId?: string;
  }): Promise<{ messages: Message[]; total: number }> {
    let sql = 'SELECT * FROM messages WHERE 1=1';
    let countSql = 'SELECT COUNT(*) as count FROM messages WHERE 1=1';
    const params: any[] = [];
    const countParams: any[] = [];

    if (filters.userId) {
      sql += ' AND session_id IN (SELECT id FROM sessions WHERE user_id = $' + (params.length + 1) + ')';
      countSql += ' AND session_id IN (SELECT id FROM sessions WHERE user_id = $' + (countParams.length + 1) + ')';
      params.push(filters.userId);
      countParams.push(filters.userId);
    }

    if (filters.sessionId) {
      sql += ' AND session_id = $' + (params.length + 1);
      countSql += ' AND session_id = $' + (countParams.length + 1);
      params.push(filters.sessionId);
      countParams.push(filters.sessionId);
    }

    if (filters.status) {
      sql += ' AND status = $' + (params.length + 1);
      countSql += ' AND status = $' + (countParams.length + 1);
      params.push(filters.status);
      countParams.push(filters.status);
    }

    if (filters.search) {
      sql += ' AND (content ILIKE $' + (params.length + 1) + ' OR to_number ILIKE $' + (params.length + 2) + ')';
      countSql += ' AND (content ILIKE $' + (countParams.length + 1) + ' OR to_number ILIKE $' + (countParams.length + 2) + ')';
      const searchPattern = `%${filters.search}%`;
      params.push(searchPattern, searchPattern);
      countParams.push(searchPattern, searchPattern);
    }

    sql += ' ORDER BY created_at DESC';

    if (filters.limit) {
      sql += ' LIMIT $' + (params.length + 1);
      params.push(filters.limit);
      if (filters.offset) {
        sql += ' OFFSET $' + (params.length + 1);
        params.push(filters.offset);
      }
    }

    const [rows, total] = await Promise.all([
      this.query(sql, params),
      this.query(countSql, countParams)
    ]);

    return {
      messages: rows.rows.map(row => this.mapMessage(row)),
      total: parseInt(total.rows[0]?.count) || 0
    };
  }

  // ============ User Methods ============
  async createUser(user: User): Promise<void> {
    const now = new Date().toISOString();
    await this.query(
      `INSERT INTO users (id, username, password, role, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)`,
      [user.id, user.username, user.password, user.role || 'user', now, now]
    );
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const result = await this.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) return null;
    return this.mapUser(result.rows[0]);
  }

  async getUserById(id: string): Promise<User | null> {
    const result = await this.query('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.mapUser(result.rows[0]);
  }

  async updateUserPassword(username: string, hashedPassword: string): Promise<void> {
    const now = new Date().toISOString();
    await this.query('UPDATE users SET password = $1, updated_at = $2 WHERE username = $3', [hashedPassword, now, username]);
  }

  async updateUserPasswordById(id: string, hashedPassword: string): Promise<void> {
    const now = new Date().toISOString();
    await this.query('UPDATE users SET password = $1, updated_at = $2 WHERE id = $3', [hashedPassword, now, id]);
  }

  async getAllUsers(): Promise<User[]> {
    const result = await this.query('SELECT id, username, role, created_at, updated_at FROM users ORDER BY created_at ASC');
    return result.rows.map(row => ({
      id: row.id,
      username: row.username,
      role: row.role,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }));
  }

  async deleteUser(id: string): Promise<void> {
    await this.query('DELETE FROM users WHERE id = $1', [id]);
  }

  async updateUserRole(id: string, role: string): Promise<void> {
    const now = new Date().toISOString();
    await this.query('UPDATE users SET role = $1, updated_at = $2 WHERE id = $3', [role, now, id]);
  }

  // ============ AntiBlock Settings ============
  async getAntiBlockSettings(userId: string): Promise<AntiBlockSettings> {
    const result = await this.query('SELECT * FROM user_antiblock_settings WHERE user_id = $1', [userId]);
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

  async updateAntiBlockSettings(settings: Partial<AntiBlockSettings> & { userId: string }): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [settings.userId];
    let idx = 2;

    const fieldMap: Record<string, any> = {
      rate_limit_enabled: settings.rateLimitEnabled !== undefined ? (settings.rateLimitEnabled ? 1 : 0) : undefined,
      messages_per_minute: settings.messagesPerMinute,
      messages_per_hour: settings.messagesPerHour,
      burst_limit: settings.burstLimit,
      delay_enabled: settings.delayEnabled !== undefined ? (settings.delayEnabled ? 1 : 0) : undefined,
      min_delay: settings.minDelay,
      max_delay: settings.maxDelay,
      base_delay: settings.baseDelay,
      warmup_enabled: settings.warmupEnabled !== undefined ? (settings.warmupEnabled ? 1 : 0) : undefined,
      warmup_days: settings.warmupDays,
      warmup_day1_limit: settings.warmupDay1Limit,
      warmup_day7_limit: settings.warmupDay7Limit,
      spintax_enabled: settings.spintaxEnabled !== undefined ? (settings.spintaxEnabled ? 1 : 0) : undefined,
      number_filter_enabled: settings.numberFilterEnabled !== undefined ? (settings.numberFilterEnabled ? 1 : 0) : undefined,
    };

    for (const [col, val] of Object.entries(fieldMap)) {
      if (val !== undefined) {
        fields.push(col);
        values.push(val);
        idx++;
      }
    }

    if (fields.length === 0) return;

    const now = new Date().toISOString();
    fields.push('updated_at');
    values.push(now);

    const insertCols = ['user_id', ...fields].join(', ');
    const insertVals = ['$1', ...fields.map((_, i) => `$${i + 2}`)].join(', ');
    const updateSets = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');

    await this.query(
      `INSERT INTO user_antiblock_settings (${insertCols}) VALUES (${insertVals})
       ON CONFLICT (user_id) DO UPDATE SET ${updateSets}`,
      values
    );
  }

  // ============ Stats ============
  async getStats(userId?: string): Promise<Stats> {
    const sessionWhere = userId ? `WHERE user_id = $1` : '';
    const msgSubq = userId ? `WHERE session_id IN (SELECT id FROM sessions WHERE user_id = $1)` : '';
    const p = userId ? [userId] : [];

    const [totalSessions, activeSessions, messagesSent, messagesQueued, messagesDelivered, messagesFailed] = await Promise.all([
      this.query(`SELECT COUNT(*) as count FROM sessions ${sessionWhere}`, p),
      this.query(`SELECT COUNT(*) as count FROM sessions ${sessionWhere ? sessionWhere + " AND status = 'connected'" : "WHERE status = 'connected'"}`, p),
      this.query(`SELECT COUNT(*) as count FROM messages ${msgSubq}`, p),
      this.query(`SELECT COUNT(*) as count FROM messages ${msgSubq ? msgSubq + " AND status = 'pending'" : "WHERE status = 'pending'"}`, p),
      this.query(`SELECT COUNT(*) as count FROM messages ${msgSubq ? msgSubq + " AND status = 'completed'" : "WHERE status = 'completed'"}`, p),
      this.query(`SELECT COUNT(*) as count FROM messages ${msgSubq ? msgSubq + " AND status = 'failed'" : "WHERE status = 'failed'"}`, p),
    ]);

    return {
      totalSessions: parseInt(totalSessions.rows[0]?.count) || 0,
      activeSessions: parseInt(activeSessions.rows[0]?.count) || 0,
      messagesSent: parseInt(messagesSent.rows[0]?.count) || 0,
      messagesQueued: parseInt(messagesQueued.rows[0]?.count) || 0,
      messagesDelivered: parseInt(messagesDelivered.rows[0]?.count) || 0,
      messagesFailed: parseInt(messagesFailed.rows[0]?.count) || 0,
    };
  }

  async getQueueStats(userId?: string): Promise<Record<string, number>> {
    let sql = 'SELECT status, COUNT(*) as count FROM messages';
    const params: any[] = [];

    if (userId) {
      sql += ' WHERE session_id IN (SELECT id FROM sessions WHERE user_id = $1)';
      params.push(userId);
    }
    sql += ' GROUP BY status';

    const result = await this.query(sql, params);
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

  // ============ Template Methods ============
  async getTemplates(userId?: string): Promise<Template[]> {
    let sql = 'SELECT * FROM templates';
    const params: any[] = [];
    if (userId) {
      sql += ' WHERE user_id = $1';
      params.push(userId);
    }
    sql += ' ORDER BY name ASC';
    const result = await this.query(sql, params);
    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      content: row.content,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }));
  }

  async getTemplate(id: string): Promise<Template | null> {
    const result = await this.query('SELECT * FROM templates WHERE id = $1', [id]);
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

  async createTemplate(template: Omit<Template, 'createdAt' | 'updatedAt'>): Promise<Template> {
    const now = new Date().toISOString();
    await this.query(
      `INSERT INTO templates (id, user_id, name, content, variables, category, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [template.id, template.userId, template.name, template.content,
       (template as any).variables || null, (template as any).category || 'general', 1, now, now]
    );
    return { ...template, createdAt: new Date(now), updatedAt: new Date(now) };
  }

  async updateTemplate(id: string, data: Partial<Template>): Promise<void> {
    const now = new Date().toISOString();
    const sets: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.name !== undefined) { sets.push(`name = $${idx++}`); values.push(data.name); }
    if (data.content !== undefined) { sets.push(`content = $${idx++}`); values.push(data.content); }
    if ((data as any).category !== undefined) { sets.push(`category = $${idx++}`); values.push((data as any).category); }

    if (sets.length === 0) return;
    sets.push(`updated_at = $${idx++}`);
    values.push(now);
    values.push(id);
    await this.query(`UPDATE templates SET ${sets.join(', ')} WHERE id = $${idx}`, values);
  }

  async deleteTemplate(id: string): Promise<void> {
    await this.query('DELETE FROM templates WHERE id = $1', [id]);
  }

  // ============ Webhook Methods ============
  async createWebhook(webhook: Omit<Webhook, 'createdAt' | 'updatedAt'>): Promise<Webhook> {
    const now = new Date().toISOString();
    await this.query(
      `INSERT INTO webhooks (id, user_id, url, secret, events, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [webhook.id, webhook.userId, webhook.url, webhook.secret || null, webhook.events.join(','), webhook.status, now, now]
    );
    return { ...webhook, createdAt: new Date(now), updatedAt: new Date(now) };
  }

  async getAllWebhooks(userId?: string): Promise<Webhook[]> {
    let sql = 'SELECT * FROM webhooks';
    const params: any[] = [];
    if (userId) {
      sql += ' WHERE user_id = $1';
      params.push(userId);
    }
    sql += ' ORDER BY created_at DESC';
    const result = await this.query(sql, params);
    return result.rows.map(row => this.mapWebhook(row));
  }

  async updateWebhook(id: string, data: Partial<Webhook>): Promise<void> {
    const now = new Date().toISOString();
    const sets: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.url !== undefined) { sets.push(`url = $${idx++}`); values.push(data.url); }
    if (data.secret !== undefined) { sets.push(`secret = $${idx++}`); values.push(data.secret); }
    if (data.events !== undefined) { sets.push(`events = $${idx++}`); values.push(data.events.join(',')); }
    if (data.status !== undefined) { sets.push(`status = $${idx++}`); values.push(data.status); }
    if (data.lastTriggered !== undefined) { sets.push(`last_triggered = $${idx++}`); values.push(data.lastTriggered?.toISOString()); }

    if (sets.length === 0) return;
    sets.push(`updated_at = $${idx++}`);
    values.push(now);
    values.push(id);
    await this.query(`UPDATE webhooks SET ${sets.join(', ')} WHERE id = $${idx}`, values);
  }

  async deleteWebhook(id: string): Promise<void> {
    await this.query('DELETE FROM webhooks WHERE id = $1', [id]);
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

  // ============ Analytics ============
  async getHourlyActivity(sessionId?: string, hours: number = 24, userId?: string): Promise<any[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString().slice(0, 13);
    let sql = 'SELECT hour, SUM(sent) as sent, SUM(failed) as failed FROM analytics_hourly WHERE hour >= $1';
    const params: any[] = [since];

    if (userId) {
      sql += ' AND session_id IN (SELECT id FROM sessions WHERE user_id = $' + (params.length + 1) + ')';
      params.push(userId);
    }
    if (sessionId) {
      sql += ' AND session_id = $' + (params.length + 1);
      params.push(sessionId);
    }
    sql += ' GROUP BY hour ORDER BY hour ASC';

    const result = await this.query(sql, params);
    return result.rows.map(row => ({
      hour: row.hour,
      sent: parseInt(row.sent) || 0,
      failed: parseInt(row.failed) || 0
    }));
  }

  async getTotalMessagesCount(userId?: string): Promise<number> {
    let sql = 'SELECT COUNT(*) as count FROM messages';
    const params: any[] = [];
    if (userId) {
      sql += ' WHERE session_id IN (SELECT id FROM sessions WHERE user_id = $1)';
      params.push(userId);
    }
    const result = await this.query(sql, params);
    return parseInt(result.rows[0]?.count) || 0;
  }

  async getMessagesCountToday(userId?: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    let sql = "SELECT COUNT(*) as count FROM messages WHERE DATE(created_at) = $1";
    const params: any[] = [today];
    if (userId) {
      sql += " AND session_id IN (SELECT id FROM sessions WHERE user_id = $2)";
      params.push(userId);
    }
    const result = await this.query(sql, params);
    return parseInt(result.rows[0]?.count) || 0;
  }

  async getMessageStats(sessionId?: string, days: number = 7, userId?: string): Promise<any> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    let whereClause = 'WHERE created_at >= $1';
    const params: any[] = [since];

    if (userId) {
      whereClause += ' AND session_id IN (SELECT id FROM sessions WHERE user_id = $' + (params.length + 1) + ')';
      params.push(userId);
    }
    if (sessionId) {
      whereClause += ' AND session_id = $' + (params.length + 1);
      params.push(sessionId);
    }

    const [total, pending, processing, completed, failed] = await Promise.all([
      this.query(`SELECT COUNT(*) as count FROM messages ${whereClause}`, params),
      this.query(`SELECT COUNT(*) as count FROM messages ${whereClause} AND status = 'pending'`, params),
      this.query(`SELECT COUNT(*) as count FROM messages ${whereClause} AND status = 'processing'`, params),
      this.query(`SELECT COUNT(*) as count FROM messages ${whereClause} AND status = 'completed'`, params),
      this.query(`SELECT COUNT(*) as count FROM messages ${whereClause} AND status = 'failed'`, params),
    ]);

    return {
      total: parseInt(total.rows[0]?.count) || 0,
      pending: parseInt(pending.rows[0]?.count) || 0,
      processing: parseInt(processing.rows[0]?.count) || 0,
      completed: parseInt(completed.rows[0]?.count) || 0,
      failed: parseInt(failed.rows[0]?.count) || 0,
      bySession: {},
      byDate: {}
    };
  }

  // ============ Global Settings ============
  async updateGlobalSettings(settings: Record<string, string | number | boolean>): Promise<void> {
    const now = new Date().toISOString();
    for (const [key, value] of Object.entries(settings)) {
      await this.query(
        `INSERT INTO global_settings (key, value, updated_at) VALUES ($1, $2, $3)
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = $3`,
        [key, String(value), now]
      );
    }
  }

  async getGlobalSettings(): Promise<Record<string, any>> {
    const result = await this.query('SELECT key, value FROM global_settings');
    const settings: Record<string, any> = {};
    for (const row of result.rows) {
      if (row.value === 'true') settings[row.key] = true;
      else if (row.value === 'false') settings[row.key] = false;
      else if (!isNaN(Number(row.value)) && row.value.trim() !== '') settings[row.key] = Number(row.value);
      else settings[row.key] = row.value;
    }
    return settings;
  }
  // ============ Contacts Methods ============
  getContactsCount(sessionId: string): number {
    // NOTE: This is called from sync callbacks in ConnectionManager that can't be async
    // Return 0 as fallback; real count comes from async getContactsCountAsync
    this.query('SELECT COUNT(*) as count FROM contacts WHERE session_id = $1', [sessionId])
      .catch(e => logger.debug('getContactsCount error:', e));
    return 0;
  }

  async getContactsCountAsync(sessionId: string): Promise<number> {
    const result = await this.query('SELECT COUNT(*) as count FROM contacts WHERE session_id = $1', [sessionId]);
    return parseInt(result.rows[0]?.count) || 0;
  }

  async bulkUpsertContacts(contacts: Array<{id: string; sessionId: string; name: string; phone: string; jid: string; isGroup: boolean}>): Promise<void> {
    if (!contacts.length) return;
    const client = await this.pool!.connect();
    try {
      await client.query('BEGIN');
      for (const c of contacts) {
        // Pakai ON CONFLICT pada (session_id, jid) — bukan id
        // Hanya update nama jika nama baru lebih informative (bukan hanya nomor)
        await client.query(
          `INSERT INTO contacts (id, session_id, name, phone, jid, is_group, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())
           ON CONFLICT (session_id, jid) DO UPDATE SET
             name = CASE
               WHEN EXCLUDED.name IS NOT NULL AND EXCLUDED.name != EXCLUDED.phone AND (contacts.name IS NULL OR contacts.name = contacts.phone OR LENGTH(EXCLUDED.name) > LENGTH(contacts.name))
               THEN EXCLUDED.name
               ELSE contacts.name
             END,
             phone = EXCLUDED.phone,
             is_group = EXCLUDED.is_group,
             updated_at = NOW()`,
          [c.id, c.sessionId, c.name, c.phone, c.jid, c.isGroup ? 1 : 0]
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      logger.error('bulkUpsertContacts error:', e);
    } finally {
      client.release();
    }
  }

  async getContacts(sessionId: string, search?: string): Promise<any[]> {
    let sql = 'SELECT * FROM contacts WHERE session_id = $1';
    const params: any[] = [sessionId];
    if (search) {
      sql += ' AND (name ILIKE $2 OR phone ILIKE $2 OR jid ILIKE $2)';
      params.push(`%${search}%`);
    }
    sql += ' ORDER BY name ASC LIMIT 500';
    const result = await this.query(sql, params);
    return result.rows.map(r => ({
      id: r.id,
      sessionId: r.session_id,
      name: r.name,
      phone: r.phone,
      jid: r.jid,
      isGroup: r.is_group === 1 || r.is_group === true,
      updatedAt: r.updated_at
    }));
  }

  async createContact(contact: { id: string; sessionId: string; name?: string; phone: string; jid: string; profilePicUrl?: string; isGroup?: boolean }): Promise<void> {
    const now = new Date().toISOString();
    const name = contact.name || null;
    await this.query(`
      INSERT INTO contacts (id, session_id, name, phone, jid, is_group, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (session_id, jid) DO UPDATE SET
        name = CASE
          WHEN EXCLUDED.name IS NOT NULL AND EXCLUDED.name != EXCLUDED.phone AND (contacts.name IS NULL OR contacts.name = contacts.phone OR LENGTH(EXCLUDED.name) > LENGTH(contacts.name))
          THEN EXCLUDED.name
          ELSE contacts.name
        END,
        phone = EXCLUDED.phone,
        is_group = EXCLUDED.is_group,
        updated_at = EXCLUDED.updated_at
    `, [
      contact.id,
      contact.sessionId,
      name,
      contact.phone,
      contact.jid,
      contact.isGroup ? 1 : 0,
      now
    ]);
  }

  async getContactByJid(sessionId: string, jid: string): Promise<any | null> {
    const result = await this.query('SELECT * FROM contacts WHERE session_id = $1 AND jid = $2', [sessionId, jid]);
    if (result.rows.length === 0) return null;
    const r = result.rows[0];
    return {
      id: r.id,
      sessionId: r.session_id,
      name: r.name,
      phone: r.phone,
      jid: r.jid,
      isGroup: r.is_group === 1 || r.is_group === true
    };
  }

  async updateContact(id: string, updates: { name?: string; profilePicUrl?: string }): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(updates.name);
    }

    if (fields.length > 0) {
      fields.push(`updated_at = $${idx++}`);
      values.push(new Date().toISOString());
      // Tambahkan id sebagai parameter terakhir dengan indeks idx
      values.push(id);

      await this.query(`UPDATE contacts SET ${fields.join(', ')} WHERE id = $${idx}`, values);
    }
  }
}