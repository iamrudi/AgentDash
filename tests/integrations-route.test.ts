import { describe, expect, it, vi } from "vitest";

vi.mock("../server/middleware/request-context", () => ({
  getRequestContext: () => ({
    userId: "user-1",
    email: "admin@example.com",
    role: "Admin",
    agencyId: "agency-1",
  }),
}));

import { LeadEventsService } from "../server/application/integrations/lead-events-service";
import { Ga4LeadEventService } from "../server/application/integrations/ga4-lead-event-service";
import { Ga4PropertyService } from "../server/application/integrations/ga4-property-service";
import { Ga4ReadService } from "../server/application/integrations/ga4-read-service";
import { GscReadService } from "../server/application/integrations/gsc-read-service";
import { ClientIntegrationService } from "../server/application/integrations/client-integration-service";
import { ClientIntegrationStatusService } from "../server/application/integrations/client-integration-status-service";
import { HubspotAgencyService } from "../server/application/integrations/hubspot-agency-service";
import { LinkedinAgencyService } from "../server/application/integrations/linkedin-agency-service";
import {
  createGa4StatusHandler,
  createGa4DisconnectHandler,
  createGa4LeadEventPatchHandler,
  createGa4KeyEventsHandler,
  createGa4PropertiesHandler,
  createGa4PropertyHandler,
  createHubspotConnectHandler,
  createHubspotDataHandler,
  createHubspotDisconnectHandler,
  createHubspotStatusHandler,
  createLinkedinConnectHandler,
  createLinkedinDataHandler,
  createLinkedinDisconnectHandler,
  createLinkedinStatusHandler,
  createGscStatusHandler,
  createGscDisconnectHandler,
  createGscSiteSaveHandler,
  createGscSitesHandler,
  createLeadEventsHandler,
} from "../server/routes/integrations";

