import { Router } from "express";
import { storage } from "../storage";
import {
  requireAuth,
  requireRole,
  requireClientAccess,
  type AuthRequest
} from "../middleware/supabase-auth";
import { z } from "zod";
import { refreshAccessToken, fetchGA4Data, fetchGA4KeyEvents, fetchGSCData, fetchGSCTopQueries } from "../lib/googleOAuth";
import { hardenedAIExecutor } from "../ai/hardened-executor";
import { cache, CACHE_TTL } from "../lib/cache";
import { emitClientRecordUpdatedSignal } from "../clients/client-record-signal";

export const agencyClientsRouter = Router();
export const clientsRouter = Router();

agencyClientsRouter.post("/:clientId/sync-metrics", requireAuth, requireRole("Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;
    const { daysToFetch = 30 } = req.body;

    const client = await storage.getClientById(clientId);
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    let ga4Integration = await storage.getIntegrationByClientId(clientId, 'GA4');
    let gscIntegration = await storage.getIntegrationByClientId(clientId, 'GSC');

    if (!ga4Integration && !gscIntegration) {
      return res.status(400).json({ message: "No analytics integrations connected" });
    }

    const end = new Date().toISOString().split('T')[0];
    const start = new Date(Date.now() - daysToFetch * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    await storage.deleteMetricsByClientIdAndDateRange(clientId, start, end);
    
    let metricsCreated = 0;

    if (ga4Integration && ga4Integration.ga4PropertyId && ga4Integration.accessToken) {
      const { fetchGA4Data, fetchGA4KeyEvents } = await import("../lib/googleOAuth");
      const ga4Data = await fetchGA4Data(ga4Integration.accessToken, ga4Integration.ga4PropertyId, start, end, clientId);
      
      let conversionsData: { rows?: Array<{ dimensionValues?: Array<{ value?: string | null }>, metricValues?: Array<{ value?: string | null }> }> } = { rows: [] };
      if (client.leadEvents && client.leadEvents.length > 0) {
        try {
          const leadEventsString = client.leadEvents.map(e => e.trim()).join(', ');
          conversionsData = await fetchGA4KeyEvents(
            ga4Integration.accessToken,
            ga4Integration.ga4PropertyId,
            leadEventsString,
            start,
            end,
            clientId
          );
        } catch (error) {
          console.error("Error fetching GA4 Key Events during sync:", error);
        }
      }
      
      const conversionsMap = new Map<string, number>();
      for (const row of conversionsData.rows || []) {
        const dateValue = row.dimensionValues?.[0]?.value;
        const conversions = parseInt(row.metricValues?.[0]?.value || '0');
        if (dateValue) {
          conversionsMap.set(dateValue, conversions);
        }
      }
      
      for (const row of ga4Data.rows || []) {
        const dateValue = row.dimensionValues?.[0]?.value;
        const sessions = parseInt(row.metricValues?.[0]?.value || '0');
        
        if (dateValue) {
          await storage.createMetric({
            date: dateValue,
            clientId: clientId,
            source: 'GA4',
            sessions: sessions,
            conversions: conversionsMap.get(dateValue) || 0,
            clicks: 0,
            impressions: 0,
            spend: '0'
          });
          metricsCreated++;
        }
      }
    }

    if (gscIntegration && gscIntegration.gscSiteUrl && gscIntegration.accessToken) {
      const { fetchGSCData } = await import("../lib/googleOAuth");
      const gscData = await fetchGSCData(gscIntegration.accessToken, gscIntegration.gscSiteUrl, start, end, clientId);
      
      for (const row of gscData.rows || []) {
        const dateValue = row.keys?.[0];
        const clicks = row.clicks || 0;
        const impressions = row.impressions || 0;
        const position = row.position || 0;
        
        if (dateValue) {
          await storage.createMetric({
            date: dateValue,
            clientId: clientId,
            source: 'GSC',
            organicClicks: clicks,
            organicImpressions: impressions,
            avgPosition: position.toString()
          });
          metricsCreated++;
        }
      }
    }

    res.json({
      success: true,
      message: `Successfully synced ${metricsCreated} metrics for the last ${daysToFetch} days`,
      metricsCreated
    });
  } catch (error: any) {
    console.error("Sync metrics error:", error);
    res.status(500).json({ message: error.message || "Failed to sync metrics" });
  }
});

