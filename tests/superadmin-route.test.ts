import { describe, expect, it, vi } from "vitest";

vi.mock("../server/middleware/request-context", () => ({
  getRequestContext: () => ({
    userId: "super-1",
    email: "superadmin@example.com",
    role: "SuperAdmin",
    agencyId: null,
  }),
}));

import { SuperadminReadService } from "../server/application/superadmin/superadmin-read-service";
import { SuperadminUserService } from "../server/application/superadmin/superadmin-user-service";
import { SuperadminAgencyService } from "../server/application/superadmin/superadmin-agency-service";
import { SuperadminRecommendationService } from "../server/application/superadmin/superadmin-recommendation-service";
import {
  createSuperadminUsersListHandler,
  createSuperadminAgenciesListHandler,
  createSuperadminClientsListHandler,
  createSuperadminRecommendationsListHandler,
  createSuperadminAuditLogsHandler,
  createSuperadminUserEmailHandler,
  createSuperadminUserPasswordHandler,
  createSuperadminUserPromoteHandler,
  createSuperadminUserRoleHandler,
  createSuperadminUserDeleteHandler,
  createSuperadminAgencyDeleteHandler,
  createSuperadminClientDeleteHandler,
  createSuperadminAgencySettingsGetHandler,
  createSuperadminAgencySettingsUpdateHandler,
  createSuperadminRecommendationRequestHandler,
} from "../server/routes/superadmin";

