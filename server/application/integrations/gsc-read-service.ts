import type { IStorage } from "../../storage";
import { refreshAccessToken, fetchGSCSites } from "../../lib/googleOAuth";

export interface GscReadResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export class GscReadService {
  constructor(private storage: IStorage) {}

  async fetchSites(clientId: string): Promise<GscReadResult<unknown>> {
    let integration = await this.storage.getIntegrationByClientId(clientId, "GSC");
    if (!integration) {
      return { ok: false, status: 404, error: "Search Console integration not found" };
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

    const sites = await fetchGSCSites(integration.accessToken!, clientId);
    return { ok: true, status: 200, data: sites };
  }
}
