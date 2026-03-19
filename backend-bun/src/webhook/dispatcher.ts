import { Database } from '../storage/database.js';
import type { Webhook } from '../models/types.js';
import { logger } from '../utils/logger.js';
// UUID menggunakan crypto.randomUUID() native
import crypto from 'crypto';

export class WebhookDispatcher {
  private db: Database;
  private failureCounts: Map<string, number> = new Map();
  private circuitOpenUntil: Map<string, number> = new Map();

  constructor(db: Database) {
    this.db = db;
  }

  private async handleFailure(webhookId: string, error: string, event: string, body: string, threshold: number, resetTime: number) {
    const currentFailures = (this.failureCounts.get(webhookId) || 0) + 1;
    this.failureCounts.set(webhookId, currentFailures);

    logger.error(`Webhook ${webhookId} failed. Count: ${currentFailures}/${threshold}. Error: ${error}`);

    if (currentFailures >= threshold) {
      logger.warn(`[Webhook] Circuit breaker OPEN for ${webhookId}. Pausing for ${resetTime / 60000} mins.`);
      this.circuitOpenUntil.set(webhookId, Date.now() + resetTime);
    }

    await this.db.createWebhookLog({
      id: crypto.randomUUID(),
      webhookId: webhookId,
      event,
      payload: body,
      success: false,
      error: error
    });
  }

  async dispatch(event: string, payload: any): Promise<void> {
    const webhooks = await this.db.getAllWebhooks();

    for (const webhook of webhooks) {
      // Check if webhook is subscribed to this event
      if (!webhook.events.includes(event) && !webhook.events.includes('*')) {
        continue;
      }

      // Send webhook asynchronously
      this.sendWebhook(webhook, event, payload);
    }
  }

  private async sendWebhook(webhook: Webhook, event: string, payload: any): Promise<void> {
    const fullPayload = {
      event,
      timestamp: new Date().toISOString(),
      data: payload
    };

    // Circuit breaker state
    const FAILURE_THRESHOLD = 5;
    const CIRCUIT_RESET_TIME = 5 * 60 * 1000; // 5 minutes

    // Check circuit breaker
    if (this.circuitOpenUntil.get(webhook.id) && this.circuitOpenUntil.get(webhook.id)! > Date.now()) {
      logger.warn(`[Webhook] Circuit open for ${webhook.id}, skipping dispatch`);
      return;
    }

    const retries = parseInt(process.env.WEBHOOK_RETRIES || '3');
    const timeout = parseInt(process.env.WEBHOOK_TIMEOUT || '30000');
    const body = JSON.stringify(fullPayload);

    let lastError: string | null = null;

    for (let i = 0; i <= retries; i++) {
      if (i > 0) {
        await this.delay(i * 1000); // Exponential backoff
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'User-Agent': 'WA-Gateway/1.0',
          'X-Webhook-Event': event,
          'X-Webhook-ID': webhook.id
        };

        if (webhook.secret) {
          const signature = this.generateSignature(body, webhook.secret);
          headers['X-Webhook-Signature'] = signature;
        }

        const response = await fetch(webhook.url, {
          method: 'POST',
          headers,
          body,
          signal: controller.signal
        }) as Response; // Cast to standard Response to fix type issues if any

        clearTimeout(timeoutId);
        const responseBody = await response.text();
        const success = response.status >= 200 && response.status < 300;

        await this.db.createWebhookLog({
          id: crypto.randomUUID(),
          webhookId: webhook.id,
          event,
          payload: body,
          success,
          statusCode: response.status,
          response: responseBody
        });

        if (success) {
          await this.db.updateWebhook({ id: webhook.id, lastTriggered: new Date() });

          // Reset failure count on success
          this.failureCounts.set(webhook.id, 0);
          this.circuitOpenUntil.delete(webhook.id);

          return;
        }

        lastError = `HTTP ${response.status}`;

      } catch (error: any) {
        lastError = error.message;
      }
    }

    // All retries failed
    this.handleFailure(webhook.id, lastError || 'Unknown error', event, body, FAILURE_THRESHOLD, CIRCUIT_RESET_TIME);
  }

  private generateSignature(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
