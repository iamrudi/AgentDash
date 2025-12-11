import { SignalNormalizer, type RawSignalPayload } from "./signal-normalizer";
import type { InsertWorkflowSignal } from "@shared/schema";

export interface AdapterResult {
  signal: InsertWorkflowSignal;
  rawPayload: Record<string, unknown>;
}

export interface SignalAdapter {
  source: string;
  adapt(agencyId: string, rawData: Record<string, unknown>, clientId?: string): AdapterResult;
}

export class GA4Adapter implements SignalAdapter {
  source = "ga4";

  adapt(agencyId: string, rawData: Record<string, unknown>, clientId?: string): AdapterResult {
    const type = this.determineType(rawData);
    const urgency = this.determineUrgency(rawData);
    
    const raw: RawSignalPayload = {
      source: this.source,
      type,
      data: rawData,
      clientId,
      urgency,
      timestamp: rawData.timestamp as string || new Date().toISOString(),
      metadata: {
        adapter: "ga4",
        propertyId: rawData.propertyId,
      },
    };

    const normalized = SignalNormalizer.normalize(agencyId, raw);
    return {
      signal: SignalNormalizer.toInsertSignal(normalized),
      rawPayload: rawData,
    };
  }

  private determineType(data: Record<string, unknown>): string {
    if (data.eventType) return data.eventType as string;
    if (data.sessions !== undefined || data.users !== undefined) return "traffic_metrics";
    if (data.conversions !== undefined) return "conversion_metrics";
    if (data.pageViews !== undefined) return "pageview_metrics";
    return "general_metrics";
  }

  private determineUrgency(data: Record<string, unknown>): string {
    const percentChange = data.percentChange as number | undefined;
    if (percentChange !== undefined) {
      if (Math.abs(percentChange) > 50) return "critical";
      if (Math.abs(percentChange) > 25) return "high";
      if (Math.abs(percentChange) > 10) return "normal";
    }
    return "low";
  }
}

export class GSCAdapter implements SignalAdapter {
  source = "gsc";

  adapt(agencyId: string, rawData: Record<string, unknown>, clientId?: string): AdapterResult {
    const type = this.determineType(rawData);
    const urgency = this.determineUrgency(rawData);
    
    const raw: RawSignalPayload = {
      source: this.source,
      type,
      data: rawData,
      clientId,
      urgency,
      timestamp: rawData.date as string || new Date().toISOString(),
      metadata: {
        adapter: "gsc",
        siteUrl: rawData.siteUrl,
      },
    };

    const normalized = SignalNormalizer.normalize(agencyId, raw);
    return {
      signal: SignalNormalizer.toInsertSignal(normalized),
      rawPayload: rawData,
    };
  }

  private determineType(data: Record<string, unknown>): string {
    if (data.position !== undefined) return "ranking_change";
    if (data.clicks !== undefined || data.impressions !== undefined) return "search_performance";
    if (data.query !== undefined) return "query_metrics";
    return "general_search";
  }

  private determineUrgency(data: Record<string, unknown>): string {
    const positionChange = data.positionChange as number | undefined;
    if (positionChange !== undefined) {
      if (positionChange > 10 || positionChange < -10) return "critical";
      if (positionChange > 5 || positionChange < -5) return "high";
      if (positionChange > 2 || positionChange < -2) return "normal";
    }
    return "low";
  }
}

export class HubSpotAdapter implements SignalAdapter {
  source = "hubspot";

  adapt(agencyId: string, rawData: Record<string, unknown>, clientId?: string): AdapterResult {
    const type = this.determineType(rawData);
    const urgency = this.determineUrgency(rawData);
    
    const raw: RawSignalPayload = {
      source: this.source,
      type,
      data: rawData,
      clientId,
      urgency,
      timestamp: rawData.occurredAt as string || new Date().toISOString(),
      metadata: {
        adapter: "hubspot",
        portalId: rawData.portalId,
        eventType: rawData.subscriptionType,
      },
    };

    const normalized = SignalNormalizer.normalize(agencyId, raw);
    return {
      signal: SignalNormalizer.toInsertSignal(normalized),
      rawPayload: rawData,
    };
  }

  private determineType(data: Record<string, unknown>): string {
    const subscriptionType = (data.subscriptionType as string)?.toLowerCase() || "";
    if (subscriptionType.includes("deal")) return "deal_update";
    if (subscriptionType.includes("contact")) return "contact_update";
    if (subscriptionType.includes("company")) return "company_update";
    if (subscriptionType.includes("form")) return "form_submission";
    return "general_crm";
  }

