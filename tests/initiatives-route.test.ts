import { describe, expect, it, vi } from "vitest";

vi.mock("../server/middleware/request-context", () => ({
  getRequestContext: () => ({
    userId: "user-1",
    email: "user@example.com",
    role: "Client",
    agencyId: "agency-1",
  }),
}));

import { InitiativeResponseService } from "../server/application/initiatives/initiative-response-service";
import { InitiativeSendService } from "../server/application/initiatives/initiative-send-service";
import { InitiativeDraftService } from "../server/application/initiatives/initiative-draft-service";
import { InitiativeLifecycleService } from "../server/application/initiatives/initiative-lifecycle-service";
import {
  createInitiativeCreateHandler,
  createInitiativeGenerateInvoiceHandler,
  createInitiativePermanentDeleteHandler,
  createInitiativeRespondHandler,
  createInitiativeRestoreHandler,
  createInitiativeSendHandler,
  createInitiativeSoftDeleteHandler,
  createInitiativeTrashListHandler,
  createInitiativeUpdateHandler,
} from "../server/routes/initiatives";

describe("Initiatives route", () => {
  it("delegates create handling to the initiative draft service", async () => {
    const createInitiative = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      data: { id: "initiative-1" },
    });
    const service = { createInitiative } as unknown as InitiativeDraftService;

    const req = {
      body: { title: "Grow traffic", billingType: "cost", cost: "1500" },
    } as any;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    const handler = createInitiativeCreateHandler(service);
    await handler(req, res);

    expect(createInitiative).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("delegates update handling to the initiative draft service", async () => {
    const updateInitiative = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { id: "initiative-1" },
    });
    const service = { updateInitiative } as unknown as InitiativeDraftService;

    const req = {
      params: { id: "initiative-1" },
      body: { title: "Revised title" },
    } as any;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    const handler = createInitiativeUpdateHandler(service);
    await handler(req, res);

    expect(updateInitiative).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates send handling to the initiative send service", async () => {
    const sendInitiative = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { id: "initiative-1", status: "sent" },
    });
    const service = { sendInitiative } as unknown as InitiativeSendService;

    const req = {
      params: { id: "initiative-1" },
    } as any;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    const handler = createInitiativeSendHandler(service);
    await handler(req, res);

    expect(sendInitiative).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates invoice generation to lifecycle service", async () => {
    const generateInvoice = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      data: { invoiceId: "inv-1", message: "Invoice generated successfully" },
    });
    const service = { generateInvoice } as unknown as InitiativeLifecycleService;

    const req = { params: { id: "initiative-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    const handler = createInitiativeGenerateInvoiceHandler(service);
    await handler(req, res);

    expect(generateInvoice).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("delegates soft delete to lifecycle service", async () => {
    const softDeleteInitiative = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { message: "Initiative moved to trash", initiative: { id: "initiative-1" } },
    });
    const service = { softDeleteInitiative } as unknown as InitiativeLifecycleService;

    const req = { params: { id: "initiative-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    const handler = createInitiativeSoftDeleteHandler(service);
    await handler(req, res);

    expect(softDeleteInitiative).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates restore to lifecycle service", async () => {
    const restoreInitiative = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { message: "Initiative restored", initiative: { id: "initiative-1" } },
    });
    const service = { restoreInitiative } as unknown as InitiativeLifecycleService;

    const req = { params: { id: "initiative-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    const handler = createInitiativeRestoreHandler(service);
    await handler(req, res);

    expect(restoreInitiative).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates trash list to lifecycle service", async () => {
    const getDeletedInitiatives = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: [{ id: "initiative-1" }],
    });
    const service = { getDeletedInitiatives } as unknown as InitiativeLifecycleService;

    const req = {} as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    const handler = createInitiativeTrashListHandler(service);
    await handler(req, res);

    expect(getDeletedInitiatives).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates permanent delete to lifecycle service", async () => {
    const permanentlyDeleteInitiative = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { message: "Initiative permanently deleted" },
    });
    const service = { permanentlyDeleteInitiative } as unknown as InitiativeLifecycleService;

    const req = { params: { id: "initiative-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    const handler = createInitiativePermanentDeleteHandler(service);
    await handler(req, res);

    expect(permanentlyDeleteInitiative).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates response handling to the initiative response service", async () => {
    const respondToInitiative = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { id: "initiative-1", clientResponse: "approved" },
    });
    const service = { respondToInitiative } as unknown as InitiativeResponseService;

    const req = {
      params: { id: "initiative-1" },
      body: { response: "approved", feedback: "looks good" },
    } as any;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    const handler = createInitiativeRespondHandler(service);
    await handler(req, res);

    expect(respondToInitiative).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("fails closed on invalid response payload", async () => {
    const service = new InitiativeResponseService({} as any);
    const handler = createInitiativeRespondHandler(service);

    const req = {
      params: { id: "initiative-1" },
      body: { response: "invalid-value" },
    } as any;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("fails closed on invalid create billing payload", async () => {
    const service = new InitiativeDraftService({} as any);
    const handler = createInitiativeCreateHandler(service);

    const req = {
      body: { billingType: "cost", cost: "0" },
    } as any;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
