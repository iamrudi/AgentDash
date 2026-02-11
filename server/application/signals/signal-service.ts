import { z } from "zod";
import { insertWorkflowSignalRouteSchema, updateWorkflowSignalRouteSchema } from "@shared/schema";
import { SignalAdapterFactory } from "../../workflow/signal-adapters";
import { signalRouter } from "../../workflow/signal-router";
import type { IStorage } from "../../storage";

export interface SignalServiceResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  errors?: unknown;
}

export class SignalService {
  constructor(private readonly storage: IStorage) {}

  async ingest(params: {
    agencyId?: string;
    source: string;
    data: unknown;
    clientId?: string;
  }): Promise<SignalServiceResult<unknown>> {
    if (!params.agencyId) {
      return { ok: false, status: 403, error: "Agency ID required" };
    }

    if (!SignalAdapterFactory.hasAdapter(params.source)) {
      return {
        ok: false,
        status: 400,
        error: `Invalid source: ${params.source}. Valid sources: ${SignalAdapterFactory.getSupportedSources().join(", ")}`,
      };
    }

    if (!params.data || typeof params.data !== "object") {
      return { ok: false, status: 400, error: "Signal data is required" };
    }

    const result = await signalRouter.ingestSignal(params.agencyId, params.source, params.data as Record<string, unknown>, params.clientId);
    return {
      ok: true,
      status: result.isDuplicate ? 200 : 201,
      data: {
        signal: result.signal,
        isDuplicate: result.isDuplicate,
        matchingRoutes: result.matchingRoutes.length,
        workflowsTriggered: result.workflowsTriggered,
      },
    };
  }

  supportedSources(): SignalServiceResult<{ sources: string[] }> {
    return {
      ok: true,
      status: 200,
      data: { sources: SignalAdapterFactory.getSupportedSources() },
    };
  }

  async pendingSignals(agencyId: string | undefined, limitRaw: unknown): Promise<SignalServiceResult<unknown>> {
    if (!agencyId) {
      return { ok: false, status: 403, error: "Agency ID required" };
    }
    const limit = Number.parseInt(String(limitRaw), 10) || 100;
    const signals = await signalRouter.getPendingSignals(agencyId, limit);
    return { ok: true, status: 200, data: signals };
  }

  async failedSignals(agencyId: string | undefined, limitRaw: unknown): Promise<SignalServiceResult<unknown>> {
    if (!agencyId) {
      return { ok: false, status: 403, error: "Agency ID required" };
    }
    const limit = Number.parseInt(String(limitRaw), 10) || 100;
    const signals = await signalRouter.getFailedSignals(agencyId, limit);
    return { ok: true, status: 200, data: signals };
  }

  async retrySignal(signalId: string, user: { agencyId?: string; isSuperAdmin?: boolean }): Promise<SignalServiceResult<unknown>> {
    const signal = await this.storage.getWorkflowSignalById(signalId);
    if (!signal) {
      return { ok: false, status: 404, error: "Signal not found" };
    }

    if (signal.agencyId !== user.agencyId && !user.isSuperAdmin) {
      return { ok: false, status: 403, error: "Access denied" };
    }

    const updatedSignal = await signalRouter.retrySignal(signalId);
    return { ok: true, status: 200, data: updatedSignal };
  }

  async getSignal(signalId: string, user: { agencyId?: string; isSuperAdmin?: boolean }): Promise<SignalServiceResult<unknown>> {
    const signal = await this.storage.getWorkflowSignalById(signalId);
    if (!signal) {
      return { ok: false, status: 404, error: "Signal not found" };
    }

    if (signal.agencyId !== user.agencyId && !user.isSuperAdmin) {
      return { ok: false, status: 403, error: "Access denied" };
    }

    return { ok: true, status: 200, data: signal };
  }

  async listRoutes(agencyId: string | undefined): Promise<SignalServiceResult<unknown>> {
    if (!agencyId) {
      return { ok: false, status: 403, error: "Agency ID required" };
    }
    const routes = await this.storage.getSignalRoutesByAgencyId(agencyId);
    return { ok: true, status: 200, data: routes };
  }

  async getRoute(routeId: string, user: { agencyId?: string; isSuperAdmin?: boolean }): Promise<SignalServiceResult<unknown>> {
    const route = await this.storage.getSignalRouteById(routeId);
    if (!route) {
      return { ok: false, status: 404, error: "Signal route not found" };
    }

    if (route.agencyId !== user.agencyId && !user.isSuperAdmin) {
      return { ok: false, status: 403, error: "Access denied" };
    }

    return { ok: true, status: 200, data: route };
  }

  async createRoute(agencyId: string | undefined, payload: unknown): Promise<SignalServiceResult<unknown>> {
    if (!agencyId) {
      return { ok: false, status: 403, error: "Agency ID required" };
    }

    try {
      const validated = insertWorkflowSignalRouteSchema.parse({ ...(payload as Record<string, unknown>), agencyId });
      const route = await this.storage.createSignalRoute(validated);
      return { ok: true, status: 201, data: route };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { ok: false, status: 400, error: "Validation failed", errors: error.errors };
      }
      throw error;
    }
  }

  async updateRoute(
    routeId: string,
    user: { agencyId?: string; isSuperAdmin?: boolean },
    payload: unknown
  ): Promise<SignalServiceResult<unknown>> {
    const route = await this.storage.getSignalRouteById(routeId);
    if (!route) {
      return { ok: false, status: 404, error: "Signal route not found" };
    }

    if (route.agencyId !== user.agencyId && !user.isSuperAdmin) {
      return { ok: false, status: 403, error: "Access denied" };
    }

    try {
      const validated = updateWorkflowSignalRouteSchema.parse(payload);
      const updated = await this.storage.updateSignalRoute(routeId, validated);
      return { ok: true, status: 200, data: updated };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { ok: false, status: 400, error: "Validation failed", errors: error.errors };
      }
      throw error;
    }
  }

  async deleteRoute(routeId: string, user: { agencyId?: string; isSuperAdmin?: boolean }): Promise<SignalServiceResult<undefined>> {
    const route = await this.storage.getSignalRouteById(routeId);
    if (!route) {
      return { ok: false, status: 404, error: "Signal route not found" };
    }

    if (route.agencyId !== user.agencyId && !user.isSuperAdmin) {
      return { ok: false, status: 403, error: "Access denied" };
    }

    await this.storage.deleteSignalRoute(routeId);
    return { ok: true, status: 204 };
  }
}
