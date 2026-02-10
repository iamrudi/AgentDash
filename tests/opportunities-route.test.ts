import { describe, expect, it, vi } from "vitest";

vi.mock("../server/middleware/request-context", () => ({
  getRequestContext: () => ({
    userId: "user-1",
    agencyId: "agency-1",
  }),
}));

vi.mock("../server/middleware/supabase-auth", async () => {
  const actual = await vi.importActual("../server/middleware/supabase-auth");
  return {
    ...actual,
    verifyClientAccess: vi.fn().mockResolvedValue(true),
  };
});

import { createOpportunityHandler } from "../server/routes/opportunities";

describe("Opportunities route", () => {
  it("uses the opportunity service to persist artifacts", async () => {
    const persistOpportunityArtifact = vi.fn().mockResolvedValue({
      ok: true,
      data: { id: "artifact-1" },
    });
    const service = {
      generateOpportunityArtifactFromAI: vi.fn(),
      persistOpportunityArtifact,
    } as any;

    const req = {
      body: {
        clientId: "9f3e2a1e-1111-4a2d-9f3e-222222222222",
        opportunityStatement: "Increase conversion rate",
      },
      user: { id: "user-1", role: "Admin", agencyId: "agency-1" },
    } as any;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    const handler = createOpportunityHandler(service);
    await handler(req, res);

    expect(persistOpportunityArtifact).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
