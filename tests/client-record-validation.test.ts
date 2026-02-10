import { describe, expect, it } from "vitest";
import { validateClientRecordUpdate } from "../server/clients/client-record-service";

describe("Client record validation", () => {
  it("accepts valid numeric updates for cataloged fields", () => {
    const result = validateClientRecordUpdate({ retainerAmount: 500, monthlyRetainerHours: "40" });
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.validatedFields).toEqual(expect.arrayContaining(["retainerAmount", "monthlyRetainerHours"]));
  });

  it("rejects invalid types for cataloged fields", () => {
    const result = validateClientRecordUpdate({ retainerAmount: "not-a-number" });
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.field).toBe("client.retainerAmount");
  });

  it("rejects null for non-nullable cataloged fields", () => {
    const result = validateClientRecordUpdate({ companyName: null });
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.field).toBe("client.companyName");
  });

  it("ignores non-catalog fields", () => {
    const result = validateClientRecordUpdate({ leadValue: 2000 });
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.validatedFields).toHaveLength(0);
  });
});
