import { describe, expect, it, vi } from "vitest";
import { ClientConnectionStatusService } from "../server/application/agency-clients/client-connection-status-service";

describe("ClientConnectionStatusService", () => {
  it("handles integration decryption failures and still returns status", async () => {
    const storage = {
      getIntegrationByClientId: vi
        .fn()
        .mockRejectedValueOnce(new Error("Decryption failed"))
        .mockRejectedValueOnce(new Error("Decryption failed")),
      getAllIntegrationsByClientId: vi.fn().mockResolvedValue([]),
      getAgencyIntegration: vi.fn().mockResolvedValue(undefined),
      hasClientAccess: vi.fn(),
    } as any;

    const service = new ClientConnectionStatusService(storage);
    const result = await service.getConnectionStatus({
      clientId: "client-1",
      agencyId: "agency-1",
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual({
      ga4: { connected: false, lastSync: undefined },
      gsc: { connected: false, lastSync: undefined },
      dataForSEO: { connected: false, source: undefined },
    });
  });

  it("returns DataForSEO source as client when client integration exists", async () => {
    const storage = {
      getIntegrationByClientId: vi
        .fn()
        .mockResolvedValueOnce({ accessToken: "ga4-token", updatedAt: undefined })
        .mockResolvedValueOnce({ accessToken: "gsc-token", updatedAt: undefined }),
      getAllIntegrationsByClientId: vi.fn().mockResolvedValue([{ serviceName: "DataForSEO" }]),
      getAgencyIntegration: vi.fn(),
      hasClientAccess: vi.fn(),
    } as any;

    const service = new ClientConnectionStatusService(storage);
    const result = await service.getConnectionStatus({
      clientId: "client-1",
      agencyId: "agency-1",
    });

    expect(result.ok).toBe(true);
    expect(result.data).toEqual({
      ga4: { connected: true, lastSync: undefined },
      gsc: { connected: true, lastSync: undefined },
      dataForSEO: { connected: true, source: "client" },
    });
    expect(storage.getAgencyIntegration).not.toHaveBeenCalled();
  });

  it("returns DataForSEO source as agency when agency integration has client access", async () => {
    const storage = {
      getIntegrationByClientId: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined),
      getAllIntegrationsByClientId: vi.fn().mockResolvedValue([]),
      getAgencyIntegration: vi.fn().mockResolvedValue({ id: "agency-int-1" }),
      hasClientAccess: vi.fn().mockResolvedValue(true),
    } as any;

    const service = new ClientConnectionStatusService(storage);
    const result = await service.getConnectionStatus({
      clientId: "client-1",
      agencyId: "agency-1",
    });

    expect(result.ok).toBe(true);
    expect(result.data).toEqual({
      ga4: { connected: false, lastSync: undefined },
      gsc: { connected: false, lastSync: undefined },
      dataForSEO: { connected: true, source: "agency" },
    });
    expect(storage.hasClientAccess).toHaveBeenCalledWith("agency-int-1", "client-1");
  });
});
