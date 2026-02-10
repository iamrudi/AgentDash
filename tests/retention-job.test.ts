import { describe, expect, it } from "vitest";
import { buildRetentionPlan } from "../server/jobs/retention-job";

describe("Retention job", () => {
  it("builds cutoff dates from retention policies", () => {
    const now = new Date("2026-02-10T00:00:00.000Z");
    const plan = buildRetentionPlan([
      { resourceType: "workflow_events", retentionDays: 30 },
    ], now);

    expect(plan).toHaveLength(1);
    expect(plan[0].resourceType).toBe("workflow_events");
    expect(plan[0].cutoffDate.toISOString()).toBe("2026-01-11T00:00:00.000Z");
    expect(plan[0].action).toBe("delete");
  });
});
