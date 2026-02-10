import { describe, expect, it, vi } from "vitest";

vi.mock("../server/ai/ai-input-builder", async () => {
  const actual = await vi.importActual<typeof import("../server/ai/ai-input-builder")>(
    "../server/ai/ai-input-builder"
  );
  return {
    ...actual,
    defaultFieldCatalogPath: () => "test",
    loadFieldCatalog: () => [
      {
        field_key: "client.companyName",
        plane: "data",
        primitive_owner: "P1",
        data_type: "string",
        allowed_values: undefined,
        nullable: false,
        scope: "client",
        read_roles: "Admin",
        write_roles: "Admin",
        ai_exposed: true,
        update_mode: "manual",
        signal_source: undefined,
        freshness_sla_days: 30,
        confidence_required: "low",
        audit_required: true,
      },
      {
        field_key: "client.secretField",
        plane: "data",
        primitive_owner: "P1",
        data_type: "string",
        allowed_values: undefined,
        nullable: true,
        scope: "client",
        read_roles: "Admin",
        write_roles: "Admin",
        ai_exposed: false,
        update_mode: "manual",
        signal_source: undefined,
        freshness_sla_days: 30,
        confidence_required: "low",
        audit_required: true,
      },
    ],
  };
});

vi.mock("../server/ai/hardened-executor", () => ({
  hardenedAIExecutor: {
    executeWithSchema: vi.fn(),
  },
}));

import { OpportunityService } from "../server/application/opportunities/opportunity-service";
import { hardenedAIExecutor } from "../server/ai/hardened-executor";

describe("OpportunityService", () => {
  it("enforces ai_exposed-only input assembly", async () => {
    const storage = {
      getClientById: vi.fn().mockResolvedValue({
        id: "client-1",
        companyName: "Acme",
        secretField: "do-not-leak",
      }),
      getActiveObjectivesByClientId: vi.fn().mockResolvedValue([]),
      getMetricsByClientId: vi.fn().mockResolvedValue([]),
    } as any;

    const service = new OpportunityService(storage);
    const result = await service.buildAIInputFromClientRecord("client-1");

    expect(result.ok).toBe(true);
    expect((result.data as any)?.client?.secretField).toBeUndefined();
    expect((result.data as any)?.client?.companyName).toBe("Acme");
  });

  it("fails closed on invalid AI output schema", async () => {
    const storage = {
      getClientById: vi.fn().mockResolvedValue({
        id: "client-1",
        companyName: "Acme",
      }),
      getActiveObjectivesByClientId: vi.fn().mockResolvedValue([]),
      getMetricsByClientId: vi.fn().mockResolvedValue([]),
    } as any;

    (hardenedAIExecutor.executeWithSchema as any).mockResolvedValue({
      success: false,
      error: "schema_invalid",
    });

    const service = new OpportunityService(storage);
    const result = await service.generateOpportunityArtifactFromAI("client-1", {
      userId: "user-1",
      agencyId: "agency-1",
      email: "admin@example.com",
      role: "Admin",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("schema_invalid");
  });
});
