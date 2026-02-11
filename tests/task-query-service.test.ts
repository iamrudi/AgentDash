import { describe, expect, it, vi } from "vitest";
import { TaskQueryService } from "../server/application/tasks/task-query-service";

describe("TaskQueryService", () => {
  it("returns 403 when non-superadmin has no agency", async () => {
    const service = new TaskQueryService({} as any);
    const result = await service.listTasksWithProject({ isSuperAdmin: false });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
  });

  it("returns tasks with project data", async () => {
    const storage = {
      getAllTasks: vi.fn().mockResolvedValue([{ id: "task-1", projectId: "project-1" }]),
      getProjectById: vi.fn().mockResolvedValue({ id: "project-1", name: "Website Redesign" }),
    } as any;
    const service = new TaskQueryService(storage);
    const result = await service.listTasksWithProject({ agencyId: "agency-1" });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(storage.getAllTasks).toHaveBeenCalledWith("agency-1");
    expect(storage.getProjectById).toHaveBeenCalledWith("project-1");
  });

  it("returns staff assignments with agency scope", async () => {
    const storage = {
      getAllTaskAssignments: vi.fn().mockResolvedValue([{ id: "assign-1" }]),
    } as any;
    const service = new TaskQueryService(storage);
    const result = await service.listStaffAssignments({ agencyId: "agency-1" });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(storage.getAllTaskAssignments).toHaveBeenCalledWith("agency-1");
  });
});
