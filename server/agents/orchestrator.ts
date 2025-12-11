import { db } from "../db";
import { agents, agentRoutingRules, type Agent, type AgentRoutingRule, type WorkflowSignal } from "@shared/schema";
import { eq, and, asc, isNull, or } from "drizzle-orm";
import { BaseAgent, AgentContext, AIProvider, Analysis, Recommendation, ExecutionResult } from "./base-agent";
import { createAgentForDomain } from "./domain-agents";

export class AgentOrchestrator {
  private aiProvider: AIProvider;
  private agentCache: Map<string, BaseAgent> = new Map();

  constructor(aiProvider: AIProvider) {
    this.aiProvider = aiProvider;
  }

  async getAgentById(agentId: string, agencyId: string): Promise<BaseAgent | null> {
    const cacheKey = `${agencyId}:${agentId}`;
    if (this.agentCache.has(cacheKey)) {
      return this.agentCache.get(cacheKey)!;
    }

    const [agentRecord] = await db.select()
      .from(agents)
      .where(and(
        eq(agents.id, agentId),
        eq(agents.agencyId, agencyId),
        eq(agents.status, "active")
      ))
      .limit(1);

    if (!agentRecord) return null;

    const agent = createAgentForDomain(agentRecord, this.aiProvider);
    await agent.loadCapabilities();
    this.agentCache.set(cacheKey, agent);
    return agent;
  }

  async getAgentsByDomain(domain: string, agencyId: string): Promise<BaseAgent[]> {
    const agentRecords = await db.select()
      .from(agents)
      .where(and(
        eq(agents.domain, domain),
        eq(agents.agencyId, agencyId),
        eq(agents.status, "active")
      ));

    const result: BaseAgent[] = [];
    for (const record of agentRecords) {
      const cacheKey = `${agencyId}:${record.id}`;
      if (!this.agentCache.has(cacheKey)) {
        const agent = createAgentForDomain(record, this.aiProvider);
        await agent.loadCapabilities();
        this.agentCache.set(cacheKey, agent);
      }
      result.push(this.agentCache.get(cacheKey)!);
    }

    return result;
  }

  async routeSignalToAgents(signal: WorkflowSignal, agencyId: string): Promise<BaseAgent[]> {
    const rules = await db.select()
      .from(agentRoutingRules)
      .innerJoin(agents, eq(agentRoutingRules.agentId, agents.id))
      .where(and(
        eq(agentRoutingRules.agencyId, agencyId),
        eq(agentRoutingRules.enabled, true),
        eq(agents.status, "active"),
        or(
          isNull(agentRoutingRules.signalSource),
          eq(agentRoutingRules.signalSource, signal.source)
        ),
        or(
          isNull(agentRoutingRules.signalType),
          eq(agentRoutingRules.signalType, signal.type)
        )
      ))
      .orderBy(asc(agentRoutingRules.priority));

    const matchedAgents: BaseAgent[] = [];
    const seenAgentIds = new Set<string>();

    for (const { agent_routing_rules: rule, agents: agentRecord } of rules) {
      if (seenAgentIds.has(agentRecord.id)) continue;

      if (rule.payloadFilter && signal.payload) {
        if (!this.matchPayloadFilter(signal.payload as Record<string, unknown>, rule.payloadFilter as Record<string, unknown>)) {
          continue;
        }
      }

      const cacheKey = `${agencyId}:${agentRecord.id}`;
      if (!this.agentCache.has(cacheKey)) {
        const agent = createAgentForDomain(agentRecord, this.aiProvider);
        await agent.loadCapabilities();
        this.agentCache.set(cacheKey, agent);
      }

      matchedAgents.push(this.agentCache.get(cacheKey)!);
      seenAgentIds.add(agentRecord.id);
    }

    return matchedAgents;
  }

  private matchPayloadFilter(payload: Record<string, unknown>, filter: Record<string, unknown>): boolean {
    for (const [key, expectedValue] of Object.entries(filter)) {
      const actualValue = this.getNestedValue(payload, key);
      
      if (typeof expectedValue === "object" && expectedValue !== null) {
        const filterOp = expectedValue as Record<string, unknown>;
        if ("$eq" in filterOp && actualValue !== filterOp.$eq) return false;
        if ("$neq" in filterOp && actualValue === filterOp.$neq) return false;
        if ("$gt" in filterOp && !(typeof actualValue === "number" && actualValue > (filterOp.$gt as number))) return false;
        if ("$gte" in filterOp && !(typeof actualValue === "number" && actualValue >= (filterOp.$gte as number))) return false;
        if ("$lt" in filterOp && !(typeof actualValue === "number" && actualValue < (filterOp.$lt as number))) return false;
        if ("$lte" in filterOp && !(typeof actualValue === "number" && actualValue <= (filterOp.$lte as number))) return false;
        if ("$contains" in filterOp && !(typeof actualValue === "string" && actualValue.includes(filterOp.$contains as string))) return false;
        if ("$in" in filterOp && !Array.isArray(filterOp.$in)) return false;
        if ("$in" in filterOp && !(filterOp.$in as unknown[]).includes(actualValue)) return false;
      } else {
        if (actualValue !== expectedValue) return false;
      }
    }
    return true;
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split(".");
    let current: unknown = obj;
    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== "object") {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }

  async executeWithAgents(
    agentIds: string[],
    operation: "analyze" | "recommend" | "execute",
    context: AgentContext,
    actionName?: string
  ): Promise<Map<string, Analysis | Recommendation[] | ExecutionResult>> {
    const results = new Map<string, Analysis | Recommendation[] | ExecutionResult>();

    for (const agentId of agentIds) {
      const agent = await this.getAgentById(agentId, context.agencyId);
      if (!agent) continue;

      try {
        const result = await agent.run(operation, context, actionName);
        results.set(agentId, result);
      } catch (error) {
        console.error(`Agent ${agentId} failed:`, error);
        results.set(agentId, {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        } as ExecutionResult);
      }
    }

    return results;
  }

  async processSignal(
    signal: WorkflowSignal,
    agencyId: string,
    operation: "analyze" | "recommend" = "analyze"
  ): Promise<Array<{ agentId: string; domain: string; result: Analysis | Recommendation[] }>> {
    const matchedAgents = await this.routeSignalToAgents(signal, agencyId);
    const results: Array<{ agentId: string; domain: string; result: Analysis | Recommendation[] }> = [];

    const context: AgentContext = {
      agencyId,
      signal: signal.payload as Record<string, unknown>,
      metadata: {
        signalId: signal.id,
        signalSource: signal.source,
        signalType: signal.type,
        signalUrgency: signal.urgency
      }
    };

    for (const agent of matchedAgents) {
      try {
        const result = await agent.run(operation, context) as Analysis | Recommendation[];
        results.push({
          agentId: agent.id,
          domain: agent.domain,
          result
        });
      } catch (error) {
        console.error(`Agent ${agent.id} (${agent.domain}) failed to process signal:`, error);
      }
    }

    return results;
  }

  clearCache(): void {
    this.agentCache.clear();
  }

  clearAgentFromCache(agentId: string, agencyId: string): void {
    const cacheKey = `${agencyId}:${agentId}`;
    this.agentCache.delete(cacheKey);
  }
}

let orchestratorInstance: AgentOrchestrator | null = null;

export function getAgentOrchestrator(aiProvider: AIProvider): AgentOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new AgentOrchestrator(aiProvider);
  }
  return orchestratorInstance;
}
