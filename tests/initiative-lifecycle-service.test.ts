import { describe, expect, it, vi } from "vitest";

const generateInvoiceFromInitiativeMock = vi.fn();

vi.mock("../server/services/invoiceGenerator", () => ({
  InvoiceGeneratorService: vi.fn().mockImplementation(() => ({
    generateInvoiceFromInitiative: generateInvoiceFromInitiativeMock,
  })),
}));

import { InitiativeLifecycleService } from "../server/application/initiatives/initiative-lifecycle-service";

describe("InitiativeLifecycleService", () => {
  it("generates invoice and remains successful if audit write fails", async () => {
    generateInvoiceFromInitiativeMock.mockResolvedValue("invoice-1");
    const storage = {
      createAuditLog: vi.fn().mockRejectedValue(new Error("audit fail")),
    } as any;

    const service = new InitiativeLifecycleService(storage);
    const result = await service.generateInvoice(
      { userId: "user-1", email: "admin@e.com", role: "Admin" },
      "initiative-1"
    );

    expect(result.ok).toBe(true);
    expect(result.status).toBe(201);
    expect(result.data).toEqual({
      invoiceId: "invoice-1",
      message: "Invoice generated successfully",
    });
  });

  it("returns 500 when soft delete fails", async () => {
    const storage = {
      softDeleteInitiative: vi.fn().mockRejectedValue(new Error("db unavailable")),
    } as any;
    const service = new InitiativeLifecycleService(storage);

    const result = await service.softDeleteInitiative(
      { userId: "user-1", email: "admin@e.com", role: "Admin" },
      "initiative-1"
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe(500);
  });

  it("returns deleted initiatives list", async () => {
    const storage = {
      getDeletedInitiatives: vi.fn().mockResolvedValue([{ id: "initiative-1" }]),
    } as any;
    const service = new InitiativeLifecycleService(storage);

    const result = await service.getDeletedInitiatives();

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual([{ id: "initiative-1" }]);
  });
});
