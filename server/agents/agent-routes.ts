import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { agents, agentCapabilities, agentExecutions, agentRoutingRules } from "@shared/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { getAgentOrchestrator } from "./orchestrator";
import { createAIProvider } from "./ai-provider-adapter";

export const agentRouter = Router();

const createAgentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  domain: z.enum(["seo", "ppc", "crm", "reporting", "general"]),
  aiProvider: z.enum(["gemini", "openai"]).default("gemini"),
  aiModel: z.string().optional(),
  systemPrompt: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  capabilities: z.array(z.string()).optional(),
  config: z.record(z.unknown()).optional(),
});

const updateAgentSchema = createAgentSchema.partial().extend({
  status: z.enum(["active", "inactive", "deprecated"]).optional(),
});

const createCapabilitySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  inputSchema: z.record(z.unknown()).optional(),
  outputSchema: z.record(z.unknown()).optional(),
  promptTemplate: z.string().optional(),
  enabled: z.boolean().optional(),
});

const createRoutingRuleSchema = z.object({
  agentId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  priority: z.number().int().optional(),
  signalSource: z.string().optional(),
  signalType: z.string().optional(),
  payloadFilter: z.record(z.unknown()).optional(),
  enabled: z.boolean().optional(),
});

const executeAgentSchema = z.object({
  operation: z.enum(["analyze", "recommend", "execute"]),
  actionName: z.string().optional(),
  context: z.object({
    clientId: z.string().uuid().optional(),
    projectId: z.string().uuid().optional(),
    signal: z.record(z.unknown()).optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
});

agentRouter.get("/", async (req, res) => {
  try {
    const agencyId = (req as any).agencyId;
    if (!agencyId) {
      return res.status(403).json({ error: "Agency access required" });
    }

    const domain = req.query.domain as string | undefined;
    const status = req.query.status as string | undefined;

    let query = db.select().from(agents).where(eq(agents.agencyId, agencyId));

    if (domain) {
      query = db.select().from(agents).where(and(
        eq(agents.agencyId, agencyId),
        eq(agents.domain, domain)
      ));
    }

    if (status) {
      query = db.select().from(agents).where(and(
        eq(agents.agencyId, agencyId),
        eq(agents.status, status)
      ));
    }

    if (domain && status) {
      query = db.select().from(agents).where(and(
        eq(agents.agencyId, agencyId),
        eq(agents.domain, domain),
        eq(agents.status, status)
      ));
    }

    const result = await query.orderBy(asc(agents.name));
    res.json(result);
  } catch (error) {
    console.error("Error fetching agents:", error);
    res.status(500).json({ error: "Failed to fetch agents" });
  }
});

agentRouter.post("/", async (req, res) => {
  try {
    const agencyId = (req as any).agencyId;
    const userId = (req as any).userId;
    if (!agencyId) {
      return res.status(403).json({ error: "Agency access required" });
    }

    const validatedData = createAgentSchema.parse(req.body);

    const [newAgent] = await db.insert(agents)
      .values({
        name: validatedData.name,
        description: validatedData.description,
        domain: validatedData.domain,
        aiProvider: validatedData.aiProvider,
        aiModel: validatedData.aiModel,
        systemPrompt: validatedData.systemPrompt,
        temperature: validatedData.temperature?.toString(),
        maxTokens: validatedData.maxTokens,
        capabilities: validatedData.capabilities || [],
        config: validatedData.config,
        agencyId,
        createdBy: userId,
        status: "active",
      })
      .returning();

    res.status(201).json(newAgent);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request body", details: error.errors });
    }
    console.error("Error creating agent:", error);
    res.status(500).json({ error: "Failed to create agent" });
  }
});

agentRouter.get("/:id", async (req, res) => {
  try {
    const agencyId = (req as any).agencyId;
    if (!agencyId) {
      return res.status(403).json({ error: "Agency access required" });
    }

    const [agent] = await db.select()
      .from(agents)
      .where(and(eq(agents.id, req.params.id), eq(agents.agencyId, agencyId)))
      .limit(1);

    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    const capabilities = await db.select()
      .from(agentCapabilities)
      .where(eq(agentCapabilities.agentId, agent.id));

    res.json({ ...agent, capabilities });
  } catch (error) {
    console.error("Error fetching agent:", error);
    res.status(500).json({ error: "Failed to fetch agent" });
  }
});

agentRouter.patch("/:id", async (req, res) => {
  try {
    const agencyId = (req as any).agencyId;
    if (!agencyId) {
      return res.status(403).json({ error: "Agency access required" });
    }

    const [existingAgent] = await db.select()
      .from(agents)
      .where(and(eq(agents.id, req.params.id), eq(agents.agencyId, agencyId)))
      .limit(1);

    if (!existingAgent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    const validatedData = updateAgentSchema.parse(req.body);

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.domain !== undefined) updateData.domain = validatedData.domain;
    if (validatedData.status !== undefined) updateData.status = validatedData.status;
    if (validatedData.aiProvider !== undefined) updateData.aiProvider = validatedData.aiProvider;
    if (validatedData.aiModel !== undefined) updateData.aiModel = validatedData.aiModel;
    if (validatedData.systemPrompt !== undefined) updateData.systemPrompt = validatedData.systemPrompt;
    if (validatedData.temperature !== undefined) updateData.temperature = validatedData.temperature.toString();
    if (validatedData.maxTokens !== undefined) updateData.maxTokens = validatedData.maxTokens;
    if (validatedData.capabilities !== undefined) updateData.capabilities = validatedData.capabilities;
    if (validatedData.config !== undefined) updateData.config = validatedData.config;

    const [updatedAgent] = await db.update(agents)
      .set(updateData)
      .where(and(eq(agents.id, req.params.id), eq(agents.agencyId, agencyId)))
      .returning();

    const aiProvider = createAIProvider();
    getAgentOrchestrator(aiProvider).clearAgentFromCache(req.params.id, agencyId);

    res.json(updatedAgent);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request body", details: error.errors });
    }
    console.error("Error updating agent:", error);
    res.status(500).json({ error: "Failed to update agent" });
  }
});

