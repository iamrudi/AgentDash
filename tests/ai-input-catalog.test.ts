import { describe, expect, it } from "vitest";
import { buildAIInput, loadFieldCatalog } from "../server/ai/ai-input-builder";

describe("AI input catalog and exposure gating", () => {
  it("loads the field catalog and validates schema", () => {
    const catalog = loadFieldCatalog("docs/client-record-field-catalog.csv");
    expect(catalog.length).toBeGreaterThan(0);
    expect(catalog[0]).toHaveProperty("field_key");
  });

  it("rejects non-exposed fields from AI input", () => {
    const catalog = [
      {
        field_key: "client.companyName",
        plane: "data",
        primitive_owner: "P6",
        data_type: "json",
        allowed_values: undefined,
        nullable: false,
        scope: "client",
        read_roles: "Admin",
        write_roles: "Admin",
        ai_exposed: true,
        update_mode: "manual",
        signal_source: undefined,
        freshness_sla_days: 30,
        confidence_required: "med",
        audit_required: true,
      },
      {
        field_key: "client.secretField",
        plane: "data",
        primitive_owner: "P6",
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
        audit_required: false,
      },
    ];

    const result = buildAIInput(catalog as any, {
      client: {
        companyName: "Acme Co",
        secretField: "nope",
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.aiInput as any).client.secretField).toBeUndefined();
    }
  });
});
