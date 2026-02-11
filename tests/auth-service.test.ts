import { describe, expect, it, vi } from "vitest";
import { AuthService } from "../server/application/auth/auth-service";

describe("AuthService", () => {
  it("fails signup when default agency is missing", async () => {
    const storage = {
      getDefaultAgency: vi.fn().mockResolvedValue(undefined),
    } as any;
    const service = new AuthService(storage, {} as any);

    const result = await service.signup({ email: "a@b.com", password: "secret" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(500);
    expect(result.error).toBe("System configuration error: No default agency found");
  });

  it("returns 401 for login without session", async () => {
    const deps = {
      signInWithPassword: vi.fn().mockResolvedValue({ data: { session: null, user: null } }),
      refreshAccessToken: vi.fn(),
      provisionUser: vi.fn(),
    } as any;
    const service = new AuthService({} as any, deps);

    const result = await service.login({ email: "a@b.com", password: "x" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(result.error).toBe("Invalid credentials");
  });

  it("returns 400 when refresh token is missing", async () => {
    const service = new AuthService({} as any, {} as any);
    const result = await service.refresh({});

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toBe("Refresh token required");
  });

  it("returns 404 when profile missing after login", async () => {
    const deps = {
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { session: { access_token: "a", refresh_token: "r", expires_at: 1 }, user: { id: "u1", email: "u@x.com" } },
      }),
      refreshAccessToken: vi.fn(),
      provisionUser: vi.fn(),
    } as any;
    const storage = {
      getProfileByUserId: vi.fn().mockResolvedValue(undefined),
    } as any;
    const service = new AuthService(storage, deps);

    const result = await service.login({ email: "u@x.com", password: "x" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.error).toBe("Profile not found");
  });

  it("resolves client context in login response", async () => {
    const deps = {
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { session: { access_token: "a", refresh_token: "r", expires_at: 1 }, user: { id: "u1", email: "u@x.com" } },
      }),
      refreshAccessToken: vi.fn(),
      provisionUser: vi.fn(),
    } as any;
    const storage = {
      getProfileByUserId: vi.fn().mockResolvedValue({ id: "p1", role: "Client" }),
      getClientByProfileId: vi.fn().mockResolvedValue({ id: "c1", agencyId: "a1" }),
    } as any;
    const service = new AuthService(storage, deps);

    const result = await service.login({ email: "u@x.com", password: "x" });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect((result.data as any).user.clientId).toBe("c1");
    expect((result.data as any).user.agencyId).toBe("a1");
  });
});
