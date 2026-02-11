import { describe, expect, it, vi } from "vitest";
import { SuperadminReadService } from "../server/application/superadmin/superadmin-read-service";

describe("SuperadminReadService", () => {
  it("lists users", async () => {
    const storage = {
      getAllUsersForSuperAdmin: vi.fn().mockResolvedValue([{ id: "user-1" }]),
    } as any;
    const service = new SuperadminReadService(storage);
    const result = await service.listUsers();

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(storage.getAllUsersForSuperAdmin).toHaveBeenCalledTimes(1);
  });

  it("returns 400 for invalid audit log query params", async () => {
    const service = new SuperadminReadService({} as any);
    const result = await service.listAuditLogs("abc", "0");

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
  });

  it("joins recommendations with client and agency names", async () => {
    const storage = {
      getAllInitiatives: vi.fn().mockResolvedValue([{ id: "init-1", clientId: "client-1" }]),
      getAllAgenciesForSuperAdmin: vi.fn().mockResolvedValue([{ id: "agency-1", name: "Agency A" }]),
      getClientById: vi.fn().mockResolvedValue({ id: "client-1", agencyId: "agency-1" }),
    } as any;
    const service = new SuperadminReadService(storage);
    const result = await service.listRecommendations();

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual([
      {
        id: "init-1",
        clientId: "client-1",
        client: { id: "client-1", agencyId: "agency-1" },
        agencyName: "Agency A",
      },
    ]);
  });
});
