import { Whatsapp, SQLiteAdapter } from 'wa-multi-session';
import { DisconnectReason } from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import { Database } from '../storage/database.js';
import type { Session, IncomingMessage } from '../models/types.js';
import { logger } from '../utils/logger.js';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { basename } from 'path';

interface SessionConnection {
  id: string;
  session: Session;
  qrCode: string | null;
  status: string;
  qrUpdateTime: Date | null;
  token: string;
  contactsSyncStatus?: 'idle' | 'syncing' | 'completed' | 'error';
  contactsSyncProgress?: number;
  contactsSyncTotal?: number;
}

export class ConnectionManager {
  private sessions: Map<string, SessionConnection> = new Map();
  private socketToSession: Map<any, string> = new Map();
  private db: Database;
  private messageHandler?: (msg: IncomingMessage) => void;
  private whatsapp: Whatsapp;
  private healthCheckInterval?: NodeJS.Timeout;

  // Contact sync tracking untuk mencegah concurrent sync yang berlebihan
  private syncInProgress: Map<string, boolean> = new Map();
  private syncQueue: string[] = [];
  private readonly MAX_CONCURRENT_SYNC = 3; // Max 3 session sync bersamaan
  private readonly SYNC_COOLDOWN = 30000; // 30 detik cooldown antar sync manual
  private lastManualSync: Map<string, number> = new Map();
  private lastSyncAttempt: Map<string, number> = new Map(); // throttle untuk auto-sync

  // Status mapping dari Baileys ke internal
  private readonly STATUS_MAP: Record<string, string> = {
    'connecting': 'connecting',
    'open': 'connected',
    'close': 'disconnected',
    'loggedOut': 'logged_out',
  };

  // Restore session locking untuk mencegah concurrent restore
  private restoreInProgress: Map<string, boolean> = new Map();
  private restoreQueue: Map<string, Promise<void>> = new Map();
  private readonly RESTORE_DEBOUNCE = 5000; // 5 detik debounce antar restore

  // Conflict/440 error tracking untuk exponential backoff
  private conflictCount: Map<string, number> = new Map();
  private lastConflictTime: Map<string, number> = new Map();
  private readonly CONFLICT_BACKOFF_BASE = 30000; // 30 detik base delay
  private readonly CONFLICT_MAX_DELAY = 300000; // 5 menit max delay

  // Track event listeners untuk mencegah multiple listeners saat reconnect
  private listenersSetup: Map<string, boolean> = new Map();

  constructor(db: Database) {
    this.db = db;
    this.whatsapp = new Whatsapp({
      adapter: new SQLiteAdapter(),
      onConnecting: (sessionId: string) => {
        logger.info(`[Session ${sessionId}] connecting`);
        const conn = this.sessions.get(sessionId);
        if (conn) {
          conn.status = 'connecting';
          conn.session.status = 'connecting';
          this.db.updateSession({ id: sessionId, status: 'connecting' });
        }
      },
      onConnected: async (sessionId: string) => {
        logger.info(`[Session ${sessionId}] connected`);

        // Reset conflict count on successful connection
        const conflictCount = this.conflictCount.get(sessionId) || 0;
        if (conflictCount > 0) {
          logger.info(`[Session ${sessionId}] Connection restored, resetting conflict count (${conflictCount} -> 0)`);
          this.conflictCount.set(sessionId, 0);
          this.lastConflictTime.delete(sessionId);
        }

        const session = await this.whatsapp.getSessionById(sessionId);
        const user = session?.sock?.user;

        // Simpan mapping socket ke sessionId
        if (session?.sock) {
          this.socketToSession.set(session.sock, sessionId);
          logger.info(`[Session ${sessionId}] Socket mapped for contact tracking`);

          // Setup event listeners HANYA JIKA belum setup untuk session ini
          // Mencegah multiple listeners saat reconnect
          if (!this.listenersSetup.get(sessionId)) {
            logger.info(`[Session ${sessionId}] Setting up event listeners...`);

            // Setup event listeners untuk contacts dan chats sync
            this.setupContactSync(sessionId, session.sock);

            // Listen for message status updates (Receipts)
            session.sock.ev.on('messages.update', async (updates) => {
              for (const update of updates) {
                if (update.update.status && update.key.id) {
                  // Map Baileys status to our status
                  let status = 'sent';
                  if (update.update.status === 3) status = 'delivered'; // DELIVERY_ACK
                  else if (update.update.status === 4) status = 'read'; // READ
                  else if (update.update.status === 5) status = 'played'; // PLAYED

                  this.db.updateMessage({
                    id: 'UNKNOWN', // We don't have the UUID here, only the WA ID.
                    messageId: update.key.id,
                    status: status
                  } as any);
                }
              }
            });

            this.listenersSetup.set(sessionId, true);
            logger.info(`[Session ${sessionId}] Event listeners setup complete`);
          } else {
            logger.info(`[Session ${sessionId}] Event listeners already setup, skipping...`);
          }
        }

        const conn = this.sessions.get(sessionId);
        if (conn) {
          conn.status = 'connected';
          conn.session.status = 'connected';
          conn.session.phone = user?.id?.split(':')[0];
          conn.session.jid = user?.id;
          this.db.updateSession({
            id: sessionId,
            status: 'connected',
            phone: conn.session.phone,
            jid: conn.session.jid,
            deviceInfo: user?.id ? (user.id.includes(':') ? 'Secondary' : 'Primary') : 'Unknown',
            platform: 'WhatsApp', // Baileys doesn't easily expose platform in user obj
            meName: user?.name || user?.notify || undefined
          });
        }

        // Tunggu beberapa detik agar store terisi, lalu sinkronisasi kontak
        // Throttle: jangan jalankan sync jika sudah ada yang berjalan dalam 60 detik terakhir
        const lastSync = this.lastSyncAttempt.get(sessionId) || 0;
        const now = Date.now();
        if (now - lastSync < 60000) {
          logger.info(`[Session ${sessionId}] Auto-sync skipped (throttled, last sync was ${Math.round((now - lastSync) / 1000)}s ago)`);
        } else {
          this.lastSyncAttempt.set(sessionId, now);
          setTimeout(() => {
            try {
              this.syncChatsHistory(sessionId);
            } catch (error) {
              logger.error(`[Session ${sessionId}] Auto sync failed:`, error);
            }
          }, 3000);
        }
      },
      onDisconnected: (sessionId: string) => {
        logger.info(`[Session ${sessionId}] disconnected`);
        const conn = this.sessions.get(sessionId);
        if (conn) {
          conn.status = 'disconnected';
          conn.session.status = 'disconnected';
          conn.qrCode = null;
          this.db.updateSession({ id: sessionId, status: 'disconnected' });
        }
      },
      onMessageReceived: async (message: any) => {
        try {
          if (!message?.key?.remoteJid) return;

          const remoteJid = message.key.remoteJid;
          if (remoteJid.includes('status@broadcast')) return;

          // Cari session yang terhubung
          for (const [sessionId, conn] of this.sessions.entries()) {
            if (conn.status === 'connected') {
              const name = message.pushName ||
                message.verifiedBizName ||
                remoteJid.split('@')[0];

              // Simpan kontak dari pesan masuk
              await this.saveContact(sessionId, remoteJid, name);
              logger.debug(`[Session ${sessionId}] Contact saved from message: ${remoteJid}`);

              // Hanya simpan ke satu session saja (yang pertama)
              break;
            }
          }

          if (this.messageHandler && message) {
            const incomingMsg: IncomingMessage = {
              id: message.key?.id || crypto.randomUUID(),
              from: remoteJid.split('@')[0],
              pushName: message.pushName,
              message: message.message?.conversation ||
                message.message?.extendedTextMessage?.text || '',
              timestamp: new Date(),
              isGroup: remoteJid.endsWith('@g.us')
            };
            this.messageHandler(incomingMsg);
          }
        } catch (err) {
          logger.error('Error handling message:', err);
        }
      }
    });
  }

