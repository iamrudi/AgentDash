import { z } from "zod";

export const InitiativeIntentRequestSchema = z.object({
  intentStatement: z.string().min(1),
  constraints: z.array(z.string()).optional(),
  successCriteria: z.array(z.string()).optional(),
  boundaryConditions: z.array(z.string()).optional(),
  evaluationHorizon: z.string().optional(),
});

export type InitiativeIntentRequest = z.infer<typeof InitiativeIntentRequestSchema>;

export const InitiativeResponseRequestSchema = z.object({
  response: z.enum(["approved", "rejected", "discussing"]),
  feedback: z.string().optional(),
});

export type InitiativeResponseRequest = z.infer<typeof InitiativeResponseRequestSchema>;
