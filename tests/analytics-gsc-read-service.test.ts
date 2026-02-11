import { describe, expect, it, vi } from "vitest";
import { AnalyticsGscReadService } from "../server/application/analytics/analytics-gsc-read-service";

describe("AnalyticsGscReadService", () => {
  it("returns 403 when a client user requests another client", async () => {
    const storage = {
      getProfileByUserId: vi.fn().mockResolvedValue({ id: "profile-1", role: "Client" }),
      getClientByProfileId: vi.fn().mockResolvedValue({ id: "client-own" }),
    } as any;

    const service = new AnalyticsGscReadService(storage, {
      refreshAccessToken: vi.fn(),
      fetchGSCData: vi.fn(),
      fetchGSCTopQueries: vi.fn(),
    });

    const result = await service.getQueries({
      userId: "user-1",
      clientId: "client-other",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(result.error).toBe("Access denied");
  });

  it("returns 404 when search console integration is missing", async () => {
    const storage = {
      getIntegrationByClientId: vi.fn().mockResolvedValue(undefined),
    } as any;

    const service = new AnalyticsGscReadService(storage, {
      refreshAccessToken: vi.fn(),
      fetchGSCData: vi.fn(),
      fetchGSCTopQueries: vi.fn(),
    });

    const result = await service.getAnalytics({
      clientId: "client-1",
      startDate: "2026-01-10",
      endDate: "2026-01-15",
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
  });

  it("returns top queries payload", async () => {
    const fetchGSCTopQueries = vi.fn().mockResolvedValue({ rows: [{ clicks: 5 }] });
    const storage = {
      getProfileByUserId: vi.fn().mockResolvedValue({ id: "profile-1", role: "Admin" }),
      getIntegrationByClientId: vi.fn().mockResolvedValue({
        id: "int-1",
        gscSiteUrl: "https://example.com",
        accessToken: "token",
      }),
    } as any;

    const service = new AnalyticsGscReadService(storage, {
      refreshAccessToken: vi.fn(),
      fetchGSCData: vi.fn(),
      fetchGSCTopQueries,
    });

    const result = await service.getQueries({
      userId: "user-1",
      clientId: "client-1",
      startDate: "2026-01-10",
      endDate: "2026-01-15",
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(fetchGSCTopQueries).toHaveBeenCalledWith(
      "token",
      "https://example.com",
      "2026-01-10",
      "2026-01-15",
      "client-1"
    );
  });
});
