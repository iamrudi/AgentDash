import { describe, expect, it, vi } from "vitest";
import { TaskListService } from "../server/application/tasks/task-list-service";

describe("TaskListService", () => {
  it("fails when projectId is missing", async () => {
    const service = new TaskListService({} as any);
    const result = await service.createTaskList({ agencyId: "agency-1" }, {});

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
  });

  it("prevents cross-tenant task-list creation", async () => {
    const storage = {
      getProjectWithAgency: vi.fn().mockResolvedValue({ agencyId: "agency-2" }),
    } as any;
    const service = new TaskListService(storage);

    const result = await service.createTaskList(
      { agencyId: "agency-1", isSuperAdmin: false },
      { projectId: "project-1", name: "List A" }
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
  });

  it("fails closed on invalid payload during update", async () => {
    const service = new TaskListService({} as any);
    const result = await service.updateTaskList({ agencyId: "agency-1" }, "list-1", { projectId: 42 });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
  });

  it("maps not found errors on delete", async () => {
    const storage = {
      deleteTaskList: vi.fn().mockRejectedValue(new Error("not found or access denied")),
    } as any;
    const service = new TaskListService(storage);
    const result = await service.deleteTaskList({ agencyId: "agency-1" }, "list-1");

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
  });
});
