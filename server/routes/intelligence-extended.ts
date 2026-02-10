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

const intelligenceExtendedRouter = Router();

// Intelligence Signals - List signals for agency
intelligenceExtendedRouter.get("/signals", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }
    
    const { limit, sourceSystem, category, processed } = req.query;
    const signals = await storage.getIntelligenceSignalsByAgencyId(agencyId, {
      limit: limit ? parseInt(limit as string) : undefined,
      sourceSystem: sourceSystem as string | undefined,
      category: category as string | undefined,
      processed: processed ? processed === "true" : undefined,
    });
    
    res.json(signals);
  } catch (error: any) {
    console.error("Error fetching intelligence signals:", error);
    res.status(500).json({ message: "Failed to fetch signals" });
  }
});

// Intelligence Signals - Get single signal
intelligenceExtendedRouter.get("/signals/:id", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const signal = await storage.getIntelligenceSignalById(req.params.id);
    if (!signal) {
      return res.status(404).json({ message: "Signal not found" });
    }
    
    const agencyId = req.user?.agencyId;
    if (agencyId && signal.agencyId !== agencyId) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    res.json(signal);
  } catch (error: any) {
    console.error("Error fetching signal:", error);
    res.status(500).json({ message: "Failed to fetch signal" });
  }
});

// Intelligence Signals - Create new signal (for internal/integration use)
intelligenceExtendedRouter.post("/signals", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }
    
    const signalData = {
      ...req.body,
      agencyId,
      occurredAt: new Date(req.body.occurredAt || Date.now()),
    };
    
    const signal = await storage.createIntelligenceSignal(signalData);
    res.status(201).json(signal);
  } catch (error: any) {
    console.error("Error creating signal:", error);
    res.status(500).json({ message: "Failed to create signal" });
  }
});

// Intelligence Signals - Discard a signal
intelligenceExtendedRouter.post("/signals/:id/discard", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ message: "Discard reason is required" });
    }
    
    const signal = await storage.discardSignal(req.params.id, reason);
    res.json(signal);
  } catch (error: any) {
    console.error("Error discarding signal:", error);
    res.status(500).json({ message: "Failed to discard signal" });
  }
});

// Intelligence Insights - List insights for agency
intelligenceExtendedRouter.get("/insights", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }
    
    const { limit, status, severity, clientId } = req.query;
    const insights = await storage.getIntelligenceInsightsByAgencyId(agencyId, {
      limit: limit ? parseInt(limit as string) : undefined,
      status: status as string | undefined,
      severity: severity as string | undefined,
      clientId: clientId as string | undefined,
    });
    
    res.json(insights);
  } catch (error: any) {
    console.error("Error fetching insights:", error);
    res.status(500).json({ message: "Failed to fetch insights" });
  }
});

// Intelligence Insights - Get single insight
intelligenceExtendedRouter.get("/insights/:id", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const insight = await storage.getIntelligenceInsightById(req.params.id);
    if (!insight) {
      return res.status(404).json({ message: "Insight not found" });
    }
    
    const agencyId = req.user?.agencyId;
    if (agencyId && insight.agencyId !== agencyId) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    res.json(insight);
  } catch (error: any) {
    console.error("Error fetching insight:", error);
    res.status(500).json({ message: "Failed to fetch insight" });
  }
});

// Intelligence Insights - Create insight (for internal/aggregator use)
intelligenceExtendedRouter.post("/insights", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }
    
    const insightData = {
      ...req.body,
      agencyId,
    };
    
    const insight = await storage.createIntelligenceInsight(insightData);
    res.status(201).json(insight);
  } catch (error: any) {
    console.error("Error creating insight:", error);
    res.status(500).json({ message: "Failed to create insight" });
  }
});

// Intelligence Insights - Update status
intelligenceExtendedRouter.patch("/insights/:id/status", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }
    
    const validStatuses = ["open", "prioritised", "actioned", "ignored", "invalid"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    
    const insight = await storage.updateIntelligenceInsightStatus(req.params.id, status);
    res.json(insight);
  } catch (error: any) {
    console.error("Error updating insight status:", error);
    res.status(500).json({ message: "Failed to update insight status" });
  }
});

// Intelligence Priority Config - Get config for agency
intelligenceExtendedRouter.get("/priority-config", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }
    
    const config = await storage.getIntelligencePriorityConfig(agencyId);
    if (!config) {
      return res.json({
        agencyId,
        wImpact: "0.4",
        wUrgency: "0.3",
        wConfidence: "0.2",
        wResource: "0.1",
      });
    }
    
    res.json(config);
  } catch (error: any) {
    console.error("Error fetching priority config:", error);
    res.status(500).json({ message: "Failed to fetch priority config" });
  }
});

// Intelligence Priority Config - Update config
intelligenceExtendedRouter.put("/priority-config", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }
    
    const { wImpact, wUrgency, wConfidence, wResource } = req.body;
    
    const config = await storage.upsertIntelligencePriorityConfig({
      agencyId,
      wImpact: wImpact || "0.4",
      wUrgency: wUrgency || "0.3",
      wConfidence: wConfidence || "0.2",
      wResource: wResource || "0.1",
    });
    
    res.json(config);
  } catch (error: any) {
    console.error("Error updating priority config:", error);
    res.status(500).json({ message: "Failed to update priority config" });
  }
});

