import type { IStorage } from "../../storage";
import type { Integration } from "@shared/schema";

export interface AnalyticsGscResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

type TokenRefreshResult = {
  success: boolean;
  accessToken?: string;
  expiresAt?: string | Date | null;
  error?: string;
};

type AnalyticsGscDeps = {
  refreshAccessToken: (refreshToken: string) => Promise<TokenRefreshResult>;
  fetchGSCData: (
    accessToken: string,
    siteUrl: string,
    startDate: string,
    endDate: string,
    clientId: string
  ) => Promise<any>;
  fetchGSCTopQueries: (
    accessToken: string,
    siteUrl: string,
    startDate: string,
    endDate: string,
    clientId: string
  ) => Promise<any>;
};

function resolveDateRange(startDate?: string, endDate?: string): { start: string; end: string } {
  const end = endDate || new Date().toISOString().split("T")[0];
  const start =
    startDate ||
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  return { start, end };
}

export class AnalyticsGscReadService {
  constructor(
    private readonly storage: IStorage,
    private readonly deps: AnalyticsGscDeps
  ) {}

  private async enforceClientOwnership(userId: string, clientId: string): Promise<boolean> {
    const profile = await this.storage.getProfileByUserId(userId);
    if (!profile) {
      return false;
    }
    if (profile.role !== "Client") {
      return true;
    }

    const client = await this.storage.getClientByProfileId(profile.id);
    return Boolean(client && client.id === clientId);
  }

  private async loadActiveIntegration(clientId: string): Promise<AnalyticsGscResult<Integration>> {
    let integration = await this.storage.getIntegrationByClientId(clientId, "GSC");
    if (!integration || !integration.gscSiteUrl) {
      return { ok: false, status: 404, error: "Search Console integration not configured" };
    }

    if (integration.expiresAt && new Date(integration.expiresAt) < new Date()) {
      if (!integration.refreshToken) {
        return { ok: false, status: 401, error: "Token expired and no refresh token available" };
      }

      const newTokens = await this.deps.refreshAccessToken(integration.refreshToken);
      if (!newTokens.success) {
        return { ok: false, status: 401, error: newTokens.error || "Token refresh failed" };
      }

      integration = await this.storage.updateIntegration(integration.id, {
        accessToken: newTokens.accessToken,
        expiresAt: newTokens.expiresAt,
      });
    }

    if (!integration.accessToken) {
      return { ok: false, status: 401, error: "Access token not available" };
    }

    return { ok: true, status: 200, data: integration };
  }

  async getQueries(params: {
    userId: string;
    clientId: string;
    startDate?: string;
    endDate?: string;
  }): Promise<AnalyticsGscResult<unknown>> {
    const hasAccess = await this.enforceClientOwnership(params.userId, params.clientId);
    if (!hasAccess) {
      return { ok: false, status: 403, error: "Access denied" };
    }

    const integrationResult = await this.loadActiveIntegration(params.clientId);
    if (!integrationResult.ok) {
      return integrationResult;
    }
    const integration = integrationResult.data!;
    const { start, end } = resolveDateRange(params.startDate, params.endDate);

    const data = await this.deps.fetchGSCTopQueries(
      integration.accessToken!,
      integration.gscSiteUrl!,
      start,
      end,
      params.clientId
    );
    return { ok: true, status: 200, data };
  }

  async getAnalytics(params: {
    clientId: string;
    startDate?: string;
    endDate?: string;
  }): Promise<AnalyticsGscResult<unknown>> {
    const integrationResult = await this.loadActiveIntegration(params.clientId);
    if (!integrationResult.ok) {
      return integrationResult;
    }
    const integration = integrationResult.data!;
    const { start, end } = resolveDateRange(params.startDate, params.endDate);

    const data = await this.deps.fetchGSCData(
      integration.accessToken!,
      integration.gscSiteUrl!,
      start,
      end,
      params.clientId
    );
    return { ok: true, status: 200, data };
  }
}