  async init(): Promise<void> {
    // Load existing sessions from database dan auto-reconnect
    const sessions = this.db.getAllSessions();
    logger.info(`[ConnectionManager] Found ${sessions.length} sessions in database`);

    // Restore sessions dengan delay antar session untuk mencegah rate limiting
    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];

      // Mark as disconnected first since we need to reconnect
      this.db.updateSession({ id: session.id, status: 'disconnected' });

      logger.info(`[ConnectionManager] Auto-reconnecting session: ${session.id} (${session.name})`);

      try {
        // Try to restore session dengan locking
        await this.restoreSessionWithLock(session.id, session.name);
      } catch (error) {
        logger.error(`[ConnectionManager] Failed to restore session ${session.id}:`, error);
      }

      // Delay antar session restore untuk mencegah rate limiting (2 detik antar session)
      if (i < sessions.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Start health check periodik setiap 30 detik
    this.startHealthCheck();
  }

  /**
   * Health check periodik untuk memastikan status session akurat
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      for (const [sessionId, conn] of this.sessions.entries()) {
        await this.checkSessionHealth(sessionId);
      }
    }, 30000); // Cek setiap 30 detik

    logger.info('Health check started (every 30s)');
  }

  /**
   * Cek kesehatan session dan update status jika perlu
   * Hanya mark as disconnected jika yakin socket mati
   */
  private async checkSessionHealth(sessionId: string): Promise<void> {
    const conn = this.sessions.get(sessionId);
    if (!conn || conn.status !== 'connected') return;

    // Skip health check if recently had conflict (within last 5 minutes)
    const lastConflict = this.lastConflictTime.get(sessionId) || 0;
    const conflictCount = this.conflictCount.get(sessionId) || 0;
    const timeSinceConflict = Date.now() - lastConflict;

    if (conflictCount > 0 && timeSinceConflict < 300000) {
      logger.debug(`[Session ${sessionId}] Health check skipped - recent conflict (${Math.round(timeSinceConflict / 1000)}s ago)`);
      return;
    }

    try {
      const session = await this.whatsapp.getSessionById(sessionId);
      const sock = session?.sock;

      // Cek apakah masih ada user data - ini yang paling penting
      const hasUser = sock?.user !== undefined;

      // Cek ws state jika tersedia (tidak semua socket expose ws langsung)
      const wsState = sock?.ws?.readyState;
      const wsOpen = wsState === 1; // 1 = WebSocket.OPEN

      // Connected jika: ada user data DAN (ws terbuka ATAU ws tidak bisa dicek)
      const isConnected = hasUser && (wsOpen || wsState === undefined);

      // Jika tidak terhubung, increment fail count
      if (!isConnected) {
        // Initialize fail count jika belum ada
        (conn as any).failCount = ((conn as any).failCount || 0) + 1;

        logger.warn(`[Session ${sessionId}] Health check fail #${(conn as any).failCount}: hasUser=${hasUser}, wsState=${wsState}`);

        // Hanya mark disconnected jika fail 3x berturut-turut
        if ((conn as any).failCount >= 3) {
          logger.error(`[Session ${sessionId}] Health check: Marking as disconnected after 3 failures`);

          conn.status = 'disconnected';
          conn.session.status = 'disconnected';
          this.db.updateSession({ id: sessionId, status: 'disconnected' });

          // Reset fail count
          (conn as any).failCount = 0;

          // Auto-reconnect jika session masih ada dan belum logged_out
          // TAPI dengan delay lebih lama untuk menghindari conflict
          const reconnectDelay = conflictCount > 0 ? 30000 : 5000;
          logger.info(`[Session ${sessionId}] Auto-reconnecting after health check failure (delay: ${reconnectDelay}ms)...`);
          setTimeout(() => {
            this.reconnectSession(sessionId).catch(err => {
              logger.error(`[Session ${sessionId}] Auto-reconnect failed:`, err.message);
            });
          }, reconnectDelay);
        }
      } else {
        // Reset fail count dan conflict count jika connected
        if ((conn as any).failCount > 0) {
          logger.info(`[Session ${sessionId}] Health check recovered`);
          (conn as any).failCount = 0;
        }

        // Reset conflict count jika sudah lama tidak ada conflict
        if (conflictCount > 0 && timeSinceConflict > 600000) { // 10 menit
          logger.info(`[Session ${sessionId}] Conflict count reset after 10 minutes stability`);
          this.conflictCount.set(sessionId, 0);
        }

        logger.debug(`[Session ${sessionId}] Health check OK`);
      }
    } catch (error) {
      // Error saat get session - mungkin session sudah tidak ada di wa-multi-session
      logger.warn(`[Session ${sessionId}] Health check error:`, error);

      // Increment fail count
      (conn as any).failCount = ((conn as any).failCount || 0) + 1;

      // Hanya mark disconnected jika fail 3x
      if ((conn as any).failCount >= 3) {
        logger.error(`[Session ${sessionId}] Health check: Marking as disconnected after 3 errors`);
        conn.status = 'disconnected';
        conn.session.status = 'disconnected';
        this.db.updateSession({ id: sessionId, status: 'disconnected' });
        (conn as any).failCount = 0;
      }
    }
  }