  private determineUrgency(data: Record<string, unknown>): string {
    const subscriptionType = (data.subscriptionType as string)?.toLowerCase() || "";
    if (subscriptionType.includes("deal.creation") || subscriptionType.includes("deal.propertyChange")) return "high";
    if (subscriptionType.includes("form.submission")) return "high";
    return "normal";
  }
}

export class LinkedInAdapter implements SignalAdapter {
  source = "linkedin";

  adapt(agencyId: string, rawData: Record<string, unknown>, clientId?: string): AdapterResult {
    const type = this.determineType(rawData);
    const urgency = this.determineUrgency(rawData);
    
    const raw: RawSignalPayload = {
      source: this.source,
      type,
      data: rawData,
      clientId,
      urgency,
      timestamp: rawData.timestamp as string || new Date().toISOString(),
      metadata: {
        adapter: "linkedin",
        organizationId: rawData.organizationId,
      },
    };

    const normalized = SignalNormalizer.normalize(agencyId, raw);
    return {
      signal: SignalNormalizer.toInsertSignal(normalized),
      rawPayload: rawData,
    };
  }

  private determineType(data: Record<string, unknown>): string {
    if (data.engagementRate !== undefined) return "engagement_metrics";
    if (data.followers !== undefined) return "follower_metrics";
    if (data.impressions !== undefined) return "reach_metrics";
    return "general_social";
  }

  private determineUrgency(data: Record<string, unknown>): string {
    const engagementChange = data.engagementChange as number | undefined;
    if (engagementChange !== undefined) {
      if (Math.abs(engagementChange) > 30) return "critical";
      if (Math.abs(engagementChange) > 15) return "high";
    }
    return "normal";
  }
}

export class InternalAdapter implements SignalAdapter {
  source = "internal";

  adapt(agencyId: string, rawData: Record<string, unknown>, clientId?: string): AdapterResult {
    const type = rawData.type as string || "internal_event";
    const urgency = rawData.urgency as string || "normal";
    
    const raw: RawSignalPayload = {
      source: this.source,
      type,
      data: rawData.data as Record<string, unknown> || rawData,
      clientId,
      urgency,
      timestamp: rawData.timestamp as string || new Date().toISOString(),
      metadata: {
        adapter: "internal",
        ...(rawData.metadata as Record<string, unknown> || {}),
      },
    };

    const normalized = SignalNormalizer.normalize(agencyId, raw);
    return {
      signal: SignalNormalizer.toInsertSignal(normalized),
      rawPayload: rawData,
    };
  }
}

export class WebhookAdapter implements SignalAdapter {
  source = "webhook";

  adapt(agencyId: string, rawData: Record<string, unknown>, clientId?: string): AdapterResult {
    const type = rawData.type as string || rawData.event as string || "webhook_event";
    const urgency = rawData.urgency as string || "normal";
    
    const raw: RawSignalPayload = {
      source: this.source,
      type,
      data: rawData.payload as Record<string, unknown> || rawData,
      clientId,
      urgency,
      timestamp: rawData.timestamp as string || new Date().toISOString(),
      metadata: {
        adapter: "webhook",
        webhookId: rawData.webhookId,
        ...(rawData.metadata as Record<string, unknown> || {}),
      },
    };

    const normalized = SignalNormalizer.normalize(agencyId, raw);
    return {
      signal: SignalNormalizer.toInsertSignal(normalized),
      rawPayload: rawData,
    };
  }
}

export class SignalAdapterFactory {
  private static adapters: Map<string, SignalAdapter> = new Map([
    ["ga4", new GA4Adapter()],
    ["gsc", new GSCAdapter()],
    ["hubspot", new HubSpotAdapter()],
    ["linkedin", new LinkedInAdapter()],
    ["internal", new InternalAdapter()],
    ["webhook", new WebhookAdapter()],
  ]);

  static getAdapter(source: string): SignalAdapter {
    const adapter = this.adapters.get(source.toLowerCase());
    if (!adapter) {
      throw new Error(`No adapter found for source: ${source}`);
    }
    return adapter;
  }

  static hasAdapter(source: string): boolean {
    return this.adapters.has(source.toLowerCase());
  }

  static getSupportedSources(): string[] {
    return Array.from(this.adapters.keys());
  }

  static adaptSignal(agencyId: string, source: string, rawData: Record<string, unknown>, clientId?: string): AdapterResult {
    const adapter = this.getAdapter(source);
    return adapter.adapt(agencyId, rawData, clientId);
  }
}
