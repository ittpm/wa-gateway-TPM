import { Database } from '../storage/database.js';
import { ConnectionManager } from '../connection/manager.js';
import { WebhookDispatcher } from '../webhook/dispatcher.js';
import type { Message } from '../models/types.js';
import { spin } from '../utils/spintax.js';
import { logger } from '../utils/logger.js';
import { cleanOldScheduledFiles } from '../middleware/upload.js';
import cron from 'node-cron';
// UUID menggunakan crypto.randomUUID() native

export class QueueManager {
  private db: Database;
  private connectionManager: ConnectionManager;
  private webhookDispatcher: WebhookDispatcher;
  private isRunning = false;
  private isPaused = false;
  private cronJob: cron.ScheduledTask | null = null;
  private guardianCronJob: cron.ScheduledTask | null = null;
  private cleanupCronJob: cron.ScheduledTask | null = null;
  private processingMessageIds: Set<string> = new Set();

  constructor(
    db: Database,
    connectionManager: ConnectionManager,
    webhookDispatcher: WebhookDispatcher
  ) {
    this.db = db;
    this.connectionManager = connectionManager;
    this.webhookDispatcher = webhookDispatcher;
  }

  async init(): Promise<void> {
    this.isRunning = true;

    // ─── FIX: Rescue messages stuck in 'processing' from previous server run ───
    try {
      const stuckMessages = this.db.getMessagesByStatus('processing', 1000);
      if (stuckMessages.length > 0) {
        logger.warn(`[Queue] Found ${stuckMessages.length} message(s) stuck in 'processing' from previous run. Resetting to 'pending'...`);
        for (const msg of stuckMessages) {
          msg.status = 'pending';
          // Don't penalise attempts for server-restart stuck messages
          msg.attempts = Math.max(0, msg.attempts - 1);
          this.db.updateMessage(msg);
        }
        logger.info(`[Queue] Rescued ${stuckMessages.length} stuck message(s).`);
      }
    } catch (err) {
      logger.error('[Queue] Error rescuing stuck messages on init:', err);
    }

    // Process queue every 2 seconds
    this.cronJob = cron.schedule('*/2 * * * * *', () => {
      if (this.isRunning && !this.isPaused) {
        this.processQueue();
      }
    });

    // ─── FIX: Check scheduled messages and move to pending when due ───
    cron.schedule('*/5 * * * * *', () => {
      if (!this.isRunning || this.isPaused) return;
      try {
        // Fetch a batch of scheduled messages
        const scheduledMessages = this.db.getMessagesByStatus('scheduled', 500);
        const now = new Date();
        for (const msg of scheduledMessages) {
          if (msg.scheduledAt && msg.scheduledAt <= now) {
            msg.status = 'pending';
            this.db.updateMessage(msg);
            logger.info(`[Queue] Scheduled message ${msg.id} is now due, moved to pending queue`);
          }
        }
      } catch (err) {
        logger.error('[Queue] Error checking scheduled messages:', err);
      }
    });

    // ─── FIX: Periodic guardian – rescue any 'processing' message older than 2 min ───
    this.guardianCronJob = cron.schedule('*/30 * * * * *', () => {
      if (!this.isRunning) return;
      try {
        const processingMessages = this.db.getMessagesByStatus('processing', 100);
        const twoMinutesAgo = Date.now() - 2 * 60 * 1000;
        for (const msg of processingMessages) {
          if (msg.updatedAt.getTime() < twoMinutesAgo && !this.processingMessageIds.has(msg.id)) {
            logger.warn(`[Queue] Guardian: message ${msg.id} stuck in processing >2min, resetting to pending`);
            msg.status = 'pending';
            this.db.updateMessage(msg);
          }
        }
      } catch (err) {
        logger.error('[Queue] Guardian error:', err);
      }
    });

    // ─── Cleanup: hapus file scheduled upload yang lebih dari 30 hari, setiap hari pukul 02:00 ───
    this.cleanupCronJob = cron.schedule('0 2 * * *', async () => {
      if (!this.isRunning) return;
      logger.info('[Queue] Running scheduled upload files cleanup (files > 30 days)...');
      await cleanOldScheduledFiles(30);
    });

    logger.info('Queue manager initialized');
  }

