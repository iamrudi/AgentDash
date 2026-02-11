import { Router } from 'express';
import { requireAuth, requireRole, requireClientAccess, type AuthRequest } from '../middleware/supabase-auth';
import { storage } from '../storage';
import { refreshAccessToken, fetchGA4Data, fetchGA4AcquisitionChannels, fetchGA4KeyEvents, fetchGSCData, fetchGSCTopQueries } from '../lib/googleOAuth';
import { analyticsRouter as anomalyAnalyticsRouter } from "../analytics/analytics-routes";
import { OutcomeMetricsService } from "../application/analytics/outcome-metrics-service";
import { AnalyticsGa4ReadService } from "../application/analytics/analytics-ga4-read-service";
import { AnalyticsGscReadService } from "../application/analytics/analytics-gsc-read-service";

const router = Router();
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

router.use(anomalyAnalyticsRouter);

export function createGa4ConversionsHandler(service: AnalyticsGa4ReadService = ga4ReadService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.getConversions({
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
      console.error("Fetch GA4 conversions error:", error);
      const message = error.userMessage || error.message || "Failed to fetch GA4 conversions";
      return res.status(500).json({ message });
    }
  };
}

router.get(
  "/ga4/:clientId/conversions",
  requireAuth,
  requireRole("Client", "Admin"),
  requireClientAccess(storage),
  createGa4ConversionsHandler()
);

export function createGa4ChannelsHandler(service: AnalyticsGa4ReadService = ga4ReadService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.getChannels({
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
      console.error("Fetch GA4 acquisition channels error:", error);
      return res.status(500).json({ message: error.message || "Failed to fetch GA4 acquisition channels" });
    }
  };
}

router.get(
  "/ga4/:clientId/channels",
  requireAuth,
  requireRole("Client", "Admin"),
  requireClientAccess(storage),
  createGa4ChannelsHandler()
);

export function createGa4AnalyticsHandler(service: AnalyticsGa4ReadService = ga4ReadService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.getAnalytics({
        clientId: req.params.clientId,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      });
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Fetch GA4 analytics error:", error);
      return res.status(500).json({ message: error.message || "Failed to fetch GA4 analytics" });
    }
  };
}

router.get(
  "/ga4/:clientId",
  requireAuth,
  requireRole("Client", "Admin"),
  requireClientAccess(storage),
  createGa4AnalyticsHandler()
);

export function createGscQueriesHandler(service: AnalyticsGscReadService = gscReadService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.getQueries({
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
      console.error("Fetch GSC top queries error:", error);
      return res.status(500).json({ message: error.message || "Failed to fetch top queries" });
    }
  };
}

router.get(
  "/gsc/:clientId/queries",
  requireAuth,
  requireRole("Client", "Admin"),
  requireClientAccess(storage),
  createGscQueriesHandler()
);

export function createGscAnalyticsHandler(service: AnalyticsGscReadService = gscReadService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.getAnalytics({
        clientId: req.params.clientId,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      });
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Fetch GSC analytics error:", error);
      return res.status(500).json({ message: error.message || "Failed to fetch Search Console analytics" });
    }
  };
}

router.get(
  "/gsc/:clientId",
  requireAuth,
  requireRole("Client", "Admin"),
  requireClientAccess(storage),
  createGscAnalyticsHandler()
);

export function createOutcomeMetricsHandler(service: OutcomeMetricsService = outcomeMetricsService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.getOutcomeMetrics({
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
      console.error("Fetch outcome metrics error:", error);
      return res.status(500).json({ message: error.message || "Failed to fetch outcome metrics" });
    }
  };
}

router.get(
  "/outcome-metrics/:clientId",
  requireAuth,
  requireRole("Client", "Admin"),
  requireClientAccess(storage),
  createOutcomeMetricsHandler()
);

export default router;
