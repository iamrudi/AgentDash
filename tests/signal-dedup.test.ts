import { describe, expect, it } from "vitest";
import { SignalNormalizer } from "../server/workflow/signal-normalizer";

describe("Signal dedup hash", () => {
  it("is stable across payload key ordering", () => {
    const agencyId = "agency-1";
    const source = "ga4";
    const type = "event";

    const payloadA = { a: 1, b: { c: 2, d: 3 } };
    const payloadB = { b: { d: 3, c: 2 }, a: 1 };

    const hashA = SignalNormalizer.computeDedupHash(agencyId, source, type, payloadA);
    const hashB = SignalNormalizer.computeDedupHash(agencyId, source, type, payloadB);

    expect(hashA).toBe(hashB);
  });
});
