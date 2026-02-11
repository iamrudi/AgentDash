import type { IStorage } from "../../storage";

export interface ClientIntegrationStatusResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export class ClientIntegrationStatusService {
  constructor(private storage: IStorage) {}

  async getGa4Status(clientId: string): Promise<ClientIntegrationStatusResult<unknown>> {
    const integration = await this.storage.getIntegrationByClientId(clientId, "GA4");
    if (!integration) {
      return { ok: true, status: 200, data: { connected: false } };
    }
    return {
      ok: true,
      status: 200,
      data: {
        connected: true,
        ga4PropertyId: integration.ga4PropertyId,
        expiresAt: integration.expiresAt,
        createdAt: integration.createdAt,
        updatedAt: integration.updatedAt,
      },
    };
  }

  async getGscStatus(clientId: string): Promise<ClientIntegrationStatusResult<unknown>> {
    const integration = await this.storage.getIntegrationByClientId(clientId, "GSC");
    if (!integration) {
      return { ok: true, status: 200, data: { connected: false } };
    }
    return {
      ok: true,
      status: 200,
      data: {
        connected: true,
        gscSiteUrl: integration.gscSiteUrl,
        expiresAt: integration.expiresAt,
        createdAt: integration.createdAt,
        updatedAt: integration.updatedAt,
      },
    };
  }
}
