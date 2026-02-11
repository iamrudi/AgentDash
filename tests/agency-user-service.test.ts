import { describe, expect, it, vi } from "vitest";
import { AgencyUserService } from "../server/application/agency-users/agency-user-service";

describe("AgencyUserService", () => {
  it("lists users by agency", async () => {
    const storage = {
      getAllUsersWithProfiles: vi.fn().mockResolvedValue([{ id: "u1" }]),
    } as any;
    const service = new AgencyUserService(storage, {} as any);

    const result = await service.listUsers("agency-1");

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(storage.getAllUsersWithProfiles).toHaveBeenCalledWith("agency-1");
  });

  it("rejects invalid role updates", async () => {
    const service = new AgencyUserService({} as any, {} as any);
    const result = await service.updateRole("user-1", "Owner");

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toBe("Invalid role");
  });

  it("rejects deleting own account", async () => {
    const service = new AgencyUserService({} as any, {} as any);
    const result = await service.deleteUser("user-1", "user-1");

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toBe("Cannot delete your own account");
  });

  it("creates client user via provisioning dependency", async () => {
    const deps = {
      deleteUser: vi.fn(),
      provisionUser: vi.fn().mockResolvedValue({ clientId: "client-1" }),
    };
    const storage = {
      getProfileById: vi.fn().mockResolvedValue({ id: "admin-1", role: "Admin", agencyId: "agency-1" }),
    } as any;
    const service = new AgencyUserService(storage, deps);

    const result = await service.createClientUser("agency-1", {
      email: "client@example.com",
      password: "ValidPassw0rd!",
      fullName: "Client User",
      companyName: "Acme Co",
      agencyId: "agency-1",
    }, "admin-1");

    expect(result.ok).toBe(true);
    expect(result.status).toBe(201);
    expect(deps.provisionUser).toHaveBeenCalledTimes(1);
    expect(deps.provisionUser).toHaveBeenCalledWith(
      expect.objectContaining({
        clientData: expect.objectContaining({
          accountManagerProfileId: "admin-1",
        }),
      })
    );
  });

  it("rejects account manager outside agency admin role", async () => {
    const invalidManagerId = "11111111-1111-4111-8111-111111111111";
    const deps = {
      deleteUser: vi.fn(),
      provisionUser: vi.fn(),
    };
    const storage = {
      getProfileById: vi.fn().mockResolvedValue({ id: invalidManagerId, role: "Staff", agencyId: "agency-1" }),
    } as any;
    const service = new AgencyUserService(storage, deps);

    const result = await service.createClientUser("agency-1", {
      email: "client@example.com",
      password: "ValidPassw0rd!",
      fullName: "Client User",
      companyName: "Acme Co",
      accountManagerProfileId: invalidManagerId,
    }, "admin-1");

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toBe("Account manager must be an Admin in the same agency");
    expect(deps.provisionUser).not.toHaveBeenCalled();
  });

  it("fails closed for invalid staff/admin payload", async () => {
    const service = new AgencyUserService({} as any, {} as any);
    const result = await service.createStaffOrAdminUser("agency-1", {
      email: "bad-email",
      password: "short",
      fullName: "",
      role: "Owner",
      agencyId: "agency-1",
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toBe("Validation failed");
  });
});
