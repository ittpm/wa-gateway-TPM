import { type Request, type Response, type NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { logger } from '../utils/logger.js';

// Schemas
export const sendMessageSchema = z.object({
    sessionId: z.string().min(1, 'Session ID is required'),
    to: z.string().regex(/^(\d+|.+@g\.us)$/, 'Invalid phone number or group ID'),
    type: z.enum(['text', 'image', 'video', 'document', 'sticker', 'audio']).default('text'),
    message: z.string().optional(),
    content: z.string().optional(), // Alias for message
    media: z.string().optional(), // URL or base64
    mediaUrl: z.string().optional(), // Legacy support
    caption: z.string().optional(),
    useSpintax: z.boolean().optional(),
    delay: z.boolean().optional()
}).refine(data => {
    const msg = data.message || data.content;
    const media = data.media || data.mediaUrl;

    if (data.type === 'text' && !msg) return false;
    if (data.type !== 'text' && !media) return false;
    return true;
}, {
    message: "Message is required for text type, Media is required for non-text types",
    path: ["message"]
});

export const bulkMessageSchema = z.object({
    sessionId: z.string().min(1, 'Session ID is required'),
    recipients: z.array(z.string().regex(/^62\d{9,}$/, 'Invalid phone number format'))
        .min(1, 'At least one recipient is required')
        .max(50, 'Maximum 50 recipients per bulk request'),
    message: z.string().min(1, 'Message content is required'),
    useSpintax: z.boolean().optional(),
    delay: z.boolean().optional()
});

export const templateSchema = z.object({
  name: z
    .string()
    .min(1, 'Template name is required')
    .max(100, 'Template name too long')
    .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Template name contains invalid characters'),
  content: z
    .string()
    .min(1, 'Template content is required')
    .max(5000, 'Template content too long'),
});

export const webhookSchema = z.object({
    url: z.string().url('Invalid Webhook URL'),
    secret: z.string().min(8, 'Secret must be at least 8 characters').optional(),
    events: z.union([
        z.string(),
        z.array(z.string())
    ])
});

export const sessionSchema = z.object({
    name: z.string()
        .min(1, 'Nama session tidak boleh kosong')
        .max(50, 'Nama session maksimal 50 karakter')
        .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Nama session hanya boleh huruf, angka, spasi, underscore, dan tanda hubung')
});

// Middleware
export const validate = (schema: z.ZodSchema) => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            // Normalize message field alias
            if (req.body.message && !req.body.content) {
                req.body.content = req.body.message;
            }

            const parsed = schema.parse(req.body);
            req.body = parsed; // Use parsed data (stripped of unknown keys if strictly configured, but Zod default is passthrough)
            next();
        } catch (error: any) {
            if (error instanceof ZodError || error.name === 'ZodError') {
                const errorDetails = error.errors?.map((e: any) => ({
                    field: e.path.join('.'),
                    message: e.message
                })) || [{ message: 'Validation failed' }];
                logger.warn(`[Validation] Failed: ${JSON.stringify(errorDetails)}`);

                return res.status(400).json({
                    error: 'Validation Error',
                    details: errorDetails
                });
            }
            next(error);
        }
    };
};
