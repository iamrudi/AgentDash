import { z } from "zod";
import type { IStorage } from "../../storage";

type HardenedExecutor = {
  executeWithSchema: (
    context: { agencyId: string; operation: string },
    input: { prompt: string },
    outputSchema: z.ZodTypeAny
  ) => Promise<{ success: boolean; data?: unknown; error?: string }>;
};

export interface AiChatResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  errors?: unknown;
}

const analyzeDataSchema = z.object({
  contextData: z.any(),
  question: z.string().min(1, "Question is required"),
});

const recommendationSchema = z.object({
  title: z.string().min(1),
  observation: z.string().min(1),
  proposedAction: z.string().min(1),
  impact: z.enum(["High", "Medium", "Low"]),
  estimatedCost: z.number().min(0),
  triggerMetric: z.string().min(1),
  baselineValue: z.number(),
  clientId: z.string().optional(),
});

export class AiChatService {
  constructor(
    private readonly storage: IStorage,
    private readonly hardenedExecutor: HardenedExecutor
  ) {}

  async analyzeData(
    userId: string,
    payload: unknown
  ): Promise<AiChatResult<unknown>> {
    const validationResult = analyzeDataSchema.safeParse(payload);
    if (!validationResult.success) {
      return {
        ok: false,
        status: 400,
        error: "Invalid request data",
        errors: validationResult.error.errors,
      };
    }

    const { contextData, question } = validationResult.data;
    const profile = await this.storage.getProfileByUserId(userId);
    let client;

    if (profile?.role === "Admin" || profile?.role === "Staff") {
      if (!contextData?.clientId) {
        return {
          ok: false,
          status: 400,
          error: "Client ID required for Admin/Staff users",
        };
      }
      client = await this.storage.getClientById(contextData.clientId);
    } else {
      if (!profile) {
        return { ok: false, status: 404, error: "Client not found" };
      }
      client = await this.storage.getClientByProfileId(profile.id);
    }

    if (!client) {
      return { ok: false, status: 404, error: "Client not found" };
    }

    const systemPrompt = `You are an expert digital marketing analyst providing on-demand insights for a client.\nThe client is asking a question about a specific dataset. Your task is to:\n1. Analyze the provided data in the context of their question.\n2. Provide a clear observation summary (1-2 sentences) that DIRECTLY answers their question.\n3. Provide structured observation insights - key data points as an array of objects with label, value, and optional context.\n4. Provide a proposed action summary (1-2 sentences).\n5. Provide action tasks - a numbered list of 3-5 specific, actionable steps the agency will take.\n6. Estimate the impact and a reasonable one-time cost for this action.\n\nIMPORTANT:\n- Use SPECIFIC numbers and metrics from the data in your observation insights\n- The observationInsights should contain 2-4 key data points\n- The actionTasks should be specific steps\n- If data is sparse, identify data gaps as opportunities\n\nRespond with a single JSON object matching the required schema.`;

    const prompt = `${systemPrompt}\n\nCLIENT: ${client.companyName}\nQUESTION: ${question}\nCONTEXT DATA:\n${JSON.stringify(contextData, null, 2)}`;

    const outputSchema = z.object({
      title: z.string(),
      observation: z.string(),
      observationInsights: z.array(
        z.object({
          label: z.string(),
          value: z.string(),
          context: z.string().optional(),
        })
      ),
      proposedAction: z.string(),
      actionTasks: z.array(z.string()),
      impact: z.enum(["High", "Medium", "Low"]),
      estimatedCost: z.number(),
      triggerMetric: z.string(),
      baselineValue: z.number(),
    });

    const analysis = await this.hardenedExecutor.executeWithSchema(
      {
        agencyId: client.agencyId,
        operation: "ai_analyze_data",
      },
      { prompt },
      outputSchema
    );

    if (!analysis.success) {
      return {
        ok: false,
        status: 500,
        error: analysis.error || "Failed to get analysis",
      };
    }

    return { ok: true, status: 200, data: analysis.data };
  }

  async requestAction(
    userId: string,
    payload: unknown
  ): Promise<AiChatResult<{ initiativeId: string; message: string }>> {
    const validationResult = recommendationSchema.safeParse(payload);
    if (!validationResult.success) {
      return {
        ok: false,
        status: 400,
        error: "Invalid recommendation data",
        errors: validationResult.error.errors,
      };
    }

    const recommendation = validationResult.data;
    const profile = await this.storage.getProfileByUserId(userId);
    let client;

    if (profile?.role === "Admin" || profile?.role === "Staff") {
      if (!recommendation.clientId) {
        return {
          ok: false,
          status: 400,
          error: "Client ID required for Admin/Staff users",
        };
      }
      client = await this.storage.getClientById(recommendation.clientId);
    } else {
      if (!profile) {
        return { ok: false, status: 404, error: "Client not found" };
      }
      client = await this.storage.getClientByProfileId(profile.id);
    }

    if (!client) {
      return { ok: false, status: 404, error: "Client not found" };
    }

    const isInternalUser = profile?.role === "Admin" || profile?.role === "Staff";
    const status = isInternalUser ? "Draft" : "Needs Review";
    const sentToClient = isInternalUser ? "false" : "true";

    const initiative = await this.storage.createInitiative({
      clientId: client.id,
      title: recommendation.title,
      observation: recommendation.observation,
      proposedAction: recommendation.proposedAction,
      cost: recommendation.estimatedCost?.toString() || "0",
      impact: recommendation.impact,
      status,
      triggerMetric: recommendation.triggerMetric || "",
      baselineValue: recommendation.baselineValue?.toString() || "0",
      sentToClient,
    });

    const message = isInternalUser
      ? "Recommendation saved as draft. You can edit and send it from the AI Recommendations page."
      : "Recommendation submitted for review.";

    return {
      ok: true,
      status: 201,
      data: { initiativeId: initiative.id, message },
    };
  }
}
