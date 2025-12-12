import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { systemSettings } from "@shared/schema";
import { eq } from "drizzle-orm";
import logger from "./logger";

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    agencyId: string;
    email: string;
    role: string;
    isSuperAdmin?: boolean;
  };
}

interface MaintenanceState {
  enabled: boolean;
  message: string;
  enabledAt?: string;
  lastCheck: number;
}

const CACHE_TTL_MS = 10000;

let maintenanceCache: MaintenanceState = {
  enabled: false,
  message: "System is under maintenance. Please try again later.",
  lastCheck: 0,
};

async function getMaintenanceState(): Promise<MaintenanceState> {
  const now = Date.now();
  
  if (now - maintenanceCache.lastCheck < CACHE_TTL_MS) {
    return maintenanceCache;
  }
  
  try {
    const [setting] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, "maintenance_mode"));
    
    if (!setting) {
      maintenanceCache = {
        enabled: false,
        message: "System is under maintenance. Please try again later.",
        lastCheck: now,
      };
      return maintenanceCache;
    }
    
    const value = setting.value as {
      enabled?: boolean;
      message?: string;
      enabledAt?: string;
    };
    
    maintenanceCache = {
      enabled: value.enabled || false,
      message: value.message || "System is under maintenance. Please try again later.",
      enabledAt: value.enabledAt,
      lastCheck: now,
    };
    
    return maintenanceCache;
  } catch (error) {
    logger.error("[Maintenance] Failed to check maintenance status:", error);
    return maintenanceCache;
  }
}

export function clearMaintenanceCache(): void {
  maintenanceCache.lastCheck = 0;
}

export async function maintenanceMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const state = await getMaintenanceState();
  
  if (!state.enabled) {
    return next();
  }
  
  if (req.user?.isSuperAdmin) {
    return next();
  }
  
  const allowedPaths = [
    "/api/auth/login",
    "/api/auth/session",
    "/api/auth/logout",
  ];
  
  if (allowedPaths.some(path => req.path.startsWith(path))) {
    return next();
  }
  
  logger.info(`[Maintenance] Blocked request from ${req.user?.email || "anonymous"} to ${req.path}`);
  
  res.status(503).json({
    error: "maintenance_mode",
    message: state.message,
    retryAfter: 300,
  });
}

export function isMaintenanceModeEnabled(): boolean {
  return maintenanceCache.enabled;
}
