import { describe, expect, it, vi } from "vitest";
import { ClientIntegrationStatusService } from "../server/application/integrations/client-integration-status-service";

describe("ClientIntegrationStatusService", () => {
  it("returns disconnected GA4 status when integration is missing", async () => {
    const storage = {
      getIntegrationByClientId: vi.fn().mockResolvedValue(undefined),
    } as any;
    const service = new ClientIntegrationStatusService(storage);

    const result = await service.getGa4Status("client-1");
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ connected: false });
  });

  it("returns connected GSC status when integration exists", async () => {
    const storage = {
      getIntegrationByClientId: vi.fn().mockResolvedValue({
        gscSiteUrl: "https://example.com",
        expiresAt: null,
        createdAt: "2026-01-01",
        updatedAt: "2026-01-02",
      }),
    } as any;
    const service = new ClientIntegrationStatusService(storage);

    const result = await service.getGscStatus("client-1");
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toMatchObject({
      connected: true,
      gscSiteUrl: "https://example.com",
    });
  });
});
