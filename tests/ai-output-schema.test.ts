import { describe, expect, it } from "vitest";
import { z } from "zod";
import { validateAIOutput } from "../server/ai/output-validator";

describe("AI output schema gate", () => {
  it("fails closed when output violates schema", () => {
    const schema = z.object({ result: z.string() });
    const validation = validateAIOutput(schema, { result: 123 });

    expect(validation.success).toBe(false);
    if (!validation.success) {
      expect(validation.error.length).toBeGreaterThan(0);
    }
  });

  it("accepts valid output", () => {
    const schema = z.object({ result: z.string() });
    const validation = validateAIOutput(schema, { result: "ok" });

    expect(validation.success).toBe(true);
    if (validation.success) {
      expect(validation.data).toEqual({ result: "ok" });
    }
  });
});
