import { describe, expect, it, vi } from "vitest";
import { StrategyCardService } from "../server/application/agency-clients/strategy-card-service";

describe("StrategyCardService", () => {
  it("returns 404 when client does not exist", async () => {
    const storage = {
      getClientById: vi.fn().mockResolvedValue(undefined),
      getActiveObjectivesByClientId: vi.fn().mockResolvedValue([]),
      getMetricsByClientId: vi.fn().mockResolvedValue([]),
      getMessagesByClientId: vi.fn().mockResolvedValue([]),
    } as any;

    const service = new StrategyCardService(storage, {
      executeWithSchema: vi.fn(),
    } as any);

    const result = await service.getStrategyCard("client-1");
    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.error).toBe("Client not found");
  });

  it("returns 500 when chat analysis fails", async () => {
    const storage = {
      getClientById: vi.fn().mockResolvedValue({
        id: "client-1",
        agencyId: "agency-1",
        businessContext: "B2B SaaS",
      }),
      getActiveObjectivesByClientId: vi.fn().mockResolvedValue([]),
      getMetricsByClientId: vi.fn().mockResolvedValue([]),
      getMessagesByClientId: vi.fn().mockResolvedValue([]),
    } as any;

    const executeWithSchema = vi.fn().mockResolvedValue({
      success: false,
      error: "quota exceeded",
    });
    const service = new StrategyCardService(storage, {
      executeWithSchema,
    } as any);

    const result = await service.getStrategyCard("client-1");
    expect(result.ok).toBe(false);
    expect(result.status).toBe(500);
    expect(result.error).toBe("quota exceeded");
  });

  it("returns strategy card payload on success", async () => {
    const storage = {
      getClientById: vi.fn().mockResolvedValue({
        id: "client-1",
        agencyId: "agency-1",
        businessContext: "B2B SaaS",
      }),
      getActiveObjectivesByClientId: vi.fn().mockResolvedValue([{ id: "obj-1", title: "Grow leads" }]),
      getMetricsByClientId: vi.fn().mockResolvedValue([
        { sessions: 10, conversions: 2, spend: "15.5" },
        { sessions: 20, conversions: 3, spend: "10" },
      ]),
      getMessagesByClientId: vi.fn().mockResolvedValue([{ senderRole: "Client", message: "Need better CPL" }]),
    } as any;

    const executeWithSchema = vi.fn().mockResolvedValue({
      success: true,
      data: { painPoints: ["High CPL"], recentWins: [], activeQuestions: ["What next?"] },
    });
    const service = new StrategyCardService(storage, {
      executeWithSchema,
    } as any);

    const result = await service.getStrategyCard("client-1");
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual({
      businessContext: "B2B SaaS",
      clientObjectives: [{ id: "obj-1", title: "Grow leads" }],
      summaryKpis: {
        totalSessions: 30,
        totalConversions: 5,
        totalSpend: 25.5,
      },
      chatAnalysis: { painPoints: ["High CPL"], recentWins: [], activeQuestions: ["What next?"] },
    });
  });
});
