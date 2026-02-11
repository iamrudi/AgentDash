import type { IStorage } from "../../storage";
import type { Integration } from "@shared/schema";

export interface OutcomeMetricsResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

type TokenRefreshResult = {
  success: boolean;
  accessToken?: string;
  expiresAt?: string | Date | null;
  error?: string;
};

type OutcomeMetricsDeps = {
  refreshAccessToken: (refreshToken: string) => Promise<TokenRefreshResult>;
  fetchGA4KeyEvents: (
    accessToken: string,
    propertyId: string,
    eventName: string,
    startDate: string,
    endDate: string,
    clientId: string
  ) => Promise<any>;
  fetchGSCData: (
    accessToken: string,
    siteUrl: string,
    startDate: string,
    endDate: string,
    clientId: string
  ) => Promise<any>;
};

type DailyMetricLike = {
  date: string | Date;
  conversions?: number | null;
  spend?: string | number | null;
};

function toDateString(input: string | undefined, fallback: Date): string {
  if (input && typeof input === "string" && input.length > 0) {
    return input;
  }
  return fallback.toISOString().split("T")[0];
}

function parseNumeric(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function sumConversions(metrics: DailyMetricLike[], start: string, end: string): number {
  const startTimestamp = new Date(start).getTime();
  const endTimestamp = new Date(end).getTime();
  return metrics
    .filter((metric) => {
      const metricTimestamp = new Date(metric.date).getTime();
      return metricTimestamp >= startTimestamp && metricTimestamp <= endTimestamp;
    })
    .reduce((sum, metric) => sum + (metric.conversions || 0), 0);
}

function sumSpend(metrics: DailyMetricLike[], start: string, end: string): number {
  const startTimestamp = new Date(start).getTime();
  const endTimestamp = new Date(end).getTime();
  return metrics
    .filter((metric) => {
      const metricTimestamp = new Date(metric.date).getTime();
      return metricTimestamp >= startTimestamp && metricTimestamp <= endTimestamp;
    })
    .reduce((sum, metric) => sum + parseNumeric(metric.spend), 0);
}

export class OutcomeMetricsService {
  constructor(
    private readonly storage: IStorage,
    private readonly deps: OutcomeMetricsDeps
  ) {}

  private async refreshIfExpired(
    integration: Integration
  ): Promise<Integration> {
    if (!integration.expiresAt || new Date(integration.expiresAt) >= new Date()) {
      return integration;
    }
    if (!integration.refreshToken) {
      return integration;
    }

    const newTokens = await this.deps.refreshAccessToken(integration.refreshToken);
    if (!newTokens.success || !newTokens.accessToken) {
      return integration;
    }

    return this.storage.updateIntegration(integration.id, {
      accessToken: newTokens.accessToken,
      expiresAt: newTokens.expiresAt,
    });
  }

  async getOutcomeMetrics(params: {
    userId: string;
    clientId: string;
    startDate?: string;
    endDate?: string;
  }): Promise<OutcomeMetricsResult<unknown>> {
    const profile = await this.storage.getProfileByUserId(params.userId);
    if (!profile) {
      return { ok: false, status: 403, error: "Access denied" };
    }

    if (profile.role === "Client") {
      const clientForProfile = await this.storage.getClientByProfileId(profile.id);
      if (!clientForProfile || clientForProfile.id !== params.clientId) {
        return { ok: false, status: 403, error: "Access denied" };
      }
    }

    const client = await this.storage.getClientById(params.clientId);
    if (!client) {
      return { ok: false, status: 404, error: "Client not found" };
    }

    const now = new Date();
    const end = toDateString(params.endDate, now);
    const start = toDateString(
      params.startDate,
      new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    );

    const currentPeriodStart = new Date(start);
    const currentPeriodEnd = new Date(end);
    const periodLength = currentPeriodEnd.getTime() - currentPeriodStart.getTime();
    const comparisonPeriodEnd = new Date(currentPeriodStart.getTime() - 24 * 60 * 60 * 1000);
    const comparisonPeriodStart = new Date(comparisonPeriodEnd.getTime() - periodLength);
    const comparisonStart = comparisonPeriodStart.toISOString().split("T")[0];
    const comparisonEnd = comparisonPeriodEnd.toISOString().split("T")[0];

    const dailyMetrics = ((await this.storage.getMetricsByClientId(params.clientId)) ??
      []) as DailyMetricLike[];
    const ga4Integration = await this.storage.getIntegrationByClientId(params.clientId, "GA4");
    const gscIntegration = await this.storage.getIntegrationByClientId(params.clientId, "GSC");

    let totalConversions = 0;
    let usedGA4Conversions = false;

    if (
      ga4Integration &&
      ga4Integration.ga4PropertyId &&
      ga4Integration.accessToken &&
      ga4Integration.ga4LeadEventName
    ) {
      try {
        const integration = await this.refreshIfExpired(ga4Integration);
        if (!integration.accessToken) {
          throw new Error("Access token not available after refresh");
        }
        const keyEventsData = await this.deps.fetchGA4KeyEvents(
          integration.accessToken,
          integration.ga4PropertyId,
          integration.ga4LeadEventName,
          start,
          end,
          params.clientId
        );
        totalConversions = keyEventsData.totalEventCount || 0;
        usedGA4Conversions = true;
      } catch (error) {
        console.error("Error fetching GA4 Key Events data:", error);
      }
    }

    if (!usedGA4Conversions) {
      totalConversions = sumConversions(dailyMetrics, start, end);
    }

    const totalSpend = sumSpend(dailyMetrics, start, end);

    let totalOrganicClicks = 0;
    if (gscIntegration && gscIntegration.gscSiteUrl && gscIntegration.accessToken) {
      try {
        const integration = await this.refreshIfExpired(gscIntegration);
        if (integration.accessToken) {
          const gscData = await this.deps.fetchGSCData(
            integration.accessToken,
            integration.gscSiteUrl,
            start,
            end,
            params.clientId
          );
          totalOrganicClicks =
            gscData.rows?.reduce((sum: number, row: any) => sum + (row.clicks || 0), 0) || 0;
        }
      } catch (error) {
        console.error("Error fetching GSC data:", error);
      }
    }

    const leadValue = parseNumeric(client.leadValue);
    const leadToOpportunityRate = parseNumeric(client.leadToOpportunityRate);
    const opportunityToCloseRate = parseNumeric(client.opportunityToCloseRate);
    const averageDealSize = parseNumeric(client.averageDealSize);

    const estimatedPipelineValue =
      leadValue > 0
        ? totalConversions * leadValue
        : totalConversions * leadToOpportunityRate * opportunityToCloseRate * averageDealSize;

    const cpa = totalConversions > 0 ? totalSpend / totalConversions : 0;

    let comparisonConversions = 0;
    let usedGA4ConversionsComparison = false;

    if (
      ga4Integration &&
      ga4Integration.ga4PropertyId &&
      ga4Integration.accessToken &&
      ga4Integration.ga4LeadEventName
    ) {
      try {
        const integration = await this.refreshIfExpired(ga4Integration);
        if (integration.accessToken) {
          const keyEventsData = await this.deps.fetchGA4KeyEvents(
            integration.accessToken,
            integration.ga4PropertyId,
            integration.ga4LeadEventName,
            comparisonStart,
            comparisonEnd,
            params.clientId
          );
          comparisonConversions = keyEventsData.totalEventCount || 0;
          usedGA4ConversionsComparison = true;
        }
      } catch (error) {
        console.error("Error fetching comparison GA4 data:", error);
      }
    }

    if (!usedGA4ConversionsComparison) {
      comparisonConversions = sumConversions(dailyMetrics, comparisonStart, comparisonEnd);
    }

    const comparisonSpend = sumSpend(dailyMetrics, comparisonStart, comparisonEnd);

    let comparisonOrganicClicks = 0;
    if (gscIntegration && gscIntegration.gscSiteUrl && gscIntegration.accessToken) {
      try {
        const integration = await this.refreshIfExpired(gscIntegration);
        if (integration.accessToken) {
          const gscData = await this.deps.fetchGSCData(
            integration.accessToken,
            integration.gscSiteUrl,
            comparisonStart,
            comparisonEnd,
            params.clientId
          );
          comparisonOrganicClicks =
            gscData.rows?.reduce((sum: number, row: any) => sum + (row.clicks || 0), 0) || 0;
        }
      } catch (error) {
        console.error("Error fetching comparison GSC data:", error);
      }
    }

    const comparisonPipelineValue =
      leadValue > 0
        ? comparisonConversions * leadValue
        : comparisonConversions * leadToOpportunityRate * opportunityToCloseRate * averageDealSize;
    const comparisonCPA = comparisonConversions > 0 ? comparisonSpend / comparisonConversions : 0;

    return {
      ok: true,
      status: 200,
      data: {
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
          leadToOpportunityRate,
          opportunityToCloseRate,
          averageDealSize,
        },
      },
    };
  }
}
