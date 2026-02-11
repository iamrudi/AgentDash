import { describe, expect, it, vi } from "vitest";
import { InitiativeIntentService } from "../server/application/initiatives/initiative-intent-service";

describe("InitiativeIntentService", () => {
  it("returns 404 when intent is missing", async () => {
    const storage = {
      getInitiativeIntentByInitiativeId: vi.fn().mockResolvedValue(undefined),
    } as any;
    const service = new InitiativeIntentService(storage);

    const result = await service.getIntentByInitiativeId("initiative-1");

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.error).toBe("Intent not found");
  });

  it("returns intent record when found", async () => {
    const storage = {
      getInitiativeIntentByInitiativeId: vi.fn().mockResolvedValue({
        id: "intent-1",
        initiativeId: "initiative-1",
      }),
    } as any;
    const service = new InitiativeIntentService(storage);

    const result = await service.getIntentByInitiativeId("initiative-1");

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ id: "intent-1", initiativeId: "initiative-1" });
  });
});