agencyClientsRouter.post("/:clientId/generate-recommendations", requireAuth, requireRole("Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;
    
    const generateRecommendationsSchema = z.object({
      preset: z.enum(["quick-wins", "strategic-growth", "full-audit"]),
      includeCompetitors: z.boolean().default(false),
      competitorDomains: z.array(z.string()).max(5).optional()
    });
    
    const validatedData = generateRecommendationsSchema.parse(req.body);
    const signalResult = await emitClientRecordUpdatedSignal(storage, {
      agencyId: req.user!.agencyId!,
      clientId,
      updates: {},
      actorId: req.user!.id,
      origin: "agency.recommendations.request",
      reason: "manual_recommendations",
      preset: validatedData.preset,
      includeCompetitors: validatedData.includeCompetitors,
      competitorDomains: validatedData.competitorDomains,
    });

    res.status(202).json({
      success: true,
      message: "Recommendation request routed to workflow engine",
      signalId: signalResult.signalId,
      isDuplicate: signalResult.isDuplicate,
      workflowsTriggered: signalResult.workflowsTriggered,
      executions: signalResult.executions,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    res.status(500).json({ message: error.message });
  }
});

agencyClientsRouter.get("/:clientId/strategy-card", requireAuth, requireRole("Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;

    const [client, objectives, metrics, messages] = await Promise.all([
      storage.getClientById(clientId),
      storage.getActiveObjectivesByClientId(clientId),
      storage.getMetricsByClientId(clientId, 30),
      storage.getMessagesByClientId(clientId),
    ]);

    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    const summaryKpis = {
      totalSessions: metrics.reduce((sum, m) => sum + (m.sessions || 0), 0),
      totalConversions: metrics.reduce((sum, m) => sum + (m.conversions || 0), 0),
      totalSpend: metrics.reduce((sum, m) => sum + parseFloat(m.spend || "0"), 0),
    };

    const recentMessages = messages.slice(-30);
    const chatHistoryText = recentMessages.length > 0
      ? recentMessages.map(msg => `${msg.senderRole}: ${msg.message}`).join('\n')
      : "No recent conversations.";
    
    const systemPrompt = `You are an expert Account Manager analyzing a recent conversation history with a client. Your task is to distill this conversation into actionable insights.\n\nFocus on messages from the \"Client\" role and extract:\n- painPoints: Problems, frustrations, concerns, or improvement requests\n- recentWins: Positive feedback or satisfaction\n- activeQuestions: Unanswered questions or requests needing follow-up\n\nIf the conversation is only greetings/small talk, return empty arrays.\nRespond with a JSON object with keys painPoints, recentWins, activeQuestions.`;

    const prompt = `${systemPrompt}\n\nCHAT HISTORY:\n${chatHistoryText}`;

    const outputSchema = z.object({
      painPoints: z.array(z.string()),
      recentWins: z.array(z.string()),
      activeQuestions: z.array(z.string()),
    });

    const chatAnalysisResult = await hardenedAIExecutor.executeWithSchema(
      {
        agencyId: client.agencyId,
        operation: "ai_chat_analysis",
      },
      { prompt },
      outputSchema
    );

    if (!chatAnalysisResult.success) {
      return res.status(500).json({ message: chatAnalysisResult.error || "Failed to analyze chat history" });
    }

    const strategyCardData = {
      businessContext: client.businessContext,
      clientObjectives: objectives,
      summaryKpis,
      chatAnalysis: chatAnalysisResult.data,
    };

    res.json(strategyCardData);
  } catch (error: any) {
    console.error("Strategy Card endpoint error:", error);
    res.status(500).json({ message: error.message || "Failed to generate strategy card data" });
  }
});

