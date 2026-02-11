import { describe, expect, it, vi } from "vitest";
import { MetricService } from "../server/application/metrics/metric-service";
import { createMetricCreateHandler } from "../server/routes/metrics";

describe("Metrics route handlers", () => {
  it("delegates metric creation", async () => {
    const createMetric = vi.fn().mockResolvedValue({ ok: true, status: 201, data: { id: "metric-1" } });
    const service = { createMetric } as unknown as MetricService;
    const handler = createMetricCreateHandler(service);
    const req = { body: { clientId: "client-1", name: "Leads" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(createMetric).toHaveBeenCalledWith({ clientId: "client-1", name: "Leads" });
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
