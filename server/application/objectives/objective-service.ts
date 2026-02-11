import { z } from "zod";
import type { IStorage } from "../../storage";

const createObjectiveSchema = z.object({
  description: z.string().min(1),
  targetMetric: z.string().min(1),
});

export interface ObjectiveResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export class ObjectiveService {
  constructor(private readonly storage: IStorage) {}

  async listByClientId(clientId: string): Promise<ObjectiveResult<unknown>> {
    const objectives = await this.storage.getObjectivesByClientId(clientId);
    return { ok: true, status: 200, data: objectives };
  }

  async create(clientId: string, payload: unknown): Promise<ObjectiveResult<unknown>> {
    const parsed = createObjectiveSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        status: 400,
        error: "description and targetMetric are required",
      };
    }

    const objective = await this.storage.createObjective({
      clientId,
      description: parsed.data.description,
      targetMetric: parsed.data.targetMetric,
    } as any);

    return { ok: true, status: 201, data: objective };
  }

  async update(objectiveId: string, updates: unknown): Promise<ObjectiveResult<unknown>> {
    const updated = await this.storage.updateObjective(objectiveId, updates as any);
    return { ok: true, status: 200, data: updated };
  }

  async delete(objectiveId: string): Promise<ObjectiveResult<undefined>> {
    await this.storage.deleteObjective(objectiveId);
    return { ok: true, status: 204 };
  }
}