agencyClientsRouter.get("/:clientId/dashboard-summary", requireAuth, requireRole("Client", "Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;
    const { startDate, endDate } = req.query;

    const end = endDate as string || new Date().toISOString().split('T')[0];
    const start = startDate as string || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const cacheKey = `dashboard-summary:${clientId}:${start}:${end}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      return res.json({ ...cachedData, cached: true });
    }

    const [ga4Result, gscResult, gscQueriesResult, outcomeMetricsResult] = await Promise.allSettled([
      (async () => {
        let integration = await storage.getIntegrationByClientId(clientId, 'GA4');
        if (!integration || !integration.ga4PropertyId) {
          return { rows: [], rowCount: 0, totals: [] };
        }

        if (integration.expiresAt && new Date(integration.expiresAt) < new Date()) {
          if (!integration.refreshToken) {
            return { rows: [], rowCount: 0, totals: [] };
          }
          const newTokens = await refreshAccessToken(integration.refreshToken);
          if (!newTokens.success) {
            return { rows: [], rowCount: 0, totals: [] };
          }
          integration = await storage.updateIntegration(integration.id, {
            accessToken: newTokens.accessToken,
            expiresAt: newTokens.expiresAt,
          });
        }

        if (!integration.accessToken) {
          return { rows: [], rowCount: 0, totals: [] };
        }

        return await fetchGA4Data(integration.accessToken, integration.ga4PropertyId!, start, end, clientId);
      })(),

      (async () => {
        let integration = await storage.getIntegrationByClientId(clientId, 'GSC');
        if (!integration || !integration.gscSiteUrl) {
          return { rows: [] };
        }

        if (integration.expiresAt && new Date(integration.expiresAt) < new Date()) {
          if (!integration.refreshToken) {
            return { rows: [] };
          }
          const newTokens = await refreshAccessToken(integration.refreshToken);
          if (!newTokens.success) {
            return { rows: [] };
          }
          integration = await storage.updateIntegration(integration.id, {
            accessToken: newTokens.accessToken,
            expiresAt: newTokens.expiresAt,
          });
        }

        if (!integration.accessToken) {
          return { rows: [] };
        }

        return await fetchGSCData(integration.accessToken, integration.gscSiteUrl!, start, end, clientId);
      })(),

      (async () => {
        let integration = await storage.getIntegrationByClientId(clientId, 'GSC');
        if (!integration || !integration.gscSiteUrl) {
          return { rows: [] };
        }

        if (integration.expiresAt && new Date(integration.expiresAt) < new Date()) {
          if (!integration.refreshToken) {
            return { rows: [] };
          }
          const newTokens = await refreshAccessToken(integration.refreshToken);
          if (!newTokens.success) {
            return { rows: [] };
          }
          integration = await storage.updateIntegration(integration.id, {
            accessToken: newTokens.accessToken,
            expiresAt: newTokens.expiresAt,
          });
        }

        if (!integration.accessToken) {
          return { rows: [] };
        }

        return await fetchGSCTopQueries(integration.accessToken, integration.gscSiteUrl!, start, end, clientId);
      })(),

      (async () => {
        const profile = await storage.getProfileByUserId(req.user!.id);
        
        if (profile!.role === "Client") {
          const client = await storage.getClientByProfileId(profile!.id);
          if (!client || client.id !== clientId) {
            throw new Error("Access denied");
          }
        }

        const client = await storage.getClientById(clientId);
        if (!client) {
          throw new Error("Client not found");
        }

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

            if (integration.accessToken) {
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
            }
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

        return {
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
        };
      })(),
    ]);

    const aggregatedData = {
      ga4: ga4Result.status === 'fulfilled' ? ga4Result.value : { rows: [], rowCount: 0, totals: [] },
      gsc: gscResult.status === 'fulfilled' ? gscResult.value : { rows: [] },
      gscQueries: gscQueriesResult.status === 'fulfilled' ? gscQueriesResult.value : { rows: [] },
      outcomeMetrics: outcomeMetricsResult.status === 'fulfilled' ? outcomeMetricsResult.value : {
        conversions: 0,
        estimatedPipelineValue: 0,
        cpa: 0,
        organicClicks: 0,
        spend: 0,
      },
    };

    cache.set(cacheKey, aggregatedData, CACHE_TTL.ONE_HOUR);

    res.json({ ...aggregatedData, cached: false });
  } catch (error: any) {
    console.error("Dashboard summary error:", error);
    res.status(500).json({ message: error.message || "Failed to fetch dashboard summary" });
  }
});

clientsRouter.get("/:clientId/connection-status", requireAuth, requireClientAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;
    
    let ga4Integration;
    try {
      ga4Integration = await storage.getIntegrationByClientId(clientId, 'GA4');
    } catch (error) {
      if (error instanceof Error && error.message.includes('Decryption failed')) {
        console.error('GA4 integration decryption failed - likely encryption key mismatch:', error.message);
        ga4Integration = undefined;
      } else {
        throw error;
      }
    }
    
    let gscIntegration;
    try {
      gscIntegration = await storage.getIntegrationByClientId(clientId, 'GSC');
    } catch (error) {
      if (error instanceof Error && error.message.includes('Decryption failed')) {
        console.error('GSC integration decryption failed - likely encryption key mismatch:', error.message);
        gscIntegration = undefined;
      } else {
        throw error;
      }
    }
    
    let clientIntegrations: any[] = [];
    try {
      clientIntegrations = await storage.getAllIntegrationsByClientId(clientId);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Decryption failed')) {
        console.error('Client integrations decryption failed - likely encryption key mismatch:', error.message);
        clientIntegrations = [];
      } else {
        throw error;
      }
    }
    const dataForSeoClientIntegration = clientIntegrations.find((i: any) => i.serviceName === 'DataForSEO');
    
    let dataForSeoConnected = false;
    let dataForSeoSource: 'client' | 'agency' | undefined;
    
    if (dataForSeoClientIntegration) {
      dataForSeoConnected = true;
      dataForSeoSource = 'client';
    } else if (req.user?.agencyId) {
      const agencyIntegration = await storage.getAgencyIntegration(req.user?.agencyId, 'DataForSEO');
      if (agencyIntegration) {
        const hasAccess = await storage.hasClientAccess(agencyIntegration.id, clientId);
        if (hasAccess) {
          dataForSeoConnected = true;
          dataForSeoSource = 'agency';
        }
      }
    }
    
    res.json({
      ga4: {
        connected: !!ga4Integration?.accessToken,
        lastSync: ga4Integration?.updatedAt ? new Date(ga4Integration.updatedAt).toLocaleString() : undefined
      },
      gsc: {
        connected: !!gscIntegration?.accessToken,
        lastSync: gscIntegration?.updatedAt ? new Date(gscIntegration.updatedAt).toLocaleString() : undefined
      },
      dataForSEO: {
        connected: dataForSeoConnected,
        source: dataForSeoSource
      }
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default agencyClientsRouter;
