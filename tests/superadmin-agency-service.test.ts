import { describe, expect, it, vi } from "vitest";
import { SuperadminAgencyService } from "../server/application/superadmin/superadmin-agency-service";

describe("SuperadminAgencyService", () => {
  it("returns 404 when deleting a missing agency", async () => {
    const storage = {
      getAgencyById: vi.fn().mockResolvedValue(undefined),
    } as any;
    const service = new SuperadminAgencyService(storage, {} as any);

    const result = await service.deleteAgency("agency-1");

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.error).toBe("Agency not found");
  });

  it("returns 404 when deleting a missing client", async () => {
    const storage = {
      getAllClientsForSuperAdmin: vi.fn().mockResolvedValue([]),
    } as any;
    const service = new SuperadminAgencyService(storage, {} as any);

    const result = await service.deleteClient("client-1");

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.error).toBe("Client not found");
  });

  it("returns default settings when agency has no override", async () => {
    const storage = {
      getAllAgenciesForSuperAdmin: vi.fn().mockResolvedValue([
        { id: "agency-1", name: "Agency One" },
      ]),
    } as any;
    const deps = {
      getAgencySettings: vi.fn().mockResolvedValue(undefined),
      insertAgencySettings: vi.fn(),
      updateAgencySettings: vi.fn(),
      invalidateAIProviderCache: vi.fn(),
    };
    const service = new SuperadminAgencyService(storage, deps);

    const result = await service.getAgencySettings("agency-1");

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data?.isDefault).toBe(true);
    expect(deps.getAgencySettings).toHaveBeenCalledWith("agency-1");
  });

  it("updates existing settings and returns audit payload", async () => {
    const storage = {
      getAllAgenciesForSuperAdmin: vi.fn().mockResolvedValue([
        { id: "agency-1", name: "Agency One" },
      ]),
    } as any;
    const deps = {
      getAgencySettings: vi.fn().mockResolvedValue({ agencyId: "agency-1", aiProvider: "openai" }),
      insertAgencySettings: vi.fn(),
      updateAgencySettings: vi.fn().mockResolvedValue({
        agencyId: "agency-1",
        aiProvider: "gemini",
      }),
      invalidateAIProviderCache: vi.fn().mockResolvedValue(undefined),
    };
    const service = new SuperadminAgencyService(storage, deps);

    const result = await service.updateAgencySettings("agency-1", { aiProvider: "gemini" });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.auditEvent?.action).toBe("agency.settings.update");
    expect(deps.updateAgencySettings).toHaveBeenCalledWith("agency-1", "gemini");
    expect(deps.invalidateAIProviderCache).toHaveBeenCalledWith("agency-1");
  });
});
