import { describe, expect, it, vi } from "vitest";
import { TaskMutationService } from "../server/application/tasks/task-mutation-service";

describe("TaskMutationService", () => {
  it("fails closed on invalid create payload", async () => {
    const service = new TaskMutationService({} as any);
    const result = await service.createTask({ title: "" }, { agencyId: "agency-1" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
  });

  it("creates task and triggers onTaskCreated side-effect", async () => {
    const storage = {
      createTask: vi.fn().mockResolvedValue({ id: "task-1", description: "SEO update", priority: "High" }),
    } as any;
    const onTaskCreated = vi.fn().mockResolvedValue(undefined);
    const scheduled: Array<() => Promise<void>> = [];
    const service = new TaskMutationService(storage, {
      onTaskCreated,
      recordTaskCompletion: vi.fn(),
      generateOutcomeFeedback: vi.fn(),
      schedule: (fn) => scheduled.push(fn),
    });

    const result = await service.createTask(
      { description: "SEO update", priority: "High", status: "To Do" },
      { agencyId: "agency-1" }
    );
    await Promise.all(scheduled.map((fn) => fn()));

    expect(result.ok).toBe(true);
    expect(result.status).toBe(201);
    expect(onTaskCreated).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid half-hour increments", async () => {
    const service = new TaskMutationService({} as any);
    const result = await service.updateTask("task-1", { timeTracked: 1.25 }, { agencyId: "agency-1" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
  });

  it("records completion signals when task transitions to completed", async () => {
    const storage = {
      getTaskById: vi.fn().mockResolvedValue({ id: "task-1", status: "In Progress" }),
      updateTask: vi.fn().mockResolvedValue({
        id: "task-1",
        status: "Completed",
        description: "content draft",
        priority: "Low",
        timeTracked: "2",
        projectId: "project-1",
      }),
      getAssignmentsByTaskId: vi.fn().mockResolvedValue([{ staffProfileId: "staff-1" }]),
      getProjectById: vi.fn().mockResolvedValue({ clientId: "client-1" }),
    } as any;
    const recordTaskCompletion = vi.fn().mockResolvedValue(undefined);
    const generateOutcomeFeedback = vi.fn().mockResolvedValue(undefined);
    const scheduled: Array<() => Promise<void>> = [];
    const service = new TaskMutationService(storage, {
      onTaskCreated: vi.fn(),
      recordTaskCompletion,
      generateOutcomeFeedback,
      schedule: (fn) => scheduled.push(fn),
    });

    const result = await service.updateTask("task-1", { status: "Completed", timeTracked: 2 }, { agencyId: "agency-1" });
    await Promise.all(scheduled.map((fn) => fn()));

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(recordTaskCompletion).toHaveBeenCalledTimes(1);
    expect(generateOutcomeFeedback).toHaveBeenCalledTimes(1);
  });

  it("deletes task successfully", async () => {
    const storage = {
      deleteTask: vi.fn().mockResolvedValue(undefined),
    } as any;
    const service = new TaskMutationService(storage);
    const result = await service.deleteTask("task-1");

    expect(result.ok).toBe(true);
    expect(result.status).toBe(204);
  });
});
