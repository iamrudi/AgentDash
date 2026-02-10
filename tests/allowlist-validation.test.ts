import { describe, expect, it } from "vitest";
import { validateAllowlistEntries } from "../scripts/guardrails-allowlist";

describe("Guardrails allowlist validation", () => {
  it("rejects server/** entries", () => {
    const result = validateAllowlistEntries([
      "server/routes/messages.ts",
      "docs/notes.md",
    ]);

    expect(result.ok).toBe(false);
    expect(result.errors.some((err) => err.includes("server/**"))).toBe(true);
  });

  it("accepts docs/tests/scripts entries", () => {
    const result = validateAllowlistEntries([
      "docs/README.md",
      "tests/fixtures/sample.txt",
      "scripts/example.sh",
    ]);

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });
});
