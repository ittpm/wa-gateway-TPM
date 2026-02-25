import { Database } from '../storage/database.js';
import { QueueManager } from '../queue/manager.js';
import { logger } from '../utils/logger.js';

export interface AutoReplyRule {
  id: string;
  sessionId: string;
  name: string;
  triggerType: 'keyword' | 'contains' | 'exact' | 'regex' | 'all';
  triggerValue: string;
  replyMessage: string;
  useAI: boolean;
  aiPrompt?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutoReplySettings {
  sessionId: string;
  autoReplyEnabled: boolean;
  autoRejectUnknown: boolean;
  unknownContactMessage: string;
  replyCooldown: number; // dalam detik
}

export class AutoReplyService {
  private db: Database;
  private queueManager: QueueManager;
  private rules: Map<string, AutoReplyRule[]> = new Map();
  private lastReplyTime: Map<string, number> = new Map();
  private settings: Map<string, AutoReplySettings> = new Map();

  constructor(db: Database, queueManager: QueueManager) {
    this.db = db;
    this.queueManager = queueManager;
    this.loadRules();
    this.loadSettings();
  }

  private loadRules(): void {
    try {
      const rules = this.db.getAllAutoReplyRules?.() || [];
      for (const rule of rules) {
        if (rule.isActive) {
          const sessionRules = this.rules.get(rule.sessionId) || [];
          sessionRules.push(rule);
          this.rules.set(rule.sessionId, sessionRules);
        }
      }
      logger.info(`[AutoReply] Loaded ${rules.length} rules`);
    } catch (error) {
      logger.error('[AutoReply] Failed to load rules:', error);
    }
  }

  private loadSettings(): void {
    try {
      const settings = this.db.getAllAutoReplySettings?.() || [];
      for (const setting of settings) {
        this.settings.set(setting.sessionId, setting);
      }
      logger.info(`[AutoReply] Loaded ${settings.length} settings`);
    } catch (error) {
      logger.error('[AutoReply] Failed to load settings:', error);
    }
  }

  reloadRules(): void {
    this.rules.clear();
    this.loadRules();
  }

  createRule(rule: Omit<AutoReplyRule, 'id' | 'createdAt' | 'updatedAt'>): AutoReplyRule {
    const newRule: AutoReplyRule = {
      ...rule,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.db.createAutoReplyRule?.(newRule);
    this.reloadRules();
    
    logger.info(`[AutoReply] Created rule: ${newRule.name}`);
    return newRule;
  }

  updateRule(id: string, updates: Partial<AutoReplyRule>): void {
    this.db.updateAutoReplyRule?.(id, updates);
    this.reloadRules();
  }

  deleteRule(id: string): void {
    this.db.deleteAutoReplyRule?.(id);
    this.reloadRules();
  }

  getRules(sessionId?: string): AutoReplyRule[] {
    if (sessionId) {
      return this.rules.get(sessionId) || [];
    }
    return Array.from(this.rules.values()).flat();
  }

  getSettings(sessionId: string): AutoReplySettings | null {
    return this.settings.get(sessionId) || null;
  }

  updateSettings(settings: AutoReplySettings): void {
    this.db.updateAutoReplySettings?.(settings);
    this.settings.set(settings.sessionId, settings);
  }

  async processIncomingMessage(
    sessionId: string,
    from: string,
    message: string,
    messageType: string
  ): Promise<boolean> {
    const setting = this.settings.get(sessionId);
    if (!setting?.autoReplyEnabled) {
      return false;
    }

    // Cek cooldown
    const cooldownKey = `${sessionId}:${from}`;
    const lastReply = this.lastReplyTime.get(cooldownKey) || 0;
    const now = Date.now();
    const cooldownMs = (setting.replyCooldown || 5) * 1000;
    
    if (now - lastReply < cooldownMs) {
      return false;
    }

    const sessionRules = this.rules.get(sessionId);
    if (!sessionRules || sessionRules.length === 0) {
      return false;
    }

    for (const rule of sessionRules) {
      if (this.matchesRule(message, rule)) {
        this.queueManager.addMessage({
          sessionId,
          to: from,
          type: messageType || 'text',
          content: rule.replyMessage,
          status: 'pending',
          useSpintax: false,
          delayEnabled: false
        });

        this.lastReplyTime.set(cooldownKey, now);
        logger.info(`[AutoReply] Sent to ${from}: ${rule.name}`);
        return true;
      }
    }

    return false;
  }

  private matchesRule(message: string, rule: AutoReplyRule): boolean {
    const msg = message.toLowerCase().trim();
    const trigger = rule.triggerValue.toLowerCase().trim();

    switch (rule.triggerType) {
      case 'exact':
        return msg === trigger;
      case 'contains':
        return msg.includes(trigger);
      case 'keyword':
        return msg.split(/\s+/).includes(trigger);
      case 'regex':
        try {
          const regex = new RegExp(trigger, 'i');
          return regex.test(message);
        } catch {
          return false;
        }
      case 'all':
        return true;
      default:
        return false;
    }
  }

  async processUnknownContact(
    sessionId: string,
    from: string
  ): Promise<boolean> {
    const settings = this.settings.get(sessionId);
    
    if (!settings?.autoRejectUnknown) {
      return false;
    }

    const contact = this.db.getContactByJid(sessionId, from);
    if (contact) {
      return false;
    }

    this.queueManager.addMessage({
      sessionId,
      to: from,
      type: 'text',
      content: settings.unknownContactMessage || 'Maaf, kami tidak dapat memproses pesan dari nomor tidak dikenal.',
      status: 'pending',
      useSpintax: false,
      delayEnabled: false
    });

    logger.info(`[AutoReply] Auto-reject sent to ${from}`);
    return true;
  }
}
