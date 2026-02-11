import { describe, expect, it, vi } from "vitest";

vi.mock("../server/middleware/request-context", () => ({
  getRequestContext: () => ({
    userId: "user-1",
    agencyId: "agency-a",
  }),
}));

import { InitiativeIntentService } from "../server/application/initiatives/initiative-intent-service";
import {
  createInitiativeIntentHandler,
  createInitiativeIntentGetHandler,
} from "../server/routes/initiative-intents";

describe("Initiative intents route", () => {
  it("calls the service layer", async () => {
    const createIntent = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      data: { id: "intent-1" },
    });
    const service = { createIntent } as unknown as InitiativeIntentService;

    const req = {
      params: { initiativeId: "initiative-1" },
      body: { intentStatement: "Deliver measurable growth" },
    } as any;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    const handler = createInitiativeIntentHandler(service);
    await handler(req, res);

    expect(createIntent).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("fails closed on invalid payload", async () => {
    const service = new InitiativeIntentService({} as any);
    const handler = createInitiativeIntentHandler(service);

    const req = {
      params: { initiativeId: "initiative-1" },
      body: { intentStatement: "" },
    } as any;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("delegates initiative intent read to service", async () => {
    const getIntentByInitiativeId = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { id: "intent-1" },
    });
    const service = { getIntentByInitiativeId } as unknown as InitiativeIntentService;
    const handler = createInitiativeIntentGetHandler(service);

    const req = {
      params: { initiativeId: "initiative-1" },
    } as any;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await handler(req, res);

    expect(getIntentByInitiativeId).toHaveBeenCalledWith("initiative-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
