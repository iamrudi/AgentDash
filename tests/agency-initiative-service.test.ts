import { describe, expect, it, vi } from "vitest";
import { AgencyInitiativeService } from "../server/application/agency/agency-initiative-service";

describe("AgencyInitiativeService", () => {
  it("marks initiative responses viewed", async () => {
    const storage = {
      markInitiativeResponsesViewed: vi.fn().mockResolvedValue(undefined),
    } as any;
    const service = new AgencyInitiativeService(storage);

    const result = await service.markResponsesViewed();

    expect(result.ok).toBe(true);
    expect(result.status).toBe(204);
    expect(storage.markInitiativeResponsesViewed).toHaveBeenCalledTimes(1);
  });
});
