import { describe, expect, it, vi } from "vitest";
import { OpportunityReadService } from "../server/application/opportunities/opportunity-read-service";

describe("OpportunityReadService", () => {
  it("lists opportunity artifacts by client id", async () => {
    const storage = {
      getOpportunityArtifactsByClientId: vi.fn().mockResolvedValue([{ id: "artifact-1" }]),
    } as any;
    const service = new OpportunityReadService(storage);

    const result = await service.listByClientId("client-1");

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual([{ id: "artifact-1" }]);
    expect(storage.getOpportunityArtifactsByClientId).toHaveBeenCalledWith("client-1");
  });
});