  addMessage(message: Omit<Message, 'id' | 'createdAt' | 'updatedAt' | 'attempts'>): Message {
    logger.info(`[Queue] Adding message: sessionId=${message.sessionId}, to=${message.to}, type=${message.type}`);

    // Apply spintax if enabled
    let content = message.content || '';
    if (message.useSpintax) {
      content = spin(content);
      logger.info(`[Queue] Spintax applied: ${message.content} -> ${content}`);
    }

    // Calculate delay or use provided schedule
    let scheduledAt: Date | undefined = message.scheduledAt;

    if (message.delayEnabled) {
      const session = this.db.getSession(message.sessionId);
      const settings = session?.userId ? this.db.getAntiBlockSettings(session.userId) : null;
      if (settings?.delayEnabled) {
        const minDelay = settings.minDelay * 1000;
        const maxDelay = settings.maxDelay * 1000;
        const randomDelay = minDelay + Math.random() * (maxDelay - minDelay);

        // If already scheduled, add delay to that. If not, add to now.
        const baseTime = scheduledAt ? scheduledAt.getTime() : Date.now();
        scheduledAt = new Date(baseTime + settings.baseDelay * 1000 + randomDelay);

        logger.info(`[Queue] Message scheduled/delayed at: ${scheduledAt.toISOString()}`);
      }
    }

    const msg = this.db.createMessage({
      ...message,
      content,
      status: message.status || 'pending',
      scheduledAt
    });

    logger.info(`[Queue] Message added to queue: ${msg.id}`);
    return msg;
  }

  private readonly MAX_TOTAL_CONCURRENT = 10; // Max 10 pesan berjalan bersamaan di server (global)
  private readonly MAX_PER_USER_BATCH = 2; // Max 2 pesan per user per siklus (supaya adil)

  private async processQueue(): Promise<void> {
    // Ambil semua pesan pending
    const allMessages = this.db.getMessagesByStatus('pending', 100);

    if (allMessages.length === 0) return;

    logger.info(`[Queue] Found ${allMessages.length} pending messages`);

    // Kelompokkan pesan berdasarkan user_id
    const messagesByUser = new Map<string, Message[]>();
    
    for (const message of allMessages) {
      // Skip jika sedang diproses
      if (this.processingMessageIds.has(message.id)) continue;
      
      // Skip jika belum waktunya (scheduled)
      if (message.scheduledAt && new Date() < message.scheduledAt) continue;

      const session = this.db.getSession(message.sessionId);
      const userId = session?.userId || 'default';

      // Rate limiting per user check
      const settings = userId !== 'default' ? this.db.getAntiBlockSettings(userId) : null;
      if (settings?.rateLimitEnabled) {
        if (!this.canSend(message.sessionId, settings)) continue;
      }

      if (!messagesByUser.has(userId)) {
        messagesByUser.set(userId, []);
      }
      messagesByUser.get(userId)!.push(message);
    }

    // Ambil pesan yang akan diproses: max MAX_PER_USER_BATCH per user
    const messagesToProcess: Message[] = [];
    
    for (const [userId, userMessages] of messagesByUser) {
      // Ambil max 2 pesan per user
      const batch = userMessages.slice(0, this.MAX_PER_USER_BATCH);
      messagesToProcess.push(...batch);
    }

    // Batasi total pesan yang diproses sekaligus (global)
    const finalBatch = messagesToProcess.slice(0, this.MAX_TOTAL_CONCURRENT);

    if (finalBatch.length === 0) return;

    logger.info(`[Queue] Processing ${finalBatch.length} messages from ${messagesByUser.size} users concurrently`);

    // Proses semua pesan secara paralel
    // Ini也让 Event Loop tetap responsive karena tidak blocking
    const promises = finalBatch.map(async (message) => {
      this.processingMessageIds.add(message.id);
      
      try {
        logger.info(`[Queue] Processing ${message.type} to ${message.to} (User: ${this.db.getSession(message.sessionId)?.userId})`);
        await this.processMessage(message);
      } catch (error) {
        logger.error(`[Queue] Error processing message ${message.id}:`, error);
      } finally {
        this.processingMessageIds.delete(message.id);
      }
    });

    await Promise.all(promises);
  }

