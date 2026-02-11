/**
 * Intelligence Extended Router
 * 
 * Core intelligence routes including signals, insights, priorities,
 * feedback, overview, and pipeline processing.
 * 
 * Routes: 20+
 */

import { Router } from 'express';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/supabase-auth';
import { storage } from '../storage';
import { IntelligenceCrudService } from "../application/intelligence/intelligence-crud-service";
import { IntelligenceOverviewService } from "../application/intelligence/intelligence-overview-service";
import { IntelligencePipelineService } from "../application/intelligence/intelligence-pipeline-service";
import { IntelligenceDurationService } from "../application/intelligence/intelligence-duration-service";
import { ResourceOptimizationService } from "../application/intelligence/resource-optimization-service";

const intelligenceExtendedRouter = Router();
const intelligenceCrudService = new IntelligenceCrudService(storage);
const intelligenceOverviewService = new IntelligenceOverviewService(storage);
const intelligencePipelineService = new IntelligencePipelineService({
  processSignals: async (agencyId: string) => {
    const { insightAggregator } = await import("../intelligence/insight-aggregator");
    return insightAggregator.processSignals(agencyId);
  },
  processInsights: async (agencyId: string) => {
    const { priorityEngine } = await import("../intelligence/priority-engine");
    return priorityEngine.processInsights(agencyId);
  },
});
const intelligenceDurationService = new IntelligenceDurationService(storage, {
  predictDuration: async (
    agencyId: string,
    taskType: string,
    complexity: string,
    assigneeId: string | null,
    clientId: string | null,
    contextSize: number | null
  ) => {
    const { durationModelService } = await import("../intelligence/duration-model-service");
    return durationModelService.predictDuration(
      agencyId,
      taskType,
      complexity,
      assigneeId,
      clientId,
      contextSize
    );
  },
  getModelStats: async (agencyId: string) => {
    const { durationModelService } = await import("../intelligence/duration-model-service");
    return durationModelService.getModelStats(agencyId);
  },
  recordTaskCompletion: async (
    agencyId: string,
    taskId: string,
    taskType: string,
    complexity: string,
    channel: string | null,
    clientId: string | null,
    projectId: string | null,
    assigneeId: string | null,
    estimatedHours: number | null,
    actualHours: number,
    aiInvolved: boolean,
    contextSize: number | null,
    urgencyTier: string | null,
    startedAt: Date | null,
    completedAt: Date
  ) => {
    const { durationModelService } = await import("../intelligence/duration-model-service");
    return durationModelService.recordTaskCompletion(
      agencyId,
      taskId,
      taskType,
      complexity,
      channel,
      clientId,
      projectId,
      assigneeId,
      estimatedHours,
      actualHours,
      aiInvolved,
      contextSize,
      urgencyTier,
      startedAt,
      completedAt
    );
  },
});
const resourceOptimizationService = new ResourceOptimizationService({
  generateAllocationPlan: async (
    agencyId: string,
    tasks: unknown[],
    startDate: Date,
    endDate: Date
  ) => {
    const { resourceOptimizerService } = await import("../intelligence/resource-optimizer-service");
    return resourceOptimizerService.generateAllocationPlan(agencyId, tasks, startDate, endDate);
  },
  saveAllocationPlan: async (
    agencyId: string,
    name: string,
    startDate: Date,
    endDate: Date,
    assignments: unknown[],
    objective: string,
    createdByUserId: string | null
  ) => {
    const { resourceOptimizerService } = await import("../intelligence/resource-optimizer-service");
    return resourceOptimizerService.saveAllocationPlan(
      agencyId,
      name,
      startDate,
      endDate,
      assignments,
      objective,
      createdByUserId
    );
  },
});

export function createSignalsListHandler(service: IntelligenceCrudService = intelligenceCrudService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.listSignals(req.user?.agencyId, {
        limit: req.query.limit as string | undefined,
        sourceSystem: req.query.sourceSystem as string | undefined,
        category: req.query.category as string | undefined,
        processed: req.query.processed as string | undefined,
      });
      if (!result.ok) return res.status(result.status).json({ message: result.error });
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error fetching intelligence signals:", error);
      return res.status(500).json({ message: "Failed to fetch signals" });
    }
  };
}

