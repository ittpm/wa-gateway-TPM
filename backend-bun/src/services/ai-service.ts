import { logger } from '../utils/logger.js';
import type { Database } from '../storage/database.js';

export interface AIResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface AIConversation {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class AIService {
  private sumopodApiKey: string;
  private sumopodModel: string;
  private geminiApiKey: string;
  private geminiModel: string;

  constructor(db?: Database) {
    const settings = db?.getGlobalSettings?.() || {};
    this.sumopodApiKey = settings.sumopodApiKey || process.env.SUMOPOD_API_KEY || '';
    this.sumopodModel = settings.sumopodModel || process.env.SUMOPOD_MODEL || 'seed-2-0-mini-free';
    this.geminiApiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY || '';
    this.geminiModel = settings.geminiModel || process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  }

  isConfigured(): boolean {
    return !!this.sumopodApiKey || !!this.geminiApiKey;
  }

  async chat(
    message: string,
    context?: string,
    history: AIConversation[] = []
  ): Promise<AIResponse | null> {
    if (!this.isConfigured()) {
      logger.warn('[AI] Neither SumoPod nor Gemini API is configured');
      return null;
    }

    let response: AIResponse | null = null;

    // Try SumoPod first
    if (this.sumopodApiKey) {
      response = await this.chatSumoPod(message, context, history);
    }

    // Fallback to Gemini if SumoPod failed or wasn't configured
    if (!response && this.geminiApiKey) {
      logger.info('[AI] Falling back to Gemini');
      response = await this.chatGemini(message, context, history);
    }

    return response;
  }

  private async chatSumoPod(
    message: string,
    context?: string,
    history: AIConversation[] = []
  ): Promise<AIResponse | null> {
    try {
      const messages: AIConversation[] = [];
      
      if (context) {
        messages.push({ role: 'system', content: context });
      }
      
      messages.push(...history);
      messages.push({ role: 'user', content: message });

      const url = 'https://ai.sumopod.com/v1/chat/completions';
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.sumopodApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.sumopodModel,
          messages,
          temperature: 0.3,
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error(`[AI] SumoPod API error: ${response.status} - ${error}`);
        return null;
      }

      const data: any = await response.json();
      
      if (data?.choices && data.choices[0]?.message?.content) {
         return {
          content: data.choices[0].message.content,
          usage: data.usage
        };
      }
      return null;
    } catch (error) {
      logger.error('[AI] SumoPod Error:', error);
      return null;
    }
  }

  private async chatGemini(
    message: string,
    context?: string,
    history: AIConversation[] = []
  ): Promise<AIResponse | null> {
    try {
      const parts = [];
      
      if (context) {
        parts.push({ text: `System Context: ${context}` });
      }
      
      for (const msg of history) {
        parts.push({ text: `${msg.role.toUpperCase()}: ${msg.content}` });
      }
      
      parts.push({ text: `USER: ${message}` });

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiApiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2000
          }
        })
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error(`[AI] Gemini API error: ${response.status} - ${error}`);
        return null;
      }

      const data: any = await response.json();
      
      if (data?.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        const text = data.candidates[0].content.parts[0].text;
        return {
          content: text,
          usage: undefined
        };
      }
      return null;
    } catch (error) {
      logger.error('[AI] Gemini Error:', error);
      return null;
    }
  }

  async generateReply(
    incomingMessage: string,
    businessContext: string,
    tone: 'professional' | 'friendly' | 'casual' = 'friendly'
  ): Promise<string | null> {
    const prompts: Record<string, string> = {
      professional: 'Anda adalah asisten profesional. Balas dengan sopan dan formal.',
      friendly: 'Anda adalah asisten yang ramah dan helpful. Balas dengan hangat.',
      casual: 'Anda adalah asisten yang santai. Balas dengan gaya casual.'
    };

    const systemPrompt = `${prompts[tone]} ${businessContext}`;
    
    const response = await this.chat(incomingMessage, systemPrompt);
    return response?.content || null;
  }

  async analyzeIntent(message: string): Promise<{
    intent: string;
    confidence: number;
    entities: Record<string, string>;
  } | null> {
    const prompt = `Analisis pesan berikut dan identifikasi:
1. Intent (tujuan pesan)
2. Confidence (0-1)
3. Entities (data penting)

Format JSON: {"intent": "...", "confidence": 0.9, "entities": {"key": "value"}}

Pesan: ${message}`;

    const response = await this.chat(prompt, 'Anda adalah AI analyzer.');
    
    if (!response?.content) return null;

    try {
      // Extract JSON from response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return null;
    } catch {
      return null;
    }
  }
}
