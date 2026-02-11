import { describe, expect, it, vi } from "vitest";

vi.mock("../server/db", () => ({
  db: {
    transaction: vi.fn(),
  },
}));

vi.mock("../server/services/invoiceGenerator", () => ({
  InvoiceGeneratorService: vi.fn().mockImplementation(() => ({
    generateInvoiceFromInitiative: vi.fn(),
  })),
}));

vi.mock("../server/intelligence/outcome-feedback-service", () => ({
  outcomeFeedbackService: {
    captureOutcome: vi.fn().mockResolvedValue(undefined),
  },
}));

import { InitiativeResponseService } from "../server/application/initiatives/initiative-response-service";

describe("InitiativeResponseService", () => {
  it("fails closed on invalid payload", async () => {
    const storage = {} as any;
    const service = new InitiativeResponseService(storage);

    const result = await service.respondToInitiative(
      { userId: "u1", email: "u@e.com", role: "Admin" },
      "initiative-1",
      { response: "invalid" } as any
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
  });

  it("returns 404 when initiative does not exist", async () => {
    const storage = {
      getInitiativeById: vi.fn().mockResolvedValue(undefined),
    } as any;
    const service = new InitiativeResponseService(storage);

    const result = await service.respondToInitiative(
      { userId: "u1", email: "u@e.com", role: "Admin" },
      "initiative-1",
      { response: "approved" }
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
  });

  it("blocks approval when retainer hours are insufficient", async () => {
    const storage = {
      getInitiativeById: vi.fn().mockResolvedValue({
        id: "initiative-1",
        clientId: "client-1",
        billingType: "hours",
        estimatedHours: "12",
      }),
      checkRetainerHours: vi.fn().mockResolvedValue({ available: 4, used: 10, total: 14 }),
      deductRetainerHours: vi.fn(),
    } as any;

    const service = new InitiativeResponseService(storage);
    const result = await service.respondToInitiative(
      { userId: "u1", email: "u@e.com", role: "Admin" },
      "initiative-1",
      { response: "approved" }
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(storage.deductRetainerHours).not.toHaveBeenCalled();
  });

  it("keeps success path when admin notifications fail", async () => {
    const storage = {
      getInitiativeById: vi.fn().mockResolvedValue({
        id: "initiative-1",
        clientId: "client-1",
        title: "Initiative",
        billingType: "cost",
        estimatedHours: null,
        invoiceId: null,
        projectId: "project-1",
        cost: "100",
        impact: null,
        recommendationType: "strategic",
      }),
      updateInitiativeClientResponse: vi.fn().mockResolvedValue({
        id: "initiative-1",
        clientResponse: "discussing",
      }),
      getProfileByUserId: vi.fn().mockResolvedValue({
        id: "profile-1",
        role: "Client",
        fullName: "Test Client",
      }),
      getClientByProfileId: vi.fn().mockResolvedValue({
        id: "client-1",
        companyName: "Acme",
        agencyId: "agency-1",
      }),
      getAllUsersWithProfiles: vi.fn().mockResolvedValue([
        { id: "admin-1", profile: { role: "Admin" } },
      ]),
      createNotification: vi.fn().mockRejectedValue(new Error("notify failed")),
      getClientById: vi.fn().mockResolvedValue(undefined),
    } as any;

    const service = new InitiativeResponseService(storage);
    const result = await service.respondToInitiative(
      { userId: "u-client", email: "client@e.com", role: "Client", agencyId: "agency-1" },
      "initiative-1",
      { response: "discussing", feedback: "Need clarification" }
    );

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(storage.updateInitiativeClientResponse).toHaveBeenCalledTimes(1);
    expect(storage.createNotification).toHaveBeenCalledTimes(1);
  });
});
