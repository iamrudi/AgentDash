import { db } from "../db";
import { agents, agentCapabilities, agentExecutions, type Agent, type AgentCapability, type AgentExecution } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { createHash } from "crypto";

export interface AgentContext {
  agencyId: string;
  clientId?: string;
  projectId?: string;
  signal?: Record<string, unknown>;
  workflowExecutionId?: string;
  metadata?: Record<string, unknown>;
}

export interface Analysis {
  summary: string;
  insights: string[];
  metrics?: Record<string, number>;
  recommendations?: string[];
  confidence: number;
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
  category: string;
  actionItems?: string[];
}

export interface ExecutionResult {
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
  actions?: string[];
}

export interface AIProvider {
  generateText(prompt: string, systemPrompt?: string, options?: Record<string, unknown>): Promise<string>;
}

export abstract class BaseAgent {
  protected agent: Agent;
  protected capabilities: AgentCapability[] = [];
  protected aiProvider: AIProvider;

  constructor(agent: Agent, aiProvider: AIProvider) {
    this.agent = agent;
    this.aiProvider = aiProvider;
  }

  get id(): string {
    return this.agent.id;
  }

  get domain(): string {
    return this.agent.domain;
  }

  get name(): string {
    return this.agent.name;
  }

  async loadCapabilities(): Promise<void> {
    this.capabilities = await db.select()
      .from(agentCapabilities)
      .where(and(
        eq(agentCapabilities.agentId, this.agent.id),
        eq(agentCapabilities.enabled, true)
      ));
  }

  hasCapability(capabilityName: string): boolean {
    return this.capabilities.some(c => c.name === capabilityName);
  }

  protected computeHash(input: unknown): string {
    const normalized = JSON.stringify(input, Object.keys(input as object).sort());
    return createHash("sha256").update(normalized).digest("hex");
  }

  protected async logExecution(
    operation: string,
    input: Record<string, unknown>,
    output: Record<string, unknown> | null,
    status: "pending" | "running" | "completed" | "failed",
    context: AgentContext,
    error?: string,
    tokenUsage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number },
    latencyMs?: number
  ): Promise<AgentExecution> {
    const inputHash = this.computeHash(input);
    const outputHash = output ? this.computeHash(output) : null;

    const [execution] = await db.insert(agentExecutions)
      .values({
        agencyId: context.agencyId,
        agentId: this.agent.id,
        workflowExecutionId: context.workflowExecutionId,
        operation,
        status,
        input,
        output,
        inputHash,
        outputHash,
        promptTokens: tokenUsage?.promptTokens,
        completionTokens: tokenUsage?.completionTokens,
        totalTokens: tokenUsage?.totalTokens,
        latencyMs,
        error,
        metadata: context.metadata,
        startedAt: status === "running" ? new Date() : null,
        completedAt: status === "completed" || status === "failed" ? new Date() : null,
      })
      .returning();

    return execution;
  }

  protected async checkIdempotency(
    operation: string,
    input: Record<string, unknown>
  ): Promise<AgentExecution | null> {
    const inputHash = this.computeHash(input);

    const [existing] = await db.select()
      .from(agentExecutions)
      .where(and(
        eq(agentExecutions.agentId, this.agent.id),
        eq(agentExecutions.operation, operation),
        eq(agentExecutions.inputHash, inputHash),
        eq(agentExecutions.status, "completed")
      ))
      .limit(1);

    return existing || null;
  }

  protected buildPrompt(template: string, variables: Record<string, unknown>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      result = result.replace(new RegExp(placeholder, "g"), String(value));
    }
    return result;
  }

  abstract analyze(context: AgentContext): Promise<Analysis>;
  abstract recommend(context: AgentContext): Promise<Recommendation[]>;
  abstract execute(action: string, context: AgentContext): Promise<ExecutionResult>;

  async run(
    operation: "analyze" | "recommend" | "execute",
    context: AgentContext,
    actionName?: string
  ): Promise<Analysis | Recommendation[] | ExecutionResult> {
    const input = { operation, context, actionName };

    const cached = await this.checkIdempotency(operation, input);
    if (cached && cached.output) {
      return cached.output as unknown as Analysis | Recommendation[] | ExecutionResult;
    }

    await this.logExecution(operation, input, null, "running", context);

    const startTime = Date.now();
    try {
      let result: Analysis | Recommendation[] | ExecutionResult;

      switch (operation) {
        case "analyze":
          result = await this.analyze(context);
          break;
        case "recommend":
          result = await this.recommend(context);
          break;
        case "execute":
          if (!actionName) throw new Error("Action name required for execute operation");
          result = await this.execute(actionName, context);
          break;
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }

      const latencyMs = Date.now() - startTime;
      await this.logExecution(
        operation,
        input,
        result as unknown as Record<string, unknown>,
        "completed",
        context,
        undefined,
        undefined,
        latencyMs
      );

      return result;
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      await this.logExecution(
        operation,
        input,
        null,
        "failed",
        context,
        error instanceof Error ? error.message : String(error),
        undefined,
        latencyMs
      );
      throw error;
    }
  }
}
