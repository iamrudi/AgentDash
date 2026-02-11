import type { IStorage } from "../../storage";
import type { RequestContext } from "../../middleware/request-context";
import { updateClientRecord } from "../../clients/client-record-accessor";

export interface AgencyClientResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  errors?: unknown;
}

export class AgencyClientService {
  constructor(private readonly storage: IStorage) {}

  async listClients(agencyId: string | undefined): Promise<AgencyClientResult<unknown>> {
    const clients = await this.storage.getAllClientsWithDetails(agencyId);
    return { ok: true, status: 200, data: clients };
  }

  async getClient(clientId: string): Promise<AgencyClientResult<unknown>> {
    const client = await this.storage.getClientById(clientId);
    if (!client) {
      return { ok: false, status: 404, error: "Client not found" };
    }
    return { ok: true, status: 200, data: client };
  }

  async updateClient(
    clientId: string,
    payload: {
      leadValue?: unknown;
      retainerAmount?: unknown;
      billingDay?: unknown;
      monthlyRetainerHours?: unknown;
    },
    ctx: RequestContext
  ): Promise<AgencyClientResult<unknown>> {
    const client = await this.storage.getClientById(clientId);
    if (!client) {
      return { ok: false, status: 404, error: "Client not found" };
    }

    const updates: Record<string, unknown> = {};
    if (payload.leadValue !== undefined) updates.leadValue = payload.leadValue;
    if (payload.retainerAmount !== undefined) updates.retainerAmount = payload.retainerAmount;
    if (payload.billingDay !== undefined) updates.billingDay = payload.billingDay;
    if (payload.monthlyRetainerHours !== undefined) updates.monthlyRetainerHours = payload.monthlyRetainerHours;

    const result = await updateClientRecord(this.storage, {
      clientId,
      updates,
      context: ctx,
      source: "manual",
      origin: "agency.client.update",
    });

    if (!result.ok) {
      return {
        ok: false,
        status: 400,
        error: "Invalid client record update",
        errors: result.errors,
      };
    }

    return { ok: true, status: 200, data: result.client };
  }

  async retainerHours(clientId: string): Promise<AgencyClientResult<unknown>> {
    const hoursInfo = await this.storage.checkRetainerHours(clientId);
    return { ok: true, status: 200, data: hoursInfo };
  }

  async resetRetainerHours(clientId: string): Promise<AgencyClientResult<unknown>> {
    const updatedClient = await this.storage.resetRetainerHours(clientId);
    return { ok: true, status: 200, data: updatedClient };
  }

  async clientMetrics(clientId: string): Promise<AgencyClientResult<unknown>> {
    const metrics = await this.storage.getMetricsByClientId(clientId, 90);
    return { ok: true, status: 200, data: metrics };
  }
}
