import type { IStorage } from "../../storage";
import { refreshAccessToken, fetchGA4Properties, fetchGA4AvailableKeyEvents } from "../../lib/googleOAuth";

export interface Ga4ReadResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export class Ga4ReadService {
  constructor(private storage: IStorage) {}

  private async loadValidGa4Integration(clientId: string): Promise<Ga4ReadResult<any>> {
    let integration = await this.storage.getIntegrationByClientId(clientId, "GA4");
    if (!integration) {
      return { ok: false, status: 404, error: "GA4 integration not found" };
    }

    if (integration.expiresAt && new Date(integration.expiresAt) < new Date()) {
      if (!integration.refreshToken) {
        return { ok: false, status: 401, error: "Token expired and no refresh token available" };
      }
      const newTokens = await refreshAccessToken(integration.refreshToken);
      if (!newTokens.success) {
        return { ok: false, status: 401, error: newTokens.error || "Token refresh failed" };
      }
      integration = await this.storage.updateIntegration(integration.id, {
        accessToken: newTokens.accessToken,
        expiresAt: newTokens.expiresAt,
      });
    }

    return { ok: true, status: 200, data: integration };
  }

  async fetchProperties(clientId: string): Promise<Ga4ReadResult<unknown>> {
    const integrationResult = await this.loadValidGa4Integration(clientId);
    if (!integrationResult.ok) {
      return integrationResult;
    }
    const integration = integrationResult.data;
    const properties = await fetchGA4Properties(integration.accessToken!, clientId);
    return { ok: true, status: 200, data: properties };
  }

  async fetchKeyEvents(clientId: string): Promise<Ga4ReadResult<unknown>> {
    const integrationResult = await this.loadValidGa4Integration(clientId);
    if (!integrationResult.ok) {
      return integrationResult;
    }
    const integration = integrationResult.data;
    if (!integration.ga4PropertyId) {
      return { ok: false, status: 404, error: "GA4 integration or property not configured" };
    }
    const keyEventsData = await fetchGA4AvailableKeyEvents(
      integration.accessToken!,
      integration.ga4PropertyId!,
      clientId
    );
    return { ok: true, status: 200, data: keyEventsData };
  }
}
