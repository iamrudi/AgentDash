import { describe, expect, it, vi } from "vitest";
import { SuperadminUserService } from "../server/application/superadmin/superadmin-user-service";

describe("SuperadminUserService", () => {
  it("fails closed on invalid email payload", async () => {
    const service = new SuperadminUserService({} as any, {} as any);
    const result = await service.updateEmail("user-1", { email: "bad-email" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
  });

  it("returns 404 when updating password for missing user", async () => {
    const storage = {
      getUserById: vi.fn().mockResolvedValue(undefined),
    } as any;
    const service = new SuperadminUserService(storage, {} as any);
    const result = await service.updatePassword("user-1", { password: "ValidPassw0rd!" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
  });

  it("rejects invalid role updates", async () => {
    const service = new SuperadminUserService({} as any, {} as any);
    const result = await service.updateRole("user-1", { role: "Owner" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
  });

  it("deletes user and returns audit payload", async () => {
    const storage = {
      getUserById: vi.fn().mockResolvedValue({ id: "user-1", email: "user@example.com" }),
    } as any;
    const deps = {
      updateUserEmail: vi.fn(),
      updateUserPassword: vi.fn(),
      promoteUserToSuperAdmin: vi.fn(),
      updateUserRole: vi.fn(),
      deleteUser: vi.fn().mockResolvedValue(undefined),
      getAuthUserEmail: vi.fn(),
    };
    const service = new SuperadminUserService(storage, deps);
    const result = await service.deleteUser("user-1");

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.auditEvent?.action).toBe("user.delete");
    expect(deps.deleteUser).toHaveBeenCalledWith("user-1");
  });
});
