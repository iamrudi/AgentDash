import { type Request, type Response } from 'express';
import promClient from 'prom-client';

// Create a Registry to register metrics
const register = new promClient.Registry();

// Add default metrics (CPU, memory, event loop lag)
promClient.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

const httpRequestTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const httpRequestErrors = new promClient.Counter({
  name: 'http_request_errors_total',
  help: 'Total number of HTTP request errors',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const activeConnections = new promClient.Gauge({
  name: 'http_active_connections',
  help: 'Number of active HTTP connections',
  registers: [register],
});

const aiRequestDuration = new promClient.Histogram({
  name: 'ai_request_duration_seconds',
  help: 'Duration of AI requests in seconds',
  labelNames: ['model', 'operation'],
  buckets: [0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

const aiRequestTotal = new promClient.Counter({
  name: 'ai_requests_total',
  help: 'Total number of AI requests',
  labelNames: ['model', 'operation', 'status'],
  registers: [register],
});

// Metrics middleware
export function metricsMiddleware(req: Request, res: Response, next: Function) {
  const start = Date.now();
  activeConnections.inc();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    const statusCode = res.statusCode.toString();

    httpRequestDuration.observe(
      { method: req.method, route, status_code: statusCode },
      duration
    );

    httpRequestTotal.inc({
      method: req.method,
      route,
      status_code: statusCode,
    });

    if (res.statusCode >= 400) {
      httpRequestErrors.inc({
        method: req.method,
        route,
        status_code: statusCode,
      });
    }

    activeConnections.dec();
  });

  next();
}

// Metrics endpoint handler
export async function metricsHandler(_req: Request, res: Response) {
  res.setHeader('Content-Type', register.contentType);
  const metrics = await register.metrics();
  res.send(metrics);
}

// Export individual metrics for use in application code
export const metrics = {
  httpRequestDuration,
  httpRequestTotal,
  httpRequestErrors,
  activeConnections,
  aiRequestDuration,
  aiRequestTotal,
};