  /**
   * Restore session dengan locking untuk mencegah concurrent restore
   */
  private async restoreSessionWithLock(sessionId: string, sessionName: string): Promise<void> {
    // Check if restore already in progress
    if (this.restoreInProgress.get(sessionId)) {
      logger.info(`[Session ${sessionId}] Restore already in progress, waiting...`);
      // Return existing promise if available
      const existing = this.restoreQueue.get(sessionId);
      if (existing) return existing;
    }

    // Check debounce - jangan restore jika baru saja direstore
    const lastRestore = (this.sessions.get(sessionId) as any)?.lastRestoreTime;
    if (lastRestore && Date.now() - lastRestore < this.RESTORE_DEBOUNCE) {
      logger.info(`[Session ${sessionId}] Restore debounced, too soon since last attempt`);
      return;
    }

    // Create restore promise
    const restorePromise = this.restoreSessionInternal(sessionId, sessionName);
    this.restoreQueue.set(sessionId, restorePromise);

    try {
      await restorePromise;
    } finally {
      this.restoreInProgress.set(sessionId, false);
      this.restoreQueue.delete(sessionId);
    }
  }

  /**
   * Internal restore session implementation
   */
  private async restoreSessionInternal(sessionId: string, sessionName: string): Promise<void> {
    this.restoreInProgress.set(sessionId, true);

    try {
      logger.info(`[Session ${sessionId}] Restoring session...`);

      // Update last restore time
      const conn = this.sessions.get(sessionId);
      if (conn) {
        (conn as any).lastRestoreTime = Date.now();
      }

      // Check if session already exists in wa-multi-session
      const existingSession = await this.whatsapp.getSessionById(sessionId);

      if (existingSession) {
        // Session exists, just need to reconnect
        logger.info(`[Session ${sessionId}] Session exists in wa-multi-session, reconnecting...`);
        await this.reconnectSession(sessionId);
      } else {
        // Create new session
        logger.info(`[Session ${sessionId}] Creating new session connection...`);
        await this.createSession(sessionName, sessionId);
      }
    } catch (error: any) {
      logger.error(`[Session ${sessionId}] Failed to restore session:`, error.message);
      throw error;
    }
  }

  /**
   * Restore session saat server restart
   * @deprecated Use restoreSessionWithLock instead
   */
  private async restoreSession(sessionId: string, sessionName: string): Promise<void> {
    return this.restoreSessionWithLock(sessionId, sessionName);
  }

  /**
   * Force refresh status session dari WhatsApp server
   * Toleran terhadap wsState yang undefined
   */
  async forceRefreshStatus(sessionId: string): Promise<{ status: string; isConnected: boolean; reason?: string; details?: any }> {
    const conn = this.sessions.get(sessionId);
    if (!conn) {
      return { status: 'not_found', isConnected: false, reason: 'Session not found' };
    }

    try {
      const session = await this.whatsapp.getSessionById(sessionId);
      const sock = session?.sock;

      // Cek ws state (bisa undefined di beberapa implementasi)
      const wsState = sock?.ws?.readyState;
      const hasUser = sock?.user !== undefined;
      const userId = sock?.user?.id || 'unknown';

      logger.info(`[Session ${sessionId}] Force refresh: wsState=${wsState}, hasUser=${hasUser}, userId=${userId}`);

      const details = {
        hasSocket: !!sock,
        hasUser,
        userId,
        wsState,
        wsOpen: wsState === 1,
        currentStatus: conn.status
      };

      // Connected jika: ada socket DAN ada user data
      // wsState bisa undefined dan itu OK
      const isConnected = !!sock && hasUser;

      if (!isConnected) {
        // Socket tidak aktif
        if (conn.status !== 'disconnected') {
          conn.status = 'disconnected';
          conn.session.status = 'disconnected';
          this.db.updateSession({ id: sessionId, status: 'disconnected' });
        }
        return {
          status: 'disconnected',
          isConnected: false,
          reason: hasUser ? 'Socket closed' : 'No user data',
          details
        };
      }

      // Socket aktif - update status ke connected
      if (conn.status !== 'connected') {
        conn.status = 'connected';
        conn.session.status = 'connected';
        this.db.updateSession({ id: sessionId, status: 'connected' });
      }

      return {
        status: 'connected',
        isConnected: true,
        details
      };
    } catch (error: any) {
      logger.error(`[Session ${sessionId}] Error refreshing status:`, error.message);

      return {
        status: 'error',
        isConnected: false,
        reason: error.message,
        details: { error: error.message, currentStatus: conn.status }
      };
    }
  }

  setMessageHandler(handler: (msg: IncomingMessage) => void): void {
    this.messageHandler = handler;
  }

  private messageStatusHandler?: (status: any) => void;

  setMessageStatusHandler(handler: (status: any) => void): void {
    this.messageStatusHandler = handler;
  }

  async createSession(name: string, existingId?: string): Promise<SessionConnection> {
    const id = existingId || crypto.randomUUID();
    const token = this.generateToken();

    logger.info(`[Session ${id}] Creating new session: ${name}`);

    // Check if session already exists in database
    const existingSession = this.db.getSession(id);
    let session;

    if (existingSession) {
      // Update existing session
      session = existingSession;
      this.db.updateSession({
        id,
        name,
        status: 'connecting',
        token
      });
    } else {
      // Create new session
      session = this.db.createSession({
        id,
        name,
        status: 'connecting',
        token
      });
    }

    const conn: SessionConnection = {
      id,
      session,
      qrCode: null,
      status: 'connecting',
      qrUpdateTime: null,
      token
    };

    this.sessions.set(id, conn);

    // Start session and get QR
    await this.startSession(id);

    return conn;
  }

