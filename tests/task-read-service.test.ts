import { describe, expect, it, vi } from "vitest";
import { TaskReadService } from "../server/application/tasks/task-read-service";

describe("TaskReadService", () => {
  it("lists tasks by list id", async () => {
    const storage = {
      getTasksByListId: vi.fn().mockResolvedValue([{ id: "task-1" }]),
    } as any;
    const service = new TaskReadService(storage);
    const result = await service.listTasksByListId("list-1");

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(storage.getTasksByListId).toHaveBeenCalledWith("list-1");
  });

  it("lists subtasks by task id", async () => {
    const storage = {
      getSubtasksByParentId: vi.fn().mockResolvedValue([{ id: "task-2" }]),
    } as any;
    const service = new TaskReadService(storage);
    const result = await service.listSubtasks("task-1");

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(storage.getSubtasksByParentId).toHaveBeenCalledWith("task-1");
  });

  it("lists task activities by task id", async () => {
    const storage = {
      getTaskActivities: vi.fn().mockResolvedValue([{ id: "activity-1" }]),
    } as any;
    const service = new TaskReadService(storage);
    const result = await service.listTaskActivities("task-1");

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(storage.getTaskActivities).toHaveBeenCalledWith("task-1");
  });
});
