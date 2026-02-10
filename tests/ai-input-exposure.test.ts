import { describe, expect, it } from "vitest";
import { selectAIExposedFields, type FieldDefinition } from "../server/ai/ai-input-selector";

describe("AI input exposure", () => {
  it("only includes fields marked ai_exposed=true", () => {
    const catalog: FieldDefinition[] = [
      { field_key: "public_field", ai_exposed: true },
      { field_key: "secret_field", ai_exposed: false },
    ];

    const record = {
      public_field: "ok",
      secret_field: "nope",
      extra_field: "ignored",
    };

    const selected = selectAIExposedFields(record, catalog);

    expect(selected).toEqual({ public_field: "ok" });
  });
});
