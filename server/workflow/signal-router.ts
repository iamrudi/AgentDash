import { storage } from "../storage";
import { SignalAdapterFactory, type AdapterResult } from "./signal-adapters";
import type { WorkflowSignal, WorkflowSignalRoute, InsertWorkflowSignal } from "@shared/schema";

export interface SignalIngestionResult {
  signal: WorkflowSignal;
  isDuplicate: boolean;
  matchingRoutes: WorkflowSignalRoute[];
  workflowsTriggered: string[];
}

export interface PayloadFilterCondition {
  path: string;
  operator: "eq" | "neq" | "contains" | "gt" | "lt" | "exists";
  value?: unknown;
}

export class SignalRouter {
  async ingestSignal(
    agencyId: string,
    source: string,
    rawData: Record<string, unknown>,
    clientId?: string
  ): Promise<SignalIngestionResult> {
    const adapterResult = SignalAdapterFactory.adaptSignal(agencyId, source, rawData, clientId);
    
    const { signal: createdSignal, isDuplicate } = await storage.createWorkflowSignalWithDedup(adapterResult.signal);

    if (isDuplicate) {
      return {
        signal: createdSignal,
        isDuplicate: true,
        matchingRoutes: [],
        workflowsTriggered: [],
      };
    }

    const matchingRoutes = await this.findMatchingRoutes(agencyId, createdSignal);
    
    return {
      signal: createdSignal,
      isDuplicate: false,
      matchingRoutes,
      workflowsTriggered: matchingRoutes.map(r => r.workflowId),
    };
  }

  async ingestRawSignal(insertSignal: InsertWorkflowSignal): Promise<SignalIngestionResult> {
    const { signal: createdSignal, isDuplicate } = await storage.createWorkflowSignalWithDedup(insertSignal);

    if (isDuplicate) {
      return {
        signal: createdSignal,
        isDuplicate: true,
        matchingRoutes: [],
        workflowsTriggered: [],
      };
    }

    const matchingRoutes = await this.findMatchingRoutes(createdSignal.agencyId, createdSignal);
    
    return {
      signal: createdSignal,
      isDuplicate: false,
      matchingRoutes,
      workflowsTriggered: matchingRoutes.map(r => r.workflowId),
    };
  }

  async findMatchingRoutes(agencyId: string, signal: WorkflowSignal): Promise<WorkflowSignalRoute[]> {
    const routes = await storage.getMatchingSignalRoutes(agencyId, signal.source, signal.type);
    
    return routes.filter(route => {
      if (route.urgencyFilter && route.urgencyFilter.length > 0) {
        if (!route.urgencyFilter.includes(signal.urgency || "normal")) {
          return false;
        }
      }

      if (route.payloadFilter) {
        if (!this.evaluatePayloadFilter(signal.payload as Record<string, unknown>, route.payloadFilter as PayloadFilterCondition[])) {
          return false;
        }
      }

      return true;
    });
  }

  private evaluatePayloadFilter(payload: Record<string, unknown>, conditions: PayloadFilterCondition[]): boolean {
    for (const condition of conditions) {
      const value = this.getNestedValue(payload, condition.path);
      
      switch (condition.operator) {
        case "eq":
          if (value !== condition.value) return false;
          break;
        case "neq":
          if (value === condition.value) return false;
          break;
        case "contains":
          if (typeof value !== "string" || !value.includes(String(condition.value))) return false;
          break;
        case "gt":
          if (typeof value !== "number" || value <= Number(condition.value)) return false;
          break;
        case "lt":
          if (typeof value !== "number" || value >= Number(condition.value)) return false;
          break;
        case "exists":
          if ((value !== undefined) !== Boolean(condition.value)) return false;
          break;
      }
    }
    return true;
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split(".");
    let current: unknown = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== "object") return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    
    return current;
  }

  async updateSignalStatus(signalId: string, status: string, error?: string): Promise<WorkflowSignal> {
    return await storage.updateSignalStatus(signalId, status, error);
  }

  async markSignalProcessed(signalId: string, executionId?: string): Promise<void> {
    await storage.markSignalProcessed(signalId, executionId);
  }

  async getUnprocessedSignals(agencyId: string, limit?: number): Promise<WorkflowSignal[]> {
    return await storage.getUnprocessedSignals(agencyId, limit);
  }

  async getPendingSignals(agencyId: string, limit?: number): Promise<WorkflowSignal[]> {
    return await storage.getSignalsByStatus(agencyId, "pending", limit);
  }

  async getFailedSignals(agencyId: string, limit?: number): Promise<WorkflowSignal[]> {
    return await storage.getSignalsByStatus(agencyId, "failed", limit);
  }

  async retrySignal(signalId: string): Promise<WorkflowSignal> {
    const signal = await storage.getWorkflowSignalById(signalId);
    if (!signal) {
      throw new Error(`Signal not found: ${signalId}`);
    }
    
    await storage.incrementSignalRetry(signalId);
    return await storage.updateSignalStatus(signalId, "pending");
  }
}

export const signalRouter = new SignalRouter();
