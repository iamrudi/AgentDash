import { beforeEach, describe, expect, it, vi } from "vitest";

let authUser: any = null;
vi.mock("../server/middleware/supabase-auth", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    getAuthUserFromToken: vi.fn(async () => authUser),
  };
});

let lastOptions: any = null;
vi.mock("ws", () => {
  class WebSocketServer {
    options: any;
    constructor(opts: any) {
      this.options = opts;
      lastOptions = opts;
    }
    on() {
      return this;
    }
  }
  class WebSocket {}
  return { WebSocketServer, WebSocket };
});

describe("Realtime WebSocket auth", () => {
  beforeEach(() => {
    authUser = null;
    lastOptions = null;
    vi.resetModules();
  });

  it("rejects invalid token", async () => {
    const { realtimeServer } = await import("../server/realtime/websocket-server");
    realtimeServer.initialize({} as any);

    expect(lastOptions?.verifyClient).toBeDefined();

    const info = {
      req: { url: "/ws?token=invalid", headers: { host: "localhost" } },
    };

    const result = await new Promise<{ ok: boolean; code?: number }>((resolve) => {
      lastOptions.verifyClient(info, (ok: boolean, code?: number) => resolve({ ok, code }));
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe(401);
  });

  it("accepts valid token and attaches user", async () => {
    authUser = {
      id: "user-1",
      email: "user@example.com",
      role: "Admin",
      agencyId: "agency-1",
      clientId: null,
      isSuperAdmin: false,
    };

    const { realtimeServer } = await import("../server/realtime/websocket-server");
    realtimeServer.initialize({} as any);

    const info: any = {
      req: { url: "/ws?token=valid", headers: { host: "localhost" } },
    };

    const result = await new Promise<{ ok: boolean }>((resolve) => {
      lastOptions.verifyClient(info, (ok: boolean) => resolve({ ok }));
    });

    expect(result.ok).toBe(true);
    expect(info.req.user).toBeDefined();
    expect(info.req.user.id).toBe("user-1");
  });
});
