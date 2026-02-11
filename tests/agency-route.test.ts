import { describe, expect, it, vi } from "vitest";
import { AgencyReadService } from "../server/application/agency/agency-read-service";
import { AgencyClientService } from "../server/application/agency/agency-client-service";
import { AgencyInitiativeService } from "../server/application/agency/agency-initiative-service";
import { AgencyProjectService } from "../server/application/agency/agency-project-service";
import {
  createAgencyClientsListHandler,
  createAgencyClientGetHandler,
  createAgencyClientUpdateHandler,
  createAgencyClientRetainerHoursHandler,
  createAgencyClientResetRetainerHoursHandler,
  createAgencyClientMetricsHandler,
  createAgencyMetricsHandler,
  createAgencyInitiativesHandler,
  createAgencyIntegrationsHandler,
  createAgencyStaffHandler,
  createAgencyMessagesHandler,
  createAgencyNotificationCountsHandler,
  createAgencyInitiativeMarkViewedHandler,
  createAgencyProjectsListHandler,
  createAgencyProjectCreateHandler,
  createAgencyProjectGetHandler,
  createAgencyProjectUpdateHandler,
  createAgencyProjectListsHandler,
} from "../server/routes/agency";

describe("Agency route handlers", () => {
  it("delegates client list to client service", async () => {
    const listClients = vi.fn().mockResolvedValue({ ok: true, status: 200, data: [] });
    const service = { listClients } as unknown as AgencyClientService;
    const handler = createAgencyClientsListHandler(service);
    const req = { user: { id: "user-1", role: "Admin", agencyId: "agency-1" }, query: {} } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(listClients).toHaveBeenCalledWith("agency-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates client get to client service", async () => {
    const getClient = vi.fn().mockResolvedValue({ ok: true, status: 200, data: { id: "client-1" } });
    const service = { getClient } as unknown as AgencyClientService;
    const handler = createAgencyClientGetHandler(service);
    const req = { params: { clientId: "client-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(getClient).toHaveBeenCalledWith("client-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates client update to client service", async () => {
    const updateClient = vi.fn().mockResolvedValue({ ok: true, status: 200, data: { id: "client-1" } });
    const service = { updateClient } as unknown as AgencyClientService;
    const handler = createAgencyClientUpdateHandler(service);
    const req = {
      user: { id: "user-1" },
      ctx: {
        userId: "user-1",
        email: "admin@example.com",
        role: "Admin",
        agencyId: "agency-1",
      },
      params: { clientId: "client-1" },
      body: { leadValue: 100 },
    } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(updateClient).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates retainer hours read to client service", async () => {
    const retainerHours = vi.fn().mockResolvedValue({ ok: true, status: 200, data: {} });
    const service = { retainerHours } as unknown as AgencyClientService;
    const handler = createAgencyClientRetainerHoursHandler(service);
    const req = { params: { clientId: "client-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(retainerHours).toHaveBeenCalledWith("client-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates retainer reset to client service", async () => {
    const resetRetainerHours = vi.fn().mockResolvedValue({ ok: true, status: 200, data: {} });
    const service = { resetRetainerHours } as unknown as AgencyClientService;
    const handler = createAgencyClientResetRetainerHoursHandler(service);
    const req = { params: { clientId: "client-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(resetRetainerHours).toHaveBeenCalledWith("client-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates client metrics to client service", async () => {
    const clientMetrics = vi.fn().mockResolvedValue({ ok: true, status: 200, data: [] });
    const service = { clientMetrics } as unknown as AgencyClientService;
    const handler = createAgencyClientMetricsHandler(service);
    const req = { params: { clientId: "client-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(clientMetrics).toHaveBeenCalledWith("client-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates metrics to read service", async () => {
    const metrics = vi.fn().mockResolvedValue({ ok: true, status: 200, data: [] });
    const service = { metrics } as unknown as AgencyReadService;
    const handler = createAgencyMetricsHandler(service);
    const req = { user: { agencyId: "agency-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(metrics).toHaveBeenCalledWith("agency-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates initiatives to read service", async () => {
    const initiatives = vi.fn().mockResolvedValue({ ok: true, status: 200, data: [] });
    const service = { initiatives } as unknown as AgencyReadService;
    const handler = createAgencyInitiativesHandler(service);
    const req = { user: { agencyId: "agency-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(initiatives).toHaveBeenCalledWith("agency-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates integrations to read service", async () => {
    const integrations = vi.fn().mockResolvedValue({ ok: true, status: 200, data: [] });
    const service = { integrations } as unknown as AgencyReadService;
    const handler = createAgencyIntegrationsHandler(service);
    const req = { user: { agencyId: "agency-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(integrations).toHaveBeenCalledWith("agency-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates staff list to read service", async () => {
    const staff = vi.fn().mockResolvedValue({ ok: true, status: 200, data: [] });
    const service = { staff } as unknown as AgencyReadService;
    const handler = createAgencyStaffHandler(service);
    const req = { user: { isSuperAdmin: false, agencyId: "agency-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(staff).toHaveBeenCalledWith({ isSuperAdmin: false, agencyId: "agency-1" });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates messages list to read service", async () => {
    const messages = vi.fn().mockResolvedValue({ ok: true, status: 200, data: [] });
    const service = { messages } as unknown as AgencyReadService;
    const handler = createAgencyMessagesHandler(service);
    const req = { user: { agencyId: "agency-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(messages).toHaveBeenCalledWith("agency-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates notification counts to read service", async () => {
    const notificationCounts = vi.fn().mockResolvedValue({ ok: true, status: 200, data: {} });
    const service = { notificationCounts } as unknown as AgencyReadService;
    const handler = createAgencyNotificationCountsHandler(service);
    const req = { user: { agencyId: "agency-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(notificationCounts).toHaveBeenCalledWith("agency-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates initiative mark viewed to initiative service", async () => {
    const markResponsesViewed = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    const service = { markResponsesViewed } as unknown as AgencyInitiativeService;
    const handler = createAgencyInitiativeMarkViewedHandler(service);
    const req = {} as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), send: vi.fn() };

    await handler(req, res);

    expect(markResponsesViewed).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledTimes(1);
  });

  it("delegates projects list to project service", async () => {
    const listProjects = vi.fn().mockResolvedValue({ ok: true, status: 200, data: [] });
    const service = { listProjects } as unknown as AgencyProjectService;
    const handler = createAgencyProjectsListHandler(service);
    const req = { user: { agencyId: "agency-1", isSuperAdmin: false } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(listProjects).toHaveBeenCalledWith({ agencyId: "agency-1", isSuperAdmin: false });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates project create to project service", async () => {
    const createProject = vi.fn().mockResolvedValue({ ok: true, status: 201, data: { id: "project-1" } });
    const service = { createProject } as unknown as AgencyProjectService;
    const handler = createAgencyProjectCreateHandler(service);
    const req = { user: { agencyId: "agency-1", isSuperAdmin: false }, body: { name: "Project" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(createProject).toHaveBeenCalledWith({ agencyId: "agency-1", isSuperAdmin: false }, { name: "Project" });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("delegates project get to project service", async () => {
    const getProject = vi.fn().mockResolvedValue({ ok: true, status: 200, data: { id: "project-1" } });
    const service = { getProject } as unknown as AgencyProjectService;
    const handler = createAgencyProjectGetHandler(service);
    const req = { params: { id: "project-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(getProject).toHaveBeenCalledWith("project-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates project update to project service", async () => {
    const updateProject = vi.fn().mockResolvedValue({ ok: true, status: 200, data: { id: "project-1" } });
    const service = { updateProject } as unknown as AgencyProjectService;
    const handler = createAgencyProjectUpdateHandler(service);
    const req = { params: { id: "project-1" }, body: { status: "Active" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(updateProject).toHaveBeenCalledWith("project-1", { status: "Active" });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates project task-list read to project service", async () => {
    const listTaskLists = vi.fn().mockResolvedValue({ ok: true, status: 200, data: [] });
    const service = { listTaskLists } as unknown as AgencyProjectService;
    const handler = createAgencyProjectListsHandler(service);
    const req = { params: { projectId: "project-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(listTaskLists).toHaveBeenCalledWith("project-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
