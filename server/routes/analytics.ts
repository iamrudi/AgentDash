import { Router } from 'express';
import { requireAuth, requireRole, requireClientAccess, type AuthRequest } from '../middleware/supabase-auth';
import { storage } from '../storage';
import { refreshAccessToken, fetchGA4Data, fetchGA4AcquisitionChannels, fetchGA4KeyEvents, fetchGSCData, fetchGSCTopQueries } from '../lib/googleOAuth';
import { analyticsRouter as anomalyAnalyticsRouter } from "../analytics/analytics-routes";

const router = Router();

router.use(anomalyAnalyticsRouter);

router.get("/ga4/:clientId/conversions", requireAuth, requireRole("Client", "Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;
    const { startDate, endDate } = req.query;
    const profile = await storage.getProfileByUserId(req.user!.id);
    
    if (profile!.role === "Client") {
      const client = await storage.getClientByProfileId(profile!.id);
      if (!client || client.id !== clientId) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    let integration = await storage.getIntegrationByClientId(clientId, 'GA4');
    
    if (!integration || !integration.ga4PropertyId) {
      return res.status(404).json({ message: "GA4 integration not configured" });
    }

    if (!integration.ga4LeadEventName) {
      return res.status(400).json({ message: "Lead event name not configured. Please configure it in the integrations page." });
    }

    if (integration.expiresAt && new Date(integration.expiresAt) < new Date()) {
      if (!integration.refreshToken) {
        return res.status(401).json({ message: "Token expired and no refresh token available" });
      }

      const newTokens = await refreshAccessToken(integration.refreshToken);
      if (!newTokens.success) {
        return res.status(401).json({ message: newTokens.error || "Token refresh failed" });
      }
      integration = await storage.updateIntegration(integration.id, {
        accessToken: newTokens.accessToken,
        expiresAt: newTokens.expiresAt,
      });
    }

    const end = endDate as string || new Date().toISOString().split('T')[0];
    const start = startDate as string || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    if (!integration.accessToken) {
      return res.status(401).json({ message: "Access token not available" });
    }

    const data = await fetchGA4KeyEvents(integration.accessToken, integration.ga4PropertyId!, integration.ga4LeadEventName!, start, end, clientId);
    res.json(data);
  } catch (error: any) {
    console.error("Fetch GA4 conversions error:", error);
    const message = error.userMessage || error.message || "Failed to fetch GA4 conversions";
    res.status(500).json({ message });
  }
});

router.get("/ga4/:clientId/channels", requireAuth, requireRole("Client", "Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;
    const { startDate, endDate } = req.query;
    const profile = await storage.getProfileByUserId(req.user!.id);
    
    if (profile!.role === "Client") {
      const client = await storage.getClientByProfileId(profile!.id);
      if (!client || client.id !== clientId) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    let integration = await storage.getIntegrationByClientId(clientId, 'GA4');
    
    if (!integration || !integration.ga4PropertyId) {
      return res.status(404).json({ message: "GA4 integration not configured" });
    }

    if (integration.expiresAt && new Date(integration.expiresAt) < new Date()) {
      if (!integration.refreshToken) {
        return res.status(401).json({ message: "Token expired and no refresh token available" });
      }

      const newTokens = await refreshAccessToken(integration.refreshToken);
      if (!newTokens.success) {
        return res.status(401).json({ message: newTokens.error || "Token refresh failed" });
      }
      integration = await storage.updateIntegration(integration.id, {
        accessToken: newTokens.accessToken,
        expiresAt: newTokens.expiresAt,
      });
    }

    const end = endDate as string || new Date().toISOString().split('T')[0];
    const start = startDate as string || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    if (!integration.accessToken) {
      return res.status(401).json({ message: "Access token not available" });
    }

    const data = await fetchGA4AcquisitionChannels(integration.accessToken, integration.ga4PropertyId!, start, end, clientId);
    res.json(data);
  } catch (error: any) {
    console.error("Fetch GA4 acquisition channels error:", error);
    res.status(500).json({ message: error.message || "Failed to fetch GA4 acquisition channels" });
  }
});

