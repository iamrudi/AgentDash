import { describe, expect, it, vi } from "vitest";
import { UserProfileService } from "../server/application/user/user-profile-service";
import {
  createUserProfileUpdateHandler,
  createUserProfileGetHandler,
} from "../server/routes/user";

describe("User route handlers", () => {
  it("delegates profile update to service", async () => {
    const updateProfile = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { message: "Profile updated successfully", profile: { id: "p1" } },
    });
    const service = { updateProfile } as unknown as UserProfileService;
    const handler = createUserProfileUpdateHandler(service);
    const req = { user: { id: "user-1" }, body: { fullName: "New Name" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(updateProfile).toHaveBeenCalledWith("user-1", { fullName: "New Name" });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates profile get to service", async () => {
    const getProfile = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { id: "p1" },
    });
    const service = { getProfile } as unknown as UserProfileService;
    const handler = createUserProfileGetHandler(service);
    const req = { user: { id: "user-1" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(getProfile).toHaveBeenCalledWith("user-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
