/**
 * Intelligence Router
 * 
 * Duration Intelligence, Resource Optimization, Commercial Impact,
 * and Feedback Loop routes for AI-powered operational intelligence.
 * 
 * Routes: 21
 */

import { Router } from 'express';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/supabase-auth';
import { storage } from '../storage';

const intelligenceRouter = Router();

// Resource Optimization - Get allocation plans
intelligenceRouter.get("/resource-optimization/plans", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }

    const status = req.query.status as string;
    const limit = parseInt(req.query.limit as string) || 20;
    const plans = await storage.getResourceAllocationPlansByAgencyId(agencyId, { status, limit });
    res.json(plans);
  } catch (error: any) {
    console.error("Error fetching allocation plans:", error);
    res.status(500).json({ message: "Failed to fetch allocation plans" });
  }
});

// Resource Optimization - Get single plan
intelligenceRouter.get("/resource-optimization/plans/:id", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const plan = await storage.getResourceAllocationPlanById(req.params.id);
    if (!plan) {
      return res.status(404).json({ message: "Allocation plan not found" });
    }
    res.json(plan);
  } catch (error: any) {
    console.error("Error fetching allocation plan:", error);
    res.status(500).json({ message: "Failed to fetch allocation plan" });
  }
});

// Resource Optimization - Update plan status
intelligenceRouter.patch("/resource-optimization/plans/:id/status", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['draft', 'approved', 'active', 'completed', 'archived'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    
    const plan = await storage.updateResourceAllocationPlan(req.params.id, { 
      status
    });
    res.json(plan);
  } catch (error: any) {
    console.error("Error updating plan status:", error);
    res.status(500).json({ message: "Failed to update plan status" });
  }
});

// Resource Optimization - Get capacity heatmap
intelligenceRouter.get("/resource-optimization/capacity-heatmap", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }

    const { resourceOptimizerService } = await import("../intelligence/resource-optimizer-service");
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date();
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    
    const heatmap = await resourceOptimizerService.getCapacityHeatmap(agencyId, startDate, endDate);
    res.json(heatmap);
  } catch (error: any) {
    console.error("Error fetching capacity heatmap:", error);
    res.status(500).json({ message: "Failed to fetch capacity heatmap" });
  }
});

// Resource Optimization - Get capacity profiles
intelligenceRouter.get("/resource-optimization/capacity-profiles", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }

    const activeOnly = req.query.activeOnly === 'true';
    const profiles = await storage.getResourceCapacityProfilesByAgencyId(agencyId, { activeOnly });
    res.json(profiles);
  } catch (error: any) {
    console.error("Error fetching capacity profiles:", error);
    res.status(500).json({ message: "Failed to fetch capacity profiles" });
  }
});

// Resource Optimization - Create capacity profile
intelligenceRouter.post("/resource-optimization/capacity-profiles", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }

    const profile = await storage.createResourceCapacityProfile({ ...req.body, agencyId });
    res.json(profile);
  } catch (error: any) {
    console.error("Error creating capacity profile:", error);
    res.status(500).json({ message: "Failed to create capacity profile" });
  }
});

// Resource Optimization - Update capacity profile
intelligenceRouter.patch("/resource-optimization/capacity-profiles/:id", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const profile = await storage.updateResourceCapacityProfile(req.params.id, req.body);
    res.json(profile);
  } catch (error: any) {
    console.error("Error updating capacity profile:", error);
    res.status(500).json({ message: "Failed to update capacity profile" });
  }
});

// Commercial Impact - Calculate score
intelligenceRouter.post("/commercial-impact/calculate", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }

    const { commercialImpactService } = await import("../intelligence/commercial-impact-service");
    const result = await commercialImpactService.calculateImpactScore(agencyId, req.body);
    res.json(result);
  } catch (error: any) {
    console.error("Error calculating commercial impact:", error);
    res.status(500).json({ message: "Failed to calculate commercial impact" });
  }
});

// Commercial Impact - Get top prioritized tasks
intelligenceRouter.get("/commercial-impact/top-priorities", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }

    const { commercialImpactService } = await import("../intelligence/commercial-impact-service");
    const limit = parseInt(req.query.limit as string) || 20;
    const priorities = await commercialImpactService.getTopPrioritizedTasks(agencyId, limit);
    res.json(priorities);
  } catch (error: any) {
    console.error("Error fetching commercial impact priorities:", error);
    res.status(500).json({ message: "Failed to fetch commercial impact priorities" });
  }
});

// Commercial Impact - Get factors
intelligenceRouter.get("/commercial-impact/factors", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }

    const { commercialImpactService } = await import("../intelligence/commercial-impact-service");
    const factors = await commercialImpactService.getAgencyFactors(agencyId);
    res.json(factors);
  } catch (error: any) {
    console.error("Error fetching commercial impact factors:", error);
    res.status(500).json({ message: "Failed to fetch commercial impact factors" });
  }
});

// Commercial Impact - Update factors
intelligenceRouter.put("/commercial-impact/factors", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }

    const { commercialImpactService } = await import("../intelligence/commercial-impact-service");
    const factors = await commercialImpactService.updateAgencyFactors(agencyId, req.body);
    res.json(factors);
  } catch (error: any) {
    console.error("Error updating commercial impact factors:", error);
    res.status(500).json({ message: "Failed to update commercial impact factors" });
  }
});