router.get("/ga4/:clientId", requireAuth, requireRole("Client", "Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;
    const { startDate, endDate } = req.query;

    let integration = await storage.getIntegrationByClientId(clientId, 'GA4');
    
    if (!integration || !integration.ga4PropertyId) {
      return res.status(404).json({ message: "GA4 integration not configured" });
    }

    if (integration.expiresAt && new Date(integration.expiresAt) < new Date()) {
      if (!integration.refreshToken) {
        return res.status(401).json({ message: "Token expired and no refresh token available" });
      }

      const newTokens = await refreshAccessToken(integration.refreshToken);
      if (!newTokens.success) {
        return res.status(401).json({ message: newTokens.error || "Token refresh failed" });
      }
      integration = await storage.updateIntegration(integration.id, {
        accessToken: newTokens.accessToken,
        expiresAt: newTokens.expiresAt,
      });
    }

    const end = endDate as string || new Date().toISOString().split('T')[0];
    const start = startDate as string || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    if (!integration.accessToken) {
      return res.status(401).json({ message: "Access token not available" });
    }

    const data = await fetchGA4Data(integration.accessToken, integration.ga4PropertyId!, start, end, clientId);
    
    const logData = {
      propertyId: integration.ga4PropertyId,
      dateRange: `${start} to ${end}`,
      rowCount: data.rowCount,
      totalRows: data.rows?.length || 0,
      hasTotals: !!data.totals,
      totalsLength: data.totals?.length || 0,
      totalMetrics: data.totals?.[0]?.metricValues?.map((m: any) => m.value) || [],
      sampleRow: data.rows?.[0]?.metricValues?.map((m: any) => m.value) || []
    };
    
    console.error('=== GA4 DATA RESPONSE ===', JSON.stringify(logData, null, 2));
    
    res.json(data);
  } catch (error: any) {
    console.error("Fetch GA4 analytics error:", error);
    res.status(500).json({ message: error.message || "Failed to fetch GA4 analytics" });
  }
});

router.get("/gsc/:clientId/queries", requireAuth, requireRole("Client", "Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;
    const { startDate, endDate } = req.query;
    const profile = await storage.getProfileByUserId(req.user!.id);
    
    if (profile!.role === "Client") {
      const client = await storage.getClientByProfileId(profile!.id);
      if (!client || client.id !== clientId) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    let integration = await storage.getIntegrationByClientId(clientId, 'GSC');
    
    if (!integration || !integration.gscSiteUrl) {
      return res.status(404).json({ message: "Search Console integration not configured" });
    }

    if (integration.expiresAt && new Date(integration.expiresAt) < new Date()) {
      if (!integration.refreshToken) {
        return res.status(401).json({ message: "Token expired and no refresh token available" });
      }

      const newTokens = await refreshAccessToken(integration.refreshToken);
      if (!newTokens.success) {
        return res.status(401).json({ message: newTokens.error || "Token refresh failed" });
      }
      integration = await storage.updateIntegration(integration.id, {
        accessToken: newTokens.accessToken,
        expiresAt: newTokens.expiresAt,
      });
    }

    const end = endDate as string || new Date().toISOString().split('T')[0];
    const start = startDate as string || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    if (!integration.accessToken) {
      return res.status(401).json({ message: "Access token not available" });
    }

    const data = await fetchGSCTopQueries(integration.accessToken, integration.gscSiteUrl!, start, end, clientId);
    console.log('=== GSC TOP QUERIES RESPONSE ===', JSON.stringify({
      siteUrl: integration.gscSiteUrl,
      dateRange: `${start} to ${end}`,
      rowCount: data.rows?.length || 0,
      sampleRow: data.rows?.[0] || null
    }, null, 2));
    res.json(data);
  } catch (error: any) {
    console.error("Fetch GSC top queries error:", error);
    res.status(500).json({ message: error.message || "Failed to fetch top queries" });
  }
});

