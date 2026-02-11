import { describe, expect, it, vi } from "vitest";
import { AgencyUserService } from "../server/application/agency-users/agency-user-service";
import {
  createAgencyClientUserCreateHandler,
  createAgencyStaffAdminUserCreateHandler,
  createAgencyUsersListHandler,
  createAgencyUsersRoleUpdateHandler,
  createAgencyUsersDeleteHandler,
} from "../server/routes/agency-users";

describe("Agency users route handlers", () => {
  it("delegates users list to service", async () => {
    const listUsers = vi.fn().mockResolvedValue({ ok: true, status: 200, data: [{ id: "u1" }] });
    const service = { listUsers } as unknown as AgencyUserService;
    const handler = createAgencyUsersListHandler(service);
    const req = { user: { id: "user-1", role: "Admin", agencyId: "agency-1" }, query: {} } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(listUsers).toHaveBeenCalledWith("agency-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates role update to service", async () => {
    const updateRole = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { message: "User role updated successfully" },
    });
    const service = { updateRole } as unknown as AgencyUserService;
    const handler = createAgencyUsersRoleUpdateHandler(service);
    const req = { params: { userId: "user-2" }, body: { role: "Staff" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(updateRole).toHaveBeenCalledWith("user-2", "Staff");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates delete to service", async () => {
    const deleteUser = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { message: "User deleted successfully" },
    });
    const service = { deleteUser } as unknown as AgencyUserService;
    const handler = createAgencyUsersDeleteHandler(service);
    const req = { user: { id: "user-1" }, params: { userId: "user-2" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(deleteUser).toHaveBeenCalledWith("user-1", "user-2");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates client user creation to service", async () => {
    const createClientUser = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      data: { message: "Client created successfully" },
    });
    const service = { createClientUser } as unknown as AgencyUserService;
    const handler = createAgencyClientUserCreateHandler(service);
    const req = {
      user: { id: "user-1", role: "Admin", agencyId: "agency-1" },
      body: {
        email: "client@example.com",
        password: "ValidPassw0rd!",
        fullName: "Client User",
        companyName: "Acme Co",
      },
    } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(createClientUser).toHaveBeenCalledWith(
      "agency-1",
      expect.objectContaining({
        email: "client@example.com",
        fullName: "Client User",
      }),
      "user-1"
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("delegates staff/admin user creation to service", async () => {
    const createStaffOrAdminUser = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      data: { message: "Staff user created successfully" },
    });
    const service = { createStaffOrAdminUser } as unknown as AgencyUserService;
    const handler = createAgencyStaffAdminUserCreateHandler(service);
    const req = {
      user: { id: "user-1", role: "Admin", agencyId: "agency-1" },
      body: {
        email: "staff@example.com",
        password: "ValidPassw0rd!",
        fullName: "Staff User",
        role: "Staff",
      },
    } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(createStaffOrAdminUser).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
