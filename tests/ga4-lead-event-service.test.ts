import { describe, expect, it, vi } from "vitest";

vi.mock("../server/clients/client-record-accessor", () => ({
  updateClientRecord: vi.fn(),
}));

import { Ga4LeadEventService } from "../server/application/integrations/ga4-lead-event-service";
import { updateClientRecord } from "../server/clients/client-record-accessor";

describe("Ga4LeadEventService", () => {
  it("returns 404 when GA4 integration is not configured", async () => {
    const storage = {
      getIntegrationByClientId: vi.fn().mockResolvedValue(undefined),
    } as any;
    const service = new Ga4LeadEventService(storage);

    const result = await service.updateLeadEventName(
      { userId: "user-1", email: "admin@example.com", role: "Admin" },
      "client-1",
      "signup"
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
  });

  it("returns 400 when client record sync fails", async () => {
    (updateClientRecord as any).mockResolvedValue({
      ok: false,
      errors: [{ message: "invalid field" }],
    });

    const storage = {
      getIntegrationByClientId: vi.fn().mockResolvedValue({ id: "integration-1" }),
      updateIntegration: vi.fn().mockResolvedValue({ ga4LeadEventName: "signup" }),
    } as any;
    const service = new Ga4LeadEventService(storage);

    const result = await service.updateLeadEventName(
      { userId: "user-1", email: "admin@example.com", role: "Admin" },
      "client-1",
      "signup"
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
  });

  it("updates integration and returns success", async () => {
    (updateClientRecord as any).mockResolvedValue({
      ok: true,
      client: { leadEvents: ["signup", "demo"] },
    });

    const storage = {
      getIntegrationByClientId: vi.fn().mockResolvedValue({ id: "integration-1" }),
      updateIntegration: vi.fn().mockResolvedValue({ ga4LeadEventName: "signup,demo" }),
    } as any;
    const service = new Ga4LeadEventService(storage);

    const result = await service.updateLeadEventName(
      { userId: "user-1", email: "admin@example.com", role: "Admin" },
      "client-1",
      "signup,demo"
    );

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(storage.updateIntegration).toHaveBeenCalledWith("integration-1", {
      ga4LeadEventName: "signup,demo",
    });
  });
});
