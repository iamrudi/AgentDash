import { describe, expect, it, vi } from "vitest";

vi.mock("../server/lib/googleOAuth", () => ({
  refreshAccessToken: vi.fn(),
  fetchGA4Properties: vi.fn(),
  fetchGA4AvailableKeyEvents: vi.fn(),
}));

import { refreshAccessToken, fetchGA4Properties, fetchGA4AvailableKeyEvents } from "../server/lib/googleOAuth";
import { Ga4ReadService } from "../server/application/integrations/ga4-read-service";

describe("Ga4ReadService", () => {
  it("returns 404 when GA4 integration is missing", async () => {
    const storage = {
      getIntegrationByClientId: vi.fn().mockResolvedValue(undefined),
    } as any;
    const service = new Ga4ReadService(storage);

    const result = await service.fetchProperties("client-1");
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
    const service = new Ga4ReadService(storage);

    const result = await service.fetchProperties("client-1");
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
  });

  it("refreshes expired tokens before fetching properties", async () => {
    (refreshAccessToken as any).mockResolvedValue({
      success: true,
      accessToken: "new-token",
      expiresAt: new Date(Date.now() + 3600_000),
    });
    (fetchGA4Properties as any).mockResolvedValue([{ id: "prop-1" }]);

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
        ga4PropertyId: "prop-1",
      }),
    } as any;
    const service = new Ga4ReadService(storage);

    const result = await service.fetchProperties("client-1");
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(storage.updateIntegration).toHaveBeenCalledTimes(1);
    expect(fetchGA4Properties).toHaveBeenCalledWith("new-token", "client-1");
  });

  it("returns 404 for key-events when property is not configured", async () => {
    const storage = {
      getIntegrationByClientId: vi.fn().mockResolvedValue({
        id: "integration-1",
        accessToken: "token",
        expiresAt: null,
        ga4PropertyId: null,
      }),
    } as any;
    const service = new Ga4ReadService(storage);

    const result = await service.fetchKeyEvents("client-1");
    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
  });

  it("fetches key-events when property is configured", async () => {
    (fetchGA4AvailableKeyEvents as any).mockResolvedValue([{ eventName: "signup" }]);
    const storage = {
      getIntegrationByClientId: vi.fn().mockResolvedValue({
        id: "integration-1",
        accessToken: "token",
        expiresAt: null,
        ga4PropertyId: "prop-1",
      }),
    } as any;
    const service = new Ga4ReadService(storage);

    const result = await service.fetchKeyEvents("client-1");
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(fetchGA4AvailableKeyEvents).toHaveBeenCalledWith("token", "prop-1", "client-1");
  });
});
