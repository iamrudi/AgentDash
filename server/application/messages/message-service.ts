import { z } from "zod";
import { hardenedAIExecutor } from "../../ai/hardened-executor";
import type { IStorage } from "../../storage";

export interface MessageServiceResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  errors?: unknown;
}

const analysisSchema = z.string();

export class MessageService {
  constructor(private readonly storage: IStorage) {}

  async markRead(messageId: string): Promise<MessageServiceResult<undefined>> {
    await this.storage.markMessageAsRead(messageId);
    return { ok: true, status: 204 };
  }

  async createMessage(input: {
    clientId?: string;
    message?: string;
    senderRole?: string;
  }): Promise<MessageServiceResult<{ message: unknown; agencyId?: string | null }>> {
    const rawMessage = input.message;
    if (!rawMessage || !rawMessage.trim()) {
      return { ok: false, status: 400, error: "Message is required" };
    }

    if (!input.clientId) {
      return { ok: false, status: 400, error: "Client ID is required" };
    }

    const createdMessage = await this.storage.createMessage({
      clientId: input.clientId,
      message: rawMessage.trim(),
      senderRole: input.senderRole || "Admin",
    });

    const client = await this.storage.getClientById(input.clientId);

    return {
      ok: true,
      status: 201,
      data: {
        message: createdMessage,
        agencyId: client?.agencyId,
      },
    };
  }

  async markAllReadForClient(clientId: string): Promise<MessageServiceResult<undefined>> {
    const messages = await this.storage.getMessagesByClientId(clientId);
    await Promise.all(
      messages
        .filter((message) => message.isRead === "false" && message.senderRole === "Client")
        .map((message) => this.storage.markMessageAsRead(message.id))
    );
    return { ok: true, status: 204 };
  }

  async analyzeConversation(clientId: string): Promise<MessageServiceResult<{ analysis: string; suggestions: unknown[] }>> {
    const client = await this.storage.getClientById(clientId);
    const messages = await this.storage.getMessagesByClientId(clientId);

    if (!client) {
      return { ok: false, status: 404, error: "Client not found" };
    }

    if (messages.length === 0) {
      return { ok: false, status: 400, error: "No messages to analyze" };
    }

    const conversationText = messages
      .map((message) => `${message.senderRole === "Client" ? "Client" : "Agency"}: ${message.message}`)
      .join("\n");

    const prompt = `Analyze this conversation between an agency and their client (${client.companyName}).

Conversation:
${conversationText}

Provide a brief analysis covering:
1. Main topics and concerns discussed
2. Client sentiment and engagement level
3. Action items or follow-ups needed
4. Potential opportunities for strategic initiatives or recommendations

Keep the analysis concise and actionable (2-3 paragraphs).`;

    const model = "gemini-2.0-flash-exp";
    const result = await hardenedAIExecutor.executeWithSchema(
      {
        agencyId: client.agencyId || "legacy",
        operation: "analyzeClientConversation",
        provider: "gemini",
        model,
      },
      {
        prompt,
        model,
        temperature: 0.2,
      },
      analysisSchema
    );

    if (!result.success) {
      throw new Error(result.error || "AI analysis failed");
    }

    return {
      ok: true,
      status: 200,
      data: { analysis: result.data, suggestions: [] },
    };
  }
}
