import { Database } from '../storage/database.js';
import { logger } from '../utils/logger.js';

export interface MessageStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  bySession: Record<string, number>;
  byDate: Record<string, number>;
}

export interface SessionStats {
  sessionId: string;
  name: string;
  phone?: string;
  status: string;
  messagesSent: number;
  messagesFailed: number;
  successRate: number;
  lastActivity: Date;
  contactsCount: number;
}

export interface RealTimeMetrics {
  timestamp: Date;
  messagesPerMinute: number;
  activeSessions: number;
  queueSize: number;
  errorRate: number;
}

export class AnalyticsService {
  private db: Database;
  private metrics: RealTimeMetrics[] = [];
  private readonly MAX_METRICS_HISTORY = 60; // 60 data points

  constructor(db: Database) {
    this.db = db;
  }

  // Get message statistics
  getMessageStats(sessionId?: string, days: number = 7): MessageStats {
    try {
      const stats = this.db.getMessageStats?.(sessionId, days) || {
        total: 0,
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        bySession: {},
        byDate: {}
      };
      return stats;
    } catch (error) {
      logger.error('[Analytics] Error getting message stats:', error);
      return {
        total: 0,
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        bySession: {},
        byDate: {}
      };
    }
  }

  // Get session performance stats
  getSessionStats(): SessionStats[] {
    try {
      const sessions = this.db.getAllSessions();
      return sessions.map(session => {
        const sent = this.db.getMessagesCount(session.id, 'completed');
        const failed = this.db.getMessagesCount(session.id, 'failed');
        const total = sent + failed;
        
        return {
          sessionId: session.id,
          name: session.name,
          phone: session.phone,
          status: session.status,
          messagesSent: sent,
          messagesFailed: failed,
          successRate: total > 0 ? Math.round((sent / total) * 100) : 0,
          lastActivity: session.updatedAt,
          contactsCount: this.db.getContactsCount(session.id)
        };
      });
    } catch (error) {
      logger.error('[Analytics] Error getting session stats:', error);
      return [];
    }
  }

  // Record real-time metrics
  recordMetrics(metrics: Omit<RealTimeMetrics, 'timestamp'>): void {
    const metric: RealTimeMetrics = {
      ...metrics,
      timestamp: new Date()
    };
    
    this.metrics.push(metric);
    
    // Keep only last N metrics
    if (this.metrics.length > this.MAX_METRICS_HISTORY) {
      this.metrics.shift();
    }
  }

  // Get real-time metrics
  getRealTimeMetrics(): RealTimeMetrics[] {
    return this.metrics;
  }

  // Get dashboard summary
  getDashboardSummary(): {
    totalSessions: number;
    activeSessions: number;
    totalMessages: number;
    messagesToday: number;
    successRate: number;
    avgMessagesPerSession: number;
  } {
    try {
      const sessions = this.db.getAllSessions();
      const totalMessages = this.db.getTotalMessagesCount?.() || 0;
      const messagesToday = this.db.getMessagesCountToday?.() || 0;
      
      let totalSent = 0;
      let totalFailed = 0;
      
      for (const session of sessions) {
        totalSent += this.db.getMessagesCount(session.id, 'completed');
        totalFailed += this.db.getMessagesCount(session.id, 'failed');
      }
      
      const total = totalSent + totalFailed;
      
      return {
        totalSessions: sessions.length,
        activeSessions: sessions.filter(s => s.status === 'connected').length,
        totalMessages,
        messagesToday,
        successRate: total > 0 ? Math.round((totalSent / total) * 100) : 0,
        avgMessagesPerSession: sessions.length > 0 ? Math.round(totalMessages / sessions.length) : 0
      };
    } catch (error) {
      logger.error('[Analytics] Error getting dashboard summary:', error);
      return {
        totalSessions: 0,
        activeSessions: 0,
        totalMessages: 0,
        messagesToday: 0,
        successRate: 0,
        avgMessagesPerSession: 0
      };
    }
  }

  // Get hourly activity for charts
  getHourlyActivity(sessionId?: string, hours: number = 24): Array<{
    hour: string;
    sent: number;
    failed: number;
  }> {
    try {
      return this.db.getHourlyActivity?.(sessionId, hours) || [];
    } catch (error) {
      logger.error('[Analytics] Error getting hourly activity:', error);
      return [];
    }
  }
}
