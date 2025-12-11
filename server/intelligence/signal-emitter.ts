import { storage } from "../storage";
import type { InsertIntelligenceSignal } from "@shared/schema";

export interface SignalPayload {
  sourceSystem: string;
  signalType: string;
  category: string;
  severity?: string;
  payload: Record<string, unknown>;
  correlationKey?: string;
  clientId?: string;
  projectId?: string;
  occurredAt?: Date;
}

export class SignalEmitter {
  async emit(agencyId: string, signal: SignalPayload): Promise<string> {
    const signalData: InsertIntelligenceSignal = {
      agencyId,
      sourceSystem: signal.sourceSystem,
      signalType: signal.signalType,
      category: signal.category,
      severity: signal.severity || "medium",
      payload: signal.payload,
      correlationKey: signal.correlationKey,
      clientId: signal.clientId,
      projectId: signal.projectId,
      occurredAt: signal.occurredAt || new Date(),
    };

    const created = await storage.createIntelligenceSignal(signalData);
    return created.id;
  }

  async emitAnalyticsSignal(
    agencyId: string,
    clientId: string | undefined,
    signalType: string,
    payload: Record<string, unknown>,
    severity: string = "medium"
  ): Promise<string> {
    return this.emit(agencyId, {
      sourceSystem: "GA4",
      signalType,
      category: "analytics",
      severity,
      payload,
      clientId,
      correlationKey: `analytics:${clientId}:${signalType}`,
    });
  }

  async emitCRMSignal(
    agencyId: string,
    clientId: string | undefined,
    signalType: string,
    payload: Record<string, unknown>,
    severity: string = "medium"
  ): Promise<string> {
    return this.emit(agencyId, {
      sourceSystem: "HUBSPOT",
      signalType,
      category: "crm",
      severity,
      payload,
      clientId,
      correlationKey: payload.dealId ? `crm:deal:${payload.dealId}` : undefined,
    });
  }

  async emitWorkflowSignal(
    agencyId: string,
    signalType: string,
    payload: Record<string, unknown>,
    severity: string = "medium",
    correlationKey?: string
  ): Promise<string> {
    return this.emit(agencyId, {
      sourceSystem: "WORKFLOW",
      signalType,
      category: "workflow",
      severity,
      payload,
      correlationKey: correlationKey || `workflow:${payload.workflowId}:${payload.executionId}`,
    });
  }

  async emitPerformanceSignal(
    agencyId: string,
    clientId: string | undefined,
    signalType: string,
    payload: Record<string, unknown>,
    severity: string = "medium"
  ): Promise<string> {
    return this.emit(agencyId, {
      sourceSystem: "PERFORMANCE_MONITOR",
      signalType,
      category: "performance",
      severity,
      payload,
      clientId,
      correlationKey: `perf:${clientId}:${signalType}`,
    });
  }

  async emitManualSignal(
    agencyId: string,
    signalType: string,
    category: string,
    payload: Record<string, unknown>,
    options: {
      severity?: string;
      clientId?: string;
      projectId?: string;
      correlationKey?: string;
    } = {}
  ): Promise<string> {
    return this.emit(agencyId, {
      sourceSystem: "MANUAL",
      signalType,
      category,
      severity: options.severity || "medium",
      payload,
      clientId: options.clientId,
      projectId: options.projectId,
      correlationKey: options.correlationKey,
    });
  }
}

export const signalEmitter = new SignalEmitter();
