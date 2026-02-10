import { z } from "zod";

export const OpportunityArtifactManualSchema = z.object({
  mode: z.literal("manual").optional(),
  clientId: z.string().uuid(),
  opportunityStatement: z.string().min(1),
  reasoning: z.string().optional(),
  assumptions: z.array(z.string()).optional(),
  confidence: z.string().optional(),
  evidenceRefs: z.array(z.string()).optional(),
  risks: z.array(z.string()).optional(),
  suggestedSuccessCriteria: z.array(z.string()).optional(),
});

export const OpportunityArtifactAIGenerateSchema = z.object({
  mode: z.literal("ai_generate"),
  clientId: z.string().uuid(),
});

export const OpportunityArtifactRequestSchema = z.union([
  OpportunityArtifactManualSchema,
  OpportunityArtifactAIGenerateSchema,
]);

export type OpportunityArtifactRequest = z.infer<typeof OpportunityArtifactRequestSchema>;

export const OpportunityArtifactAIOutputSchema = z.object({
  opportunity_statement: z.string().min(1),
  reasoning: z.string().min(1),
  assumptions: z.array(z.string()).default([]),
  confidence: z.enum(["high", "med", "low"]),
  evidence_refs: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  suggested_success_criteria: z.array(z.string()).default([]),
});

export type OpportunityArtifactAIOutput = z.infer<typeof OpportunityArtifactAIOutputSchema>;
