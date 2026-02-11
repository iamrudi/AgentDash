import { describe, expect, it, vi } from "vitest";
import { AgencySettingsService } from "../server/application/agency/agency-settings-service";

describe("AgencySettingsService", () => {
  it("fails closed on getSettings when agency missing", async () => {
    const service = new AgencySettingsService({} as any, {} as any);
    const result = await service.getSettings({ isSuperAdmin: false, agencyId: undefined });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(result.error).toBe("Agency association required");
  });

  it("returns global default for superadmin without agency", async () => {
    const deps = {
      getSettings: vi.fn(),
      insertSettings: vi.fn(),
      updateSettings: vi.fn(),
      invalidateAIProviderCache: vi.fn(),
      fileExists: vi.fn(),
      removeFile: vi.fn(),
      getCwd: vi.fn(),
    } as any;
    const service = new AgencySettingsService({} as any, deps);

    const result = await service.getSettings({ isSuperAdmin: true, agencyId: undefined });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toMatchObject({ isDefault: true, isSuperAdminGlobal: true });
  });

  it("fails closed on invalid update payload", async () => {
    const deps = {
      getSettings: vi.fn(),
      insertSettings: vi.fn(),
      updateSettings: vi.fn(),
      invalidateAIProviderCache: vi.fn(),
      fileExists: vi.fn(),
      removeFile: vi.fn(),
      getCwd: vi.fn(),
    } as any;
    const service = new AgencySettingsService({} as any, deps);

    const result = await service.updateSettings({ isSuperAdmin: false, agencyId: "agency-1" }, { aiProvider: "invalid" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
  });

  it("rejects invalid logo type and cleans uploaded file", async () => {
    const deps = {
      getSettings: vi.fn(),
      insertSettings: vi.fn(),
      updateSettings: vi.fn(),
      invalidateAIProviderCache: vi.fn(),
      fileExists: vi.fn().mockReturnValue(true),
      removeFile: vi.fn(),
      getCwd: vi.fn().mockReturnValue("/workspace"),
    } as any;
    const service = new AgencySettingsService({} as any, deps);

    const result = await service.uploadLogo(
      { agencyId: "agency-1" },
      { path: "/workspace/uploads/logos/x.png", filename: "x.png" },
      "badType"
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(deps.removeFile).toHaveBeenCalledWith("/workspace/uploads/logos/x.png");
  });

  it("returns empty branding when no agency can be resolved", async () => {
    const deps = {
      getSettings: vi.fn(),
      insertSettings: vi.fn(),
      updateSettings: vi.fn(),
      invalidateAIProviderCache: vi.fn(),
      fileExists: vi.fn(),
      removeFile: vi.fn(),
      getCwd: vi.fn(),
    } as any;
    const storage = {
      getClientById: vi.fn().mockResolvedValue(undefined),
    } as any;
    const service = new AgencySettingsService(storage, deps);

    const result = await service.getBranding({ agencyId: undefined, clientId: "client-1" });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ agencyLogo: null, clientLogo: null, staffLogo: null });
  });
});
