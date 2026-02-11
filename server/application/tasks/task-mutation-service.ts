import { insertTaskSchema, updateTaskSchema, type Task } from "@shared/schema";
import { durationIntelligenceIntegration } from "../../intelligence/duration-intelligence-integration";
import type { IStorage } from "../../storage";

export interface TaskMutationServiceResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

interface TaskMutationPrincipal {
  agencyId?: string;
}

interface TaskMutationDeps {
  onTaskCreated: (agencyId: string, task: any, params: { taskType: string; complexity: string }) => Promise<unknown>;
  recordTaskCompletion: (
    agencyId: string,
    taskId: string,
    taskType: string,
    complexity: string,
    actualHours: number,
    assigneeId?: string,
    clientId?: string
  ) => Promise<unknown>;
  generateOutcomeFeedback: (agencyId: string, taskId: string) => Promise<unknown>;
  schedule: (fn: () => Promise<void>) => void;
}

const defaultDeps: TaskMutationDeps = {
  onTaskCreated: durationIntelligenceIntegration.onTaskCreated.bind(durationIntelligenceIntegration),
  recordTaskCompletion: durationIntelligenceIntegration.recordTaskCompletion.bind(durationIntelligenceIntegration),
  generateOutcomeFeedback: durationIntelligenceIntegration.generateOutcomeFeedback.bind(durationIntelligenceIntegration),
  schedule: (fn) => setImmediate(() => void fn()),
};

export class TaskMutationService {
  constructor(private storage: IStorage, private deps: TaskMutationDeps = defaultDeps) {}

  async createTask(
    payload: unknown,
    principal: TaskMutationPrincipal
  ): Promise<TaskMutationServiceResult<unknown>> {
    const parsed = insertTaskSchema.safeParse(payload);
    if (!parsed.success) {
      return { ok: false, status: 400, error: parsed.error.errors[0]?.message ?? "Validation failed" };
    }

    const newTask = await this.storage.createTask(parsed.data);

    if (principal.agencyId) {
      const agencyId = principal.agencyId;
      this.deps.schedule(async () => {
        try {
          await this.deps.onTaskCreated(agencyId, newTask, {
            taskType: this.deriveTaskType(newTask.description),
            complexity: this.deriveComplexity(newTask.priority),
          });
        } catch {
          // Non-blocking intelligence side-effect.
        }
      });
    }

    return { ok: true, status: 201, data: newTask };
  }

  async updateTask(
    taskId: string,
    payload: unknown,
    principal: TaskMutationPrincipal
  ): Promise<TaskMutationServiceResult<unknown>> {
    const input = payload as Record<string, unknown>;
    const trackedError = this.validateHalfHour(input.timeTracked, "Time tracked");
    if (trackedError) {
      return { ok: false, status: 400, error: trackedError };
    }

    const estimateError = this.validateHalfHour(input.timeEstimate, "Time estimate");
    if (estimateError) {
      return { ok: false, status: 400, error: estimateError };
    }

    const parsed = updateTaskSchema.safeParse(payload);
    if (!parsed.success) {
      return { ok: false, status: 400, error: parsed.error.errors[0]?.message ?? "Validation failed" };
    }

    const oldTask = await this.storage.getTaskById(taskId);

    const updateData = parsed.data;
    const storageData: Partial<Task> = {
      ...updateData,
      timeEstimate:
        updateData.timeEstimate !== undefined && updateData.timeEstimate !== null
          ? String(updateData.timeEstimate)
          : (updateData.timeEstimate as string | null | undefined),
      timeTracked:
        updateData.timeTracked !== undefined && updateData.timeTracked !== null
          ? String(updateData.timeTracked)
          : (updateData.timeTracked as string | null | undefined),
    };

    const updatedTask = await this.storage.updateTask(taskId, storageData);

    if (
      oldTask &&
      oldTask.status !== "Completed" &&
      updatedTask.status === "Completed" &&
      principal.agencyId
    ) {
      const agencyId = principal.agencyId;
      this.deps.schedule(async () => {
        try {
          const assignments = await this.storage.getAssignmentsByTaskId(updatedTask.id);
          const assigneeId = assignments.length > 0 ? assignments[0].staffProfileId : undefined;

          let clientId: string | undefined;
          if (updatedTask.projectId) {
            const project = await this.storage.getProjectById(updatedTask.projectId);
            clientId = project?.clientId ?? undefined;
          }

          const actualHours = updatedTask.timeTracked ? parseFloat(updatedTask.timeTracked) : 0;

          await this.deps.recordTaskCompletion(
            agencyId,
            updatedTask.id,
            this.deriveTaskType(updatedTask.description),
            this.deriveComplexity(updatedTask.priority),
            actualHours,
            assigneeId,
            clientId
          );

          await this.deps.generateOutcomeFeedback(agencyId, updatedTask.id);
        } catch {
          // Non-blocking intelligence side-effect.
        }
      });
    }

    return { ok: true, status: 200, data: updatedTask };
  }

  async deleteTask(taskId: string): Promise<TaskMutationServiceResult<undefined>> {
    await this.storage.deleteTask(taskId);
    return { ok: true, status: 204 };
  }

  private deriveTaskType(description: string | null | undefined): string {
    const text = (description ?? "").toLowerCase();
    if (text.includes("design")) return "design";
    if (text.includes("content")) return "content";
    if (text.includes("dev")) return "development";
    if (text.includes("seo")) return "seo";
    return "general";
  }

  private deriveComplexity(priority: string | null | undefined): string {
    if (priority === "High") return "high";
    if (priority === "Low") return "low";
    return "medium";
  }

  private validateHalfHour(value: unknown, label: "Time tracked" | "Time estimate"): string | null {
    if (value === undefined || value === null) {
      return null;
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0 || (numeric * 2) % 1 !== 0) {
      return `${label} must be a non-negative number in 0.5 hour increments (0, 0.5, 1, 1.5, etc.)`;
    }
    return null;
  }
}
