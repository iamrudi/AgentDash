import { z } from "zod";

export const GateTypeSchema = z.enum([
  "opportunity",
  "initiative",
  "acceptance",
  "outcome",
  "learning",
]);

export const GateDecisionValueSchema = z.enum(["approve", "reject", "defer"]);

export const GateDecisionTargetTypeSchema = z.enum([
  "opportunity_artifact",
  "initiative",
  "execution_output",
  "outcome_review",
  "learning_artifact",
]);

export const GateDecisionRequestSchema = z.object({
  gateType: GateTypeSchema,
  decision: GateDecisionValueSchema,
  rationale: z.string().optional(),
  targetType: GateDecisionTargetTypeSchema,
  targetId: z.string().uuid(),
  metadata: z.record(z.unknown()).optional(),
});

export type GateDecisionRequest = z.infer<typeof GateDecisionRequestSchema>;