// Commercial Impact - Batch calculate
intelligenceRouter.post("/commercial-impact/batch-calculate", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }

    const { commercialImpactService } = await import("../intelligence/commercial-impact-service");
    const { tasks } = req.body;
    const results = await commercialImpactService.batchCalculateImpactScores(agencyId, tasks);
    
    const resultObj: Record<string, any> = {};
    results.forEach((value, key) => {
      resultObj[key] = value;
    });
    
    res.json(resultObj);
  } catch (error: any) {
    console.error("Error batch calculating commercial impact:", error);
    res.status(500).json({ message: "Failed to batch calculate commercial impact" });
  }
});

// Integration - Check SLA risks for tasks
intelligenceRouter.post("/integration/sla-risks", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }

    const { durationIntelligenceIntegration } = await import("../intelligence/duration-intelligence-integration");
    const { tasksWithPredictions } = req.body;
    const risks = await durationIntelligenceIntegration.checkSLARisks(agencyId, tasksWithPredictions);
    res.json(risks);
  } catch (error: any) {
    console.error("Error checking SLA risks:", error);
    res.status(500).json({ message: "Failed to check SLA risks" });
  }
});

// Integration - Enrich tasks with intelligence
intelligenceRouter.post("/integration/enrich-tasks", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }

    const { durationIntelligenceIntegration } = await import("../intelligence/duration-intelligence-integration");
    const { taskIds } = req.body;
    
    const tasks = [];
    for (const taskId of taskIds) {
      const task = await storage.getTaskById(taskId);
      if (task) tasks.push(task);
    }
    
    const enrichedTasks = await durationIntelligenceIntegration.enrichTasksWithIntelligence(agencyId, tasks);
    res.json(enrichedTasks);
  } catch (error: any) {
    console.error("Error enriching tasks:", error);
    res.status(500).json({ message: "Failed to enrich tasks" });
  }
});

// Integration - Generate resource plan with intelligence
intelligenceRouter.post("/integration/generate-intelligent-plan", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }

    const { durationIntelligenceIntegration } = await import("../intelligence/duration-intelligence-integration");
    const { taskIds, startDate, endDate } = req.body;
    
    const tasks = [];
    for (const taskId of taskIds) {
      const task = await storage.getTaskById(taskId);
      if (task) tasks.push(task);
    }
    
    const result = await durationIntelligenceIntegration.generateResourcePlanWithIntelligence(
      agencyId,
      tasks,
      new Date(startDate),
      new Date(endDate)
    );
    res.json(result);
  } catch (error: any) {
    console.error("Error generating intelligent resource plan:", error);
    res.status(500).json({ message: "Failed to generate intelligent resource plan" });
  }
});

// Integration - Predict and signal for a task
intelligenceRouter.post("/integration/predict-and-signal", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }

    const { durationIntelligenceIntegration } = await import("../intelligence/duration-intelligence-integration");
    const { taskId, taskType, complexity, channel } = req.body;
    
    const task = await storage.getTaskById(taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
    
    const result = await durationIntelligenceIntegration.predictAndSignal(agencyId, task, {
      taskType: taskType || 'general',
      complexity: complexity || 'medium',
      channel
    });
    res.json(result);
  } catch (error: any) {
    console.error("Error predicting and signaling:", error);
    res.status(500).json({ message: "Failed to predict and signal" });
  }
});

// Feedback Loop - Capture recommendation outcome
intelligenceRouter.post("/feedback-loop/outcomes", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }

    const { outcomeFeedbackService } = await import("../intelligence/outcome-feedback-service");
    const outcome = await outcomeFeedbackService.captureOutcome({
      ...req.body,
      agencyId,
    });
    res.json(outcome);
  } catch (error: any) {
    console.error("Error capturing outcome:", error);
    res.status(500).json({ message: "Failed to capture outcome" });
  }
});

// Feedback Loop - Update recommendation outcome
intelligenceRouter.patch("/feedback-loop/outcomes/:id", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const { outcomeFeedbackService } = await import("../intelligence/outcome-feedback-service");
    const outcome = await outcomeFeedbackService.updateOutcome(req.params.id, req.body);
    if (!outcome) {
      return res.status(404).json({ message: "Outcome not found" });
    }
    res.json(outcome);
  } catch (error: any) {
    console.error("Error updating outcome:", error);
    res.status(500).json({ message: "Failed to update outcome" });
  }
});

// Feedback Loop - Get recommendation quality dashboard
intelligenceRouter.get("/feedback-loop/quality-dashboard", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }

    const { outcomeFeedbackService } = await import("../intelligence/outcome-feedback-service");
    const dashboard = await outcomeFeedbackService.getQualityDashboard(agencyId, {
      clientId: req.query.clientId as string,
      periods: req.query.periods ? parseInt(req.query.periods as string) : undefined,
    });
    res.json(dashboard);
  } catch (error: any) {
    console.error("Error getting quality dashboard:", error);
    res.status(500).json({ message: "Failed to get quality dashboard" });
  }
});

// Feedback Loop - Get AI calibration parameters
intelligenceRouter.get("/feedback-loop/calibration", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }

    const params = await storage.getAiCalibrationParameters(agencyId, req.query.clientId as string);
    res.json(params);
  } catch (error: any) {
    console.error("Error getting calibration parameters:", error);
    res.status(500).json({ message: "Failed to get calibration parameters" });
  }
});

// Feedback Loop - Update AI calibration parameter
intelligenceRouter.put("/feedback-loop/calibration", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }

    const param = await storage.upsertAiCalibrationParameter({
      ...req.body,
      agencyId,
    });
    res.json(param);
  } catch (error: any) {
    console.error("Error updating calibration parameter:", error);
    res.status(500).json({ message: "Failed to update calibration parameter" });
  }
});

export default intelligenceRouter;