// Intelligence Priorities - List priorities for agency
intelligenceExtendedRouter.get("/priorities", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }
    
    const { limit, status, bucket } = req.query;
    const priorities = await storage.getIntelligencePrioritiesByAgencyId(agencyId, {
      limit: limit ? parseInt(limit as string) : undefined,
      status: status as string | undefined,
      bucket: bucket as string | undefined,
    });
    
    res.json(priorities);
  } catch (error: any) {
    console.error("Error fetching priorities:", error);
    res.status(500).json({ message: "Failed to fetch priorities" });
  }
});

// Intelligence Priorities - Get single priority
intelligenceExtendedRouter.get("/priorities/:id", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const priority = await storage.getIntelligencePriorityById(req.params.id);
    if (!priority) {
      return res.status(404).json({ message: "Priority not found" });
    }
    
    const agencyId = req.user?.agencyId;
    if (agencyId && priority.agencyId !== agencyId) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    res.json(priority);
  } catch (error: any) {
    console.error("Error fetching priority:", error);
    res.status(500).json({ message: "Failed to fetch priority" });
  }
});

// Intelligence Priorities - Create priority (for priority engine use)
intelligenceExtendedRouter.post("/priorities", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }
    
    const priorityData = {
      ...req.body,
      agencyId,
    };
    
    const priority = await storage.createIntelligencePriority(priorityData);
    res.status(201).json(priority);
  } catch (error: any) {
    console.error("Error creating priority:", error);
    res.status(500).json({ message: "Failed to create priority" });
  }
});

// Intelligence Priorities - Update status
intelligenceExtendedRouter.patch("/priorities/:id/status", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }
    
    const validStatuses = ["pending", "in_progress", "done", "dismissed"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    
    const priority = await storage.updateIntelligencePriorityStatus(req.params.id, status);
    res.json(priority);
  } catch (error: any) {
    console.error("Error updating priority status:", error);
    res.status(500).json({ message: "Failed to update priority status" });
  }
});

// Intelligence Feedback - List feedback for agency
intelligenceExtendedRouter.get("/feedback", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }
    
    const { limit, insightId } = req.query;
    const feedback = await storage.getIntelligenceFeedbackByAgencyId(agencyId, {
      limit: limit ? parseInt(limit as string) : undefined,
      insightId: insightId as string | undefined,
    });
    
    res.json(feedback);
  } catch (error: any) {
    console.error("Error fetching feedback:", error);
    res.status(500).json({ message: "Failed to fetch feedback" });
  }
});

// Intelligence Feedback - Get single feedback
intelligenceExtendedRouter.get("/feedback/:id", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const feedback = await storage.getIntelligenceFeedbackById(req.params.id);
    if (!feedback) {
      return res.status(404).json({ message: "Feedback not found" });
    }
    
    const agencyId = req.user?.agencyId;
    if (agencyId && feedback.agencyId !== agencyId) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    res.json(feedback);
  } catch (error: any) {
    console.error("Error fetching feedback:", error);
    res.status(500).json({ message: "Failed to fetch feedback" });
  }
});

// Intelligence Feedback - Submit feedback
intelligenceExtendedRouter.post("/feedback", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }
    
    const feedbackData = {
      ...req.body,
      agencyId,
      createdByUserId: req.user?.id,
    };
    
    const feedback = await storage.createIntelligenceFeedback(feedbackData);
    res.status(201).json(feedback);
  } catch (error: any) {
    console.error("Error creating feedback:", error);
    res.status(500).json({ message: "Failed to create feedback" });
  }
});

// Intelligence Overview - Dashboard summary
intelligenceExtendedRouter.get("/overview", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }
    
    const [signals, insights, priorities] = await Promise.all([
      storage.getIntelligenceSignalsByAgencyId(agencyId, { limit: 100, processed: false }),
      storage.getOpenIntelligenceInsights(agencyId),
      storage.getPendingIntelligencePriorities(agencyId),
    ]);
    
    res.json({
      unprocessedSignalsCount: signals.length,
      openInsightsCount: insights.length,
      pendingPrioritiesCount: priorities.length,
      recentSignals: signals.slice(0, 10),
      topInsights: insights.slice(0, 5),
      topPriorities: priorities.slice(0, 5),
    });
  } catch (error: any) {
    console.error("Error fetching intelligence overview:", error);
    res.status(500).json({ message: "Failed to fetch intelligence overview" });
  }
});

// Intelligence Processing - Process signals into insights (Admin only)
intelligenceExtendedRouter.post("/process-signals", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }
    
    const { insightAggregator } = await import("../intelligence/insight-aggregator");
    const result = await insightAggregator.processSignals(agencyId);
    
    res.json({
      message: "Signal processing completed",
      ...result,
    });
  } catch (error: any) {
    console.error("Error processing signals:", error);
    res.status(500).json({ message: "Failed to process signals" });
  }
});