export function createSignalGetHandler(service: IntelligenceCrudService = intelligenceCrudService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.getSignal(req.user?.agencyId, req.params.id);
      if (!result.ok) return res.status(result.status).json({ message: result.error });
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error fetching signal:", error);
      return res.status(500).json({ message: "Failed to fetch signal" });
    }
  };
}

export function createSignalCreateHandler(service: IntelligenceCrudService = intelligenceCrudService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.createSignal(req.user?.agencyId, req.body);
      if (!result.ok) return res.status(result.status).json({ message: result.error });
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error creating signal:", error);
      return res.status(500).json({ message: "Failed to create signal" });
    }
  };
}

export function createSignalDiscardHandler(service: IntelligenceCrudService = intelligenceCrudService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.discardSignal(req.params.id, req.body?.reason);
      if (!result.ok) return res.status(result.status).json({ message: result.error });
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error discarding signal:", error);
      return res.status(500).json({ message: "Failed to discard signal" });
    }
  };
}

export function createInsightsListHandler(service: IntelligenceCrudService = intelligenceCrudService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.listInsights(req.user?.agencyId, {
        limit: req.query.limit as string | undefined,
        status: req.query.status as string | undefined,
        severity: req.query.severity as string | undefined,
        clientId: req.query.clientId as string | undefined,
      });
      if (!result.ok) return res.status(result.status).json({ message: result.error });
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error fetching insights:", error);
      return res.status(500).json({ message: "Failed to fetch insights" });
    }
  };
}

export function createInsightGetHandler(service: IntelligenceCrudService = intelligenceCrudService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.getInsight(req.user?.agencyId, req.params.id);
      if (!result.ok) return res.status(result.status).json({ message: result.error });
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error fetching insight:", error);
      return res.status(500).json({ message: "Failed to fetch insight" });
    }
  };
}

export function createInsightCreateHandler(service: IntelligenceCrudService = intelligenceCrudService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.createInsight(req.user?.agencyId, req.body);
      if (!result.ok) return res.status(result.status).json({ message: result.error });
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error creating insight:", error);
      return res.status(500).json({ message: "Failed to create insight" });
    }
  };
}

export function createInsightStatusHandler(service: IntelligenceCrudService = intelligenceCrudService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.updateInsightStatus(req.params.id, req.body?.status);
      if (!result.ok) return res.status(result.status).json({ message: result.error });
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error updating insight status:", error);
      return res.status(500).json({ message: "Failed to update insight status" });
    }
  };
}

export function createPriorityConfigGetHandler(service: IntelligenceCrudService = intelligenceCrudService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.getPriorityConfig(req.user?.agencyId);
      if (!result.ok) return res.status(result.status).json({ message: result.error });
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error fetching priority config:", error);
      return res.status(500).json({ message: "Failed to fetch priority config" });
    }
  };
}

export function createPriorityConfigUpdateHandler(service: IntelligenceCrudService = intelligenceCrudService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.updatePriorityConfig(req.user?.agencyId, req.body || {});
      if (!result.ok) return res.status(result.status).json({ message: result.error });
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error updating priority config:", error);
      return res.status(500).json({ message: "Failed to update priority config" });
    }
  };
}

export function createPrioritiesListHandler(service: IntelligenceCrudService = intelligenceCrudService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.listPriorities(req.user?.agencyId, {
        limit: req.query.limit as string | undefined,
        status: req.query.status as string | undefined,
        bucket: req.query.bucket as string | undefined,
      });
      if (!result.ok) return res.status(result.status).json({ message: result.error });
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error fetching priorities:", error);
      return res.status(500).json({ message: "Failed to fetch priorities" });
    }
  };
}

export function createPriorityGetHandler(service: IntelligenceCrudService = intelligenceCrudService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.getPriority(req.user?.agencyId, req.params.id);
      if (!result.ok) return res.status(result.status).json({ message: result.error });
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error fetching priority:", error);
      return res.status(500).json({ message: "Failed to fetch priority" });
    }
  };
}

export function createPriorityCreateHandler(service: IntelligenceCrudService = intelligenceCrudService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.createPriority(req.user?.agencyId, req.body);
      if (!result.ok) return res.status(result.status).json({ message: result.error });
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error creating priority:", error);
      return res.status(500).json({ message: "Failed to create priority" });
    }
  };
}

