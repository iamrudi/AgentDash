import { describe, expect, it, vi } from "vitest";
import { AgencyReadService } from "../server/application/agency/agency-read-service";

describe("AgencyReadService", () => {
  it("fails closed on metrics when agency is missing", async () => {
    const service = new AgencyReadService({} as any);
    const result = await service.metrics(undefined);

    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(result.error).toBe("Agency association required");
  });

  it("returns superadmin staff list without agency filter", async () => {
    const storage = {
      getAllStaff: vi.fn().mockResolvedValue([{ id: "staff-1", fullName: "Staff One" }]),
    } as any;
    const service = new AgencyReadService(storage);
    const result = await service.staff({ isSuperAdmin: true, agencyId: undefined });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual([{ id: "staff-1", name: "Staff One" }]);
  });
});
