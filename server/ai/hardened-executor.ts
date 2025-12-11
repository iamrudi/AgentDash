import crypto from "crypto";
import { z } from "zod";
import { db } from "../db";
import { aiExecutions, aiUsageTracking, type InsertAIExecution } from "@shared/schema";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import { getAIProvider } from "./provider";
import type { AIProvider, GenerateTextOptions } from "./types";

export interface AIExecutionContext {
  agencyId: string;
  workflowExecutionId?: string;
  stepId?: string;
  operation: string;
  provider?: string;
  model?: string;
}

export interface HardenedExecutionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  cached: boolean;
  executionId: string;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  durationMs: number;
}

interface CacheEntry {
  output: unknown;
  outputHash: string;
  expiresAt: number;
}

const responseCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour default

export class HardenedAIExecutor {
  private static instance: HardenedAIExecutor;

  static getInstance(): HardenedAIExecutor {
    if (!this.instance) {
      this.instance = new HardenedAIExecutor();
    }
    return this.instance;
  }

  private computeInputHash(input: Record<string, unknown>): string {
    const sortedInput = this.sortObjectKeys(input);
    return crypto.createHash("sha256").update(JSON.stringify(sortedInput)).digest("hex");
  }

  private computeOutputHash(output: unknown): string {
    return crypto.createHash("sha256").update(JSON.stringify(output)).digest("hex");
  }

