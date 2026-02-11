import { describe, expect, it, vi } from "vitest";
import { OAuthService } from "../server/application/oauth/oauth-service";

describe("OAuthService", () => {
  it("fails initiate when profile is missing", async () => {
    const storage = {
      getProfileByUserId: vi.fn().mockResolvedValue(undefined),
    } as any;
    const service = new OAuthService(storage, {} as any);

    const result = await service.initiate({ userId: "u1", service: "GA4" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.error).toBe("Profile not found");
  });

  it("fails initiate when admin omits clientId", async () => {
    const storage = {
      getProfileByUserId: vi.fn().mockResolvedValue({ id: "p1", role: "Admin" }),
    } as any;
    const deps = {
      generateOAuthState: vi.fn(),
      getAuthUrl: vi.fn(),
      exchangeCodeForTokens: vi.fn(),
      verifyOAuthState: vi.fn(),
    } as any;
    const service = new OAuthService(storage, deps);

    const result = await service.initiate({ userId: "u1", service: "GA4" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toBe("clientId query parameter required for Admin/SuperAdmin");
  });

  it("returns missing-parameters redirect when callback query is incomplete", async () => {
    const service = new OAuthService({} as any, {} as any);
    const result = await service.callback({ code: "abc" });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ kind: "redirect", location: "/client?oauth_error=missing_parameters" });
  });

  it("returns invalid-state redirect when state verification fails", async () => {
    const deps = {
      verifyOAuthState: vi.fn(() => {
        throw new Error("bad state");
      }),
      exchangeCodeForTokens: vi.fn(),
      getAuthUrl: vi.fn(),
      generateOAuthState: vi.fn(),
    } as any;
    const service = new OAuthService({} as any, deps);

    const result = await service.callback({ code: "abc", state: "bad" });

    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ kind: "redirect", location: "/client?oauth_error=invalid_state" });
  });

  it("returns popup html on callback success for popup flow", async () => {
    const storage = {
      getIntegrationByClientId: vi.fn().mockResolvedValue(undefined),
      createIntegration: vi.fn().mockResolvedValue({ id: "int-1" }),
      updateIntegration: vi.fn(),
    } as any;
    const deps = {
      verifyOAuthState: vi.fn().mockReturnValue({
        clientId: "client-1",
        initiatedBy: "Admin",
        service: "GA4",
        returnTo: "/agency/integrations",
        popup: true,
        origin: "https://app.example.com",
      }),
      exchangeCodeForTokens: vi.fn().mockResolvedValue({ accessToken: "a", refreshToken: "r", expiresAt: null }),
      getAuthUrl: vi.fn(),
      generateOAuthState: vi.fn(),
    } as any;
    const service = new OAuthService(storage, deps);

    const result = await service.callback({ code: "abc", state: "ok" });

    expect(result.ok).toBe(true);
    expect(result.data?.kind).toBe("html");
    expect((result.data as any).html).toContain("GOOGLE_OAUTH_SUCCESS");
    expect(storage.createIntegration).toHaveBeenCalledTimes(1);
  });
});
