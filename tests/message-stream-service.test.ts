import { describe, expect, it, vi } from "vitest";
import { MessageStreamService } from "../server/application/messages/message-stream-service";

describe("MessageStreamService", () => {
  it("fails when auth token is missing", async () => {
    const service = new MessageStreamService({} as any, {} as any);
    const result = await service.authenticateStream(undefined);

    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(result.error).toBe("Authentication token required");
  });

  it("fails when token is invalid", async () => {
    const deps = { getUserByToken: vi.fn().mockResolvedValue(null) } as any;
    const service = new MessageStreamService({} as any, deps);

    const result = await service.authenticateStream("token-1");

    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(result.error).toBe("Invalid or expired token");
  });

  it("fails when user is not an admin", async () => {
    const deps = { getUserByToken: vi.fn().mockResolvedValue({ id: "user-1" }) } as any;
    const storage = {
      getProfileByUserId: vi.fn().mockResolvedValue({ id: "profile-1", role: "Client", agencyId: "agency-1" }),
    } as any;
    const service = new MessageStreamService(storage, deps);

    const result = await service.authenticateStream("token-1");

    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(result.error).toBe("Admin access required");
  });

  it("authenticates admin stream with agency", async () => {
    const deps = { getUserByToken: vi.fn().mockResolvedValue({ id: "user-1" }) } as any;
    const storage = {
      getProfileByUserId: vi.fn().mockResolvedValue({ id: "profile-1", role: "Admin", agencyId: "agency-1" }),
    } as any;
    const service = new MessageStreamService(storage, deps);

    const result = await service.authenticateStream("token-1");

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ agencyId: "agency-1" });
  });
});
