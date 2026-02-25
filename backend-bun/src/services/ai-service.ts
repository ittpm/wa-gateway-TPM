import { logger } from '../utils/logger.js';

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
  private apiKey: string;
  private baseURL: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.KIMI_API_KEY || '';
    this.baseURL = process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1';
    this.model = process.env.KIMI_MODEL || 'moonshot-v1-8k';
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async chat(
    message: string,
    context?: string,
    history: AIConversation[] = []
  ): Promise<AIResponse | null> {
    if (!this.isConfigured()) {
      logger.warn('[AI] Kimi API not configured');
      return null;
    }

    try {
      const messages: AIConversation[] = [];
      
      // System prompt
      if (context) {
        messages.push({
          role: 'system',
          content: context
        });
      }

      // History
      messages.push(...history);

      // Current message
      messages.push({
        role: 'user',
        content: message
      });

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0.7,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error('[AI] API error:', error);
        return null;
      }

      const data = await response.json();
      
      return {
        content: data.choices[0]?.message?.content || '',
        usage: data.usage
      };
    } catch (error) {
      logger.error('[AI] Error:', error);
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
