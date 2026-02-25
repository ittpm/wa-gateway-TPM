import { Database } from '../storage/database.js';
import { logger } from '../utils/logger.js';

export interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  variables: string[];
  category: 'general' | 'greeting' | 'promotion' | 'notification' | 'support';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class TemplateEngine {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  // Extract variables from template content
  extractVariables(content: string): string[] {
    const regex = /\{\{(\w+)\}\}/g;
    const variables: string[] = [];
    let match;
    
    while ((match = regex.exec(content)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }
    
    return variables;
  }

  // Render template with variables
  render(templateContent: string, variables: Record<string, string>): string {
    let rendered = templateContent;
    
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      rendered = rendered.replace(regex, value);
    }
    
    // Check for unreplaced variables
    const unreplaced = rendered.match(/\{\{\w+\}\}/g);
    if (unreplaced) {
      logger.warn(`[Template] Unreplaced variables: ${unreplaced.join(', ')}`);
    }
    
    return rendered;
  }

  // Create template
  createTemplate(
    name: string,
    content: string,
    category: MessageTemplate['category'] = 'general'
  ): MessageTemplate | null {
    try {
      const variables = this.extractVariables(content);
      
      const template: MessageTemplate = {
        id: crypto.randomUUID(),
        name,
        content,
        variables,
        category,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.db.createTemplate?.(template);
      logger.info(`[Template] Created: ${name} with variables [${variables.join(', ')}]`);
      return template;
    } catch (error) {
      logger.error('[Template] Error creating template:', error);
      return null;
    }
  }

  // Update template
  updateTemplate(
    id: string,
    updates: Partial<Omit<MessageTemplate, 'id' | 'createdAt'>>
  ): boolean {
    try {
      if (updates.content) {
        updates.variables = this.extractVariables(updates.content);
      }
      
      updates.updatedAt = new Date();
      this.db.updateTemplate?.(id, updates);
      return true;
    } catch (error) {
      logger.error('[Template] Error updating template:', error);
      return false;
    }
  }

  // Get template by ID
  getTemplate(id: string): MessageTemplate | null {
    try {
      return this.db.getTemplate?.(id) || null;
    } catch (error) {
      logger.error('[Template] Error getting template:', error);
      return null;
    }
  }

  // Get all templates
  getTemplates(category?: string): MessageTemplate[] {
    try {
      let templates = this.db.getTemplates?.() || [];
      
      if (category) {
        templates = templates.filter(t => t.category === category);
      }
      
      return templates.filter(t => t.isActive);
    } catch (error) {
      logger.error('[Template] Error getting templates:', error);
      return [];
    }
  }

  // Delete template
  deleteTemplate(id: string): boolean {
    try {
      this.db.deleteTemplate?.(id);
      return true;
    } catch (error) {
      logger.error('[Template] Error deleting template:', error);
      return false;
    }
  }

  // Process message with template
  processTemplateMessage(
    templateId: string,
    variables: Record<string, string>
  ): { success: boolean; message?: string; error?: string } {
    const template = this.getTemplate(templateId);
    
    if (!template) {
      return { success: false, error: 'Template not found' };
    }

    if (!template.isActive) {
      return { success: false, error: 'Template is inactive' };
    }

    // Validate required variables
    const missingVars = template.variables.filter(v => !variables[v]);
    if (missingVars.length > 0) {
      return {
        success: false,
        error: `Missing variables: ${missingVars.join(', ')}`
      };
    }

    const rendered = this.render(template.content, variables);
    return { success: true, message: rendered };
  }

  // Preview template with sample data
  previewTemplate(
    templateId: string,
    sampleData?: Record<string, string>
  ): { success: boolean; preview?: string; error?: string } {
    const template = this.getTemplate(templateId);
    
    if (!template) {
      return { success: false, error: 'Template not found' };
    }

    // Generate sample data for empty variables
    const sample: Record<string, string> = {
      name: 'John Doe',
      phone: '628123456789',
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
      ...sampleData
    };

    const rendered = this.render(template.content, sample);
    return { success: true, preview: rendered };
  }
}
