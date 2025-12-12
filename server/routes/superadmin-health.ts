import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { systemSettings } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { cronHeartbeat } from "../services/cronHeartbeat";
import { realtimeService } from "../realtime/realtime-service";
import { clearMaintenanceCache } from "../middleware/maintenance";
import logger from "../middleware/logger";
import { z } from "zod";

const router = Router();

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    agencyId: string;
    email: string;
    role: string;
    isSuperAdmin?: boolean;
  };
}

function requireSuperAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.user?.isSuperAdmin) {
    return res.status(403).json({ error: "SuperAdmin access required" });
  }
  next();
}

interface HealthCheck {
  name: string;
  status: "healthy" | "degraded" | "unhealthy";
  latency?: number;
  details?: Record<string, unknown>;
  error?: string;
}

async function checkDatabaseHealth(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const result = await db.execute(sql`SELECT 1 as health_check, current_setting('server_version') as version`);
    const latency = Date.now() - start;
    const row = result[0] as { health_check?: number; version?: string } | undefined;
    return {
      name: "database",
      status: latency < 100 ? "healthy" : "degraded",
      latency,
      details: {
        connected: true,
        version: row?.version || "unknown",
      },
    };
  } catch (error: any) {
    return {
      name: "database",
      status: "unhealthy",
      latency: Date.now() - start,
      error: error.message,
    };
  }
}

async function checkRlsSanity(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const result = await db.execute(sql`
      SELECT COUNT(*) as violation_count
      FROM projects p
      INNER JOIN clients c ON p.client_id = c.id
      WHERE p.agency_id IS NOT NULL 
        AND c.agency_id IS NOT NULL 
        AND p.agency_id != c.agency_id
    `);
    
    const row = result[0] as { violation_count?: string | number } | undefined;
    const count = Number(row?.violation_count || 0);
    const latency = Date.now() - start;
    
    return {
      name: "rls_sanity",
      status: count === 0 ? "healthy" : "unhealthy",
      latency,
      details: {
        crossTenantViolations: count,
        checked: "projects with client from different agency",
      },
      error: count > 0 ? `Found ${count} cross-tenant violations` : undefined,
    };
  } catch (error: any) {
    return {
      name: "rls_sanity",
      status: "degraded",
      latency: Date.now() - start,
      error: error.message,
      details: {
        note: "RLS check failed - may indicate schema issue"
      }
    };
  }
}

function checkCronHealth(): HealthCheck {
  const health = cronHeartbeat.getHealth();
  
  let status: "healthy" | "degraded" | "unhealthy" = "healthy";
  if (health.summary.errors > 0) {
    status = "unhealthy";
  } else if (health.summary.neverRun > 0 && health.uptime > 600) {
    status = "degraded";
  }
  
  return {
    name: "cron_jobs",
    status,
    details: {
      uptime: health.uptime,
      summary: health.summary,
      jobs: health.jobs.map(j => ({
        name: j.name,
        schedule: j.schedule,
        lastRun: j.lastRun,
        status: j.lastStatus,
        runCount: j.runCount,
        lastError: j.lastError,
      })),
    },
  };
}

function checkRealtimeHealth(): HealthCheck {
  try {
    const metrics = realtimeService.getDetailedMetrics();
    const healthy = realtimeService.isHealthy();
    
    return {
      name: "realtime",
      status: healthy ? "healthy" : "degraded",
      details: {
        status: metrics.overall.status,
        totalClients: metrics.overall.totalClients,
        websocket: {
          clients: metrics.websocket.connections.current,
        },
        sse: metrics.sse,
      },
    };
  } catch (error: any) {
    return {
      name: "realtime",
      status: "unhealthy",
      error: error.message,
    };
  }
}

async function checkAiProviderHealth(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasGemini = !!process.env.GEMINI_API_KEY;
    
    const latency = Date.now() - start;
    
    return {
      name: "ai_providers",
      status: (hasOpenAI || hasGemini) ? "healthy" : "degraded",
      latency,
      details: {
        openai: hasOpenAI ? "configured" : "not_configured",
        gemini: hasGemini ? "configured" : "not_configured",
        note: "Full ping tests disabled for performance",
      },
    };
  } catch (error: any) {
    return {
      name: "ai_providers",
      status: "unhealthy",
      latency: Date.now() - start,
      error: error.message,
    };
  }
}

