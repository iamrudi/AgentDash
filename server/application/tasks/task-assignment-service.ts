import type { IStorage } from "../../storage";

export interface TaskAssignmentServiceResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

interface AssignmentActor {
  userId?: string;
}

export class TaskAssignmentService {
  constructor(private storage: IStorage) {}

  async assignStaff(
    taskId: string,
    staffProfileId: unknown,
    actor: AssignmentActor
  ): Promise<TaskAssignmentServiceResult<unknown>> {
    if (!staffProfileId || typeof staffProfileId !== "string") {
      return { ok: false, status: 400, error: "Staff profile ID is required" };
    }

    const staffProfile = await this.storage.getStaffProfileById(staffProfileId);
    if (!staffProfile) {
      return { ok: false, status: 404, error: "Staff profile not found" };
    }

    const assignment = await this.storage.createStaffAssignment({
      taskId,
      staffProfileId,
    });

    if (actor.userId) {
      try {
        await this.storage.createTaskActivity({
          taskId,
          userId: actor.userId,
          action: "assignee_added",
          fieldName: "assignees",
          newValue: staffProfile.fullName,
        });
      } catch {
        // Non-blocking activity logging.
      }
    }

    return { ok: true, status: 201, data: assignment };
  }

  async unassignStaff(
    taskId: string,
    staffProfileId: string,
    actor: AssignmentActor
  ): Promise<TaskAssignmentServiceResult<undefined>> {
    const staffProfile = await this.storage.getStaffProfileById(staffProfileId);
    await this.storage.deleteStaffAssignment(taskId, staffProfileId);

    if (actor.userId && staffProfile) {
      try {
        await this.storage.createTaskActivity({
          taskId,
          userId: actor.userId,
          action: "assignee_removed",
          fieldName: "assignees",
          oldValue: staffProfile.fullName,
        });
      } catch {
        // Non-blocking activity logging.
      }
    }

    return { ok: true, status: 204 };
  }
}