router.get("/gsc/:clientId", requireAuth, requireRole("Client", "Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;
    const { startDate, endDate } = req.query;

    let integration = await storage.getIntegrationByClientId(clientId, 'GSC');
    
    if (!integration || !integration.gscSiteUrl) {
      return res.status(404).json({ message: "Search Console integration not configured" });
    }

    if (integration.expiresAt && new Date(integration.expiresAt) < new Date()) {
      if (!integration.refreshToken) {
        return res.status(401).json({ message: "Token expired and no refresh token available" });
      }

      const newTokens = await refreshAccessToken(integration.refreshToken);
      if (!newTokens.success) {
        return res.status(401).json({ message: newTokens.error || "Token refresh failed" });
      }
      integration = await storage.updateIntegration(integration.id, {
        accessToken: newTokens.accessToken,
        expiresAt: newTokens.expiresAt,
      });
    }

    const end = endDate as string || new Date().toISOString().split('T')[0];
    const start = startDate as string || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    if (!integration.accessToken) {
      return res.status(401).json({ message: "Access token not available" });
    }

    const data = await fetchGSCData(integration.accessToken, integration.gscSiteUrl!, start, end, clientId);
    res.json(data);
  } catch (error: any) {
    console.error("Fetch GSC analytics error:", error);
    res.status(500).json({ message: error.message || "Failed to fetch Search Console analytics" });
  }
});

