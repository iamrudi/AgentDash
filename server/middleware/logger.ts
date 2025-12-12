import winston from 'winston';
import { mkdirSync } from 'fs';
import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

try {
  mkdirSync('logs', { recursive: true });
} catch (err) {
  // Directory already exists or cannot be created
}

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const isProduction = process.env.NODE_ENV === 'production';

const consoleFormat = printf(({ level, message, timestamp, stack, requestId, ...meta }) => {
  const reqId = requestId ? `[${requestId}] ` : '';
  const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} ${reqId}[${level}]: ${stack || message}${metaStr}`;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'agency-client-portal' },
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' })
  ),
  transports: [
    new winston.transports.Console({
      format: isProduction
        ? combine(timestamp(), json())
        : combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), consoleFormat)
    }),
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      format: combine(timestamp(), json())
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      format: combine(timestamp(), json())
    })
  ]
});

export function generateRequestId(): string {
  return randomUUID().slice(0, 8);
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = (req.headers['x-request-id'] as string) || generateRequestId();
  (req as any).requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const requestId = (req as any).requestId || 'unknown';

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const contentLength = res.get('Content-Length') || 0;
    
    let sanitizedUrl = req.originalUrl;
    if (sanitizedUrl.includes('token=')) {
      sanitizedUrl = sanitizedUrl.replace(/([?&]token=)[^&]+/, '$1[REDACTED]');
    }
    
    const logData = {
      requestId,
      method: req.method,
      path: sanitizedUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength,
      userId: (req as any).user?.id,
      userAgent: req.get('User-Agent')?.slice(0, 50)
    };
    
    if (res.statusCode >= 500) {
      logger.error('Request failed', logData);
    } else if (res.statusCode >= 400) {
      logger.warn('Request error', logData);
    } else {
      logger.info('Request completed', logData);
    }
  });

  next();
}

export function createChildLogger(requestId: string) {
  return logger.child({ requestId });
}

export default logger;
