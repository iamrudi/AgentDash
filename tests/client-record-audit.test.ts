import { describe, expect, it, vi } from "vitest";
import { auditClientRecordUpdate } from "../server/clients/client-record-audit";

describe("Client record audit", () => {
  it("emits an audit log when auditable fields are updated", async () => {
    const createAuditLog = vi.fn();
    const storage = { createAuditLog } as any;

    const result = await auditClientRecordUpdate(storage, {
      userId: "user-1",
      clientId: "client-1",
      updates: { retainerAmount: 500 },
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(result.audited).toBe(true);
    expect(result.fields).toContain("retainerAmount");
    expect(createAuditLog).toHaveBeenCalledTimes(1);
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "client.record.update",
        resourceType: "client",
        resourceId: "client-1",
      })
    );
  });

  it("does not emit an audit log for non-catalog fields", async () => {
    const createAuditLog = vi.fn();
    const storage = { createAuditLog } as any;

    const result = await auditClientRecordUpdate(storage, {
      userId: "user-1",
      clientId: "client-1",
      updates: { usedRetainerHours: 3 },
    });

    expect(result.audited).toBe(false);
    expect(createAuditLog).not.toHaveBeenCalled();
  });
});