router.get("/outcome-metrics/:clientId", requireAuth, requireRole("Client", "Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;
    const { startDate, endDate } = req.query;
    const profile = await storage.getProfileByUserId(req.user!.id);
    
    if (profile!.role === "Client") {
      const client = await storage.getClientByProfileId(profile!.id);
      if (!client || client.id !== clientId) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    const client = await storage.getClientById(clientId);
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    const end = endDate as string || new Date().toISOString().split('T')[0];
    const start = startDate as string || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const currentPeriodStart = new Date(start);
    const currentPeriodEnd = new Date(end);
    const periodLength = currentPeriodEnd.getTime() - currentPeriodStart.getTime();
    const comparisonPeriodEnd = new Date(currentPeriodStart.getTime() - 24 * 60 * 60 * 1000);
    const comparisonPeriodStart = new Date(comparisonPeriodEnd.getTime() - periodLength);
    const comparisonStart = comparisonPeriodStart.toISOString().split('T')[0];
    const comparisonEnd = comparisonPeriodEnd.toISOString().split('T')[0];

    let totalConversions = 0;
    let totalSpend = 0;
    let totalOrganicClicks = 0;
    let usedGA4Conversions = false;

    const ga4Integration = await storage.getIntegrationByClientId(clientId, 'GA4');
    if (ga4Integration && ga4Integration.ga4PropertyId && ga4Integration.accessToken && ga4Integration.ga4LeadEventName) {
      try {
        let integration = ga4Integration;
        if (integration.expiresAt && new Date(integration.expiresAt) < new Date()) {
          if (integration.refreshToken) {
            const newTokens = await refreshAccessToken(integration.refreshToken);
            if (newTokens.success) {
              integration = await storage.updateIntegration(integration.id, {
                accessToken: newTokens.accessToken,
                expiresAt: newTokens.expiresAt,
              });
            }
          }
        }

        if (!integration.accessToken) {
          throw new Error("Access token not available after refresh");
        }
        
        const keyEventsData = await fetchGA4KeyEvents(
          integration.accessToken, 
          integration.ga4PropertyId!, 
          integration.ga4LeadEventName!, 
          start, 
          end,
          clientId
        );
        
        totalConversions = keyEventsData.totalEventCount || 0;
        usedGA4Conversions = true;
        
        console.log(`GA4 Key Events data fetched successfully: ${totalConversions} conversions for event "${integration.ga4LeadEventName}"`);
      } catch (error) {
        console.error("Error fetching GA4 Key Events data:", error);
      }
    }

    if (!usedGA4Conversions) {
      const dailyMetrics = await storage.getMetricsByClientId(clientId);
      if (dailyMetrics && dailyMetrics.length > 0) {
        const startTimestamp = new Date(start).getTime();
        const endTimestamp = new Date(end).getTime();
        const filteredMetrics = dailyMetrics.filter((metric: any) => {
          const metricTimestamp = new Date(metric.date).getTime();
          return metricTimestamp >= startTimestamp && metricTimestamp <= endTimestamp;
        });
        totalConversions = filteredMetrics.reduce((sum: number, metric: any) => sum + (metric.conversions || 0), 0);
        console.log(`Using dailyMetrics fallback: ${totalConversions} conversions`);
      }
    }

    const dailyMetrics = await storage.getMetricsByClientId(clientId);
    if (dailyMetrics && dailyMetrics.length > 0) {
      const startTimestamp = new Date(start).getTime();
      const endTimestamp = new Date(end).getTime();
      const filteredMetrics = dailyMetrics.filter((metric: any) => {
        const metricTimestamp = new Date(metric.date).getTime();
        return metricTimestamp >= startTimestamp && metricTimestamp <= endTimestamp;
      });
      totalSpend = filteredMetrics.reduce((sum: number, metric: any) => sum + parseFloat(metric.spend || '0'), 0);
    }

    const gscIntegration = await storage.getIntegrationByClientId(clientId, 'GSC');
    if (gscIntegration && gscIntegration.gscSiteUrl && gscIntegration.accessToken) {
      try {
        let integration = gscIntegration;
        if (integration.expiresAt && new Date(integration.expiresAt) < new Date()) {
          if (integration.refreshToken) {
            const newTokens = await refreshAccessToken(integration.refreshToken);
            if (newTokens.success) {
              integration = await storage.updateIntegration(integration.id, {
                accessToken: newTokens.accessToken,
                expiresAt: newTokens.expiresAt,
              });
            }
          }
        }

        if (integration.accessToken) {
          const gscData = await fetchGSCData(integration.accessToken, integration.gscSiteUrl!, start, end, clientId);
          totalOrganicClicks = gscData.rows?.reduce((sum: number, row: any) => sum + (row.clicks || 0), 0) || 0;
        }
      } catch (error) {
        console.error("Error fetching GSC data:", error);
      }
    }

    let estimatedPipelineValue = 0;
    const leadValue = parseFloat(client.leadValue || '0');
    
    if (leadValue > 0) {
      estimatedPipelineValue = totalConversions * leadValue;
    } else {
      const leadToOpportunityRate = parseFloat(client.leadToOpportunityRate || '0');
      const opportunityToCloseRate = parseFloat(client.opportunityToCloseRate || '0');
      const averageDealSize = parseFloat(client.averageDealSize || '0');
      estimatedPipelineValue = totalConversions * leadToOpportunityRate * opportunityToCloseRate * averageDealSize;
    }

    const cpa = totalConversions > 0 ? totalSpend / totalConversions : 0;

    let comparisonConversions = 0;
    let comparisonSpend = 0;
    let comparisonOrganicClicks = 0;
    let usedGA4ConversionsComparison = false;

    if (ga4Integration && ga4Integration.ga4PropertyId && ga4Integration.accessToken && ga4Integration.ga4LeadEventName) {
      try {
        let integration = ga4Integration;
        if (integration.expiresAt && new Date(integration.expiresAt) < new Date()) {
          if (integration.refreshToken) {
            const newTokens = await refreshAccessToken(integration.refreshToken);
            if (newTokens.success) {
              integration = await storage.updateIntegration(integration.id, {
                accessToken: newTokens.accessToken,
                expiresAt: newTokens.expiresAt,
              });
            }
          }
        }

        if (integration.accessToken) {
          const keyEventsData = await fetchGA4KeyEvents(
            integration.accessToken,
            integration.ga4PropertyId!,
            integration.ga4LeadEventName!,
            comparisonStart,
            comparisonEnd,
            clientId
          );
          comparisonConversions = keyEventsData.totalEventCount || 0;
          usedGA4ConversionsComparison = true;
        }
      } catch (error) {
        console.error("Error fetching comparison GA4 data:", error);
      }
    }

    if (!usedGA4ConversionsComparison && dailyMetrics && dailyMetrics.length > 0) {
      const comparisonStartTimestamp = new Date(comparisonStart).getTime();
      const comparisonEndTimestamp = new Date(comparisonEnd).getTime();
      const filteredMetrics = dailyMetrics.filter((metric: any) => {
        const metricTimestamp = new Date(metric.date).getTime();
        return metricTimestamp >= comparisonStartTimestamp && metricTimestamp <= comparisonEndTimestamp;
      });
      comparisonConversions = filteredMetrics.reduce((sum: number, metric: any) => sum + (metric.conversions || 0), 0);
    }

    if (dailyMetrics && dailyMetrics.length > 0) {
      const comparisonStartTimestamp = new Date(comparisonStart).getTime();
      const comparisonEndTimestamp = new Date(comparisonEnd).getTime();
      const filteredMetrics = dailyMetrics.filter((metric: any) => {
        const metricTimestamp = new Date(metric.date).getTime();
        return metricTimestamp >= comparisonStartTimestamp && metricTimestamp <= comparisonEndTimestamp;
      });
      comparisonSpend = filteredMetrics.reduce((sum: number, metric: any) => sum + parseFloat(metric.spend || '0'), 0);
    }

    if (gscIntegration && gscIntegration.gscSiteUrl && gscIntegration.accessToken) {
      try {
        let integration = gscIntegration;
        if (integration.expiresAt && new Date(integration.expiresAt) < new Date()) {
          if (integration.refreshToken) {
            const newTokens = await refreshAccessToken(integration.refreshToken);
            if (newTokens.success) {
              integration = await storage.updateIntegration(integration.id, {
                accessToken: newTokens.accessToken,
                expiresAt: newTokens.expiresAt,
              });
            }
          }
        }

        if (integration.accessToken) {
          const gscData = await fetchGSCData(integration.accessToken, integration.gscSiteUrl!, comparisonStart, comparisonEnd, clientId);
          comparisonOrganicClicks = gscData.rows?.reduce((sum: number, row: any) => sum + (row.clicks || 0), 0) || 0;
        }
      } catch (error) {
        console.error("Error fetching comparison GSC data:", error);
      }
    }

    const comparisonPipelineValue = leadValue > 0
      ? comparisonConversions * leadValue
      : comparisonConversions * parseFloat(client.leadToOpportunityRate || '0') * parseFloat(client.opportunityToCloseRate || '0') * parseFloat(client.averageDealSize || '0');
    const comparisonCPA = comparisonConversions > 0 ? comparisonSpend / comparisonConversions : 0;

    res.json({
      conversions: totalConversions,
      estimatedPipelineValue: Math.round(estimatedPipelineValue),
      cpa: Math.round(cpa * 100) / 100,
      organicClicks: totalOrganicClicks,
      spend: totalSpend,
      leadValue: leadValue > 0 ? leadValue : null,
      comparisonPeriodData: {
        conversions: comparisonConversions,
        estimatedPipelineValue: Math.round(comparisonPipelineValue),
        cpa: Math.round(comparisonCPA * 100) / 100,
        organicClicks: comparisonOrganicClicks,
      },
      pipelineCalculation: {
        leadToOpportunityRate: parseFloat(client.leadToOpportunityRate || '0'),
        opportunityToCloseRate: parseFloat(client.opportunityToCloseRate || '0'),
        averageDealSize: parseFloat(client.averageDealSize || '0'),
      }
    });
  } catch (error: any) {
    console.error("Fetch outcome metrics error:", error);
    res.status(500).json({ message: error.message || "Failed to fetch outcome metrics" });
  }
});

export default router;
