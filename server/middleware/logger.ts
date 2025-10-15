import winston from 'winston';
import { mkdirSync } from 'fs';
import type { Request, Response, NextFunction } from 'express';

// Ensure logs directory exists
try {
  mkdirSync('logs', { recursive: true });
} catch (err) {
  // Directory already exists or cannot be created
}

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack, requestId }) => {
  const reqId = requestId ? `[${requestId}] ` : '';
  return `${timestamp} ${reqId}[${level}]: ${stack || message}`;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
      )
    }),
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log' 
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: combine(
      colorize(),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      logFormat
    )
  }));
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const requestId = (req as any).requestId || 'unknown';

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const contentLength = res.get('Content-Length') || 0;
    
    // Mask sensitive token parameters to prevent logging
    let sanitizedUrl = req.originalUrl;
    if (sanitizedUrl.includes('token=')) {
      sanitizedUrl = sanitizedUrl.replace(/([?&]token=)[^&]+/, '$1[REDACTED]');
    }
    
    const logMessage = `${req.method} ${sanitizedUrl} ${res.statusCode} - ${duration}ms - ${contentLength} bytes`;
    
    const logContext = { requestId };
    
    if (res.statusCode >= 500) {
      logger.error(logMessage, logContext);
    } else if (res.statusCode >= 400) {
      logger.warn(logMessage, logContext);
    } else {
      logger.info(logMessage, logContext);
    }
  });

  next();
}

export default logger;