describe("Integrations route", () => {
  it("delegates lead events save to service", async () => {
    const saveLeadEvents = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { message: "Lead events saved successfully", leadEvents: ["signup"] },
    });
    const service = { saveLeadEvents } as unknown as LeadEventsService;

    const req = {
      params: { clientId: "client-1" },
      body: { leadEvents: ["signup"] },
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    const handler = createLeadEventsHandler(service);
    await handler(req, res);

    expect(saveLeadEvents).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("fails closed on invalid lead events payload", async () => {
    const service = new LeadEventsService({} as any);
    const handler = createLeadEventsHandler(service);

    const req = {
      params: { clientId: "client-1" },
      body: { leadEvents: "not-an-array" },
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("delegates GA4 lead-event patch to service", async () => {
    const updateLeadEventName = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { message: "Lead event configuration updated successfully", ga4LeadEventName: "signup" },
    });
    const service = { updateLeadEventName } as unknown as Ga4LeadEventService;

    const req = {
      params: { clientId: "client-1" },
      body: { ga4LeadEventName: "signup" },
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    const handler = createGa4LeadEventPatchHandler(service);
    await handler(req, res);

    expect(updateLeadEventName).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("fails closed on invalid GA4 lead-event patch payload", async () => {
    const service = new Ga4LeadEventService({} as any);
    const handler = createGa4LeadEventPatchHandler(service);

    const req = {
      params: { clientId: "client-1" },
      body: { ga4LeadEventName: 123 },
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("delegates GA4 property save to service", async () => {
    const saveProperty = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { message: "GA4 property and lead event saved successfully" },
    });
    const service = { saveProperty } as unknown as Ga4PropertyService;

    const req = {
      params: { clientId: "client-1" },
      body: { ga4PropertyId: "prop-1", ga4LeadEventName: "signup" },
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    const handler = createGa4PropertyHandler(service);
    await handler(req, res);

    expect(saveProperty).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("fails closed on invalid GA4 property payload", async () => {
    const service = new Ga4PropertyService({} as any);
    const handler = createGa4PropertyHandler(service);

    const req = {
      params: { clientId: "client-1" },
      body: { ga4LeadEventName: "signup" },
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("delegates GA4 properties read to service", async () => {
    const fetchProperties = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: [{ id: "prop-1" }],
    });
    const service = { fetchProperties } as unknown as Ga4ReadService;

    const req = { params: { clientId: "client-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    const handler = createGa4PropertiesHandler(service);
    await handler(req, res);

    expect(fetchProperties).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates GA4 status read to status service", async () => {
    const getGa4Status = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { connected: false },
    });
    const service = { getGa4Status } as unknown as ClientIntegrationStatusService;
    const req = { params: { clientId: "client-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    const handler = createGa4StatusHandler(service);
    await handler(req, res);

    expect(getGa4Status).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates GA4 key-events read to service", async () => {
    const fetchKeyEvents = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: [{ eventName: "signup" }],
    });
    const service = { fetchKeyEvents } as unknown as Ga4ReadService;

    const req = { params: { clientId: "client-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    const handler = createGa4KeyEventsHandler(service);
    await handler(req, res);

    expect(fetchKeyEvents).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates GSC sites read to service", async () => {
    const fetchSites = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: [{ siteUrl: "https://example.com" }],
    });
    const service = { fetchSites } as unknown as GscReadService;

    const req = { params: { clientId: "client-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    const handler = createGscSitesHandler(service);
    await handler(req, res);

    expect(fetchSites).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates GSC status read to status service", async () => {
    const getGscStatus = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { connected: true },
    });
    const service = { getGscStatus } as unknown as ClientIntegrationStatusService;
    const req = { params: { clientId: "client-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    const handler = createGscStatusHandler(service);
    await handler(req, res);

    expect(getGscStatus).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates GA4 disconnect to client integration service", async () => {
    const disconnectGa4 = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { message: "GA4 integration disconnected successfully" },
    });
    const service = { disconnectGa4 } as unknown as ClientIntegrationService;

    const req = { params: { clientId: "client-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    const handler = createGa4DisconnectHandler(service);
    await handler(req, res);

    expect(disconnectGa4).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates GSC site save to client integration service", async () => {
    const saveGscSite = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { message: "Search Console site saved successfully", gscSiteUrl: "https://example.com" },
    });
    const service = { saveGscSite } as unknown as ClientIntegrationService;

    const req = { params: { clientId: "client-1" }, body: { gscSiteUrl: "https://example.com" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    const handler = createGscSiteSaveHandler(service);
    await handler(req, res);

    expect(saveGscSite).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates GSC disconnect to client integration service", async () => {
    const disconnectGsc = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { message: "Search Console integration disconnected successfully" },
    });
    const service = { disconnectGsc } as unknown as ClientIntegrationService;

    const req = { params: { clientId: "client-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    const handler = createGscDisconnectHandler(service);
    await handler(req, res);

    expect(disconnectGsc).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates HubSpot status to agency service", async () => {
    const getStatus = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { connected: true },
    });
    const service = { getStatus } as unknown as HubspotAgencyService;
    const req = { user: { agencyId: "agency-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    const handler = createHubspotStatusHandler(service);
    await handler(req, res);

    expect(getStatus).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates HubSpot connect to agency service", async () => {
    const connect = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { success: true, message: "HubSpot connected successfully" },
    });
    const service = { connect } as unknown as HubspotAgencyService;
    const req = { user: { agencyId: "agency-1" }, body: { accessToken: "token" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    const handler = createHubspotConnectHandler(service);
    await handler(req, res);

    expect(connect).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates HubSpot disconnect to agency service", async () => {
    const disconnect = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { success: true, message: "HubSpot disconnected successfully" },
    });
    const service = { disconnect } as unknown as HubspotAgencyService;
    const req = { user: { agencyId: "agency-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    const handler = createHubspotDisconnectHandler(service);
    await handler(req, res);

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates HubSpot data fetch to agency service", async () => {
    const fetchData = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { contacts: [] },
    });
    const service = { fetchData } as unknown as HubspotAgencyService;
    const req = { user: { agencyId: "agency-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    const handler = createHubspotDataHandler(service);
    await handler(req, res);

    expect(fetchData).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates LinkedIn status to agency service", async () => {
    const getStatus = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { connected: true },
    });
    const service = { getStatus } as unknown as LinkedinAgencyService;
    const req = { user: { agencyId: "agency-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    const handler = createLinkedinStatusHandler(service);
    await handler(req, res);

    expect(getStatus).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates LinkedIn connect to agency service", async () => {
    const connect = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { success: true, message: "LinkedIn connected successfully" },
    });
    const service = { connect } as unknown as LinkedinAgencyService;
    const req = { user: { agencyId: "agency-1" }, body: { accessToken: "token", organizationId: "org-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    const handler = createLinkedinConnectHandler(service);
    await handler(req, res);

    expect(connect).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates LinkedIn disconnect to agency service", async () => {
    const disconnect = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { success: true, message: "LinkedIn disconnected successfully" },
    });
    const service = { disconnect } as unknown as LinkedinAgencyService;
    const req = { user: { agencyId: "agency-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    const handler = createLinkedinDisconnectHandler(service);
    await handler(req, res);

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates LinkedIn data fetch to agency service", async () => {
    const fetchData = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { posts: [] },
    });
    const service = { fetchData } as unknown as LinkedinAgencyService;
    const req = { user: { agencyId: "agency-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    const handler = createLinkedinDataHandler(service);
    await handler(req, res);

    expect(fetchData).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
