import { describe, expect, it, vi } from "vitest";
import { ObjectiveService } from "../server/application/objectives/objective-service";

describe("ObjectiveService", () => {
  it("lists objectives by client id", async () => {
    const storage = {
      getObjectivesByClientId: vi.fn().mockResolvedValue([{ id: "obj-1" }]),
    } as any;
    const service = new ObjectiveService(storage);

    const result = await service.listByClientId("client-1");

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(storage.getObjectivesByClientId).toHaveBeenCalledWith("client-1");
  });

  it("fails closed on invalid create payload", async () => {
    const service = new ObjectiveService({} as any);
    const result = await service.create("client-1", { description: "", targetMetric: "" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toBe("description and targetMetric are required");
  });
});
