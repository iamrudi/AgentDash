import { describe, expect, it, vi } from "vitest";

vi.mock("../server/clients/client-record-accessor", () => ({
  updateClientRecord: vi.fn(),
}));

import { LeadEventsService } from "../server/application/integrations/lead-events-service";
import { updateClientRecord } from "../server/clients/client-record-accessor";

describe("LeadEventsService", () => {
  it("returns 404 when client does not exist", async () => {
    const storage = {
      getClientById: vi.fn().mockResolvedValue(undefined),
    } as any;
    const service = new LeadEventsService(storage);

    const result = await service.saveLeadEvents(
      { userId: "user-1", email: "admin@example.com", role: "Admin" },
      "client-1",
      ["signup"]
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
  });

  it("updates integration lead event string when GA4 integration exists", async () => {
    (updateClientRecord as any).mockResolvedValue({
      ok: true,
      client: { leadEvents: ["signup", "demo"] },
    });

    const storage = {
      getClientById: vi.fn().mockResolvedValue({ id: "client-1" }),
      getIntegrationByClientId: vi.fn().mockResolvedValue({ id: "integration-1" }),
      updateIntegration: vi.fn().mockResolvedValue({}),
    } as any;
    const service = new LeadEventsService(storage);

    const result = await service.saveLeadEvents(
      { userId: "user-1", email: "admin@example.com", role: "Admin" },
      "client-1",
      ["signup", "demo"]
    );

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(storage.updateIntegration).toHaveBeenCalledWith("integration-1", {
      ga4LeadEventName: "signup,demo",
    });
  });
});
