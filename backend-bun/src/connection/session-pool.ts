import { Database } from '../storage/database.js';
import { ConnectionManager } from './manager.js';
import { logger } from '../utils/logger.js';

export interface SessionInfo {
  id: string;
  name: string;
  token: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'logged_out';
  phone?: string;
  lastActivity: Date;
  messagesSent: number;
  messagesFailed: number;
}

export class SessionPool {
  private db: Database;
  private connectionManager: ConnectionManager;
  private sessionRotationIndex: number = 0;

  constructor(db: Database, connectionManager: ConnectionManager) {
    this.db = db;
    this.connectionManager = connectionManager;
  }

  // Get all active (connected) sessions
  getActiveSessions(): SessionInfo[] {
    const sessions = this.db.getAllSessions();
    const activeSessions: SessionInfo[] = [];

    for (const session of sessions) {
      const conn = this.connectionManager.getSession(session.id);
      if (conn && conn.status === 'connected') {
        activeSessions.push({
          id: session.id,
          name: session.name,
          token: conn.token,
          status: 'connected',
          phone: session.phone,
          lastActivity: session.updatedAt,
          messagesSent: this.db.getMessagesCount(session.id, 'completed'),
          messagesFailed: this.db.getMessagesCount(session.id, 'failed')
        });
      }
    }

    return activeSessions;
  }

  // Get best session for sending (round-robin)
  getBestSession(): SessionInfo | null {
    const activeSessions = this.getActiveSessions();
    
    if (activeSessions.length === 0) {
      logger.warn('[SessionPool] No active sessions available');
      return null;
    }

    // Round-robin selection
    const session = activeSessions[this.sessionRotationIndex % activeSessions.length];
    this.sessionRotationIndex++;
    
    logger.info(`[SessionPool] Selected session: ${session.id} (${session.phone || 'no phone'})`);
    return session;
  }

  // Get session by phone number
  getSessionByPhone(phone: string): SessionInfo | null {
    const sessions = this.getActiveSessions();
    return sessions.find(s => s.phone === phone) || null;
  }

  // Get pool stats
  getStats(): {
    total: number;
    connected: number;
    connecting: number;
    disconnected: number;
    totalMessagesSent: number;
    totalMessagesFailed: number;
  } {
    const sessions = this.db.getAllSessions();
    let connected = 0;
    let connecting = 0;
    let disconnected = 0;
    let totalMessagesSent = 0;
    let totalMessagesFailed = 0;

    for (const session of sessions) {
      const conn = this.connectionManager.getSession(session.id);
      if (conn) {
        if (conn.status === 'connected') connected++;
        else if (conn.status === 'connecting') connecting++;
        else disconnected++;
      } else {
        disconnected++;
      }
      
      totalMessagesSent += this.db.getMessagesCount(session.id, 'completed');
      totalMessagesFailed += this.db.getMessagesCount(session.id, 'failed');
    }

    return {
      total: sessions.length,
      connected,
      connecting,
      disconnected,
      totalMessagesSent,
      totalMessagesFailed
    };
  }

  // Validate session token
  validateSessionToken(sessionId: string, token: string): boolean {
    const conn = this.connectionManager.getSession(sessionId);
    return conn !== undefined && conn.token === token;
  }

  // Get session info by ID
  getSessionInfo(sessionId: string): SessionInfo | null {
    const session = this.db.getSessionById(sessionId);
    if (!session) return null;

    const conn = this.connectionManager.getSession(sessionId);
    return {
      id: session.id,
      name: session.name,
      token: conn?.token || '',
      status: (conn?.status as any) || 'disconnected',
      phone: session.phone,
      lastActivity: session.updatedAt,
      messagesSent: this.db.getMessagesCount(sessionId, 'completed'),
      messagesFailed: this.db.getMessagesCount(sessionId, 'failed')
    };
  }
}
