import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
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

const app = express();

// Trust proxy for correct client IP detection (Replit, load balancers, etc.)
app.set('trust proxy', 1);

// Security: Helmet for secure HTTP headers
app.use(helmet({
  contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false,
}));

// =================================================================
// CORS Configuration - Dynamic Whitelist for Public API Endpoints
// =================================================================

// Build list of allowed same-origin hostnames
function getAllowedSameOriginHosts(): Set<string> {
  const hosts = new Set<string>();
  
  // Add localhost
  hosts.add(`localhost:${env.PORT}`);
  
  // Add VITE_PUBLIC_URL if set
  if (process.env.VITE_PUBLIC_URL) {
    try {
      const url = new URL(process.env.VITE_PUBLIC_URL);
      hosts.add(url.host); // includes hostname:port
    } catch (e) {
      console.warn('[CORS] Invalid VITE_PUBLIC_URL:', process.env.VITE_PUBLIC_URL);
    }
  }
  
  // Add REPLIT_DOMAINS (comma-separated list)
  if (process.env.REPLIT_DOMAINS) {
    const replitDomains = process.env.REPLIT_DOMAINS.split(',').map(d => d.trim());
    replitDomains.forEach(domain => {
      if (domain) {
        hosts.add(domain);
      }
    });
  }
  
  return hosts;
}

// Load CORS domains from database (async)
async function loadCorsDomainsFromDB(): Promise<string[]> {
  try {
    const { eq } = await import('drizzle-orm');
    const { systemSettings } = await import('../shared/schema');
    const { db } = await import('./db');
    
    const setting = await db.query.systemSettings.findFirst({
      where: eq(systemSettings.key, 'cors_allowed_origins'),
    });
    
    if (setting && setting.value) {
      const domains = setting.value as { domains: string[] };
      return domains.domains || [];
    }
  } catch (error) {
    console.warn('[CORS] Failed to load domains from database:', error);
  }
  return [];
}

const allowedSameOriginHosts = getAllowedSameOriginHosts();
let dbCorsDomains: string[] = [];

// Load DB CORS domains asynchronously
loadCorsDomainsFromDB().then(domains => {
  dbCorsDomains = domains;
  console.log(`[CORS] Loaded ${domains.length} domain(s) from database:`, domains);
});

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g., mobile apps, curl, Postman)
    if (!origin) {
      return callback(null, true);
    }

    // Parse origin URL for secure comparison
    let originUrl: URL;
    try {
      originUrl = new URL(origin);
    } catch (e) {
      console.warn(`[CORS] Invalid origin format: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    }

    // Check if origin is same-origin (strict hostname:port comparison)
    if (allowedSameOriginHosts.has(originUrl.host)) {
      return callback(null, true);
    }

    // Check if the origin is in our whitelist from environment variable or database
    if (env.CORS_ALLOWED_ORIGINS.includes(origin) || dbCorsDomains.includes(origin)) {
      callback(null, true);
    } else {
      // Log rejected origins for debugging
      console.warn(`[CORS] Blocked request from unauthorized origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow cookies and authentication headers
  optionsSuccessStatus: 200, // Some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.use(cors(corsOptions));
// =================================================================

// Request ID for tracing
app.use(requestIdMiddleware);

// Metrics collection
app.use(metricsMiddleware);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Request logging (after body parsing)
app.use(requestLogger);

// Apply rate limiting conditionally
app.use((req, res, next) => {
  if (runtimeSettings.isRateLimiterEnabled) {
    return generalLimiter(req, res, next);
  }
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
