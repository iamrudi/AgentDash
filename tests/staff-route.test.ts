import { describe, expect, it, vi } from "vitest";
import { StaffReadService } from "../server/application/staff/staff-read-service";
import {
  createStaffTasksHandler,
  createStaffFullTasksHandler,
  createStaffNotificationCountsHandler,
} from "../server/routes/staff";

describe("Staff route handlers", () => {
  it("delegates tasks list to service", async () => {
    const listTasks = vi.fn().mockResolvedValue({ ok: true, status: 200, data: [] });
    const service = { listTasks } as unknown as StaffReadService;
    const handler = createStaffTasksHandler(service);
    const req = { user: { agencyId: "agency-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(listTasks).toHaveBeenCalledWith("agency-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates full tasks list to service", async () => {
    const listFullTasks = vi.fn().mockResolvedValue({ ok: true, status: 200, data: [] });
    const service = { listFullTasks } as unknown as StaffReadService;
    const handler = createStaffFullTasksHandler(service);
    const req = { user: { id: "user-1", role: "Staff", agencyId: "agency-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(listFullTasks).toHaveBeenCalledWith({
      agencyId: "agency-1",
      userId: "user-1",
      role: "Staff",
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates notification counts to service", async () => {
    const notificationCounts = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { newTasks: 1, highPriorityTasks: 2 },
    });
    const service = { notificationCounts } as unknown as StaffReadService;
    const handler = createStaffNotificationCountsHandler(service);
    const req = { user: { id: "user-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(notificationCounts).toHaveBeenCalledWith("user-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