describe("Superadmin route handlers", () => {
  it("delegates users list to read service", async () => {
    const listUsers = vi.fn().mockResolvedValue({ ok: true, status: 200, data: [{ id: "u1" }] });
    const service = { listUsers } as unknown as SuperadminReadService;
    const handler = createSuperadminUsersListHandler(service);
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler({} as any, res);

    expect(listUsers).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates agencies list to read service", async () => {
    const listAgencies = vi.fn().mockResolvedValue({ ok: true, status: 200, data: [{ id: "a1" }] });
    const service = { listAgencies } as unknown as SuperadminReadService;
    const handler = createSuperadminAgenciesListHandler(service);
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler({} as any, res);

    expect(listAgencies).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates clients list to read service", async () => {
    const listClients = vi.fn().mockResolvedValue({ ok: true, status: 200, data: [{ id: "c1" }] });
    const service = { listClients } as unknown as SuperadminReadService;
    const handler = createSuperadminClientsListHandler(service);
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler({} as any, res);

    expect(listClients).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates recommendations list to read service", async () => {
    const listRecommendations = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: [{ id: "r1" }],
    });
    const service = { listRecommendations } as unknown as SuperadminReadService;
    const handler = createSuperadminRecommendationsListHandler(service);
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler({} as any, res);

    expect(listRecommendations).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates audit logs list to read service with query params", async () => {
    const listAuditLogs = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: [{ id: "log-1" }],
    });
    const service = { listAuditLogs } as unknown as SuperadminReadService;
    const handler = createSuperadminAuditLogsHandler(service);
    const req = { query: { limit: "50", offset: "10" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(listAuditLogs).toHaveBeenCalledWith("50", "10");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates user email update to user service", async () => {
    const updateEmail = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { message: "User email updated successfully" },
    });
    const service = { updateEmail } as unknown as SuperadminUserService;
    const handler = createSuperadminUserEmailHandler(service);
    const req = {
      user: { id: "super-1" },
      params: { userId: "user-1" },
      body: { email: "new@example.com" },
      ip: "127.0.0.1",
      get: vi.fn().mockReturnValue("test-agent"),
    } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(updateEmail).toHaveBeenCalledWith("user-1", { email: "new@example.com" });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates user password update to user service", async () => {
    const updatePassword = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { message: "User password updated successfully" },
    });
    const service = { updatePassword } as unknown as SuperadminUserService;
    const handler = createSuperadminUserPasswordHandler(service);
    const req = {
      user: { id: "super-1" },
      params: { userId: "user-1" },
      body: { password: "ValidPassw0rd!" },
      ip: "127.0.0.1",
      get: vi.fn().mockReturnValue("test-agent"),
    } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(updatePassword).toHaveBeenCalledWith("user-1", { password: "ValidPassw0rd!" });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates promote superadmin to user service", async () => {
    const promoteToSuperadmin = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { message: "User promoted to SuperAdmin successfully", profile: { id: "user-1" } },
    });
    const service = { promoteToSuperadmin } as unknown as SuperadminUserService;
    const handler = createSuperadminUserPromoteHandler(service);
    const req = {
      user: { id: "super-1" },
      params: { userId: "user-1" },
      ip: "127.0.0.1",
      get: vi.fn().mockReturnValue("test-agent"),
    } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(promoteToSuperadmin).toHaveBeenCalledWith("user-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates role update to user service", async () => {
    const updateRole = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { message: "User role updated successfully", profile: { id: "user-1" } },
    });
    const service = { updateRole } as unknown as SuperadminUserService;
    const handler = createSuperadminUserRoleHandler(service);
    const req = {
      user: { id: "super-1" },
      params: { userId: "user-1" },
      body: { role: "Admin", agencyId: "agency-1" },
      ip: "127.0.0.1",
      get: vi.fn().mockReturnValue("test-agent"),
    } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(updateRole).toHaveBeenCalledWith("user-1", { role: "Admin", agencyId: "agency-1" });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates user delete to user service", async () => {
    const deleteUser = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { message: "User deleted successfully" },
    });
    const service = { deleteUser } as unknown as SuperadminUserService;
    const handler = createSuperadminUserDeleteHandler(service);
    const req = {
      user: { id: "super-1" },
      params: { userId: "user-1" },
      ip: "127.0.0.1",
      get: vi.fn().mockReturnValue("test-agent"),
    } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(deleteUser).toHaveBeenCalledWith("user-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates agency delete to agency service", async () => {
    const deleteAgency = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { message: "Agency deleted successfully" },
    });
    const service = { deleteAgency } as unknown as SuperadminAgencyService;
    const handler = createSuperadminAgencyDeleteHandler(service);
    const req = {
      user: { id: "super-1" },
      params: { agencyId: "agency-1" },
      ip: "127.0.0.1",
      get: vi.fn().mockReturnValue("test-agent"),
    } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(deleteAgency).toHaveBeenCalledWith("agency-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates client delete to agency service", async () => {
    const deleteClient = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { message: "Client deleted successfully" },
    });
    const service = { deleteClient } as unknown as SuperadminAgencyService;
    const handler = createSuperadminClientDeleteHandler(service);
    const req = {
      user: { id: "super-1" },
      params: { clientId: "client-1" },
      ip: "127.0.0.1",
      get: vi.fn().mockReturnValue("test-agent"),
    } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(deleteClient).toHaveBeenCalledWith("client-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates agency settings read to agency service", async () => {
    const getAgencySettings = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { agencyId: "agency-1", aiProvider: "gemini", isDefault: false },
    });
    const service = { getAgencySettings } as unknown as SuperadminAgencyService;
    const handler = createSuperadminAgencySettingsGetHandler(service);
    const req = {
      params: { agencyId: "agency-1" },
    } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(getAgencySettings).toHaveBeenCalledWith("agency-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates agency settings update to agency service", async () => {
    const updateAgencySettings = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { agencyId: "agency-1", aiProvider: "openai", isDefault: false },
    });
    const service = { updateAgencySettings } as unknown as SuperadminAgencyService;
    const handler = createSuperadminAgencySettingsUpdateHandler(service);
    const req = {
      user: { id: "super-1" },
      params: { agencyId: "agency-1" },
      body: { aiProvider: "openai" },
      ip: "127.0.0.1",
      get: vi.fn().mockReturnValue("test-agent"),
    } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(updateAgencySettings).toHaveBeenCalledWith("agency-1", { aiProvider: "openai" });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates recommendation request to recommendation service", async () => {
    const requestRecommendations = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      data: { success: true, signalId: "signal-1" },
    });
    const service = { requestRecommendations } as unknown as SuperadminRecommendationService;
    const handler = createSuperadminRecommendationRequestHandler(service);
    const req = {
      user: { id: "super-1" },
      params: { clientId: "client-1" },
      body: { preset: "quick-wins" },
      ip: "127.0.0.1",
      get: vi.fn().mockReturnValue("test-agent"),
    } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(requestRecommendations).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(202);
  });
});
