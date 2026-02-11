import type { IStorage } from "../../storage";
import type { RequestContext } from "../../middleware/request-context";
import { updateClientRecord } from "../../clients/client-record-accessor";

export interface Ga4PropertyResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  errors?: unknown;
}

export class Ga4PropertyService {
  constructor(private storage: IStorage) {}

  async saveProperty(
    ctx: RequestContext,
    clientId: string,
    payload: { ga4PropertyId?: unknown; ga4LeadEventName?: unknown }
  ): Promise<Ga4PropertyResult<unknown>> {
    const { ga4PropertyId, ga4LeadEventName } = payload ?? {};

    if (!ga4PropertyId) {
      return { ok: false, status: 400, error: "ga4PropertyId is required" };
    }

    if (ga4LeadEventName && (typeof ga4LeadEventName !== "string" || ga4LeadEventName.length > 500)) {
      return {
        ok: false,
        status: 400,
        error: "ga4LeadEventName must be a string with max 500 characters",
      };
    }

    const integration = await this.storage.getIntegrationByClientId(clientId, "GA4");
    if (!integration) {
      return { ok: false, status: 404, error: "GA4 integration not found" };
    }

    const updated = await this.storage.updateIntegration(integration.id, {
      ga4PropertyId: String(ga4PropertyId),
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
      origin: "integration.ga4.property",
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
        message: "GA4 property and lead event saved successfully",
        ga4PropertyId: updated.ga4PropertyId,
        ga4LeadEventName: updated.ga4LeadEventName,
      },
    };
  }
}
