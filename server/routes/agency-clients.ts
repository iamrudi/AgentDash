import { Router } from "express";
import { storage } from "../storage";
import {
  requireAuth,
  requireRole,
  requireClientAccess,
  type AuthRequest
} from "../middleware/supabase-auth";
import { refreshAccessToken, fetchGA4Data, fetchGA4AcquisitionChannels, fetchGA4KeyEvents, fetchGSCData, fetchGSCTopQueries } from "../lib/googleOAuth";
import { hardenedAIExecutor } from "../ai/hardened-executor";
import { cache, CACHE_TTL } from "../lib/cache";
import { emitClientRecordUpdatedSignal } from "../clients/client-record-signal";
import { getRequestContext } from "../middleware/request-context";
import { SyncMetricsService } from "../application/agency-clients/sync-metrics-service";
import { StrategyCardService } from "../application/agency-clients/strategy-card-service";
import { DashboardSummaryService } from "../application/agency-clients/dashboard-summary-service";
import { RecommendationRequestService } from "../application/agency-clients/recommendation-request-service";
import { ClientConnectionStatusService } from "../application/agency-clients/client-connection-status-service";
import { AnalyticsGa4ReadService } from "../application/analytics/analytics-ga4-read-service";
import { AnalyticsGscReadService } from "../application/analytics/analytics-gsc-read-service";
import { OutcomeMetricsService } from "../application/analytics/outcome-metrics-service";

export const agencyClientsRouter = Router();
export const clientsRouter = Router();
const syncMetricsService = new SyncMetricsService(storage, {
  fetchGA4Data,
  fetchGA4KeyEvents,
  fetchGSCData,
});
const strategyCardService = new StrategyCardService(storage, hardenedAIExecutor);
const ga4ReadService = new AnalyticsGa4ReadService(storage, {
  refreshAccessToken,
  fetchGA4Data,
  fetchGA4AcquisitionChannels,
  fetchGA4KeyEvents,
});
const gscReadService = new AnalyticsGscReadService(storage, {
  refreshAccessToken,
  fetchGSCData,
  fetchGSCTopQueries,
});
const outcomeMetricsService = new OutcomeMetricsService(storage, {
  refreshAccessToken,
  fetchGA4KeyEvents,
  fetchGSCData,
});
const dashboardSummaryService = new DashboardSummaryService(
  ga4ReadService,
  gscReadService,
  outcomeMetricsService,
  cache,
  CACHE_TTL.ONE_HOUR
);
const recommendationRequestService = new RecommendationRequestService(storage, emitClientRecordUpdatedSignal);
const clientConnectionStatusService = new ClientConnectionStatusService(storage);

export function createSyncMetricsHandler(service: SyncMetricsService = syncMetricsService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.syncClientMetrics(req.params.clientId, req.body?.daysToFetch);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Sync metrics error:", error);
      return res.status(500).json({ message: error.message || "Failed to sync metrics" });
    }
  };
}

agencyClientsRouter.post(
  "/:clientId/sync-metrics",
  requireAuth,
  requireRole("Admin"),
  requireClientAccess(storage),
  createSyncMetricsHandler()
);

export function createRecommendationRequestHandler(
  service: RecommendationRequestService = recommendationRequestService
) {
  return async (req: AuthRequest, res: any) => {
    try {
      const ctx = getRequestContext(req);
      const result = await service.requestRecommendations(ctx, req.params.clientId, req.body);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

agencyClientsRouter.post(
  "/:clientId/generate-recommendations",
  requireAuth,
  requireRole("Admin"),
  requireClientAccess(storage),
  createRecommendationRequestHandler()
);

export function createStrategyCardHandler(service: StrategyCardService = strategyCardService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.getStrategyCard(req.params.clientId);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Strategy Card endpoint error:", error);
      return res.status(500).json({ message: error.message || "Failed to generate strategy card data" });
    }
  };
}

agencyClientsRouter.get(
  "/:clientId/strategy-card",
  requireAuth,
  requireRole("Admin"),
  requireClientAccess(storage),
  createStrategyCardHandler()
);

export function createDashboardSummaryHandler(service: DashboardSummaryService = dashboardSummaryService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.getDashboardSummary({
        userId: req.user!.id,
        clientId: req.params.clientId,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      });
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Dashboard summary error:", error);
      return res.status(500).json({ message: error.message || "Failed to fetch dashboard summary" });
    }
  };
}

agencyClientsRouter.get(
  "/:clientId/dashboard-summary",
  requireAuth,
  requireRole("Client", "Admin"),
  requireClientAccess(storage),
  createDashboardSummaryHandler()
);

export function createClientConnectionStatusHandler(
  service: ClientConnectionStatusService = clientConnectionStatusService
) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.getConnectionStatus({
        clientId: req.params.clientId,
        agencyId: req.user?.agencyId,
      });
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

clientsRouter.get(
  "/:clientId/connection-status",
  requireAuth,
  requireClientAccess(storage),
  createClientConnectionStatusHandler()
);

export default agencyClientsRouter;