export function createPriorityStatusHandler(service: IntelligenceCrudService = intelligenceCrudService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.updatePriorityStatus(req.params.id, req.body?.status);
      if (!result.ok) return res.status(result.status).json({ message: result.error });
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error updating priority status:", error);
      return res.status(500).json({ message: "Failed to update priority status" });
    }
  };
}

export function createFeedbackListHandler(service: IntelligenceCrudService = intelligenceCrudService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.listFeedback(req.user?.agencyId, {
        limit: req.query.limit as string | undefined,
        insightId: req.query.insightId as string | undefined,
      });
      if (!result.ok) return res.status(result.status).json({ message: result.error });
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error fetching feedback:", error);
      return res.status(500).json({ message: "Failed to fetch feedback" });
    }
  };
}

export function createFeedbackGetHandler(service: IntelligenceCrudService = intelligenceCrudService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.getFeedback(req.user?.agencyId, req.params.id);
      if (!result.ok) return res.status(result.status).json({ message: result.error });
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error fetching feedback:", error);
      return res.status(500).json({ message: "Failed to fetch feedback" });
    }
  };
}

export function createFeedbackCreateHandler(service: IntelligenceCrudService = intelligenceCrudService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.createFeedback(req.user?.agencyId, req.user?.id, req.body);
      if (!result.ok) return res.status(result.status).json({ message: result.error });
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error creating feedback:", error);
      return res.status(500).json({ message: "Failed to create feedback" });
    }
  };
}

intelligenceExtendedRouter.get("/signals", requireAuth, requireRole("Admin", "SuperAdmin"), createSignalsListHandler());
intelligenceExtendedRouter.get("/signals/:id", requireAuth, requireRole("Admin", "SuperAdmin"), createSignalGetHandler());
intelligenceExtendedRouter.post("/signals", requireAuth, requireRole("Admin", "SuperAdmin"), createSignalCreateHandler());
intelligenceExtendedRouter.post("/signals/:id/discard", requireAuth, requireRole("Admin", "SuperAdmin"), createSignalDiscardHandler());
intelligenceExtendedRouter.get("/insights", requireAuth, requireRole("Admin", "SuperAdmin"), createInsightsListHandler());
intelligenceExtendedRouter.get("/insights/:id", requireAuth, requireRole("Admin", "SuperAdmin"), createInsightGetHandler());
intelligenceExtendedRouter.post("/insights", requireAuth, requireRole("Admin", "SuperAdmin"), createInsightCreateHandler());
intelligenceExtendedRouter.patch("/insights/:id/status", requireAuth, requireRole("Admin", "SuperAdmin"), createInsightStatusHandler());
intelligenceExtendedRouter.get("/priority-config", requireAuth, requireRole("Admin", "SuperAdmin"), createPriorityConfigGetHandler());
intelligenceExtendedRouter.put("/priority-config", requireAuth, requireRole("Admin"), createPriorityConfigUpdateHandler());
intelligenceExtendedRouter.get("/priorities", requireAuth, requireRole("Admin", "SuperAdmin"), createPrioritiesListHandler());
intelligenceExtendedRouter.get("/priorities/:id", requireAuth, requireRole("Admin", "SuperAdmin"), createPriorityGetHandler());
intelligenceExtendedRouter.post("/priorities", requireAuth, requireRole("Admin", "SuperAdmin"), createPriorityCreateHandler());
intelligenceExtendedRouter.patch("/priorities/:id/status", requireAuth, requireRole("Admin", "SuperAdmin"), createPriorityStatusHandler());
intelligenceExtendedRouter.get("/feedback", requireAuth, requireRole("Admin", "SuperAdmin"), createFeedbackListHandler());
intelligenceExtendedRouter.get("/feedback/:id", requireAuth, requireRole("Admin", "SuperAdmin"), createFeedbackGetHandler());
intelligenceExtendedRouter.post("/feedback", requireAuth, requireRole("Admin", "SuperAdmin"), createFeedbackCreateHandler());

export function createIntelligenceOverviewHandler(
  service: IntelligenceOverviewService = intelligenceOverviewService
) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.getOverview(req.user?.agencyId);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error fetching intelligence overview:", error);
      return res.status(500).json({ message: "Failed to fetch intelligence overview" });
    }
  };
}

intelligenceExtendedRouter.get(
  "/overview",
  requireAuth,
  requireRole("Admin", "SuperAdmin"),
  createIntelligenceOverviewHandler()
);

