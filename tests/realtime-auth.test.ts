import { beforeEach, describe, expect, it, vi } from "vitest";

let authUser: any = null;
vi.mock("../server/middleware/supabase-auth", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    getAuthUserFromToken: vi.fn(async () => authUser),
  };
});

vi.mock("../server/realtime/realtime-service", () => ({
  realtimeService: {
    registerSSEClient: vi.fn(() => "client-1"),
  },
}));

describe("Realtime auth", () => {
  beforeEach(() => {
    authUser = null;
    vi.resetModules();
  });

  it("rejects SSE stream without token", async () => {
    const { default: realtimeRoutes } = await import("../server/realtime/realtime-routes");
    const handler = realtimeRoutes.stack.find((layer: any) => layer.route?.path === "/stream").route.stack[0].handle;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    await handler({ query: {} } as any, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("accepts SSE stream with valid token", async () => {
    authUser = {
      id: "user-1",
      email: "user@example.com",
      role: "Admin",
      agencyId: "agency-1",
      clientId: null,
      isSuperAdmin: false,
    };

    const { default: realtimeRoutes } = await import("../server/realtime/realtime-routes");
    const handler = realtimeRoutes.stack.find((layer: any) => layer.route?.path === "/stream").route.stack[0].handle;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    const req = {
      query: { token: "valid-token", channels: "agency:agency-1" },
      headers: {},
      on: vi.fn(),
    } as any;

    await handler(req, res);

    expect(res.status).not.toHaveBeenCalledWith(401);
  });
});