  private sortObjectKeys(obj: Record<string, unknown>): Record<string, unknown> {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(obj).sort();
    for (const key of keys) {
      const value = obj[key];
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        sorted[key] = this.sortObjectKeys(value as Record<string, unknown>);
      } else {
        sorted[key] = value;
      }
    }
    return sorted;
  }

  private getCacheKey(agencyId: string, operation: string, inputHash: string): string {
    return `${agencyId}:${operation}:${inputHash}`;
  }

  private getFromCache(cacheKey: string): CacheEntry | null {
    const entry = responseCache.get(cacheKey);
    if (entry && entry.expiresAt > Date.now()) {
      return entry;
    }
    if (entry) {
      responseCache.delete(cacheKey);
    }
    return null;
  }

  private setCache(cacheKey: string, output: unknown, outputHash: string): void {
    responseCache.set(cacheKey, {
      output,
      outputHash,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }

  async executeWithSchema<T>(
    context: AIExecutionContext,
    options: GenerateTextOptions,
    outputSchema: z.ZodSchema<T>,
    useCache: boolean = true
  ): Promise<HardenedExecutionResult<T>> {
    const startTime = Date.now();
    const inputHash = this.computeInputHash({ prompt: options.prompt, ...options });
    const cacheKey = this.getCacheKey(context.agencyId, context.operation, inputHash);
    
    let executionId: string = "";
    const providerName = context.provider || "gemini";
    const modelName = context.model || options.model || "default";

    try {
      if (useCache) {
        const cached = this.getFromCache(cacheKey);
        if (cached) {
          executionId = await this.logExecution({
            agencyId: context.agencyId,
            workflowExecutionId: context.workflowExecutionId,
            stepId: context.stepId,
            provider: providerName,
            model: modelName,
            operation: context.operation,
            inputHash,
            outputHash: cached.outputHash,
            prompt: options.prompt,
            input: options,
            output: cached.output,
            outputValidated: true,
            cached: true,
            cacheKey,
            status: "cached",
            durationMs: Date.now() - startTime,
          });

          return {
            success: true,
            data: cached.output as T,
            cached: true,
            executionId,
            durationMs: Date.now() - startTime,
          };
        }
      }

      executionId = await this.logExecution({
        agencyId: context.agencyId,
        workflowExecutionId: context.workflowExecutionId,
        stepId: context.stepId,
        provider: providerName,
        model: modelName,
        operation: context.operation,
        inputHash,
        prompt: options.prompt,
        input: options,
        status: "pending",
      });

      const provider = await getAIProvider(context.agencyId);
      const rawResponse = await provider.generateText(options);

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawResponse);
      } catch {
        parsed = rawResponse;
      }

      const validationResult = outputSchema.safeParse(parsed);

      if (!validationResult.success) {
        const validationErrors = validationResult.error.errors;
        await this.updateExecution(executionId, {
          status: "failed",
          output: parsed,
          outputValidated: false,
          validationErrors,
          error: `Schema validation failed: ${validationErrors.map(e => e.message).join(", ")}`,
          durationMs: Date.now() - startTime,
        });

        return {
          success: false,
          error: `Schema validation failed: ${validationErrors.map(e => e.message).join(", ")}`,
          cached: false,
          executionId,
          durationMs: Date.now() - startTime,
        };
      }

      const outputHash = this.computeOutputHash(validationResult.data);

      if (useCache) {
        this.setCache(cacheKey, validationResult.data, outputHash);
      }

      await this.updateExecution(executionId, {
        status: "success",
        output: validationResult.data,
        outputHash,
        outputValidated: true,
        durationMs: Date.now() - startTime,
      });

      await this.updateUsageTracking(context.agencyId, providerName, modelName, true, false);

      return {
        success: true,
        data: validationResult.data,
        cached: false,
        executionId,
        durationMs: Date.now() - startTime,
      };
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      
      if (executionId) {
        await this.updateExecution(executionId, {
          status: "failed",
          error: error.message,
          durationMs,
        });
      }

      await this.updateUsageTracking(context.agencyId, providerName, modelName, false, false);

      return {
        success: false,
        error: error.message,
        cached: false,
        executionId: executionId || "unknown",
        durationMs,
      };
    }
  }

  async execute(
    context: AIExecutionContext,
    options: GenerateTextOptions,
    useCache: boolean = true
  ): Promise<HardenedExecutionResult<string>> {
    const stringSchema = z.string();
    return this.executeWithSchema(context, options, stringSchema, useCache);
  }

  private async logExecution(data: Partial<InsertAIExecution> & { agencyId: string; provider: string; model: string; operation: string; inputHash: string; prompt: string }): Promise<string> {
    const [execution] = await db.insert(aiExecutions).values({
      agencyId: data.agencyId,
      workflowExecutionId: data.workflowExecutionId || null,
      stepId: data.stepId || null,
      provider: data.provider,
      model: data.model,
      operation: data.operation,
      inputHash: data.inputHash,
      outputHash: data.outputHash || null,
      prompt: data.prompt,
      input: data.input || null,
      output: data.output || null,
      outputValidated: data.outputValidated || false,
      validationErrors: data.validationErrors || null,
      cached: data.cached || false,
      cacheKey: data.cacheKey || null,
      status: data.status || "pending",
      error: data.error || null,
      promptTokens: data.promptTokens || null,
      completionTokens: data.completionTokens || null,
      totalTokens: data.totalTokens || null,
      durationMs: data.durationMs || null,
      retryCount: data.retryCount || 0,
    }).returning();

    return execution.id;
  }

  private async updateExecution(executionId: string, updates: Partial<InsertAIExecution>): Promise<void> {
    await db.update(aiExecutions)
      .set({
        ...updates,
        completedAt: updates.status === "success" || updates.status === "failed" ? new Date() : undefined,
      })
      .where(eq(aiExecutions.id, executionId));
  }

  private async updateUsageTracking(
    agencyId: string,
    provider: string,
    model: string,
    success: boolean,
    cached: boolean,
    tokens?: { prompt: number; completion: number; total: number }
  ): Promise<void> {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const existing = await db.select()
      .from(aiUsageTracking)
      .where(
        and(
          eq(aiUsageTracking.agencyId, agencyId),
          eq(aiUsageTracking.provider, provider),
          gte(aiUsageTracking.periodStart, periodStart),
          lte(aiUsageTracking.periodEnd, periodEnd)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db.update(aiUsageTracking)
        .set({
          totalRequests: sql`${aiUsageTracking.totalRequests} + 1`,
          successfulRequests: success ? sql`${aiUsageTracking.successfulRequests} + 1` : aiUsageTracking.successfulRequests,
          failedRequests: !success ? sql`${aiUsageTracking.failedRequests} + 1` : aiUsageTracking.failedRequests,
          cachedRequests: cached ? sql`${aiUsageTracking.cachedRequests} + 1` : aiUsageTracking.cachedRequests,
          totalPromptTokens: tokens ? sql`${aiUsageTracking.totalPromptTokens} + ${tokens.prompt}` : aiUsageTracking.totalPromptTokens,
          totalCompletionTokens: tokens ? sql`${aiUsageTracking.totalCompletionTokens} + ${tokens.completion}` : aiUsageTracking.totalCompletionTokens,
          totalTokens: tokens ? sql`${aiUsageTracking.totalTokens} + ${tokens.total}` : aiUsageTracking.totalTokens,
          updatedAt: new Date(),
        })
        .where(eq(aiUsageTracking.id, existing[0].id));
    } else {
      await db.insert(aiUsageTracking).values({
        agencyId,
        provider,
        model,
        periodStart,
        periodEnd,
        totalRequests: 1,
        successfulRequests: success ? 1 : 0,
        failedRequests: success ? 0 : 1,
        cachedRequests: cached ? 1 : 0,
        totalPromptTokens: tokens?.prompt || 0,
        totalCompletionTokens: tokens?.completion || 0,
        totalTokens: tokens?.total || 0,
      });
    }
  }

  async getExecutionById(executionId: string) {
    const [execution] = await db.select()
      .from(aiExecutions)
      .where(eq(aiExecutions.id, executionId))
      .limit(1);
    return execution || null;
  }

  async getExecutionsByWorkflow(workflowExecutionId: string) {
    return db.select()
      .from(aiExecutions)
      .where(eq(aiExecutions.workflowExecutionId, workflowExecutionId))
      .orderBy(aiExecutions.createdAt);
  }

  async getUsageByAgency(agencyId: string, periodStart?: Date, periodEnd?: Date) {
    let query = db.select().from(aiUsageTracking).where(eq(aiUsageTracking.agencyId, agencyId));
    
    if (periodStart) {
      query = query.where(gte(aiUsageTracking.periodStart, periodStart)) as typeof query;
    }
    if (periodEnd) {
      query = query.where(lte(aiUsageTracking.periodEnd, periodEnd)) as typeof query;
    }
    
    return query.orderBy(aiUsageTracking.periodStart);
  }

  clearCache(): void {
    responseCache.clear();
  }

  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: responseCache.size,
      keys: Array.from(responseCache.keys()),
    };
  }
}

export const hardenedAIExecutor = HardenedAIExecutor.getInstance();
