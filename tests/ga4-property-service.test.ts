import { describe, expect, it, vi } from "vitest";

vi.mock("../server/clients/client-record-accessor", () => ({
  updateClientRecord: vi.fn(),
}));

import { updateClientRecord } from "../server/clients/client-record-accessor";
import { Ga4PropertyService } from "../server/application/integrations/ga4-property-service";

describe("Ga4PropertyService", () => {
  it("returns 400 when ga4PropertyId is missing", async () => {
    const service = new Ga4PropertyService({} as any);
    const result = await service.saveProperty(
      { userId: "user-1", email: "admin@example.com", role: "Admin" },
      "client-1",
      { ga4LeadEventName: "signup" }
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
  });

  it("returns 404 when GA4 integration does not exist", async () => {
    const storage = {
      getIntegrationByClientId: vi.fn().mockResolvedValue(undefined),
    } as any;
    const service = new Ga4PropertyService(storage);
    const result = await service.saveProperty(
      { userId: "user-1", email: "admin@example.com", role: "Admin" },
      "client-1",
      { ga4PropertyId: "prop-1" }
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
  });

  it("returns 400 when client record update fails", async () => {
    (updateClientRecord as any).mockResolvedValue({
      ok: false,
      errors: [{ message: "invalid" }],
    });

    const storage = {
      getIntegrationByClientId: vi.fn().mockResolvedValue({ id: "integration-1" }),
      updateIntegration: vi.fn().mockResolvedValue({
        ga4PropertyId: "prop-1",
        ga4LeadEventName: "signup",
      }),
    } as any;
    const service = new Ga4PropertyService(storage);
    const result = await service.saveProperty(
      { userId: "user-1", email: "admin@example.com", role: "Admin" },
      "client-1",
      { ga4PropertyId: "prop-1", ga4LeadEventName: "signup" }
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
  });

  it("updates GA4 property and lead events successfully", async () => {
    (updateClientRecord as any).mockResolvedValue({
      ok: true,
      client: { leadEvents: ["signup"] },
    });

    const storage = {
      getIntegrationByClientId: vi.fn().mockResolvedValue({ id: "integration-1" }),
      updateIntegration: vi.fn().mockResolvedValue({
        ga4PropertyId: "prop-1",
        ga4LeadEventName: "signup",
      }),
    } as any;
    const service = new Ga4PropertyService(storage);
    const result = await service.saveProperty(
      { userId: "user-1", email: "admin@example.com", role: "Admin" },
      "client-1",
      { ga4PropertyId: "prop-1", ga4LeadEventName: "signup" }
    );

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(storage.updateIntegration).toHaveBeenCalledWith("integration-1", {
      ga4PropertyId: "prop-1",
      ga4LeadEventName: "signup",
    });
  });
});
