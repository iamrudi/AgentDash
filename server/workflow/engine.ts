import { createHash } from "crypto";
import { db } from "../db";
import { IStorage } from "../storage";
import { getAIProvider } from "../ai/provider";
import { createRuleEngine, RuleEngine, RuleEvaluationContext } from "./rule-engine";
import {
  Workflow,
  WorkflowExecution,
  WorkflowEvent,
  WorkflowStep,
  WorkflowStepConfig,
  RuleCondition,
  BranchCondition,
  InsertWorkflowExecution,
  InsertWorkflowEvent,
  workflowExecutions,
  workflowEvents,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";

type TxOrDb = typeof db;

export interface WorkflowContext {
  agencyId: string;
  clientId?: string;
  userId?: string;
  data: Record<string, unknown>;
  stepResults: Record<string, unknown>;
}

export interface StepResult {
  success: boolean;
  output?: unknown;
  error?: string;
  nextStep?: string | null;
}

type StepHandler = (
  step: WorkflowStep,
  context: WorkflowContext,
  storage: IStorage
) => Promise<StepResult>;

interface TransactionContext {
  tx: TxOrDb;
  agencyId: string;
}

export class WorkflowEngine {
  private storage: IStorage;
  private ruleEngine: RuleEngine;
  private stepHandlers: Map<string, StepHandler>;
  private currentAgencyId: string | null = null;
  private txContext: TransactionContext | null = null;

  constructor(storage: IStorage) {
    this.storage = storage;
    this.ruleEngine = createRuleEngine(storage);
    this.stepHandlers = new Map();
    this.registerBuiltInHandlers();
  }

  private getTx(): TxOrDb {
    return this.txContext?.tx || db;
  }

  private registerBuiltInHandlers(): void {
    this.stepHandlers.set("signal", this.handleSignalStep.bind(this));
    this.stepHandlers.set("rule", this.handleRuleStep.bind(this));
    this.stepHandlers.set("ai", this.handleAIStep.bind(this));
    this.stepHandlers.set("action", this.handleActionStep.bind(this));
    this.stepHandlers.set("branch", this.handleBranchStep.bind(this));
    this.stepHandlers.set("parallel", this.handleParallelStep.bind(this));
  }

  public registerStepHandler(type: string, handler: StepHandler): void {
    this.stepHandlers.set(type, handler);
  }

  public async execute(
    workflow: Workflow,
    triggerPayload: Record<string, unknown>,
    options: {
      triggerId?: string;
      triggerType?: string;
      skipIdempotencyCheck?: boolean;
    } = {}
  ): Promise<WorkflowExecution> {
    const inputHash = this.computeHash(triggerPayload);

    if (!options.skipIdempotencyCheck) {
      const existing = await this.findExecutionByHash(workflow.id, inputHash);
      if (existing) {
        return existing;
      }
    }

    // Set agency context for event logging
    this.currentAgencyId = workflow.agencyId;

    // Track execution ID for error handling
    let currentExecutionId: string | null = null;

    // Execute entire workflow within a transaction for atomic commit/rollback
    return await db.transaction(async (tx) => {
      // Set transaction context for all methods
      this.txContext = { tx, agencyId: workflow.agencyId };

      try {
        let execution: WorkflowExecution;
        try {
          execution = await this.createExecution(workflow, {
            inputHash,
            triggerPayload,
            triggerId: options.triggerId,
            triggerType: options.triggerType || workflow.triggerType,
          });
          currentExecutionId = execution.id;
        } catch (error: any) {
          if (error?.code === "23505" || error?.message?.includes("duplicate key")) {
            const existing = await this.findExecutionByHash(workflow.id, inputHash);
            if (existing) {
              return existing;
            }
          }
          throw error;
        }

        const context: WorkflowContext = {
          agencyId: workflow.agencyId,
          data: { ...triggerPayload },
          stepResults: {},
        };

        await this.updateExecutionStatus(execution.id, "running");
        
        const steps = workflow.steps as WorkflowStep[];
        const stepMap = new Map(steps.map((s) => [s.id, s]));
        
        let currentStepId: string | null | undefined = steps[0]?.id;
        
        while (currentStepId) {
          const step = stepMap.get(currentStepId);
          if (!step) {
            throw new Error(`Step not found: ${currentStepId}`);
          }

          await this.updateCurrentStep(execution.id, currentStepId);
          
          const result = await this.executeStep(execution.id, step, context);
          
          if (!result.success) {
            if (step.onError === "skip") {
              currentStepId = step.next;
              continue;
            }
            if (step.onError === "retry" && step.retryConfig) {
              throw new Error(`Retry not yet implemented: ${result.error}`);
            }
            throw new Error(result.error || "Step execution failed");
          }

          context.stepResults[step.id] = result.output;
          
          if (result.nextStep !== undefined) {
            currentStepId = result.nextStep;
          } else {
            currentStepId = step.next;
          }
        }

        const outputHash = this.computeHash(context.stepResults);
        await this.completeExecution(execution.id, context.stepResults, outputHash);
        
        return await this.getExecution(execution.id);
      } catch (error) {
        // Use the tracked execution ID directly (not re-queried)
        if (currentExecutionId) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          await this.failExecution(currentExecutionId, errorMessage);
          const failedExecution = await this.getExecution(currentExecutionId);
          return failedExecution;
        }
        
        throw error;
      } finally {
        // Clear transaction context
        this.txContext = null;
      }
    });
  }

  private async executeStep(
    executionId: string,
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<StepResult> {
    const startTime = Date.now();
    
    await this.logEvent(executionId, {
      stepId: step.id,
      stepType: step.type,
      eventType: "started",
      input: context.data,
    });

    const handler = this.stepHandlers.get(step.type);
    if (!handler) {
      const error = `No handler for step type: ${step.type}`;
      await this.logEvent(executionId, {
        stepId: step.id,
        stepType: step.type,
        eventType: "failed",
        error,
        durationMs: Date.now() - startTime,
      });
      return { success: false, error };
    }

    try {
      const result = await handler(step, context, this.storage);
      
      await this.logEvent(executionId, {
        stepId: step.id,
        stepType: step.type,
        eventType: result.success ? "completed" : "failed",
        output: result.output as Record<string, unknown> | undefined,
        error: result.error,
        durationMs: Date.now() - startTime,
      });
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.logEvent(executionId, {
        stepId: step.id,
        stepType: step.type,
        eventType: "failed",
        error: errorMessage,
        durationMs: Date.now() - startTime,
      });
      return { success: false, error: errorMessage };
    }
  }

  private async handleSignalStep(
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<StepResult> {
    const config = step.config.signal;
    if (!config) {
      return { success: false, error: "Missing signal configuration" };
    }

    const signalData = context.data;
    
    if (config.filter) {
      for (const [key, value] of Object.entries(config.filter)) {
        if (signalData[key] !== value) {
          return { success: true, output: { matched: false }, nextStep: null };
        }
      }
    }

    return { success: true, output: { matched: true, signal: signalData } };
  }

  private async handleRuleStep(
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<StepResult> {
    const config = step.config.rule;
    if (!config) {
      return { success: false, error: "Missing rule configuration" };
    }

    // Check if using a versioned rule (ruleId provided)
    const ruleId = (config as any).ruleId;
    if (ruleId) {
      return await this.handleVersionedRule(ruleId, context);
    }

    // Fallback to inline conditions
    const results = config.conditions.map((cond) =>
      this.evaluateCondition(cond, context.data)
    );

    const passed =
      config.logic === "all"
        ? results.every(Boolean)
        : results.some(Boolean);

    return {
      success: true,
      output: { passed, results },
      nextStep: passed ? undefined : null,
    };
  }

  private async handleVersionedRule(
    ruleId: string,
    context: WorkflowContext
  ): Promise<StepResult> {
    const rule = await this.storage.getWorkflowRuleById(ruleId);
    if (!rule) {
      return { success: false, error: `Rule not found: ${ruleId}` };
    }

    if (!rule.enabled) {
      return {
        success: true,
        output: { passed: false, skipped: true, reason: "Rule is disabled" },
        nextStep: null,
      };
    }

    const evalContext: RuleEvaluationContext = {
      signal: context.data,
      client: context.data.client as Record<string, unknown> | undefined,
      project: context.data.project as Record<string, unknown> | undefined,
      history: context.data.history as Array<Record<string, unknown>> | undefined,
    };

    const result = await this.ruleEngine.evaluateRule(rule, evalContext);

    return {
      success: true,
      output: {
        passed: result.matched,
        ruleId: result.ruleId,
        ruleVersionId: result.ruleVersionId,
        conditionResults: result.conditionResults,
        durationMs: result.durationMs,
      },
      nextStep: result.matched ? undefined : null,
    };
  }

  private evaluateCondition(
    condition: RuleCondition,
    data: Record<string, unknown>
  ): boolean {
    const value = this.getNestedValue(data, condition.field);
    const target = condition.value;

    switch (condition.operator) {
      case "eq":
        return value === target;
      case "neq":
        return value !== target;
      case "gt":
        return typeof value === "number" && typeof target === "number" && value > target;
      case "gte":
        return typeof value === "number" && typeof target === "number" && value >= target;
      case "lt":
        return typeof value === "number" && typeof target === "number" && value < target;
      case "lte":
        return typeof value === "number" && typeof target === "number" && value <= target;
      case "contains":
        return typeof value === "string" && typeof target === "string" && value.includes(target);
      case "regex":
        return typeof value === "string" && typeof target === "string" && new RegExp(target).test(value);
      case "exists":
        return value !== undefined && value !== null;
      default:
        return false;
    }
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split(".").reduce((curr, key) => {
      if (curr && typeof curr === "object" && key in curr) {
        return (curr as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj as unknown);
  }

  private async handleAIStep(
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<StepResult> {
    const config = step.config.ai;
    if (!config) {
      return { success: false, error: "Missing AI configuration" };
    }

    try {
      const prompt = this.interpolateTemplate(config.prompt, context.data);
      
      const aiProvider = await getAIProvider(context.agencyId);
      const response = await aiProvider.generateText({
        prompt,
        model: config.provider === "openai" ? "gpt-4o" : "gemini-2.0-flash",
      });

      let output: unknown = response;
      
      if (config.schema) {
        try {
          output = JSON.parse(response);
        } catch {
          return { success: false, error: "AI response is not valid JSON" };
        }
      }

      return { success: true, output };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "AI step failed",
      };
    }
  }

  private interpolateTemplate(
    template: string,
    data: Record<string, unknown>
  ): string {
    return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path) => {
      const value = this.getNestedValue(data, path);
      return value !== undefined ? String(value) : "";
    });
  }

  private async handleActionStep(
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<StepResult> {
    const config = step.config.action;
    if (!config) {
      return { success: false, error: "Missing action configuration" };
    }

    try {
      switch (config.type) {
        case "create_project":
          return await this.actionCreateProject(config.config, context);
        case "create_task":
          return await this.actionCreateTask(config.config, context);
        case "create_task_list":
          return await this.actionCreateTaskList(config.config, context);
        case "send_notification":
          return await this.actionSendNotification(config.config, context);
        case "update_record":
          return await this.actionUpdateRecord(config.config, context);
        case "update_initiative":
          return await this.actionUpdateInitiative(config.config, context);
        case "create_invoice":
          return await this.actionCreateInvoice(config.config, context);
        case "log":
          return this.actionLog(config.config, context);
        default:
          return { success: false, error: `Unknown action type: ${config.type}` };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Action failed",
      };
    }
  }

  private async actionCreateProject(
    config: Record<string, unknown>,
    context: WorkflowContext
  ): Promise<StepResult> {
    const name = this.interpolateTemplate(String(config.name || ""), context.data);
    const description = config.description
      ? this.interpolateTemplate(String(config.description), context.data)
      : undefined;
    const clientId = String(config.clientId || context.clientId || context.data.clientId);

    if (!clientId) {
      return { success: false, error: "clientId is required for create_project" };
    }

    const project = await this.storage.createProject({
      name,
      description,
      clientId,
      status: "Active",
    });

    context.data.createdProjectId = project.id;

    return { success: true, output: { projectId: project.id } };
  }

  private async actionCreateTaskList(
    config: Record<string, unknown>,
    context: WorkflowContext
  ): Promise<StepResult> {
    const name = this.interpolateTemplate(String(config.name || ""), context.data);
    const projectId = String(
      config.projectId || context.data.createdProjectId || context.data.projectId
    );

    if (!projectId) {
      return { success: false, error: "projectId is required for create_task_list" };
    }

    const taskList = await this.storage.createTaskList({
      name,
      projectId,
      agencyId: context.agencyId,
    });

    context.data.createdTaskListId = taskList.id;

    return { success: true, output: { taskListId: taskList.id } };
  }

  private async actionCreateTask(
    config: Record<string, unknown>,
    context: WorkflowContext
  ): Promise<StepResult> {
    const description = this.interpolateTemplate(
      String(config.description || config.name || "New Task"),
      context.data
    );
    const listId = String(
      config.taskListId || context.data.createdTaskListId || context.data.taskListId
    );

    if (!listId) {
      return { success: false, error: "taskListId is required for create_task" };
    }

    const priorityMap: Record<string, "Low" | "Medium" | "High" | "Urgent"> = {
      low: "Low",
      medium: "Medium",
      high: "High",
      urgent: "Urgent",
    };

    const priority = priorityMap[String(config.priority || "medium").toLowerCase()] || "Medium";

    const task = await this.storage.createTask({
      description,
      listId,
      status: "To Do",
      priority,
    });

    context.data.createdTaskId = task.id;

    return { success: true, output: { taskId: task.id } };
  }

  private async actionSendNotification(
    config: Record<string, unknown>,
    context: WorkflowContext
  ): Promise<StepResult> {
    const title = this.interpolateTemplate(String(config.title || ""), context.data);
    const message = this.interpolateTemplate(String(config.message || ""), context.data);
    const userId = String(config.userId || context.userId);

    if (!userId) {
      return { success: false, error: "userId is required for send_notification" };
    }

    const notification = await this.storage.createNotification({
      userId,
      title,
      message,
      type: String(config.type || "info"),
    });

    return { success: true, output: { notificationId: notification.id } };
  }

  private async actionUpdateRecord(
    config: Record<string, unknown>,
    context: WorkflowContext
  ): Promise<StepResult> {
    const table = String(config.table);
    const recordId = String(config.recordId || context.data[`${table}Id`]);
    const updates = config.updates as Record<string, unknown>;

    if (!table || !recordId || !updates) {
      return { success: false, error: "table, recordId, and updates are required" };
    }

    return { success: true, output: { updated: true, table, recordId } };
  }

  private async actionUpdateInitiative(
    config: Record<string, unknown>,
    context: WorkflowContext
  ): Promise<StepResult> {
    const initiativeId = String(
      config.initiativeId || context.data.initiativeId
    );
    const status = String(config.status || "approved");

    if (!initiativeId || initiativeId === "undefined") {
      return { success: true, output: { skipped: true, reason: "No initiative ID provided" } };
    }

    try {
      const updated = await this.storage.updateInitiative(initiativeId, { status });
      return { success: true, output: { initiativeId, status: updated.status } };
    } catch (error) {
      return { success: true, output: { warning: "Initiative not found or could not be updated" } };
    }
  }

  private async actionCreateInvoice(
    config: Record<string, unknown>,
    context: WorkflowContext
  ): Promise<StepResult> {
    const clientId = String(config.clientId || context.clientId || context.data.clientId);
    
    if (!clientId || clientId === "undefined") {
      return { success: false, error: "clientId is required for create_invoice" };
    }

    return { success: true, output: { invoiceStub: true, clientId } };
  }

  private actionLog(
    config: Record<string, unknown>,
    context: WorkflowContext
  ): StepResult {
    const message = this.interpolateTemplate(String(config.message || ""), context.data);
    const level = String(config.level || "info");
    
    console.log(`[Workflow Log][${level.toUpperCase()}] ${message}`);
    
    return { success: true, output: { logged: true, message, level } };
  }

  private async handleBranchStep(
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<StepResult> {
    const config = step.config.branch;
    if (!config) {
      return { success: false, error: "Missing branch configuration" };
    }

    for (const branch of config.conditions) {
      const results = branch.condition.map((cond) =>
        this.evaluateCondition(cond, context.data)
      );
      
      const matched =
        branch.logic === "all"
          ? results.every(Boolean)
          : results.some(Boolean);

      if (matched) {
        return { success: true, output: { branch: branch.next }, nextStep: branch.next };
      }
    }

    return {
      success: true,
      output: { branch: config.default || null },
      nextStep: config.default || null,
    };
  }

  private async handleParallelStep(
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<StepResult> {
    const config = step.config.parallel;
    if (!config) {
      return { success: false, error: "Missing parallel configuration" };
    }

    return {
      success: true,
      output: { parallelSteps: config.steps },
    };
  }

  private computeHash(data: unknown): string {
    return createHash("sha256").update(JSON.stringify(data)).digest("hex");
  }

  private async findExecutionByHash(
    workflowId: string,
    inputHash: string
  ): Promise<WorkflowExecution | null> {
    // Use db directly for idempotency check (outside transaction)
    const [execution] = await db
      .select()
      .from(workflowExecutions)
      .where(
        and(
          eq(workflowExecutions.workflowId, workflowId),
          eq(workflowExecutions.inputHash, inputHash)
        )
      )
      .limit(1);
    return execution || null;
  }

  private async createExecution(
    workflow: Workflow,
    data: {
      inputHash: string;
      triggerPayload: unknown;
      triggerId?: string;
      triggerType?: string;
    }
  ): Promise<WorkflowExecution> {
    const tx = this.getTx();
    const [execution] = await tx
      .insert(workflowExecutions)
      .values({
        workflowId: workflow.id,
        agencyId: workflow.agencyId,
        status: "pending",
        inputHash: data.inputHash,
        triggerPayload: data.triggerPayload,
        triggerId: data.triggerId,
        triggerType: data.triggerType,
      })
      .returning();
    return execution;
  }

  private async getExecution(executionId: string): Promise<WorkflowExecution> {
    const tx = this.getTx();
    const [execution] = await tx
      .select()
      .from(workflowExecutions)
      .where(eq(workflowExecutions.id, executionId));
    return execution;
  }

  private async updateExecutionStatus(
    executionId: string,
    status: string
  ): Promise<void> {
    const tx = this.getTx();
    const updates: Partial<InsertWorkflowExecution> = { status };
    if (status === "running") {
      updates.startedAt = new Date();
    }
    await tx
      .update(workflowExecutions)
      .set(updates)
      .where(eq(workflowExecutions.id, executionId));
  }

  private async updateCurrentStep(
    executionId: string,
    stepId: string
  ): Promise<void> {
    const tx = this.getTx();
    await tx
      .update(workflowExecutions)
      .set({ currentStep: stepId })
      .where(eq(workflowExecutions.id, executionId));
  }

  private async completeExecution(
    executionId: string,
    result: unknown,
    outputHash: string
  ): Promise<void> {
    const tx = this.getTx();
    await tx
      .update(workflowExecutions)
      .set({
        status: "completed",
        result,
        outputHash,
        completedAt: new Date(),
      })
      .where(eq(workflowExecutions.id, executionId));
  }

  private async failExecution(
    executionId: string,
    error: string
  ): Promise<void> {
    const tx = this.getTx();
    await tx
      .update(workflowExecutions)
      .set({
        status: "failed",
        error,
        completedAt: new Date(),
      })
      .where(eq(workflowExecutions.id, executionId));
  }

  private async logEvent(
    executionId: string,
    event: Omit<InsertWorkflowEvent, "executionId" | "agencyId">
  ): Promise<void> {
    if (!this.currentAgencyId) {
      throw new Error("Agency context not set for workflow execution");
    }
    const tx = this.getTx();
    await tx.insert(workflowEvents).values({
      executionId,
      agencyId: this.currentAgencyId,
      ...event,
    });
  }

  public async executeFromSignal(
    signalId: string,
    workflowId: string,
    signalPayload: Record<string, unknown>
  ): Promise<WorkflowExecution | null> {
    const workflow = await this.storage.getWorkflowById(workflowId);
    if (!workflow) {
      console.error(`Workflow ${workflowId} not found for signal ${signalId}`);
      return null;
    }

    if (!workflow.enabled) {
      console.log(`Workflow ${workflowId} is disabled, skipping execution for signal ${signalId}`);
      return null;
    }

    const execution = await this.execute(workflow, signalPayload, {
      triggerId: signalId,
      triggerType: "signal",
    });

    return execution;
  }

  public async processSignal(
    signalId: string,
    signalPayload: Record<string, unknown>,
    workflowIds: string[]
  ): Promise<{ signalId: string; executions: WorkflowExecution[] }> {
    const executions: WorkflowExecution[] = [];

    for (const workflowId of workflowIds) {
      const execution = await this.executeFromSignal(signalId, workflowId, signalPayload);
      if (execution) {
        executions.push(execution);
      }
    }

    return { signalId, executions };
  }
}

export function createWorkflowEngine(storage: IStorage): WorkflowEngine {
  return new WorkflowEngine(storage);
}
