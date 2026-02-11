import { describe, expect, it, vi } from "vitest";
import { UserProfileService } from "../server/application/user/user-profile-service";

describe("UserProfileService", () => {
  it("fails closed on invalid update payload", async () => {
    const service = new UserProfileService({} as any);
    const result = await service.updateProfile("user-1", { fullName: "" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toBe("Invalid profile data");
  });

  it("returns 404 when profile is missing on read", async () => {
    const storage = {
      getProfileByUserId: vi.fn().mockResolvedValue(undefined),
    } as any;
    const service = new UserProfileService(storage);
    const result = await service.getProfile("user-1");

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.error).toBe("Profile not found");
  });
});
