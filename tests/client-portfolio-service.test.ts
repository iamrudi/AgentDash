import { describe, expect, it, vi } from "vitest";
import { ClientPortfolioService } from "../server/application/client/client-portfolio-service";

describe("ClientPortfolioService", () => {
  it("fails closed for admin project list without agency", async () => {
    const service = new ClientPortfolioService({} as any);
    const result = await service.listProjects({
      userId: "user-1",
      role: "Admin",
      agencyId: undefined,
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(result.error).toBe("Agency association required");
  });

  it("returns empty list for client invoice list when client record is missing", async () => {
    const storage = {
      getProfileById: vi.fn().mockResolvedValue({ id: "profile-1" }),
      getClientByProfileId: vi.fn().mockResolvedValue(undefined),
    } as any;
    const service = new ClientPortfolioService(storage);
    const result = await service.listInvoices({
      userId: "user-1",
      role: "Client",
      agencyId: null,
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual([]);
  });
});