  private async startSession(sessionId: string): Promise<void> {
    return new Promise((resolve) => {
      this.whatsapp.startSession(sessionId, {
        onQRUpdated: async (qr: string) => {
          logger.info(`[Session ${sessionId}] QR received`);
          try {
            const qrDataUrl = await QRCode.toDataURL(qr, {
              type: 'image/png',
              margin: 2,
              scale: 8,
              width: 400
            });

            const conn = this.sessions.get(sessionId);
            if (conn) {
              conn.qrCode = qrDataUrl;
              conn.qrUpdateTime = new Date();
              conn.status = 'qr';
              conn.session.status = 'qr';
              this.db.updateSession({ id: sessionId, status: 'qr' });
              logger.info(`[Session ${sessionId}] QR code generated`);
            }
          } catch (err) {
            logger.error(`[Session ${sessionId}] Failed to generate QR:`, err);
          }
          resolve();
        },
        onConnected: () => {
          resolve();
        }
      });
    });
  }

  private generateToken(): string {
    return 'wag_' + Buffer.from(crypto.randomUUID()).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
  }

  async connect(sessionId: string): Promise<void> {
    await this.startSession(sessionId);
  }

  startQRRefresh(sessionId: string, callback: (qrCode: string | null) => void): NodeJS.Timeout {
    const interval = setInterval(async () => {
      const conn = this.sessions.get(sessionId);
      if (!conn || conn.status === 'connected') {
        clearInterval(interval);
        return;
      }
      callback(conn.qrCode);
    }, 2000);

    return interval;
  }

  getSession(id: string): SessionConnection | undefined {
    return this.sessions.get(id);
  }

  getAllSessions(): SessionConnection[] {
    return Array.from(this.sessions.values());
  }

  async deleteSession(id: string): Promise<void> {
    const conn = this.sessions.get(id);
    if (conn) {
      await this.whatsapp.deleteSession(id);
      this.sessions.delete(id);
    }

    // Clear all tracking for this session
    this.listenersSetup.delete(id);
    this.conflictCount.delete(id);
    this.lastConflictTime.delete(id);
    this.reconnectInProgress.delete(id);
    this.restoreInProgress.delete(id);
    this.restoreQueue.delete(id);

    this.db.deleteSession(id);
  }

  private reconnectInProgress: Map<string, boolean> = new Map();

  async reconnectSession(id: string): Promise<void> {
    // Check if reconnect already in progress
    if (this.reconnectInProgress.get(id)) {
      logger.info(`[Session ${id}] Reconnect already in progress, skipping...`);
      return;
    }

    this.reconnectInProgress.set(id, true);

    try {
      logger.info(`[Session ${id}] Reconnecting...`);

      // Delete old session
      await this.whatsapp.deleteSession(id);

      const conn = this.sessions.get(id);
      if (conn) {
        conn.qrCode = null;
        conn.qrUpdateTime = null;
        conn.status = 'connecting';
      }

      // Start new session
      await this.startSession(id);
    } finally {
      this.reconnectInProgress.set(id, false);
    }
  }

  async logoutSession(id: string): Promise<void> {
    logger.info(`[Session ${id}] Logging out...`);
    await this.whatsapp.deleteSession(id);

    const conn = this.sessions.get(id);
    if (conn) {
      conn.status = 'disconnected';
      conn.session.status = 'disconnected';
      conn.qrCode = null;
    }

    this.db.updateSession({ id, status: 'disconnected' });
  }

