import { z } from "zod";
import type { IStorage } from "../../storage";

type HardenedExecutor = {
  executeWithSchema: (
    context: { agencyId: string; operation: string },
    input: { prompt: string },
    outputSchema: z.ZodTypeAny
  ) => Promise<{ success: boolean; data?: unknown; error?: string }>;
};

export interface StrategyCardResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export class StrategyCardService {
  constructor(
    private readonly storage: IStorage,
    private readonly hardenedExecutor: HardenedExecutor
  ) {}

  async getStrategyCard(clientId: string): Promise<StrategyCardResult<unknown>> {
    const [client, objectives, metrics, messages] = await Promise.all([
      this.storage.getClientById(clientId),
      this.storage.getActiveObjectivesByClientId(clientId),
      this.storage.getMetricsByClientId(clientId, 30),
      this.storage.getMessagesByClientId(clientId),
    ]);

    if (!client) {
      return { ok: false, status: 404, error: "Client not found" };
    }

    const summaryKpis = {
      totalSessions: metrics.reduce((sum, m) => sum + (m.sessions || 0), 0),
      totalConversions: metrics.reduce((sum, m) => sum + (m.conversions || 0), 0),
      totalSpend: metrics.reduce((sum, m) => sum + parseFloat(m.spend || "0"), 0),
    };

    const recentMessages = messages.slice(-30);
    const chatHistoryText =
      recentMessages.length > 0
        ? recentMessages.map((msg) => `${msg.senderRole}: ${msg.message}`).join("\n")
        : "No recent conversations.";

    const systemPrompt =
      'You are an expert Account Manager analyzing a recent conversation history with a client. Your task is to distill this conversation into actionable insights.\n\nFocus on messages from the "Client" role and extract:\n- painPoints: Problems, frustrations, concerns, or improvement requests\n- recentWins: Positive feedback or satisfaction\n- activeQuestions: Unanswered questions or requests needing follow-up\n\nIf the conversation is only greetings/small talk, return empty arrays.\nRespond with a JSON object with keys painPoints, recentWins, activeQuestions.';
    const prompt = `${systemPrompt}\n\nCHAT HISTORY:\n${chatHistoryText}`;

    const outputSchema = z.object({
      painPoints: z.array(z.string()),
      recentWins: z.array(z.string()),
      activeQuestions: z.array(z.string()),
    });

    const chatAnalysisResult = await this.hardenedExecutor.executeWithSchema(
      {
        agencyId: client.agencyId,
        operation: "ai_chat_analysis",
      },
      { prompt },
      outputSchema
    );

    if (!chatAnalysisResult.success) {
      return {
        ok: false,
        status: 500,
        error: chatAnalysisResult.error || "Failed to analyze chat history",
      };
    }

    return {
      ok: true,
      status: 200,
      data: {
        businessContext: client.businessContext,
        clientObjectives: objectives,
        summaryKpis,
        chatAnalysis: chatAnalysisResult.data,
      },
    };
  }
}
