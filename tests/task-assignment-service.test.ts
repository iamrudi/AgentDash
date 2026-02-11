import { describe, expect, it, vi } from "vitest";
import { TaskAssignmentService } from "../server/application/tasks/task-assignment-service";

describe("TaskAssignmentService", () => {
  it("returns 400 when staffProfileId is missing", async () => {
    const service = new TaskAssignmentService({} as any);
    const result = await service.assignStaff("task-1", undefined, { userId: "user-1" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
  });

  it("returns 404 when staff profile does not exist", async () => {
    const storage = {
      getStaffProfileById: vi.fn().mockResolvedValue(undefined),
    } as any;
    const service = new TaskAssignmentService(storage);
    const result = await service.assignStaff("task-1", "staff-1", { userId: "user-1" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
  });

  it("creates assignment and logs activity", async () => {
    const storage = {
      getStaffProfileById: vi.fn().mockResolvedValue({ id: "staff-1", fullName: "Jane Doe" }),
      createStaffAssignment: vi.fn().mockResolvedValue({ id: "assignment-1" }),
      createTaskActivity: vi.fn().mockResolvedValue(undefined),
    } as any;
    const service = new TaskAssignmentService(storage);
    const result = await service.assignStaff("task-1", "staff-1", { userId: "user-1" });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(201);
    expect(storage.createStaffAssignment).toHaveBeenCalledWith({
      taskId: "task-1",
      staffProfileId: "staff-1",
    });
    expect(storage.createTaskActivity).toHaveBeenCalledTimes(1);
  });

  it("unassigns staff and returns 204", async () => {
    const storage = {
      getStaffProfileById: vi.fn().mockResolvedValue({ id: "staff-1", fullName: "Jane Doe" }),
      deleteStaffAssignment: vi.fn().mockResolvedValue(undefined),
      createTaskActivity: vi.fn().mockResolvedValue(undefined),
    } as any;
    const service = new TaskAssignmentService(storage);
    const result = await service.unassignStaff("task-1", "staff-1", { userId: "user-1" });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(204);
    expect(storage.deleteStaffAssignment).toHaveBeenCalledWith("task-1", "staff-1");
  });
});
