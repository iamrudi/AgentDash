import { Router, Response } from "express";
import { requireAuth, AuthRequest, requireRole, getAuthUserFromToken } from "../middleware/supabase-auth";
import { realtimeService } from "./realtime-service";
import logger from "../middleware/logger";

const router = Router();

interface SSEUser {
  id: string;
  email: string;
  role: string;
  agencyId: string | null;
  clientId: string | null;
  isSuperAdmin: boolean;
}

async function authenticateSSE(token: string): Promise<SSEUser | null> {
  const user = await getAuthUserFromToken(token);
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    agencyId: user.agencyId ?? null,
    clientId: user.clientId ?? null,
    isSuperAdmin: user.isSuperAdmin ?? false,
  };
}

function canAccessChannel(user: SSEUser, channel: string): boolean {
  const parts = channel.split(":");
  const type = parts[0];

  switch (type) {
    case "agency":
      return user.isSuperAdmin || user.agencyId === parts[1];
    case "project":
      if (parts.length < 3) return false;
      const projectAgencyId = parts[1];
      return user.isSuperAdmin || user.agencyId === projectAgencyId;
    case "task":
      if (parts.length < 3) return false;
      const taskAgencyId = parts[1];
      return user.isSuperAdmin || user.agencyId === taskAgencyId;
    case "user":
      return user.id === parts[1] || user.isSuperAdmin;
    default:
      return false;
  }
}

router.get("/stream", async (req, res: Response) => {
  const token = req.query.token as string;
  
  if (!token) {
    return res.status(401).json({ message: "Authentication token required" });
  }

  let user: SSEUser | null = null;
  try {
    user = await authenticateSSE(token);
  } catch (error) {
    logger.error("[SSE] Authentication error:", error);
  }

  if (!user) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  const lastEventId = req.headers["last-event-id"] as string | undefined;
  const requestedChannels = req.query.channels 
    ? (req.query.channels as string).split(",") 
    : [];

  const authorizedChannels = requestedChannels.filter(channel => 
    canAccessChannel(user, channel)
  );

  try {
    const clientId = realtimeService.registerSSEClient(
      res,
      user.id,
      user.agencyId,
      authorizedChannels,
      lastEventId || null
    );

    req.on("close", () => {
      logger.info(`[SSE Route] Connection closed for client: ${clientId}`);
    });

  } catch (error: any) {
    logger.error("[SSE Route] Failed to register client:", error);
    res.status(500).json({ message: "Failed to establish SSE connection" });
  }
});

router.get("/presence", requireAuth, async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user!.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency ID required" });
    }

    const presence = realtimeService.getPresence(agencyId);
    res.json(presence);
  } catch (error: any) {
    logger.error("[Realtime Route] Failed to get presence:", error);
    res.status(500).json({ message: error.message });
  }
});

router.get("/online-users", requireAuth, async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user!.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency ID required" });
    }

    const users = realtimeService.getOnlineUsers(agencyId);
    res.json({ users });
  } catch (error: any) {
    logger.error("[Realtime Route] Failed to get online users:", error);
    res.status(500).json({ message: error.message });
  }
});

router.get("/stats", requireAuth, requireRole("SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const stats = realtimeService.getConnectionStats();
    res.json(stats);
  } catch (error: any) {
    logger.error("[Realtime Route] Failed to get stats:", error);
    res.status(500).json({ message: error.message });
  }
});

router.get("/health", async (req, res) => {
  try {
    const isHealthy = realtimeService.isHealthy();
    const metrics = realtimeService.getDetailedMetrics();
    
    const statusCode = metrics.overall.status === "unhealthy" ? 503 : 200;
    
    res.status(statusCode).json({
      status: metrics.overall.status,
      healthy: isHealthy,
      uptime: metrics.websocket.uptime,
    });
  } catch (error: any) {
    logger.error("[Realtime Route] Failed to get health:", error);
    res.status(503).json({ status: "unhealthy", healthy: false });
  }
});

router.get("/metrics", requireAuth, requireRole("SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const metrics = realtimeService.getDetailedMetrics();
    res.json(metrics);
  } catch (error: any) {
    logger.error("[Realtime Route] Failed to get metrics:", error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
