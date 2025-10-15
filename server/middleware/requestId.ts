import { type Request, type Response, type NextFunction } from 'express';
import { nanoid } from 'nanoid';

// Extend Express Request to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

/**
 * Request ID middleware
 * Adds a unique request ID to each request for tracing through logs
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  // Check for existing request ID from client or load balancer
  req.requestId = (req.headers['x-request-id'] as string) || nanoid(12);
  
  // Set response header for client tracking
  res.setHeader('X-Request-ID', req.requestId);
  
  next();
}
