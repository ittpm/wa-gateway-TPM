export interface Session {
  id: string;
  userId: string;
  name: string;
  phone?: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'qr';
  jid?: string;
  token?: string;
  apiKey?: string;
  deviceInfo?: string;
  platform?: string;
  meName?: string;
  createdAt: Date;
  updatedAt: Date;
  lastActive?: Date;
  messageCount: number;
}

export interface Message {
  id: string;
  sessionId: string;
  to: string;
  type: 'text' | 'image' | 'video' | 'document' | 'sticker' | 'audio' | 'vcard';
  content?: string;
  mediaUrl?: string;
  fileName?: string;
  caption?: string;
  latitude?: number;
  longitude?: number;
  contactName?: string;
  contactPhone?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'scheduled';
  attempts: number;
  error?: string;
  messageId?: string;
  createdAt: Date;
  updatedAt: Date;
  scheduledAt?: Date;
  useSpintax: boolean;
  delayEnabled: boolean;
}

export interface Webhook {
  id: string;
  userId: string;
  url: string;
  secret?: string;
  events: string[];
  status: 'active' | 'inactive' | 'error';
  lastTriggered?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookLog {
  id: string;
  webhookId: string;
  event: string;
  payload: string;
  success: boolean;
  statusCode?: number;
  response?: string;
  error?: string;
  timestamp: Date;
}

export interface AntiBlockSettings {
  userId: string;
  rateLimitEnabled: boolean;
  messagesPerMinute: number;
  messagesPerHour: number;
  burstLimit: number;
  delayEnabled: boolean;
  minDelay: number;
  maxDelay: number;
  baseDelay: number;
  warmupEnabled: boolean;
  warmupDays: number;
  warmupDay1Limit: number;
  warmupDay7Limit: number;
  spintaxEnabled: boolean;
  numberFilterEnabled: boolean;
  updatedAt: Date;
}

export interface Stats {
  totalSessions: number;
  activeSessions: number;
  messagesSent: number;
  messagesQueued: number;
  messagesDelivered: number;
  messagesFailed: number;
}

export interface Contact {
  id: string;
  sessionId: string;
  name?: string;
  phone: string;
  jid: string;
  profilePicUrl?: string;
  isGroup: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IncomingMessage {
  id: string;
  from: string;
  pushName?: string;
  message: string;
  timestamp: Date;
  isGroup: boolean;
  groupName?: string;
  mediaType?: string;
  mediaUrl?: string;
}

export interface Template {
  id: string;
  userId: string;
  name: string;
  content: string;
  variables?: string[];
  category?: string;
  isActive?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActivityData {
  time: string;
  sent: number;
  delivered: number;
  failed: number;
}
