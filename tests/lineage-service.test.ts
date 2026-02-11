import { describe, expect, it, vi } from "vitest";
import { LineageService } from "../server/application/lineage/lineage-service";

describe("LineageService", () => {
  it("returns 404 when task is missing", async () => {
    const storage = {
      getTaskById: vi.fn().mockResolvedValue(undefined),
    } as any;
    const service = new LineageService(storage);

    const result = await service.getTaskLineage("task-1", { agencyId: "agency-1", isSuperAdmin: false });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.error).toBe("Task not found");
  });
});