  private async processMessage(message: Message): Promise<void> {
    // Update to processing
    message.status = 'processing';
    message.attempts++;
    this.db.updateMessage(message);

    logger.info(`[Queue] Message ${message.id} attempt #${message.attempts}`);

    // Check if session is connected
    const isConnected = this.connectionManager.isConnected(message.sessionId);
    logger.info(`[Queue] Session ${message.sessionId} connected: ${isConnected}`);

    if (!isConnected) {
      message.status = 'pending';
      if (message.attempts >= 3) {
        message.status = 'failed';
        message.error = 'Session not connected after 3 attempts';
        logger.error(`[Queue] Message ${message.id} failed: Session not connected`);
        this.webhookDispatcher.dispatch('message.failed', {
          messageId: message.id,
          to: message.to,
          error: message.error
        });
      } else {
        logger.warn(`[Queue] Message ${message.id} retrying (attempt ${message.attempts}/3)`);
      }
      this.db.updateMessage(message);
      return;
    }

    // Safety timeout untuk mencegah message stuck di processing
    const MESSAGE_TIMEOUT = 60000; // 60 detik
    let timeoutId: NodeJS.Timeout | null = null;

    try {
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('Message processing timeout after 60s'));
        }, MESSAGE_TIMEOUT);
      });

      let messageId: string;

      const sendPromise = (async () => {
        switch (message.type) {
          case 'text':
          case 'image':
          case 'video':
          case 'document':
          case 'sticker':
          case 'audio':
            logger.info(`[Queue] Sending ${message.type} message to ${message.to}`);
            return await this.connectionManager.sendTextMessage(
              message.sessionId,
              message.to,
              message.content || '',
              {
                type: message.type,
                media: message.mediaUrl,
                caption: message.caption
              }
            );
          default:
            throw new Error(`Unsupported message type: ${message.type}`);
        }
      })();

      // Race between send and timeout
      messageId = await Promise.race([sendPromise, timeoutPromise]);

      // Clear timeout on success
      if (timeoutId) clearTimeout(timeoutId);

      message.status = 'completed';
      message.messageId = messageId;

      logger.info(`[Queue] Message ${message.id} sent successfully: ${messageId}`);

      // ─── FIX: Save messageId to DB immediately after success ───
      this.db.updateMessage({ id: message.id, status: 'completed', messageId: messageId, attempts: message.attempts });

      this.webhookDispatcher.dispatch('message.sent', {
        messageId: message.id,
        waMessageId: messageId,
        to: message.to,
        type: message.type
      });

    } catch (error: any) {
      // Clear timeout on error
      if (timeoutId) clearTimeout(timeoutId);

      logger.error(`[Queue] Message ${message.id} error:`, error.message);
      message.error = error.message;

      // Check if it's a connection error - keep pending for retry
      const isConnectionError = error.message?.includes('Connection Closed') ||
        error.message?.includes('connection closed') ||
        error.message?.includes('WhatsApp connection closed') ||
        error.message?.includes('timeout');

      if (isConnectionError) {
        // For connection errors, always keep pending (don't count as attempt)
        // The message will be retried when connection is restored
        message.status = 'pending';
        message.attempts = Math.max(0, message.attempts - 1); // Don't count this attempt
        logger.warn(`[Queue] Message ${message.id} connection error - will retry when connection restored`);
      } else if (message.attempts >= 3) {
        message.status = 'failed';
        this.webhookDispatcher.dispatch('message.failed', {
          messageId: message.id,
          to: message.to,
          error: error.message
        });
      } else {
        message.status = 'pending';
      }
    }

    this.db.updateMessage(message);
  }

  private canSend(sessionId: string, settings: any): boolean {
    if (!settings?.rateLimitEnabled) return true;

    try {
      const now = new Date();

      // Check per minute limit
      if (settings.messagesPerMinute > 0) {
        const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
        const SentInLastMinute = this.db.getMessagesCountInTimeRange(sessionId, oneMinuteAgo, now);

        if (SentInLastMinute >= settings.messagesPerMinute) {
          logger.debug(`[Queue] Rate limit per minute exceeded for ${sessionId} (${SentInLastMinute}/${settings.messagesPerMinute})`);
          return false;
        }
      }

      // Check per hour limit
      if (settings.messagesPerHour > 0) {
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const SentInLastHour = this.db.getMessagesCountInTimeRange(sessionId, oneHourAgo, now);

        if (SentInLastHour >= settings.messagesPerHour) {
          logger.debug(`[Queue] Rate limit per hour exceeded for ${sessionId} (${SentInLastHour}/${settings.messagesPerHour})`);
          return false;
        }
      }

      return true;
    } catch (error) {
      // If DB query fails, allow message to prevent cascading failures
      logger.error(`[Queue] Rate limit check failed for ${sessionId}:`, error);
      return true; // Safe default
    }
  }

  pause(): void {
    this.isPaused = true;
    logger.info('Queue paused');
  }

  resume(): void {
    this.isPaused = false;
    logger.info('Queue resumed');
  }

  isPausedStatus(): boolean {
    return this.isPaused;
  }

  retryFailed(userId?: string): void {
    const messages = this.db.getMessagesByStatus('failed', 100, userId);
    for (const message of messages) {
      message.status = 'pending';
      message.attempts = 0;
      message.error = undefined;
      this.db.updateMessage(message);
    }
    logger.info(`Retrying ${messages.length} failed messages`);
  }

  clear(status: string, userId?: string): void {
    this.db.deleteMessagesByStatus(status, userId);
    logger.info(`Cleared ${status} messages`);
  }

  getStats(userId?: string): Record<string, number> {
    return this.db.getQueueStats(userId);
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.cronJob) {
      this.cronJob.stop();
    }
    if (this.guardianCronJob) {
      this.guardianCronJob.stop();
    }
    if (this.cleanupCronJob) {
      this.cleanupCronJob.stop();
    }
  }
}
