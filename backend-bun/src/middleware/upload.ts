import { type Request, type Response, type NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { mkdir, readdir, unlink, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

// File upload configuration
export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/jpg'],
  video: ['video/mp4', 'video/avi', 'video/mov', 'video/quicktime'],
  audio: ['audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/webm'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'application/zip',
    'application/x-zip-compressed'
  ]
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function ensureUploadDir(): Promise<string> {
  const uploadDir = './uploads';
  if (!existsSync(uploadDir)) {
    await mkdir(uploadDir, { recursive: true });
  }
  return uploadDir;
}

export async function ensureScheduledUploadDir(): Promise<string> {
  const scheduledDir = './uploads/scheduled';
  if (!existsSync(scheduledDir)) {
    await mkdir(scheduledDir, { recursive: true });
  }
  return scheduledDir;
}

/**
 * Hapus file di ./uploads/scheduled/ yang usianya lebih dari maxAgeDays hari.
 * Dipanggil oleh cron job harian di QueueManager.
 */
export async function cleanOldScheduledFiles(maxAgeDays: number = 30): Promise<void> {
  const scheduledDir = './uploads/scheduled';
  if (!existsSync(scheduledDir)) return;

  const cutoffMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  let deleted = 0;

  try {
    const files = await readdir(scheduledDir);
    for (const file of files) {
      const filePath = join(scheduledDir, file);
      try {
        const fileStat = await stat(filePath);
        const ageMs = now - fileStat.mtimeMs;
        if (ageMs > cutoffMs) {
          await unlink(filePath);
          deleted++;
          logger.info(`[Upload] Cleanup: deleted old scheduled file ${file} (age: ${Math.floor(ageMs / 86400000)}d)`);
        }
      } catch (err) {
        logger.warn(`[Upload] Cleanup: could not process file ${file}:`, err);
      }
    }
    if (deleted > 0) {
      logger.info(`[Upload] Cleanup complete: ${deleted} file(s) deleted from ./uploads/scheduled/`);
    } else {
      logger.info('[Upload] Cleanup: no old scheduled files to delete');
    }
  } catch (err) {
    logger.error('[Upload] Cleanup failed:', err);
  }
}

export function getFileType(mimetype: string): string | null {
  for (const [type, mimes] of Object.entries(ALLOWED_MIME_TYPES)) {
    if (mimes.includes(mimetype)) {
      return type;
    }
  }
  return null;
}

export function validateFile(file: UploadedFile): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` };
  }

  // Check mime type
  const fileType = getFileType(file.mimetype);
  if (!fileType) {
    return { valid: false, error: `Invalid file type: ${file.mimetype}` };
  }

  return { valid: true };
}

// Simple multipart parser middleware
export async function fileUploadMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const contentType = req.headers['content-type'] || '';

  if (!contentType.includes('multipart/form-data')) {
    return next();
  }

  try {
    // Parse multipart form data manually
    const chunks: Buffer[] = [];

    for await (const chunk of req.body) {
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);

    // Extract boundary
    const boundary = contentType.split('boundary=')[1];
    if (!boundary) {
      res.status(400).json({ error: 'No boundary found in multipart form' });
      return;
    }

    const parts = parseMultipartForm(buffer, boundary);

    // Attach parsed data to request
    (req as any).body = parts.fields;
    (req as any).files = parts.files;

    next();
  } catch (error) {
    logger.error('[Upload] Error parsing multipart form:', error);
    res.status(400).json({ error: 'Failed to parse upload' });
  }
}

interface MultipartResult {
  fields: Record<string, any>;
  files: UploadedFile[];
}

function parseMultipartForm(buffer: Buffer, boundary: string): MultipartResult {
  const result: MultipartResult = { fields: {}, files: [] };
  const boundaryBuffer = Buffer.from(`--${boundary}`);

  let start = buffer.indexOf(boundaryBuffer);

  while (start !== -1) {
    let end = buffer.indexOf(boundaryBuffer, start + boundaryBuffer.length);
    if (end === -1) break;

    const part = buffer.slice(start + boundaryBuffer.length, end);
    const headerEnd = part.indexOf('\r\n\r\n');

    if (headerEnd !== -1) {
      const header = part.slice(0, headerEnd).toString();
      const data = part.slice(headerEnd + 4, part.length - 2); // Remove trailing \r\n

      const nameMatch = header.match(/name="([^"]+)"/);
      const filenameMatch = header.match(/filename="([^"]+)"/);
      const contentTypeMatch = header.match(/Content-Type: (.+)/i);

      if (nameMatch) {
        const name = nameMatch[1];

        if (filenameMatch && contentTypeMatch) {
          // It's a file
          result.files.push({
            fieldname: name,
            originalname: filenameMatch[1],
            encoding: 'binary',
            mimetype: contentTypeMatch[1].trim(),
            buffer: data,
            size: data.length
          });
        } else {
          // It's a field
          result.fields[name] = data.toString();
        }
      }
    }

    start = end;
  }

  return result;
}
