import { describe, expect, it, vi } from "vitest";

vi.mock("../server/lib/googleOAuth", () => ({
  refreshAccessToken: vi.fn(),
  fetchGSCSites: vi.fn(),
}));

import { refreshAccessToken, fetchGSCSites } from "../server/lib/googleOAuth";
import { GscReadService } from "../server/application/integrations/gsc-read-service";

describe("GscReadService", () => {
  it("returns 404 when GSC integration is missing", async () => {
    const storage = {
      getIntegrationByClientId: vi.fn().mockResolvedValue(undefined),
    } as any;
    const service = new GscReadService(storage);

    const result = await service.fetchSites("client-1");
    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
  });

  it("returns 401 when token is expired and refresh token is missing", async () => {
    const storage = {
      getIntegrationByClientId: vi.fn().mockResolvedValue({
        id: "integration-1",
        accessToken: "old-token",
        expiresAt: new Date(Date.now() - 60_000),
        refreshToken: null,
      }),
    } as any;
    const service = new GscReadService(storage);

    const result = await service.fetchSites("client-1");
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
  });

  it("refreshes expired token before fetching sites", async () => {
    (refreshAccessToken as any).mockResolvedValue({
      success: true,
      accessToken: "new-token",
      expiresAt: new Date(Date.now() + 3600_000),
    });
    (fetchGSCSites as any).mockResolvedValue([{ siteUrl: "https://example.com" }]);

    const storage = {
      getIntegrationByClientId: vi.fn().mockResolvedValue({
        id: "integration-1",
        accessToken: "old-token",
        expiresAt: new Date(Date.now() - 60_000),
        refreshToken: "refresh-token",
      }),
      updateIntegration: vi.fn().mockResolvedValue({
        id: "integration-1",
        accessToken: "new-token",
        expiresAt: new Date(Date.now() + 3600_000),
      }),
    } as any;
    const service = new GscReadService(storage);

    const result = await service.fetchSites("client-1");
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(storage.updateIntegration).toHaveBeenCalledTimes(1);
    expect(fetchGSCSites).toHaveBeenCalledWith("new-token", "client-1");
  });
});
