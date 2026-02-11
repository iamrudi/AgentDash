import { describe, expect, it, vi } from "vitest";
import { InitiativeDraftService } from "../server/application/initiatives/initiative-draft-service";

describe("InitiativeDraftService", () => {
  it("fails closed for invalid cost billing on create", async () => {
    const storage = {
      createInitiative: vi.fn(),
    } as any;
    const service = new InitiativeDraftService(storage);

    const result = await service.createInitiative({
      title: "Test",
      billingType: "cost",
      cost: "0",
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(storage.createInitiative).not.toHaveBeenCalled();
  });

  it("infers hours billing on create when only estimatedHours is provided", async () => {
    const storage = {
      createInitiative: vi.fn().mockResolvedValue({ id: "initiative-1" }),
    } as any;
    const service = new InitiativeDraftService(storage);

    const result = await service.createInitiative({
      title: "Hours Initiative",
      estimatedHours: "12",
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(201);
    expect(storage.createInitiative).toHaveBeenCalledWith(
      expect.objectContaining({
        billingType: "hours",
        estimatedHours: 12,
        cost: null,
      })
    );
  });

  it("returns 400 for invalid legacy estimatedHours update payload", async () => {
    const storage = {
      updateInitiative: vi.fn(),
    } as any;
    const service = new InitiativeDraftService(storage);

    const result = await service.updateInitiative("initiative-1", {
      estimatedHours: "-1",
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(storage.updateInitiative).not.toHaveBeenCalled();
  });
});