  // Setup event listener untuk sync contacts dari Baileys events
  private setupContactSync(sessionId: string, sock: any): void {
    const conn = this.sessions.get(sessionId);
    if (!conn) return;

    // Listen ke event contacts.upsert - ini dipicu saat WhatsApp mengirim kontak
    sock.ev?.on('contacts.upsert', async (contacts: any[]) => {
      try {
        logger.info(`[Session ${sessionId}] Received ${contacts.length} contacts from sync`);

        const contactsToSave = [];
        for (const contact of contacts) {
          if (contact.id && !contact.id.includes('status@broadcast')) {
            const jid = contact.id;
            const phone = jid.split('@')[0];
            const name = contact.name || contact.pushname || contact.verifiedName || contact.notify || phone;

            contactsToSave.push({
              id: crypto.randomUUID(),
              sessionId,
              name,
              phone,
              jid,
              isGroup: jid.endsWith('@g.us')
            });
          }
        }

        if (contactsToSave.length > 0) {
          // Process in chunks to prevent blocking the event loop
          const CHUNK_SIZE = 100;
          for (let i = 0; i < contactsToSave.length; i += CHUNK_SIZE) {
            const chunk = contactsToSave.slice(i, i + CHUNK_SIZE);
            this.db.bulkUpsertContacts(chunk);
            // Yield to event loop to allow other tasks (like sending messages) to process
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }

        const totalCount = this.db.getContactsCount(sessionId);
        conn.contactsSyncProgress = totalCount;
        conn.contactsSyncTotal = totalCount;
        conn.contactsSyncStatus = 'completed';
        logger.info(`[Session ${sessionId}] Contacts synced from event. Total: ${totalCount}`);
      } catch (err) {
        logger.error(`[Session ${sessionId}] Error in contacts.upsert:`, err);
      }
    });

    // Listen ke event chats.upsert - untuk mendapatkan kontak dari chat history
    sock.ev?.on('chats.upsert', async (chats: any[]) => {
      try {
        logger.debug(`[Session ${sessionId}] Received ${chats.length} chats from sync`);

        const contactsToSave = [];
        for (const chat of chats) {
          if (chat.id && !chat.id.includes('status@broadcast')) {
            const jid = chat.id;
            const phone = jid.split('@')[0];
            const name = chat.name || chat.pushName || chat.verifiedName || phone;

            contactsToSave.push({
              id: crypto.randomUUID(),
              sessionId,
              name,
              phone,
              jid,
              isGroup: jid.endsWith('@g.us')
            });
          }
        }

        if (contactsToSave.length > 0) {
          // Process in chunks to prevent blocking the event loop
          const CHUNK_SIZE = 100;
          for (let i = 0; i < contactsToSave.length; i += CHUNK_SIZE) {
            const chunk = contactsToSave.slice(i, i + CHUNK_SIZE);
            this.db.bulkUpsertContacts(chunk);
            // Yield to event loop
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }
      } catch (err) {
        logger.error(`[Session ${sessionId}] Error in chats.upsert:`, err);
      }
    });

    // Listen ke event messages.update untuk status pengiriman (receipts)
    sock.ev?.on('messages.update', (updates: any[]) => {
      try {
        for (const update of updates) {
          if (update.update.status) {
            const statusMap: Record<number, string> = {
              1: 'pending',
              2: 'server_ack',
              3: 'delivery_ack',
              4: 'read',
              5: 'played'
            };
            const status = statusMap[update.update.status] || 'unknown';

            logger.debug(`[Session ${sessionId}] Message status update: ${update.key.id} -> ${status}`);

            if (this.messageStatusHandler) {
              this.messageStatusHandler({
                id: update.key.id,
                sessionId,
                status,
                timestamp: new Date()
              });
            }
          }
        }
      } catch (err) {
        logger.error(`[Session ${sessionId}] Error in messages.update:`, err);
      }
    });

    // Listen ke messaging-history.set - event penting untuk history sync
    sock.ev?.on('messaging-history.set', async ({ contacts, chats }: any) => {
      try {
        const contactsToSave = [];

        if (contacts) {
          logger.info(`[Session ${sessionId}] History sync: ${contacts.length} contacts`);
          for (const contact of contacts) {
            if (contact.id && !contact.id.includes('status@broadcast')) {
              const jid = contact.id;
              const phone = jid.split('@')[0];
              const name = contact.name || contact.pushname || contact.verifiedName || contact.notify || phone;

              contactsToSave.push({
                id: crypto.randomUUID(),
                sessionId,
                name,
                phone,
                jid,
                isGroup: jid.endsWith('@g.us')
              });
            }
          }
        }

        if (chats) {
          logger.info(`[Session ${sessionId}] History sync: ${chats.length} chats`);
          for (const chat of chats) {
            if (chat.id && !chat.id.includes('status@broadcast')) {
              const jid = chat.id;
              const phone = jid.split('@')[0];
              const name = chat.name || chat.pushName || chat.verifiedName || phone;

              // Only add if not already added from contacts
              if (!contactsToSave.some(c => c.jid === jid)) {
                contactsToSave.push({
                  id: crypto.randomUUID(),
                  sessionId,
                  name,
                  phone,
                  jid,
                  isGroup: jid.endsWith('@g.us')
                });
              }
            }
          }
        }

        if (contactsToSave.length > 0) {
          // Process in chunks to prevent blocking the event loop
          const CHUNK_SIZE = 100;
          for (let i = 0; i < contactsToSave.length; i += CHUNK_SIZE) {
            const chunk = contactsToSave.slice(i, i + CHUNK_SIZE);
            this.db.bulkUpsertContacts(chunk);
            // Yield to event loop
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }

        const totalCount = this.db.getContactsCount(sessionId);
        conn.contactsSyncProgress = totalCount;
        conn.contactsSyncTotal = totalCount;
        if (totalCount > 0) {
          conn.contactsSyncStatus = 'completed';
        }
        logger.info(`[Session ${sessionId}] History sync completed. Total contacts: ${totalCount}`);
      } catch (err) {
        logger.error(`[Session ${sessionId}] Error in messaging-history.set:`, err);
      }
    });

    // Listen ke connection update untuk handle error & status
    sock.ev?.on('connection.update', (update: any) => {
      const { connection, lastDisconnect } = update;

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const reason = lastDisconnect?.error?.message || 'unknown';

        logger.warn(`[Session ${sessionId}] Connection closed. Reason: ${reason}, Code: ${statusCode}`);

        // Update status ke disconnected
        const conn = this.sessions.get(sessionId);
        if (conn && conn.status !== 'disconnected' && conn.status !== 'logged_out') {
          conn.status = 'disconnected';
          conn.session.status = 'disconnected';
          this.db.updateSession({ id: sessionId, status: 'disconnected' });
        }

        // Logged out (user kicked the session from phone)
        if (statusCode === DisconnectReason.loggedOut) {
          logger.warn(`[Session ${sessionId}] Logged out from phone. Session terminated.`);

          if (conn) {
            (conn as any).status = 'logged_out';
            (conn as any).session.status = 'logged_out';
            this.db.updateSession({ id: sessionId, status: 'logged_out' as any });
          }

          // Clear listeners setup flag
          this.listenersSetup.delete(sessionId);
          return;
        }

        // Restart required - session data corrupt
        if (statusCode === DisconnectReason.restartRequired) {
          logger.warn(`[Session ${sessionId}] Restart required. Reconnecting in 10s...`);
          setTimeout(() => {
            this.reconnectSession(sessionId).catch(err => {
              logger.error(`[Session ${sessionId}] Reconnect failed:`, err.message);
            });
          }, 10000);
          return;
        }

        // Bad session - need to reconnect
        if (statusCode === DisconnectReason.badSession) {
          logger.warn(`[Session ${sessionId}] Bad session. Reconnecting in 5s...`);
          setTimeout(() => {
            this.reconnectSession(sessionId).catch(err => {
              logger.error(`[Session ${sessionId}] Reconnect failed:`, err.message);
            });
          }, 5000);
          return;
        }

        // Conflict (Code 440) - Multiple connection detected
        // This happens when the same session is trying to connect from multiple places
        if (statusCode === 440 || reason.includes('conflict')) {
          const now = Date.now();
          const lastConflict = this.lastConflictTime.get(sessionId) || 0;
          let count = this.conflictCount.get(sessionId) || 0;

          // Reset count if last conflict was > 5 minutes ago
          if (now - lastConflict > 300000) {
            count = 0;
          }

          count++;
          this.conflictCount.set(sessionId, count);
          this.lastConflictTime.set(sessionId, now);

          // Calculate backoff: 30s, 60s, 120s, 240s, max 300s (5min)
          const delay = Math.min(
            this.CONFLICT_BACKOFF_BASE * Math.pow(2, count - 1),
            this.CONFLICT_MAX_DELAY
          );

          // Add jitter (±20%) to prevent thundering herd
          const jitter = delay * 0.2 * (Math.random() * 2 - 1);
          const finalDelay = Math.floor(delay + jitter);

          logger.warn(`[Session ${sessionId}] Conflict detected (attempt ${count}). Waiting ${Math.round(finalDelay / 1000)}s before reconnect...`);

          // Clear the session from wa-multi-session to force fresh connection
          setTimeout(async () => {
            try {
              logger.info(`[Session ${sessionId}] Cleaning up conflicted session...`);
              await this.whatsapp.deleteSession(sessionId);
              logger.info(`[Session ${sessionId}] Session cleaned up, reconnecting...`);
              await this.reconnectSession(sessionId);
            } catch (err: any) {
              logger.error(`[Session ${sessionId}] Failed to reconnect after conflict:`, err.message);
            }
          }, finalDelay);
          return;
        }

        // Untuk disconnect lainnya, jangan auto-reconnect dulu
        // Biarkan health check yang menangani jika memang perlu
        logger.info(`[Session ${sessionId}] Disconnected. Health check will monitor and reconnect if needed.`);
      }

      // Handle connecting status
      if (connection === 'connecting') {
        const conn = this.sessions.get(sessionId);
        if (conn && conn.status !== 'connecting') {
          conn.status = 'connecting';
          conn.session.status = 'connecting';
          this.db.updateSession({ id: sessionId, status: 'connecting' });
        }
      }
    });

    // Listen ke errors
    sock.ev?.on('error', (error: any) => {
      logger.error(`[Session ${sessionId}] Socket error:`, error);

      // Jika error kriptografi (MessageCounterError), force reconnect
      if (error?.message?.includes('MessageCounterError') ||
        error?.message?.includes('Key used already')) {
        logger.warn(`[Session ${sessionId}] Cryptographic error detected. Forcing reconnect...`);
        setTimeout(() => {
          this.reconnectSession(sessionId).catch(err => {
            logger.error(`[Session ${sessionId}] Force reconnect failed:`, err.message);
          });
        }, 3000);
      }
    });
  }

  // Check if can start sync (respect concurrent limit)
  private canStartSync(): boolean {
    let activeSyncs = 0;
    for (const [_, inProgress] of this.syncInProgress) {
      if (inProgress) activeSyncs++;
    }
    return activeSyncs < this.MAX_CONCURRENT_SYNC;
  }

  // Queue sync if at capacity
  private queueSync(sessionId: string): void {
    if (!this.syncQueue.includes(sessionId)) {
      this.syncQueue.push(sessionId);
      logger.info(`[Session ${sessionId}] Sync queued. Queue size: ${this.syncQueue.length}`);
    }
  }

  // Process next in queue
  private processSyncQueue(): void {
    if (this.syncQueue.length === 0) return;
    if (!this.canStartSync()) return;

    const nextSessionId = this.syncQueue.shift();
    if (nextSessionId) {
      logger.info(`[Session ${nextSessionId}] Processing queued sync`);
      this.syncChatsHistory(nextSessionId);
    }
  }

  // Check if manual sync is allowed (rate limiting)
  isManualSyncAllowed(sessionId: string): boolean {
    const lastSync = this.lastManualSync.get(sessionId) || 0;
    const now = Date.now();
    return (now - lastSync) > this.SYNC_COOLDOWN;
  }

  // Record manual sync time
  recordManualSync(sessionId: string): void {
    this.lastManualSync.set(sessionId, Date.now());
  }

  // Sinkronisasi chats history saat connected dengan retry
  async syncChatsHistory(sessionId: string, attempt: number = 1): Promise<void> {
    // Check concurrent limit
    if (!this.canStartSync() && !this.syncInProgress.get(sessionId)) {
      this.queueSync(sessionId);
      return;
    }

    // Mark sync as in progress
    this.syncInProgress.set(sessionId, true);

    const conn = this.sessions.get(sessionId);
    if (conn) {
      conn.contactsSyncStatus = 'syncing';
      conn.contactsSyncProgress = 0;
      conn.contactsSyncTotal = 0;
    }

    try {
      logger.info(`[Session ${sessionId}] Scanning for contacts (attempt ${attempt})...`);

      const session = await this.whatsapp.getSessionById(sessionId);
      if (!session?.sock) {
        logger.warn(`[Session ${sessionId}] Socket not available`);
        if (conn) conn.contactsSyncStatus = 'error';
        // Release lock so queue can continue
        this.syncInProgress.set(sessionId, false);
        this.processSyncQueue();
        return;
      }

      const sock = session.sock as any;
      let syncedCount = 0;
      let totalInStore = 0;

      // Coba ambil dari store.contacts (ini yang paling lengkap)
      try {
        const contacts = sock.store?.contacts;
        if (contacts && typeof contacts === 'object') {
          const contactArray = Array.isArray(contacts) ? contacts : Object.values(contacts);
          totalInStore += contactArray.length;
          logger.info(`[Session ${sessionId}] Found ${contactArray.length} contacts in store.contacts`);

          for (let i = 0; i < contactArray.length; i++) {
            const contact = contactArray[i];
            // Yield every 100 iterations to keep the event loop responsive
            if (i > 0 && i % 100 === 0) {
              await new Promise(resolve => setTimeout(resolve, 50));
            }

            if (contact.id && !contact.id.includes('status@broadcast')) {
              // Prioritaskan nama lengkap, lalu pushname, lalu notify, lalu verifiedName
              const contactName = contact.name ||
                contact.verifiedName ||
                contact.pushname ||
                contact.notify ||
                contact.shortName;

              await this.saveContact(
                sessionId,
                contact.id,
                contactName
              );
              syncedCount++;
            }
          }
        }
      } catch (err) {
        logger.debug(`[Session ${sessionId}] Store contacts not accessible: ${err}`);
      }

      // Coba ambil dari store.chats (untuk kontak yang belum ada di contacts tapi ada chat)
      try {
        const chats = sock.store?.chats;
        if (chats && typeof chats === 'object') {
          const chatArray = Array.isArray(chats) ? chats : Object.values(chats);
          totalInStore += chatArray.length;
          logger.info(`[Session ${sessionId}] Found ${chatArray.length} chats in store.chats`);

          for (let i = 0; i < chatArray.length; i++) {
            const chat = chatArray[i];
            // Yield every 100 iterations to keep the event loop responsive
            if (i > 0 && i % 100 === 0) {
              await new Promise(resolve => setTimeout(resolve, 50));
            }

            if (chat.id && !chat.id.includes('status@broadcast')) {
              const chatName = chat.name ||
                chat.verifiedName ||
                chat.pushName ||
                (chat.id.includes('@g.us') ? 'Group' : undefined);

              await this.saveContact(
                sessionId,
                chat.id,
                chatName
              );
              syncedCount++;
            }
          }
        }
      } catch (err) {
        logger.debug(`[Session ${sessionId}] Store chats not accessible: ${err}`);
      }

      // Coba fetch dari group participants
      try {
        const groups = sock.groupFetchAllParticipating ? await sock.groupFetchAllParticipating() : null;
        if (groups && typeof groups === 'object') {
          const groupArray = Object.values(groups) as any[];
          logger.info(`[Session ${sessionId}] Found ${groupArray.length} groups`);

          for (const group of groupArray) {
            if (group.id) {
              await this.saveContact(
                sessionId,
                group.id,
                group.subject || group.name || 'Group'
              );
              syncedCount++;
            }

            // Simpan juga participants
            if (group.participants) {
              for (const participant of group.participants) {
                if (participant.id && !participant.id.includes('status@broadcast')) {
                  await this.saveContact(sessionId, participant.id);
                }
              }
            }
          }
        }
      } catch (err: any) {
        logger.debug(`[Session ${sessionId}] Groups not accessible:`, err?.message);
      }

      const totalCount = this.db.getContactsCount(sessionId);
      logger.info(`[Session ${sessionId}] Contact scan completed. New: ${syncedCount}, Total: ${totalCount}`);

      if (conn) {
        conn.contactsSyncStatus = totalCount > 0 ? 'completed' : 'idle';
        conn.contactsSyncProgress = totalCount;
        conn.contactsSyncTotal = totalCount;
      }

      // Mark sync as complete
      this.syncInProgress.set(sessionId, false);

      // Process next in queue
      this.processSyncQueue();

      // Retry jika kontak masih sedikit (kurang dari 1000) dan attempt < 5
      if (totalCount < 1000 && attempt < 5) {
        logger.info(`[Session ${sessionId}] Contacts still low (${totalCount}), retrying in 10 seconds... (attempt ${attempt}/5)`);
        setTimeout(() => {
          this.syncChatsHistory(sessionId, attempt + 1);
        }, 10000);
      } else if (totalCount === 0) {
        logger.info(`[Session ${sessionId}] No contacts in store yet. Waiting for history sync from WhatsApp server...`);
      }
    } catch (error) {
      logger.error(`[Session ${sessionId}] Error scanning contacts:`, error);
      if (conn) conn.contactsSyncStatus = 'error';
      // Mark sync as complete even on error
      this.syncInProgress.set(sessionId, false);
      this.processSyncQueue();
    }
  }

  // Simpan kontak dari pesan masuk atau sync
  async saveContact(sessionId: string, jid: string, name?: string): Promise<void> {
    try {
      const phone = jid.split('@')[0];
      const isGroup = jid.endsWith('@g.us');

      // Cek apakah kontak sudah ada
      const existingContact = this.db.getContactByJid(sessionId, jid);

      if (existingContact) {
        // Update nama jika nama baru lebih baik (lebih panjang atau bukan nomor)
        if (name && name !== phone &&
          (!existingContact.name || existingContact.name === phone || name.length > existingContact.name.length)) {
          this.db.updateContact(existingContact.id, { name });
          logger.debug(`[Session ${sessionId}] Contact updated: ${phone} -> ${name}`);
        }
        return;
      }

      // Buat kontak baru
      this.db.createContact({
        id: crypto.randomUUID(),
        sessionId,
        name: name || phone,
        phone,
        jid,
        isGroup
      });

      logger.debug(`[Session ${sessionId}] Contact saved: ${phone} (${name || 'no name'})`);
    } catch (error) {
      // Ignore errors (duplicate, etc)
    }
  }

  // Get contacts untuk session
  getContacts(sessionId: string, search?: string): any[] {
    return this.db.getContacts(sessionId, search);
  }

  getContactsCount(sessionId: string): number {
    return this.db.getContactsCount(sessionId);
  }

  async sendPresenceUpdate(sessionId: string, to: string, type: 'composing' | 'recording' | 'available' | 'unavailable'): Promise<void> {
    const session = await this.whatsapp.getSessionById(sessionId);
    if (!session?.sock) {
      throw new Error('Session not connected');
    }

    await session.sock.sendPresenceUpdate(type, to);
  }

  private async sendMessageWithRetry(
    sessionId: string,
    jid: string,
    content: any,
    maxRetries: number = 2
  ): Promise<any> {
    let lastError: any;
    const SEND_TIMEOUT = 30000; // 30 detik timeout untuk send message

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const session = await this.whatsapp.getSessionById(sessionId);
        if (!session?.sock) {
          throw new Error('Session not connected');
        }

        // Wrap sendMessage dengan timeout untuk mencegah hanging
        const sendWithTimeout = Promise.race([
          session.sock.sendMessage(jid, content),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Send message timeout after 30s')), SEND_TIMEOUT)
          )
        ]);

        return await sendWithTimeout;
      } catch (error: any) {
        lastError = error;

        // Check if it's a timeout error
        if (error.message?.includes('timeout')) {
          logger.error(`[Connection] Send message timeout for session ${sessionId} (attempt ${attempt + 1})`);
        }

        // Check if it's a retryable error
        const isRetryable =
          error.message?.includes('Connection Closed') ||
          error.message?.includes('connection closed') ||
          error.message?.includes('Stream Errored') ||
          error.message?.includes('rate-overlimit') ||
          error.message?.includes('timeout') ||
          error.output?.statusCode === 428 ||
          error.output?.statusCode === 440;

        if (!isRetryable || attempt === maxRetries) {
          throw error;
        }

        // Wait before retry with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        logger.warn(`[Connection] Message send failed (attempt ${attempt + 1}), retrying in ${delay}ms:`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));

        // Try to reconnect session before final retry
        if (attempt === maxRetries - 1) {
          logger.info(`[Connection] Attempting session reconnect before final retry...`);
          try {
            await this.reconnectSession(sessionId);
          } catch (reconnectError) {
            logger.warn(`[Connection] Reconnect failed:`, reconnectError);
          }
        }
      }
    }

