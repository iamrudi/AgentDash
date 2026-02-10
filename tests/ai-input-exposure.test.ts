import { describe, expect, it } from "vitest";
import { selectAIExposedFields, type FieldDefinition } from "../server/ai/ai-input-selector";

describe("AI input exposure", () => {
  it("only includes fields marked ai_exposed=true", () => {
    const catalog: FieldDefinition[] = [
      { field_key: "client.publicField", ai_exposed: true },
      { field_key: "client.secretField", ai_exposed: false },
    ];

    const record = {
      client: {
        publicField: "ok",
        secretField: "nope",
        extraField: "ignored",
      },
    };

    const selected = selectAIExposedFields(record, catalog);

    expect(selected).toEqual({ client: { publicField: "ok" } });
  });
});