agentRouter.delete("/:id", async (req, res) => {
  try {
    const agencyId = (req as any).agencyId;
    if (!agencyId) {
      return res.status(403).json({ error: "Agency access required" });
    }

    const [existingAgent] = await db.select()
      .from(agents)
      .where(and(eq(agents.id, req.params.id), eq(agents.agencyId, agencyId)))
      .limit(1);

    if (!existingAgent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    await db.delete(agents)
      .where(and(eq(agents.id, req.params.id), eq(agents.agencyId, agencyId)));

    const aiProvider = createAIProvider();
    getAgentOrchestrator(aiProvider).clearAgentFromCache(req.params.id, agencyId);

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting agent:", error);
    res.status(500).json({ error: "Failed to delete agent" });
  }
});

agentRouter.post("/:id/execute", async (req, res) => {
  try {
    const agencyId = (req as any).agencyId;
    if (!agencyId) {
      return res.status(403).json({ error: "Agency access required" });
    }

    const [existingAgent] = await db.select()
      .from(agents)
      .where(and(eq(agents.id, req.params.id), eq(agents.agencyId, agencyId)))
      .limit(1);

    if (!existingAgent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    if (existingAgent.status !== "active") {
      return res.status(400).json({ error: "Agent is not active" });
    }

    const validatedData = executeAgentSchema.parse(req.body);

    const aiProvider = createAIProvider();
    const orchestrator = getAgentOrchestrator(aiProvider);
    const agent = await orchestrator.getAgentById(req.params.id, agencyId);

    if (!agent) {
      return res.status(404).json({ error: "Agent not available" });
    }

    const context = {
      agencyId,
      clientId: validatedData.context.clientId,
      projectId: validatedData.context.projectId,
      signal: validatedData.context.signal,
      metadata: validatedData.context.metadata,
    };

    const result = await agent.run(
      validatedData.operation,
      context,
      validatedData.actionName
    );

    res.json({ agentId: req.params.id, operation: validatedData.operation, result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request body", details: error.errors });
    }
    console.error("Error executing agent:", error);
    res.status(500).json({ error: "Failed to execute agent" });
  }
});

agentRouter.get("/:id/capabilities", async (req, res) => {
  try {
    const agencyId = (req as any).agencyId;
    if (!agencyId) {
      return res.status(403).json({ error: "Agency access required" });
    }

    const [existingAgent] = await db.select()
      .from(agents)
      .where(and(eq(agents.id, req.params.id), eq(agents.agencyId, agencyId)))
      .limit(1);

    if (!existingAgent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    const capabilities = await db.select()
      .from(agentCapabilities)
      .where(eq(agentCapabilities.agentId, req.params.id));

    res.json(capabilities);
  } catch (error) {
    console.error("Error fetching capabilities:", error);
    res.status(500).json({ error: "Failed to fetch capabilities" });
  }
});

agentRouter.post("/:id/capabilities", async (req, res) => {
  try {
    const agencyId = (req as any).agencyId;
    if (!agencyId) {
      return res.status(403).json({ error: "Agency access required" });
    }

    const [existingAgent] = await db.select()
      .from(agents)
      .where(and(eq(agents.id, req.params.id), eq(agents.agencyId, agencyId)))
      .limit(1);

    if (!existingAgent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    const validatedData = createCapabilitySchema.parse(req.body);

    const [capability] = await db.insert(agentCapabilities)
      .values({
        agentId: req.params.id,
        name: validatedData.name,
        description: validatedData.description,
        inputSchema: validatedData.inputSchema,
        outputSchema: validatedData.outputSchema,
        promptTemplate: validatedData.promptTemplate,
        enabled: validatedData.enabled ?? true,
      })
      .returning();

    const aiProvider = createAIProvider();
    getAgentOrchestrator(aiProvider).clearAgentFromCache(req.params.id, agencyId);

    res.status(201).json(capability);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request body", details: error.errors });
    }
    console.error("Error creating capability:", error);
    res.status(500).json({ error: "Failed to create capability" });
  }
});

agentRouter.get("/executions", async (req, res) => {
  try {
    const agencyId = (req as any).agencyId;
    if (!agencyId) {
      return res.status(403).json({ error: "Agency access required" });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const agentId = req.query.agentId as string | undefined;
    const status = req.query.status as string | undefined;

    let whereConditions = [eq(agentExecutions.agencyId, agencyId)];
    if (agentId) {
      whereConditions.push(eq(agentExecutions.agentId, agentId));
    }
    if (status) {
      whereConditions.push(eq(agentExecutions.status, status));
    }

    const executions = await db.select()
      .from(agentExecutions)
      .where(and(...whereConditions))
      .orderBy(desc(agentExecutions.createdAt))
      .limit(limit);

    res.json(executions);
  } catch (error) {
    console.error("Error fetching executions:", error);
    res.status(500).json({ error: "Failed to fetch executions" });
  }
});

agentRouter.get("/routing-rules", async (req, res) => {
  try {
    const agencyId = (req as any).agencyId;
    if (!agencyId) {
      return res.status(403).json({ error: "Agency access required" });
    }

    const rules = await db.select()
      .from(agentRoutingRules)
      .where(eq(agentRoutingRules.agencyId, agencyId))
      .orderBy(asc(agentRoutingRules.priority));

    res.json(rules);
  } catch (error) {
    console.error("Error fetching routing rules:", error);
    res.status(500).json({ error: "Failed to fetch routing rules" });
  }
});

agentRouter.post("/routing-rules", async (req, res) => {
  try {
    const agencyId = (req as any).agencyId;
    if (!agencyId) {
      return res.status(403).json({ error: "Agency access required" });
    }

    const validatedData = createRoutingRuleSchema.parse(req.body);

    const [existingAgent] = await db.select()
      .from(agents)
      .where(and(eq(agents.id, validatedData.agentId), eq(agents.agencyId, agencyId)))
      .limit(1);

    if (!existingAgent) {
      return res.status(400).json({ error: "Agent not found or does not belong to this agency" });
    }

    const [rule] = await db.insert(agentRoutingRules)
      .values({
        agencyId,
        agentId: validatedData.agentId,
        name: validatedData.name,
        description: validatedData.description,
        priority: validatedData.priority ?? 100,
        signalSource: validatedData.signalSource,
        signalType: validatedData.signalType,
        payloadFilter: validatedData.payloadFilter,
        enabled: validatedData.enabled ?? true,
      })
      .returning();

    res.status(201).json(rule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request body", details: error.errors });
    }
    console.error("Error creating routing rule:", error);
    res.status(500).json({ error: "Failed to create routing rule" });
  }
});

agentRouter.delete("/routing-rules/:id", async (req, res) => {
  try {
    const agencyId = (req as any).agencyId;
    if (!agencyId) {
      return res.status(403).json({ error: "Agency access required" });
    }

    const [existingRule] = await db.select()
      .from(agentRoutingRules)
      .where(and(eq(agentRoutingRules.id, req.params.id), eq(agentRoutingRules.agencyId, agencyId)))
      .limit(1);

    if (!existingRule) {
      return res.status(404).json({ error: "Routing rule not found" });
    }

    await db.delete(agentRoutingRules)
      .where(and(eq(agentRoutingRules.id, req.params.id), eq(agentRoutingRules.agencyId, agencyId)));

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting routing rule:", error);
    res.status(500).json({ error: "Failed to delete routing rule" });
  }
});