    throw lastError;
  }

  async sendTextMessage(sessionId: string, to: string, message: string, options?: any): Promise<string> {
    logger.info(`[Connection] Sending message: session=${sessionId}, to=${to}, type=${options?.type || 'text'}`);

    try {
      const session = await this.whatsapp.getSessionById(sessionId);
      if (!session?.sock) {
        throw new Error('Session not connected');
      }

      // Check if socket is actually open
      const sock = session.sock as any;
      if (sock.ws && !sock.ws.isOpen && !sock.ws.isConnecting) {
        throw new Error('WebSocket connection is closed');
      }

      const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

      // Handle media messages
      if (options?.media) {
        const mediaType = options.type || 'image';
        const mediaContent: any = {};

        // Check if media is local file path or URL
        const isLocalFile = !options.media.startsWith('http://') &&
          !options.media.startsWith('https://') &&
          !options.media.startsWith('data:');

        if (isLocalFile) {
          // Read local file with timeout protection
          logger.info(`[Connection] Reading local file: ${options.media}`);

          // Check if file exists first
          if (!existsSync(options.media)) {
            throw new Error(`Media file not found: ${options.media}`);
          }

          // Read file with 10 second timeout
          const fileBuffer = await Promise.race([
            readFile(options.media),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('File read timeout after 10s')), 10000)
            )
          ]);

          logger.info(`[Connection] File read complete: ${options.media} (${fileBuffer.length} bytes)`);

          if (mediaType === 'image') {
            mediaContent.image = fileBuffer;
          } else if (mediaType === 'video') {
            mediaContent.video = fileBuffer;
          } else if (mediaType === 'document') {
            mediaContent.document = fileBuffer;
            mediaContent.mimetype = options.mimetype || 'application/octet-stream';
            mediaContent.fileName = options.fileName || basename(options.media);
          } else if (mediaType === 'sticker') {
            mediaContent.sticker = fileBuffer;
          } else if (mediaType === 'audio') {
            mediaContent.audio = fileBuffer;
            mediaContent.mimetype = 'audio/mp4';
            mediaContent.ptt = options.ptt || false; // Push to talk (voice note)
          }
        } else {
          // Handle URL media
          logger.info(`[Connection] Using URL media: ${options.media}`);
          if (mediaType === 'image') {
            mediaContent.image = { url: options.media };
          } else if (mediaType === 'video') {
            mediaContent.video = { url: options.media };
          } else if (mediaType === 'document') {
            mediaContent.document = { url: options.media };
            mediaContent.mimetype = options.mimetype || 'application/pdf';
            mediaContent.fileName = options.fileName || 'document.pdf';
          } else if (mediaType === 'sticker') {
            mediaContent.sticker = { url: options.media };
          } else if (mediaType === 'audio') {
            mediaContent.audio = { url: options.media };
            mediaContent.mimetype = 'audio/mp4';
            mediaContent.ptt = options.ptt || false;
          }
        }

        if (options.caption && mediaType !== 'sticker' && mediaType !== 'audio') {
          mediaContent.caption = options.caption;
        }

        logger.info(`[Connection] Sending ${mediaType} message to ${jid}...`);
        const result = await this.sendMessageWithRetry(sessionId, jid, mediaContent);
        logger.info(`[Connection] Message sent successfully: ${result?.key?.id}`);
        return result?.key?.id || crypto.randomUUID();
      }

      // Default text message
      logger.info(`[Connection] Sending text message to ${jid}...`);
      const result = await this.sendMessageWithRetry(sessionId, jid, { text: message });
      logger.info(`[Connection] Text message sent successfully: ${result?.key?.id}`);
      return result?.key?.id || crypto.randomUUID();

    } catch (error: any) {
      // Handle specific errors
      if (error.message?.includes('Connection Closed') ||
        error.message?.includes('connection closed') ||
        error.message?.includes('Stream Errored') ||
        error.output?.statusCode === 428 ||
        error.output?.statusCode === 440) {
        logger.warn(`[Connection] Connection closed while sending message to ${to}. Session will auto-reconnect.`);
        throw new Error('WhatsApp connection closed. Please wait for auto-reconnect or reconnect manually.');
      }

      logger.error(`[Connection] Failed to send message:`, error.message);
      throw error;
    }
  }

  async sendImageMessage(sessionId: string, to: string, imageUrl: string, caption?: string): Promise<string> {
    logger.info(`[Connection] Sending image message: session=${sessionId}, to=${to}, url=${imageUrl}`);

    try {
      const response = await fetch(imageUrl);
      const buffer = Buffer.from(await response.arrayBuffer());

      const result = await this.whatsapp.sendImage({
        sessionId,
        to,
        image: buffer,
        caption: caption || ''
      });

      logger.info(`[Connection] Image message sent: ${result?.key?.id}`);

      return result?.key?.id || crypto.randomUUID();
    } catch (error: any) {
      logger.error(`[Connection] Failed to send image message:`, error.message);
      throw error;
    }
  }

  isConnected(sessionId: string): boolean {
    const conn = this.sessions.get(sessionId);
    if (!conn || conn.status !== 'connected') {
      return false;
    }

    // Additional check: verify socket actually has user data
    // This prevents false positives when connection drops but status not updated yet
    this.whatsapp.getSessionById(sessionId).then(session => {
      const hasUser = session?.sock?.user !== undefined;
      if (!hasUser && conn.status === 'connected') {
        logger.warn(`[Connection] Session ${sessionId} has no user data but status is connected`);
      }
    }).catch(() => { });

    return true;
  }

  async isOnWhatsApp(sessionId: string, phones: string[]): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const phone of phones) {
      try {
        const result = await this.whatsapp.onWhatsApp(sessionId, phone);
        results[phone] = result?.exists || false;
      } catch (err) {
        results[phone] = false;
      }
    }

    return results;
  }

  async checkContacts(sessionId: string, phones: string[]): Promise<any[]> {
    const results: any[] = [];

    for (const phone of phones) {
      try {
        const result = await this.whatsapp.onWhatsApp(sessionId, phone);
        results.push({
          input: phone,
          jid: result?.jid || null,
          exists: result?.exists || false
        });
      } catch (err) {
        results.push({
          input: phone,
          jid: null,
          exists: false,
          error: 'Check failed'
        });
      }
    }

    return results;
  }

  async stop(): Promise<void> {
    logger.info('[ConnectionManager] Stopping...');

    // Clear health check interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    // Clear all locks
    this.reconnectInProgress.clear();
    this.restoreInProgress.clear();
    this.restoreQueue.clear();

    // Clear conflict tracking
    this.conflictCount.clear();
    this.lastConflictTime.clear();

    // Clear listeners tracking
    this.listenersSetup.clear();

    // wa-multi-session handles cleanup automatically
    this.sessions.clear();

    logger.info('[ConnectionManager] Stopped');
  }
}
