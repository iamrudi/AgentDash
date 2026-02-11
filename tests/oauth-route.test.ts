import { describe, expect, it, vi } from "vitest";
import { OAuthService } from "../server/application/oauth/oauth-service";
import { createOAuthInitiateHandler, createOAuthCallbackHandler } from "../server/routes/oauth";

describe("OAuth route handlers", () => {
  it("delegates initiate", async () => {
    const initiate = vi.fn().mockResolvedValue({ ok: true, status: 200, data: { authUrl: "https://auth" } });
    const service = { initiate } as unknown as OAuthService;
    const handler = createOAuthInitiateHandler(service);
    const req = {
      user: { id: "u1" },
      query: { service: "GA4", returnTo: "/client", clientId: "c1", popup: "true" },
      get: vi.fn((key: string) => (key === "origin" ? "https://app.example.com" : undefined)),
    } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(initiate).toHaveBeenCalledWith({
      userId: "u1",
      service: "GA4",
      returnTo: "/client",
      clientId: "c1",
      popup: true,
      origin: "https://app.example.com",
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("delegates callback redirect", async () => {
    const callback = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { kind: "redirect", location: "/client?x=1" },
    });
    const service = { callback } as unknown as OAuthService;
    const handler = createOAuthCallbackHandler(service);
    const req = { query: { code: "abc", state: "st" } } as any;
    const res = { redirect: vi.fn(), type: vi.fn().mockReturnThis(), send: vi.fn() };

    await handler(req, res);

    expect(callback).toHaveBeenCalledWith({ code: "abc", state: "st" });
    expect(res.redirect).toHaveBeenCalledWith("/client?x=1");
  });

  it("delegates callback html", async () => {
    const callback = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { kind: "html", html: "<html></html>" },
    });
    const service = { callback } as unknown as OAuthService;
    const handler = createOAuthCallbackHandler(service);
    const req = { query: { code: "abc", state: "st" } } as any;
    const res = { redirect: vi.fn(), type: vi.fn().mockReturnThis(), send: vi.fn() };

    await handler(req, res);

    expect(res.type).toHaveBeenCalledWith("text/html");
    expect(res.send).toHaveBeenCalledWith("<html></html>");
  });
});