export function createProcessSignalsHandler(
  service: IntelligencePipelineService = intelligencePipelineService
) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.processSignals(req.user?.agencyId);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error processing signals:", error);
      return res.status(500).json({ message: "Failed to process signals" });
    }
  };
}

intelligenceExtendedRouter.post(
  "/process-signals",
  requireAuth,
  requireRole("Admin"),
  createProcessSignalsHandler()
);

export function createComputePrioritiesHandler(
  service: IntelligencePipelineService = intelligencePipelineService
) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.computePriorities(req.user?.agencyId);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error computing priorities:", error);
      return res.status(500).json({ message: "Failed to compute priorities" });
    }
  };
}

intelligenceExtendedRouter.post(
  "/compute-priorities",
  requireAuth,
  requireRole("Admin"),
  createComputePrioritiesHandler()
);

export function createRunPipelineHandler(
  service: IntelligencePipelineService = intelligencePipelineService
) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.runPipeline(req.user?.agencyId);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error running intelligence pipeline:", error);
      return res.status(500).json({ message: "Failed to run intelligence pipeline" });
    }
  };
}

intelligenceExtendedRouter.post(
  "/run-pipeline",
  requireAuth,
  requireRole("Admin"),
  createRunPipelineHandler()
);

// ===========================================
// DURATION INTELLIGENCE API ENDPOINTS
// ===========================================

export function createDurationPredictHandler(
  service: IntelligenceDurationService = intelligenceDurationService
) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.predict(req.user?.agencyId, req.body);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error generating duration prediction:", error);
      return res.status(500).json({ message: "Failed to generate duration prediction" });
    }
  };
}

intelligenceExtendedRouter.post(
  "/duration/predict",
  requireAuth,
  requireRole("Admin", "SuperAdmin"),
  createDurationPredictHandler()
);

export function createDurationStatsHandler(
  service: IntelligenceDurationService = intelligenceDurationService
) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.getStats(req.user?.agencyId);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error fetching duration model stats:", error);
      return res.status(500).json({ message: "Failed to fetch duration model stats" });
    }
  };
}

intelligenceExtendedRouter.get(
  "/duration/stats",
  requireAuth,
  requireRole("Admin", "SuperAdmin"),
  createDurationStatsHandler()
);

export function createDurationHistoryHandler(
  service: IntelligenceDurationService = intelligenceDurationService
) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.getHistory(req.user?.agencyId, {
        limit: req.query.limit as string | undefined,
        taskType: req.query.taskType as string | undefined,
        clientId: req.query.clientId as string | undefined,
      });
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error fetching execution history:", error);
      return res.status(500).json({ message: "Failed to fetch execution history" });
    }
  };
}

intelligenceExtendedRouter.get(
  "/duration/history",
  requireAuth,
  requireRole("Admin", "SuperAdmin"),
  createDurationHistoryHandler()
);

export function createDurationRecordCompletionHandler(
  service: IntelligenceDurationService = intelligenceDurationService
) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.recordCompletion(req.user?.agencyId, req.body);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error recording task completion:", error);
      return res.status(500).json({ message: "Failed to record task completion" });
    }
  };
}

intelligenceExtendedRouter.post(
  "/duration/record-completion",
  requireAuth,
  requireRole("Admin", "SuperAdmin"),
  createDurationRecordCompletionHandler()
);

export function createResourceGeneratePlanHandler(
  service: ResourceOptimizationService = resourceOptimizationService
) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.generatePlan(req.user?.agencyId, req.body);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error generating allocation plan:", error);
      return res.status(500).json({ message: "Failed to generate allocation plan" });
    }
  };
}

intelligenceExtendedRouter.post(
  "/resource-optimization/generate-plan",
  requireAuth,
  requireRole("Admin", "SuperAdmin"),
  createResourceGeneratePlanHandler()
);

export function createResourceSavePlanHandler(
  service: ResourceOptimizationService = resourceOptimizationService
) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.savePlan(req.user?.agencyId, req.user?.id, req.body);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error saving allocation plan:", error);
      return res.status(500).json({ message: "Failed to save allocation plan" });
    }
  };
}

intelligenceExtendedRouter.post(
  "/resource-optimization/save-plan",
  requireAuth,
  requireRole("Admin"),
  createResourceSavePlanHandler()
);

export default intelligenceExtendedRouter;
