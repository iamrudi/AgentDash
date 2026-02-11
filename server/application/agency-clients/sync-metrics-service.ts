import type { IStorage } from "../../storage";

type SyncMetricsDeps = {
  fetchGA4Data: (
    accessToken: string,
    propertyId: string,
    startDate: string,
    endDate: string,
    clientId: string
  ) => Promise<{
    rows?: Array<{
      dimensionValues?: Array<{ value?: string | null }>;
      metricValues?: Array<{ value?: string | null }>;
    }>;
  }>;
  fetchGA4KeyEvents: (
    accessToken: string,
    propertyId: string,
    eventName: string,
    startDate: string,
    endDate: string,
    clientId: string
  ) => Promise<{
    rows?: Array<{
      dimensionValues?: Array<{ value?: string | null }>;
      metricValues?: Array<{ value?: string | null }>;
    }>;
  }>;
  fetchGSCData: (
    accessToken: string,
    siteUrl: string,
    startDate: string,
    endDate: string,
    clientId: string
  ) => Promise<{
    rows?: Array<{
      keys?: string[];
      clicks?: number;
      impressions?: number;
      position?: number;
    }>;
  }>;
};

export interface SyncMetricsResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export class SyncMetricsService {
  constructor(
    private readonly storage: IStorage,
    private readonly deps: SyncMetricsDeps
  ) {}

  async syncClientMetrics(
    clientId: string,
    daysToFetchInput?: unknown
  ): Promise<SyncMetricsResult<{ success: true; message: string; metricsCreated: number }>> {
    const daysToFetch =
      typeof daysToFetchInput === "number" && Number.isFinite(daysToFetchInput)
        ? Math.max(1, Math.floor(daysToFetchInput))
        : 30;

    const client = await this.storage.getClientById(clientId);
    if (!client) {
      return { ok: false, status: 404, error: "Client not found" };
    }

    const ga4Integration = await this.storage.getIntegrationByClientId(clientId, "GA4");
    const gscIntegration = await this.storage.getIntegrationByClientId(clientId, "GSC");

    if (!ga4Integration && !gscIntegration) {
      return { ok: false, status: 400, error: "No analytics integrations connected" };
    }

    const end = new Date().toISOString().split("T")[0];
    const start = new Date(Date.now() - daysToFetch * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    await this.storage.deleteMetricsByClientIdAndDateRange(clientId, start, end);
    let metricsCreated = 0;

    if (ga4Integration && ga4Integration.ga4PropertyId && ga4Integration.accessToken) {
      const ga4Data = await this.deps.fetchGA4Data(
        ga4Integration.accessToken,
        ga4Integration.ga4PropertyId,
        start,
        end,
        clientId
      );

      let conversionsData: Awaited<ReturnType<SyncMetricsDeps["fetchGA4KeyEvents"]>> = { rows: [] };
      if (client.leadEvents && client.leadEvents.length > 0) {
        try {
          const leadEventsString = client.leadEvents.map((e) => e.trim()).join(", ");
          conversionsData = await this.deps.fetchGA4KeyEvents(
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
        const conversions = parseInt(row.metricValues?.[0]?.value || "0");
        if (dateValue) {
          conversionsMap.set(dateValue, conversions);
        }
      }

      for (const row of ga4Data.rows || []) {
        const dateValue = row.dimensionValues?.[0]?.value;
        const sessions = parseInt(row.metricValues?.[0]?.value || "0");
        if (!dateValue) {
          continue;
        }
        await this.storage.createMetric({
          date: dateValue,
          clientId,
          source: "GA4",
          sessions,
          conversions: conversionsMap.get(dateValue) || 0,
          clicks: 0,
          impressions: 0,
          spend: "0",
        });
        metricsCreated++;
      }
    }

    if (gscIntegration && gscIntegration.gscSiteUrl && gscIntegration.accessToken) {
      const gscData = await this.deps.fetchGSCData(
        gscIntegration.accessToken,
        gscIntegration.gscSiteUrl,
        start,
        end,
        clientId
      );

      for (const row of gscData.rows || []) {
        const dateValue = row.keys?.[0];
        if (!dateValue) {
          continue;
        }
        await this.storage.createMetric({
          date: dateValue,
          clientId,
          source: "GSC",
          organicClicks: row.clicks || 0,
          organicImpressions: row.impressions || 0,
          avgPosition: (row.position || 0).toString(),
        });
        metricsCreated++;
      }
    }

    return {
      ok: true,
      status: 200,
      data: {
        success: true,
        message: `Successfully synced ${metricsCreated} metrics for the last ${daysToFetch} days`,
        metricsCreated,
      },
    };
  }
}