// Intelligence Processing - Compute priorities from insights (Admin only)
intelligenceExtendedRouter.post("/compute-priorities", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }
    
    const { priorityEngine } = await import("../intelligence/priority-engine");
    const result = await priorityEngine.processInsights(agencyId);
    
    res.json({
      message: "Priority computation completed",
      ...result,
    });
  } catch (error: any) {
    console.error("Error computing priorities:", error);
    res.status(500).json({ message: "Failed to compute priorities" });
  }
});

// Intelligence Processing - Run full pipeline (Admin only)
intelligenceExtendedRouter.post("/run-pipeline", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }
    
    const { insightAggregator } = await import("../intelligence/insight-aggregator");
    const { priorityEngine } = await import("../intelligence/priority-engine");
    
    const signalResult = await insightAggregator.processSignals(agencyId);
    const priorityResult = await priorityEngine.processInsights(agencyId);
    
    res.json({
      message: "Intelligence pipeline completed",
      signalsProcessed: signalResult.processed,
      insightsCreated: signalResult.insightsCreated,
      prioritiesCreated: priorityResult.prioritiesCreated,
    });
  } catch (error: any) {
    console.error("Error running intelligence pipeline:", error);
    res.status(500).json({ message: "Failed to run intelligence pipeline" });
  }
});

// ===========================================
// DURATION INTELLIGENCE API ENDPOINTS
// ===========================================

// Duration Model - Get prediction for a task
intelligenceExtendedRouter.post("/duration/predict", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }

    const { durationModelService } = await import("../intelligence/duration-model-service");
    const { taskType, complexity, assigneeId, clientId, contextSize } = req.body;
    const prediction = await durationModelService.predictDuration(
      agencyId,
      taskType,
      complexity,
      assigneeId || null,
      clientId || null,
      contextSize || null
    );
    res.json(prediction);
  } catch (error: any) {
    console.error("Error generating duration prediction:", error);
    res.status(500).json({ message: "Failed to generate duration prediction" });
  }
});

// Duration Model - Get model stats
intelligenceExtendedRouter.get("/duration/stats", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }

    const { durationModelService } = await import("../intelligence/duration-model-service");
    const stats = await durationModelService.getModelStats(agencyId);
    res.json(stats);
  } catch (error: any) {
    console.error("Error fetching duration model stats:", error);
    res.status(500).json({ message: "Failed to fetch duration model stats" });
  }
});

// Duration Model - Get execution history
intelligenceExtendedRouter.get("/duration/history", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const taskType = req.query.taskType as string;
    const clientId = req.query.clientId as string;

    const history = await storage.getTaskExecutionHistoryByAgencyId(agencyId, { limit, taskType, clientId });
    res.json(history);
  } catch (error: any) {
    console.error("Error fetching execution history:", error);
    res.status(500).json({ message: "Failed to fetch execution history" });
  }
});

// Duration Model - Record task completion
intelligenceExtendedRouter.post("/duration/record-completion", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }

    const { durationModelService } = await import("../intelligence/duration-model-service");
    const {
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
      completedAt,
    } = req.body;
    
    await durationModelService.recordTaskCompletion(
      agencyId,
      taskId,
      taskType,
      complexity,
      channel || null,
      clientId || null,
      projectId || null,
      assigneeId || null,
      estimatedHours || null,
      actualHours,
      aiInvolved || false,
      contextSize || null,
      urgencyTier || null,
      startedAt ? new Date(startedAt) : null,
      completedAt ? new Date(completedAt) : new Date()
    );
    res.json({ success: true, message: "Completion recorded successfully" });
  } catch (error: any) {
    console.error("Error recording task completion:", error);
    res.status(500).json({ message: "Failed to record task completion" });
  }
});

// Resource Optimization - Generate allocation plan
intelligenceExtendedRouter.post("/resource-optimization/generate-plan", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }

    const { resourceOptimizerService } = await import("../intelligence/resource-optimizer-service");
    const { tasks, startDate, endDate } = req.body;
    
    const result = await resourceOptimizerService.generateAllocationPlan(
      agencyId,
      tasks,
      new Date(startDate),
      new Date(endDate)
    );
    res.json(result);
  } catch (error: any) {
    console.error("Error generating allocation plan:", error);
    res.status(500).json({ message: "Failed to generate allocation plan" });
  }
});

// Resource Optimization - Save allocation plan
intelligenceExtendedRouter.post("/resource-optimization/save-plan", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }

    const { resourceOptimizerService } = await import("../intelligence/resource-optimizer-service");
    const { name, startDate, endDate, assignments, objective } = req.body;
    
    const plan = await resourceOptimizerService.saveAllocationPlan(
      agencyId,
      name,
      new Date(startDate),
      new Date(endDate),
      assignments,
      objective,
      req.user?.id || null
    );
    res.json(plan);
  } catch (error: any) {
    console.error("Error saving allocation plan:", error);
    res.status(500).json({ message: "Failed to save allocation plan" });
  }
});

export default intelligenceExtendedRouter;
