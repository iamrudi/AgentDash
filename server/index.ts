import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import path from "path";
import fs from "fs";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { InvoiceScheduler } from "./services/invoiceScheduler";
import { TrashCleanupScheduler } from "./services/trashCleanupScheduler";
import { storage } from "./storage";
import { requestIdMiddleware } from "./middleware/requestId";
import { requestLogger } from "./middleware/logger";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { generalLimiter } from "./middleware/rateLimiter";
import { runtimeSettings } from "./config/runtimeSettings";
import { metricsMiddleware, metricsHandler } from "./middleware/metrics";
import { swaggerSpec } from "./config/swagger";
import { features } from "./config/features";
import { env } from "./env";

// Ensure uploads directory exists for branding logos
const uploadsDir = path.join(process.cwd(), 'uploads', 'logos');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads/logos directory for branding');
}

const app = express();

// Trust proxy for correct client IP detection (Replit, load balancers, etc.)
app.set('trust proxy', 1);

// Security: Helmet for secure HTTP headers
app.use(helmet({
  contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false,
}));

// Simple CORS configuration - Allow all origins
app.use(cors({
  origin: true, // Allow all origins
  credentials: true, // Allow cookies and authentication headers
  optionsSuccessStatus: 200
}));

// Request ID for tracing
app.use(requestIdMiddleware);

// Metrics collection
app.use(metricsMiddleware);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve static files from /uploads directory (for branding logos)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Request logging (after body parsing)
app.use(requestLogger);

// Apply rate limiting conditionally
app.use((req, res, next) => {
  if (runtimeSettings.isRateLimiterEnabled) {
    return generalLimiter(req, res, next);
  }
  next();
});

// Disable HTTP caching for all API routes to prevent 304 responses
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// Legacy logging (can be removed once Winston is fully adopted)
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Health check endpoint (before auth)
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env.NODE_ENV,
    features: {
      maintenance: features.maintenanceMode,
      ai: features.aiRecommendations,
      analytics: features.googleAnalytics,
    },
  });
});

// Metrics endpoint (Prometheus format)
app.get('/metrics', metricsHandler);

// API Documentation (Swagger UI)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Agency Portal API Documentation',
}));

(async () => {
  const server = await registerRoutes(app);

  // Start invoice scheduler for automated monthly invoicing
  if (features.autoInvoicing) {
    const invoiceScheduler = new InvoiceScheduler(storage);
    invoiceScheduler.start();
    log('✅ Invoice scheduler started');
  }

  // Start trash cleanup scheduler for automatic deletion after 30 days
  if (features.trashCleanup) {
    const trashCleanupScheduler = new TrashCleanupScheduler(storage);
    trashCleanupScheduler.start();
    log('✅ Trash cleanup scheduler started');
  }

  // Start orphan user cleanup scheduler for detecting and removing orphaned auth users
  const { scheduleOrphanCleanup } = await import("./jobs/orphan-cleanup");
  scheduleOrphanCleanup();
  log('✅ Orphan user cleanup scheduler started (runs nightly at 2:00 AM)');

  // Serve frontend (must be after API routes but before 404 handler)
  // This catch-all serves index.html for all non-API GET requests
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // 404 handler for unmatched routes (after frontend serving)
  app.use(notFoundHandler);

  // Error handling middleware (must be last)
  app.use(errorHandler);

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(env.PORT, 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`🚀 Server running on port ${port}`);
    log(`📚 API docs available at http://localhost:${port}/api-docs`);
    log(`📊 Metrics available at http://localhost:${port}/metrics`);
    log(`🏥 Health check at http://localhost:${port}/health`);
    
    if (features.maintenanceMode) {
      log('⚠️  Maintenance mode is ENABLED');
    }
  });
})();
