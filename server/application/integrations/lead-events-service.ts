import type { IStorage } from "../../storage";
import type { RequestContext } from "../../middleware/request-context";
import { updateClientRecord } from "../../clients/client-record-accessor";

export interface LeadEventsResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  errors?: unknown;
}

export class LeadEventsService {
  constructor(private storage: IStorage) {}

  async saveLeadEvents(
    ctx: RequestContext,
    clientId: string,
    leadEvents: unknown
  ): Promise<LeadEventsResult<unknown>> {
    if (!Array.isArray(leadEvents)) {
      return { ok: false, status: 400, error: "leadEvents must be an array" };
    }
    if (!leadEvents.every((event) => typeof event === "string")) {
      return { ok: false, status: 400, error: "All lead events must be strings" };
    }

    const client = await this.storage.getClientById(clientId);
    if (!client) {
      return { ok: false, status: 404, error: "Client not found" };
    }

    const result = await updateClientRecord(this.storage, {
      clientId,
      updates: { leadEvents },
      context: ctx,
      source: "signal",
      signalSource: "ga4",
      origin: "integration.lead_events",
    });

    if (!result.ok) {
      return {
        ok: false,
        status: 400,
        error: "Invalid client record update",
        errors: result.errors,
      };
    }

    const ga4Integration = await this.storage.getIntegrationByClientId(clientId, "GA4");
    if (ga4Integration) {
      const leadEventsString = leadEvents.map((e: string) => e.trim()).join(",");
      await this.storage.updateIntegration(ga4Integration.id, {
        ga4LeadEventName: leadEventsString || null,
      });
    }

    return {
      ok: true,
      status: 200,
      data: {
        message: "Lead events saved successfully",
        leadEvents: (result.client as { leadEvents?: unknown })?.leadEvents ?? leadEvents,
      },
    };
  }
}
