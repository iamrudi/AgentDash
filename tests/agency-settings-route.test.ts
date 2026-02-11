import { describe, expect, it, vi } from "vitest";
import { AgencySettingsService } from "../server/application/agency/agency-settings-service";
import {
  createAgencySettingsGetHandler,
  createAgencySettingsUpdateHandler,
  createAgencySettingsLogoUploadHandler,
  createAgencySettingsLogoDeleteHandler,
  createAgencySettingsBrandingHandler,
} from "../server/routes/agency-settings";

describe("Agency settings route handlers", () => {
  it("delegates get settings", async () => {
    const getSettings = vi.fn().mockResolvedValue({ ok: true, status: 200, data: { aiProvider: "gemini" } });
    const service = { getSettings } as unknown as AgencySettingsService;
    const handler = createAgencySettingsGetHandler(service);
    const req = { user: { isSuperAdmin: false, agencyId: "agency-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(getSettings).toHaveBeenCalledWith({ isSuperAdmin: false, agencyId: "agency-1" });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates update settings", async () => {
    const updateSettings = vi.fn().mockResolvedValue({ ok: true, status: 200, data: { aiProvider: "gemini" } });
    const service = { updateSettings } as unknown as AgencySettingsService;
    const handler = createAgencySettingsUpdateHandler(service);
    const req = { user: { isSuperAdmin: false, agencyId: "agency-1" }, body: { aiProvider: "gemini" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(updateSettings).toHaveBeenCalledWith({ isSuperAdmin: false, agencyId: "agency-1" }, { aiProvider: "gemini" });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates logo upload", async () => {
    const uploadLogo = vi.fn().mockResolvedValue({ ok: true, status: 200, data: { message: "ok" } });
    const service = { uploadLogo } as unknown as AgencySettingsService;
    const handler = createAgencySettingsLogoUploadHandler(service);
    const req = {
      user: { agencyId: "agency-1" },
      body: { type: "agencyLogo" },
      file: { path: "/tmp/logo.png", filename: "logo.png" },
    } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(uploadLogo).toHaveBeenCalledWith(
      { agencyId: "agency-1" },
      { path: "/tmp/logo.png", filename: "logo.png" },
      "agencyLogo"
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates logo delete", async () => {
    const deleteLogo = vi.fn().mockResolvedValue({ ok: true, status: 200, data: { message: "ok" } });
    const service = { deleteLogo } as unknown as AgencySettingsService;
    const handler = createAgencySettingsLogoDeleteHandler(service);
    const req = { user: { agencyId: "agency-1" }, params: { type: "agencyLogo" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(deleteLogo).toHaveBeenCalledWith({ agencyId: "agency-1" }, "agencyLogo");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates branding read", async () => {
    const getBranding = vi.fn().mockResolvedValue({ ok: true, status: 200, data: { agencyLogo: null, clientLogo: null, staffLogo: null } });
    const service = { getBranding } as unknown as AgencySettingsService;
    const handler = createAgencySettingsBrandingHandler(service);
    const req = { user: { agencyId: "agency-1", clientId: null } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(getBranding).toHaveBeenCalledWith({ agencyId: "agency-1", clientId: null });
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