async function getMaintenanceStatus(): Promise<{
  enabled: boolean;
  message?: string;
  enabledAt?: Date;
  enabledBy?: string;
}> {
  try {
    const [setting] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, "maintenance_mode"));
    
    if (!setting) {
      return { enabled: false };
    }
    
    const value = setting.value as {
      enabled?: boolean;
      message?: string;
      enabledAt?: string;
      enabledBy?: string;
    };
    
    return {
      enabled: value.enabled || false,
      message: value.message,
      enabledAt: value.enabledAt ? new Date(value.enabledAt) : undefined,
      enabledBy: value.enabledBy,
    };
  } catch {
    return { enabled: false };
  }
}

router.get(
  "/health",
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const startTime = Date.now();
      
      const [
        dbHealth,
        rlsHealth,
        aiHealth,
      ] = await Promise.all([
        checkDatabaseHealth(),
        checkRlsSanity(),
        checkAiProviderHealth(),
      ]);
      
      const cronHealth = checkCronHealth();
      const realtimeHealth = checkRealtimeHealth();
      const maintenanceStatus = await getMaintenanceStatus();
      
      const checks: HealthCheck[] = [
        dbHealth,
        rlsHealth,
        cronHealth,
        realtimeHealth,
        aiHealth,
      ];
      
      const unhealthyCount = checks.filter(c => c.status === "unhealthy").length;
      const degradedCount = checks.filter(c => c.status === "degraded").length;
      
      let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy";
      if (unhealthyCount > 0) {
        overallStatus = "unhealthy";
      } else if (degradedCount > 0) {
        overallStatus = "degraded";
      }
      
      res.json({
        status: overallStatus,
        timestamp: new Date().toISOString(),
        totalLatency: Date.now() - startTime,
        maintenance: maintenanceStatus,
        checks,
        summary: {
          healthy: checks.filter(c => c.status === "healthy").length,
          degraded: degradedCount,
          unhealthy: unhealthyCount,
        },
      });
    } catch (error: any) {
      logger.error("[SuperAdmin Health] Health check failed:", error);
      res.status(500).json({
        status: "unhealthy",
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

const maintenanceToggleSchema = z.object({
  enabled: z.boolean(),
  message: z.string().max(500).optional(),
  reason: z.string().max(500).optional(),
});

router.post(
  "/maintenance",
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validation = maintenanceToggleSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: validation.error.message });
      }
      
      const { enabled, message, reason } = validation.data;
      const userId = req.user!.id;
      
      const existingSetting = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, "maintenance_mode"));
      
      const previousValue = existingSetting[0]?.value || { enabled: false };
      
      const newValue = {
        enabled,
        message: message || "System is under maintenance. Please try again later.",
        enabledAt: enabled ? new Date().toISOString() : null,
        enabledBy: enabled ? userId : null,
      };
      
      if (existingSetting.length === 0) {
        await db.insert(systemSettings).values({
          key: "maintenance_mode",
          value: newValue,
          description: "Platform maintenance mode toggle",
          updatedBy: userId,
        });
      } else {
        await db
          .update(systemSettings)
          .set({
            value: newValue,
            updatedBy: userId,
            updatedAt: new Date(),
          })
          .where(eq(systemSettings.key, "maintenance_mode"));
      }
      
      clearMaintenanceCache();
      
      logger.info(`[SuperAdmin] Maintenance mode ${enabled ? "enabled" : "disabled"} by ${req.user!.email}${reason ? ` - Reason: ${reason}` : ""}`);
      
      res.json({
        success: true,
        maintenance: {
          enabled,
          message: newValue.message,
          enabledAt: newValue.enabledAt,
        },
        previousState: previousValue,
      });
    } catch (error: any) {
      logger.error("[SuperAdmin] Maintenance toggle failed:", error);
      res.status(500).json({ error: "Failed to toggle maintenance mode" });
    }
  }
);

router.get(
  "/maintenance",
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const status = await getMaintenanceStatus();
      res.json(status);
    } catch (error: any) {
      logger.error("[SuperAdmin] Failed to get maintenance status:", error);
      res.status(500).json({ error: "Failed to get maintenance status" });
    }
  }
);

export default router;
