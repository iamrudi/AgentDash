import { describe, expect, it, vi } from "vitest";
import { AuthService } from "../server/application/auth/auth-service";
import { createSignupHandler, createLoginHandler, createRefreshHandler } from "../server/routes/auth";

describe("Auth route handlers", () => {
  it("delegates signup", async () => {
    const signup = vi.fn().mockResolvedValue({ ok: true, status: 201, data: { message: "ok" } });
    const service = { signup } as unknown as AuthService;
    const handler = createSignupHandler(service);
    const req = { body: { email: "a@b.com", password: "x", fullName: "A", companyName: "Acme" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(signup).toHaveBeenCalledWith({ email: "a@b.com", password: "x", fullName: "A", companyName: "Acme" });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("delegates login", async () => {
    const login = vi.fn().mockResolvedValue({ ok: true, status: 200, data: { token: "t" } });
    const service = { login } as unknown as AuthService;
    const handler = createLoginHandler(service);
    const req = { body: { email: "a@b.com", password: "x" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(login).toHaveBeenCalledWith({ email: "a@b.com", password: "x" });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates refresh", async () => {
    const refresh = vi.fn().mockResolvedValue({ ok: true, status: 200, data: { token: "t" } });
    const service = { refresh } as unknown as AuthService;
    const handler = createRefreshHandler(service);
    const req = { body: { refreshToken: "r" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(refresh).toHaveBeenCalledWith({ refreshToken: "r" });
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
