import { describe, expect, it, vi } from "vitest";
import { AnalyticsGa4ReadService } from "../server/application/analytics/analytics-ga4-read-service";

describe("AnalyticsGa4ReadService", () => {
  it("returns 403 when a client user requests another client", async () => {
    const storage = {
      getProfileByUserId: vi.fn().mockResolvedValue({ id: "profile-1", role: "Client" }),
      getClientByProfileId: vi.fn().mockResolvedValue({ id: "client-own" }),
    } as any;

    const service = new AnalyticsGa4ReadService(storage, {
      refreshAccessToken: vi.fn(),
      fetchGA4Data: vi.fn(),
      fetchGA4AcquisitionChannels: vi.fn(),
      fetchGA4KeyEvents: vi.fn(),
    });

    const result = await service.getConversions({
      userId: "user-1",
      clientId: "client-other",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(result.error).toBe("Access denied");
  });

  it("returns 400 when lead event name is missing for conversions", async () => {
    const storage = {
      getProfileByUserId: vi.fn().mockResolvedValue({ id: "profile-1", role: "Admin" }),
      getIntegrationByClientId: vi.fn().mockResolvedValue({
        id: "int-1",
        ga4PropertyId: "prop-1",
        accessToken: "token",
      }),
    } as any;

    const service = new AnalyticsGa4ReadService(storage, {
      refreshAccessToken: vi.fn(),
      fetchGA4Data: vi.fn(),
      fetchGA4AcquisitionChannels: vi.fn(),
      fetchGA4KeyEvents: vi.fn(),
    });

    const result = await service.getConversions({
      userId: "user-1",
      clientId: "client-1",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
  });

  it("returns 401 when token is expired and refresh fails", async () => {
    const refreshAccessToken = vi.fn().mockResolvedValue({ success: false, error: "refresh failed" });
    const storage = {
      getProfileByUserId: vi.fn().mockResolvedValue({ id: "profile-1", role: "Admin" }),
      getIntegrationByClientId: vi.fn().mockResolvedValue({
        id: "int-1",
        ga4PropertyId: "prop-1",
        accessToken: "old-token",
        refreshToken: "refresh-token",
        expiresAt: "2020-01-01T00:00:00.000Z",
      }),
    } as any;

    const service = new AnalyticsGa4ReadService(storage, {
      refreshAccessToken,
      fetchGA4Data: vi.fn(),
      fetchGA4AcquisitionChannels: vi.fn(),
      fetchGA4KeyEvents: vi.fn(),
    });

    const result = await service.getChannels({
      userId: "user-1",
      clientId: "client-1",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(result.error).toBe("refresh failed");
  });

  it("returns analytics payload for configured integration", async () => {
    const fetchGA4Data = vi.fn().mockResolvedValue({ rows: [{ metricValues: [] }] });
    const storage = {
      getIntegrationByClientId: vi.fn().mockResolvedValue({
        id: "int-1",
        ga4PropertyId: "prop-1",
        accessToken: "token",
      }),
    } as any;

    const service = new AnalyticsGa4ReadService(storage, {
      refreshAccessToken: vi.fn(),
      fetchGA4Data,
      fetchGA4AcquisitionChannels: vi.fn(),
      fetchGA4KeyEvents: vi.fn(),
    });

    const result = await service.getAnalytics({
      clientId: "client-1",
      startDate: "2026-01-10",
      endDate: "2026-01-15",
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(fetchGA4Data).toHaveBeenCalledWith(
      "token",
      "prop-1",
      "2026-01-10",
      "2026-01-15",
      "client-1"
    );
  });
});
