import type { IStorage } from "../../storage";

export interface StaffReadResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export class StaffReadService {
  constructor(private readonly storage: IStorage) {}

  async listTasks(agencyId: string | null | undefined): Promise<StaffReadResult<unknown>> {
    if (!agencyId) {
      return { ok: false, status: 403, error: "Agency association required" };
    }

    const allTasks = await this.storage.getAllTasks(agencyId);
    const tasksWithProjects = await Promise.all(
      allTasks.map(async (task) => {
        const project = task.projectId ? await this.storage.getProjectById(task.projectId) : undefined;
        return { ...task, project };
      })
    );

    return { ok: true, status: 200, data: tasksWithProjects };
  }

  async listFullTasks(params: {
    agencyId: string | null | undefined;
    userId: string;
    role: string;
  }): Promise<StaffReadResult<unknown>> {
    if (!params.agencyId) {
      return { ok: false, status: 403, error: "Agency association required" };
    }

    const profile = await this.storage.getProfileByUserId(params.userId);
    if (!profile) {
      return { ok: false, status: 403, error: "Profile not found" };
    }

    const allTasks = await this.storage.getAllTasks(params.agencyId);
    const tasksToReturn = params.role === "Staff"
      ? await Promise.all(
          allTasks.map(async (task) => {
            const assignments = await this.storage.getAssignmentsByTaskId(task.id);
            const isAssigned = assignments.some((entry) => entry.staffProfileId === profile.id);
            return isAssigned ? task : null;
          })
        ).then((tasks) => tasks.filter((entry): entry is typeof allTasks[number] => entry !== null))
      : allTasks;

    const tasksWithAssignments = await Promise.all(
      tasksToReturn.map(async (task) => {
        const assignments = await this.storage.getAssignmentsByTaskId(task.id);
        const assignmentsWithProfiles = await Promise.all(
          assignments.map(async (assignment) => {
            const assigneeProfile = await this.storage.getProfileById(assignment.staffProfileId);
            return { ...assignment, staffProfile: assigneeProfile };
          })
        );
        return { ...task, assignments: assignmentsWithProfiles };
      })
    );

    return { ok: true, status: 200, data: tasksWithAssignments };
  }

  async notificationCounts(userId: string): Promise<StaffReadResult<{ newTasks: number; highPriorityTasks: number }>> {
    const profile = await this.storage.getProfileByUserId(userId);
    if (!profile) {
      return { ok: true, status: 200, data: { newTasks: 0, highPriorityTasks: 0 } };
    }

    const counts = await this.storage.getStaffNotificationCounts(profile.id);
    return { ok: true, status: 200, data: counts };
  }
}
