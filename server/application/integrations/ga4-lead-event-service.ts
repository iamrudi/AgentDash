import type { IStorage } from "../../storage";
import type { RequestContext } from "../../middleware/request-context";
import { updateClientRecord } from "../../clients/client-record-accessor";

export interface Ga4LeadEventResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  errors?: unknown;
}

export class Ga4LeadEventService {
  constructor(private storage: IStorage) {}

  async updateLeadEventName(
    ctx: RequestContext,
    clientId: string,
    ga4LeadEventName: unknown
  ): Promise<Ga4LeadEventResult<unknown>> {
    if (ga4LeadEventName !== null && ga4LeadEventName !== undefined && ga4LeadEventName !== "") {
      if (typeof ga4LeadEventName !== "string" || ga4LeadEventName.length > 500) {
        return {
          ok: false,
          status: 400,
          error: "ga4LeadEventName must be a string with max 500 characters",
        };
      }
    }

    const integration = await this.storage.getIntegrationByClientId(clientId, "GA4");
    if (!integration) {
      return {
        ok: false,
        status: 404,
        error: "GA4 integration not found. Please connect GA4 first.",
      };
    }

    const updated = await this.storage.updateIntegration(integration.id, {
      ga4LeadEventName: (ga4LeadEventName as string) || null,
    });

    const leadEventsArray = ga4LeadEventName
      ? (ga4LeadEventName as string).split(",").map((e: string) => e.trim()).filter((e: string) => e.length > 0)
      : [];

    const result = await updateClientRecord(this.storage, {
      clientId,
      updates: { leadEvents: leadEventsArray },
      context: ctx,
      source: "signal",
      signalSource: "ga4",
      origin: "integration.ga4.lead_event_patch",
    });

    if (!result.ok) {
      return {
        ok: false,
        status: 400,
        error: "Invalid client record update",
        errors: result.errors,
      };
    }

    return {
      ok: true,
      status: 200,
      data: {
        message: "Lead event configuration updated successfully",
        ga4LeadEventName: updated.ga4LeadEventName,
      },
    };
  }
}
