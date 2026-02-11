import { describe, expect, it, vi } from "vitest";

vi.mock("../server/middleware/request-context", () => ({
  getRequestContext: () => ({
    userId: "user-1",
    email: "admin@example.com",
    role: "Admin",
    agencyId: "agency-1",
  }),
}));

import { TaskListService } from "../server/application/tasks/task-list-service";
import { TaskQueryService } from "../server/application/tasks/task-query-service";
import { TaskAssignmentService } from "../server/application/tasks/task-assignment-service";
import { TaskMutationService } from "../server/application/tasks/task-mutation-service";
import { TaskReadService } from "../server/application/tasks/task-read-service";
import {
  createTaskListCreateHandler,
  createTaskListUpdateHandler,
  createTaskListDeleteHandler,
  createTaskListTasksHandler,
  createTaskSubtasksHandler,
  createTaskActivitiesHandler,
  createTasksListHandler,
  createStaffAssignmentsListHandler,
  createTaskAssignHandler,
  createTaskUnassignHandler,
  createTaskCreateHandler,
  createTaskUpdateHandler,
  createTaskDeleteHandler,
} from "../server/routes/agency-tasks";

describe("Agency tasks route handlers", () => {
  it("delegates task-list create to service", async () => {
    const createTaskList = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      data: { id: "list-1" },
    });
    const service = { createTaskList } as unknown as TaskListService;
    const handler = createTaskListCreateHandler(service);
    const req = { user: { agencyId: "agency-1", isSuperAdmin: false }, body: { projectId: "project-1", name: "A" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), send: vi.fn() };

    await handler(req, res);

    expect(createTaskList).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("returns fail-closed validation result on update", async () => {
    const service = new TaskListService({} as any);
    const handler = createTaskListUpdateHandler(service);
    const req = { user: { agencyId: "agency-1" }, params: { id: "list-1" }, body: { projectId: 123 } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), send: vi.fn() };

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("delegates task-list delete and returns 204", async () => {
    const deleteTaskList = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
    });
    const service = { deleteTaskList } as unknown as TaskListService;
    const handler = createTaskListDeleteHandler(service);
    const req = { user: { agencyId: "agency-1" }, params: { id: "list-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), send: vi.fn() };

    await handler(req, res);

    expect(deleteTaskList).toHaveBeenCalledWith({ agencyId: "agency-1", isSuperAdmin: undefined }, "list-1");
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("delegates task-list tasks read to read service", async () => {
    const listTasksByListId = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: [{ id: "task-1" }],
    });
    const service = { listTasksByListId } as unknown as TaskReadService;
    const handler = createTaskListTasksHandler(service);
    const req = { params: { listId: "list-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), send: vi.fn() };

    await handler(req, res);

    expect(listTasksByListId).toHaveBeenCalledWith("list-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates subtasks read to read service", async () => {
    const listSubtasks = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: [{ id: "task-2" }],
    });
    const service = { listSubtasks } as unknown as TaskReadService;
    const handler = createTaskSubtasksHandler(service);
    const req = { params: { taskId: "task-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), send: vi.fn() };

    await handler(req, res);

    expect(listSubtasks).toHaveBeenCalledWith("task-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates task activities read to read service", async () => {
    const listTaskActivities = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: [{ id: "activity-1" }],
    });
    const service = { listTaskActivities } as unknown as TaskReadService;
    const handler = createTaskActivitiesHandler(service);
    const req = { params: { taskId: "task-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), send: vi.fn() };

    await handler(req, res);

    expect(listTaskActivities).toHaveBeenCalledWith("task-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates tasks list to query service", async () => {
    const listTasksWithProject = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: [{ id: "task-1" }],
    });
    const service = { listTasksWithProject } as unknown as TaskQueryService;
    const handler = createTasksListHandler(service);
    const req = { user: { agencyId: "agency-1", isSuperAdmin: false } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), send: vi.fn() };

    await handler(req, res);

    expect(listTasksWithProject).toHaveBeenCalledWith({ agencyId: "agency-1", isSuperAdmin: false });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates staff assignments list to query service", async () => {
    const listStaffAssignments = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: [{ id: "assignment-1" }],
    });
    const service = { listStaffAssignments } as unknown as TaskQueryService;
    const handler = createStaffAssignmentsListHandler(service);
    const req = { user: { agencyId: "agency-1", isSuperAdmin: false } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), send: vi.fn() };

    await handler(req, res);

    expect(listStaffAssignments).toHaveBeenCalledWith({ agencyId: "agency-1", isSuperAdmin: false });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates task assignment to assignment service", async () => {
    const assignStaff = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      data: { id: "assignment-1" },
    });
    const service = { assignStaff } as unknown as TaskAssignmentService;
    const handler = createTaskAssignHandler(service);
    const req = { user: { id: "user-1" }, params: { taskId: "task-1" }, body: { staffProfileId: "staff-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), send: vi.fn() };

    await handler(req, res);

    expect(assignStaff).toHaveBeenCalledWith("task-1", "staff-1", { userId: "user-1" });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("delegates task unassignment to assignment service", async () => {
    const unassignStaff = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
    });
    const service = { unassignStaff } as unknown as TaskAssignmentService;
    const handler = createTaskUnassignHandler(service);
    const req = { user: { id: "user-1" }, params: { taskId: "task-1", staffProfileId: "staff-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), send: vi.fn() };

    await handler(req, res);

    expect(unassignStaff).toHaveBeenCalledWith("task-1", "staff-1", { userId: "user-1" });
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("delegates task create to mutation service", async () => {
    const createTask = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      data: { id: "task-1" },
    });
    const service = { createTask } as unknown as TaskMutationService;
    const handler = createTaskCreateHandler(service);
    const req = { user: { agencyId: "agency-1" }, body: { title: "Task" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), send: vi.fn() };

    await handler(req, res);

    expect(createTask).toHaveBeenCalledWith({ title: "Task" }, { agencyId: "agency-1" });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("delegates task update to mutation service", async () => {
    const updateTask = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { id: "task-1" },
    });
    const service = { updateTask } as unknown as TaskMutationService;
    const handler = createTaskUpdateHandler(service);
    const req = { user: { agencyId: "agency-1" }, params: { id: "task-1" }, body: { status: "Completed" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), send: vi.fn() };

    await handler(req, res);

    expect(updateTask).toHaveBeenCalledWith("task-1", { status: "Completed" }, { agencyId: "agency-1" });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates task delete to mutation service", async () => {
    const deleteTask = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
    });
    const service = { deleteTask } as unknown as TaskMutationService;
    const handler = createTaskDeleteHandler(service);
    const req = { params: { id: "task-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), send: vi.fn() };

    await handler(req, res);

    expect(deleteTask).toHaveBeenCalledWith("task-1");
    expect(res.status).toHaveBeenCalledWith(204);
  });
});
