import { describe, expect, it, vi } from "vitest";
import { TestUserService } from "../server/application/test/test-user-service";

describe("TestUserService", () => {
  it("returns 404 outside development", async () => {
    const service = new TestUserService({} as any, {} as any);
    const result = await service.createUser({ env: "production" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.error).toBe("Not found");
  });

  it("returns 500 when default agency is missing for client role", async () => {
    const storage = {
      getDefaultAgency: vi.fn().mockResolvedValue(undefined),
    } as any;
    const service = new TestUserService(storage, {} as any);

    const result = await service.createUser({ env: "development", role: "Client" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(500);
    expect(result.error).toBe("System configuration error: No default agency found");
  });

  it("creates test user with requested agency", async () => {
    const storage = {
      getDefaultAgency: vi.fn(),
    } as any;
    const deps = {
      provisionUser: vi.fn().mockResolvedValue({ profileId: "profile-1" }),
    } as any;
    const service = new TestUserService(storage, deps);

    const result = await service.createUser({
      env: "development",
      email: "a@b.com",
      password: "secret",
      fullName: "A",
      role: "Admin",
      requestedAgencyId: "agency-1",
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(201);
    expect(deps.provisionUser).toHaveBeenCalledWith({
      email: "a@b.com",
      password: "secret",
      fullName: "A",
      role: "Admin",
      agencyId: "agency-1",
      clientData: undefined,
    });
  });
});
