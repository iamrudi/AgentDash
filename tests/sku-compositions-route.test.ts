import { describe, expect, it, vi } from "vitest";

vi.mock("../server/middleware/request-context", () => ({
  getRequestContext: () => ({
    userId: "user-1",
    agencyId: "agency-a",
  }),
}));

import { SkuCompositionService } from "../server/application/sku/sku-composition-service";
import { createSkuCompositionHandler } from "../server/routes/sku-compositions";

describe("SKU compositions route", () => {
  it("calls the service layer", async () => {
    const createComposition = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      data: { id: "sku-1" },
    });
    const service = { createComposition } as unknown as SkuCompositionService;

    const req = {
      params: { initiativeId: "initiative-1" },
      body: { productSku: "SKU-1", executionSkus: ["EX-1"] },
    } as any;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    const handler = createSkuCompositionHandler(service);
    await handler(req, res);

    expect(createComposition).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("fails closed on invalid payload", async () => {
    const service = new SkuCompositionService({} as any);
    const handler = createSkuCompositionHandler(service);

    const req = {
      params: { initiativeId: "initiative-1" },
      body: { productSku: "", executionSkus: [] },
    } as any;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
