import { describe, expect, it, vi } from "vitest";
import { ClientIntegrationService } from "../server/application/integrations/client-integration-service";

describe("ClientIntegrationService", () => {
  it("returns 404 when disconnecting missing GA4 integration", async () => {
    const storage = {
      getIntegrationByClientId: vi.fn().mockResolvedValue(undefined),
    } as any;
    const service = new ClientIntegrationService(storage);

    const result = await service.disconnectGa4("client-1");
    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
  });

  it("returns 400 when gscSiteUrl is missing", async () => {
    const service = new ClientIntegrationService({} as any);
    const result = await service.saveGscSite("client-1", "");

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
  });

  it("disconnects GSC integration successfully", async () => {
    const storage = {
      getIntegrationByClientId: vi.fn().mockResolvedValue({ id: "integration-1" }),
      deleteIntegration: vi.fn().mockResolvedValue(undefined),
    } as any;
    const service = new ClientIntegrationService(storage);

    const result = await service.disconnectGsc("client-1");
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(storage.deleteIntegration).toHaveBeenCalledWith("integration-1");
  });
});
