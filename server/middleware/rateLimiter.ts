import rateLimit from 'express-rate-limit';
import type { Response } from 'express';

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res: Response) => {
    res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later.',
      retryAfter: 900
    });
  }
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login/signup requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  skipSuccessfulRequests: true,
  handler: (_req, res: Response) => {
    res.status(429).json({
      success: false,
      message: 'Too many authentication attempts. Please try again in 15 minutes.',
      retryAfter: 900
    });
  }
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // Limit each IP to 60 requests per minute for API routes
  message: 'API rate limit exceeded',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res: Response) => {
    res.status(429).json({
      success: false,
      message: 'API rate limit exceeded. Please slow down.',
      retryAfter: 60
    });
  }
});

export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit AI requests to 20 per hour per IP
  message: 'AI request limit exceeded',
  handler: (_req, res: Response) => {
    res.status(429).json({
      success: false,
      message: 'AI request limit exceeded. Please try again later.',
      retryAfter: 3600
    });
  }
});
