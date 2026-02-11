import { describe, expect, it, vi } from "vitest";
import { MetricService } from "../server/application/metrics/metric-service";

describe("MetricService", () => {
  it("creates metric through storage", async () => {
    const storage = {
      createMetric: vi.fn().mockResolvedValue({ id: "metric-1" }),
    } as any;
    const service = new MetricService(storage);

    const result = await service.createMetric({ clientId: "client-1", name: "Leads" });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(201);
    expect(result.data).toEqual({ id: "metric-1" });
    expect(storage.createMetric).toHaveBeenCalledWith({ clientId: "client-1", name: "Leads" });
  });
});
