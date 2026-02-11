import type { IStorage } from "../../storage";

export interface ClientIntegrationResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export class ClientIntegrationService {
  constructor(private storage: IStorage) {}

  async disconnectGa4(clientId: string): Promise<ClientIntegrationResult<{ message: string }>> {
    const integration = await this.storage.getIntegrationByClientId(clientId, "GA4");
    if (!integration) {
      return { ok: false, status: 404, error: "GA4 integration not found" };
    }
    await this.storage.deleteIntegration(integration.id);
    return { ok: true, status: 200, data: { message: "GA4 integration disconnected successfully" } };
  }

  async saveGscSite(
    clientId: string,
    gscSiteUrl: unknown
  ): Promise<ClientIntegrationResult<{ message: string; gscSiteUrl: string | null }>> {
    if (!gscSiteUrl) {
      return { ok: false, status: 400, error: "gscSiteUrl is required" };
    }

    const integration = await this.storage.getIntegrationByClientId(clientId, "GSC");
    if (!integration) {
      return { ok: false, status: 404, error: "Search Console integration not found" };
    }

    const updated = await this.storage.updateIntegration(integration.id, {
      gscSiteUrl: String(gscSiteUrl),
    });

    return {
      ok: true,
      status: 200,
      data: {
        message: "Search Console site saved successfully",
        gscSiteUrl: updated.gscSiteUrl,
      },
    };
  }

  async disconnectGsc(clientId: string): Promise<ClientIntegrationResult<{ message: string }>> {
    const integration = await this.storage.getIntegrationByClientId(clientId, "GSC");
    if (!integration) {
      return { ok: false, status: 404, error: "Search Console integration not found" };
    }
    await this.storage.deleteIntegration(integration.id);
    return {
      ok: true,
      status: 200,
      data: { message: "Search Console integration disconnected successfully" },
    };
  }
}
