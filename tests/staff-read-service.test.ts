import { describe, expect, it, vi } from "vitest";
import { StaffReadService } from "../server/application/staff/staff-read-service";

describe("StaffReadService", () => {
  it("fails closed when agency is missing", async () => {
    const service = new StaffReadService({} as any);
    const result = await service.listTasks(undefined);

    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(result.error).toBe("Agency association required");
  });

  it("returns default notification counts when profile is missing", async () => {
    const storage = {
      getProfileByUserId: vi.fn().mockResolvedValue(undefined),
    } as any;
    const service = new StaffReadService(storage);
    const result = await service.notificationCounts("user-1");

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ newTasks: 0, highPriorityTasks: 0 });
  });
});
