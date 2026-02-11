import { describe, expect, it, vi } from "vitest";
import { ClientReadService } from "../server/application/client/client-read-service";
import { ClientPortfolioService } from "../server/application/client/client-portfolio-service";
import { ClientWorkspaceService } from "../server/application/client/client-workspace-service";
import { ClientMessageService } from "../server/application/client/client-message-service";
import {
  createClientProfileHandler,
  createClientNotificationCountsHandler,
  createClientProjectsHandler,
  createClientInvoicesHandler,
  createClientInitiativesHandler,
  createClientRecentTasksHandler,
  createClientProjectsWithTasksHandler,
  createClientObjectivesHandler,
  createClientMessagesHandler,
  createClientMessageCreateHandler,
} from "../server/routes/client";

describe("Client route handlers", () => {
  it("delegates profile read to service", async () => {
    const profile = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { id: "client-1", companyName: "Acme" },
    });
    const service = { profile } as unknown as ClientReadService;
    const handler = createClientProfileHandler(service);
    const req = { user: { id: "user-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(profile).toHaveBeenCalledWith("user-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates notification counts to service", async () => {
    const notificationCounts = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { unreadMessages: 1, newRecommendations: 2 },
    });
    const service = { notificationCounts } as unknown as ClientReadService;
    const handler = createClientNotificationCountsHandler(service);
    const req = { user: { id: "user-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(notificationCounts).toHaveBeenCalledWith("user-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates projects to portfolio service", async () => {
    const listProjects = vi.fn().mockResolvedValue({ ok: true, status: 200, data: [] });
    const service = { listProjects } as unknown as ClientPortfolioService;
    const handler = createClientProjectsHandler(service);
    const req = { user: { id: "user-1", role: "Admin", agencyId: "agency-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(listProjects).toHaveBeenCalledWith({
      userId: "user-1",
      role: "Admin",
      agencyId: "agency-1",
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates invoices to portfolio service", async () => {
    const listInvoices = vi.fn().mockResolvedValue({ ok: true, status: 200, data: [] });
    const service = { listInvoices } as unknown as ClientPortfolioService;
    const handler = createClientInvoicesHandler(service);
    const req = { user: { id: "user-1", role: "Client", agencyId: null } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(listInvoices).toHaveBeenCalledWith({
      userId: "user-1",
      role: "Client",
      agencyId: null,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates initiatives to portfolio service", async () => {
    const listInitiatives = vi.fn().mockResolvedValue({ ok: true, status: 200, data: [] });
    const service = { listInitiatives } as unknown as ClientPortfolioService;
    const handler = createClientInitiativesHandler(service);
    const req = { user: { id: "user-1", role: "Client", agencyId: null } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(listInitiatives).toHaveBeenCalledWith({
      userId: "user-1",
      role: "Client",
      agencyId: null,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates recent tasks to workspace service", async () => {
    const recentTasks = vi.fn().mockResolvedValue({ ok: true, status: 200, data: [] });
    const service = { recentTasks } as unknown as ClientWorkspaceService;
    const handler = createClientRecentTasksHandler(service);
    const req = { user: { id: "user-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(recentTasks).toHaveBeenCalledWith("user-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates projects-with-tasks to workspace service", async () => {
    const projectsWithTasks = vi.fn().mockResolvedValue({ ok: true, status: 200, data: [] });
    const service = { projectsWithTasks } as unknown as ClientWorkspaceService;
    const handler = createClientProjectsWithTasksHandler(service);
    const req = { user: { id: "user-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(projectsWithTasks).toHaveBeenCalledWith("user-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates objectives to workspace service", async () => {
    const objectives = vi.fn().mockResolvedValue({ ok: true, status: 200, data: [] });
    const service = { objectives } as unknown as ClientWorkspaceService;
    const handler = createClientObjectivesHandler(service);
    const req = { user: { id: "user-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(objectives).toHaveBeenCalledWith("user-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates messages list to workspace service", async () => {
    const messages = vi.fn().mockResolvedValue({ ok: true, status: 200, data: [] });
    const service = { messages } as unknown as ClientWorkspaceService;
    const handler = createClientMessagesHandler(service);
    const req = { user: { id: "user-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(messages).toHaveBeenCalledWith("user-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates message creation to message service", async () => {
    const createMessage = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      data: { id: "msg-1" },
    });
    const service = { createMessage } as unknown as ClientMessageService;
    const handler = createClientMessageCreateHandler(service);
    const req = {
      user: { id: "user-1" },
      body: { subject: "Need update", content: "Please share status" },
    } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(createMessage).toHaveBeenCalledWith("user-1", {
      subject: "Need update",
      content: "Please share status",
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
