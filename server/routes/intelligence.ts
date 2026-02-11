/**
 * Intelligence Router
 */

import { Router } from 'express';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/supabase-auth';
import { storage } from '../storage';
import { IntelligenceOperationsService } from '../application/intelligence/intelligence-operations-service';

const intelligenceRouter = Router();

const intelligenceOperationsService = new IntelligenceOperationsService(storage, {
  resourceOptimizerService: {
    getCapacityHeatmap: async (agencyId, startDate, endDate) => {
      const { resourceOptimizerService } = await import('../intelligence/resource-optimizer-service');
      return resourceOptimizerService.getCapacityHeatmap(agencyId, startDate, endDate);
    },
  },
  commercialImpactService: {
    calculateImpactScore: async (agencyId, payload) => {
      const { commercialImpactService } = await import('../intelligence/commercial-impact-service');
      return commercialImpactService.calculateImpactScore(agencyId, payload);
    },
    getTopPrioritizedTasks: async (agencyId, limit) => {
      const { commercialImpactService } = await import('../intelligence/commercial-impact-service');
      return commercialImpactService.getTopPrioritizedTasks(agencyId, limit);
    },
    getAgencyFactors: async (agencyId) => {
      const { commercialImpactService } = await import('../intelligence/commercial-impact-service');
      return commercialImpactService.getAgencyFactors(agencyId);
    },
    updateAgencyFactors: async (agencyId, payload) => {
      const { commercialImpactService } = await import('../intelligence/commercial-impact-service');
      return commercialImpactService.updateAgencyFactors(agencyId, payload);
    },
    batchCalculateImpactScores: async (agencyId, tasks) => {
      const { commercialImpactService } = await import('../intelligence/commercial-impact-service');
      return commercialImpactService.batchCalculateImpactScores(agencyId, tasks);
    },
  },
  durationIntelligenceIntegration: {
    checkSLARisks: async (agencyId, tasksWithPredictions) => {
      const { durationIntelligenceIntegration } = await import('../intelligence/duration-intelligence-integration');
      return durationIntelligenceIntegration.checkSLARisks(agencyId, tasksWithPredictions);
    },
    enrichTasksWithIntelligence: async (agencyId, tasks) => {
      const { durationIntelligenceIntegration } = await import('../intelligence/duration-intelligence-integration');
      return durationIntelligenceIntegration.enrichTasksWithIntelligence(agencyId, tasks);
    },
    generateResourcePlanWithIntelligence: async (agencyId, tasks, startDate, endDate) => {
      const { durationIntelligenceIntegration } = await import('../intelligence/duration-intelligence-integration');
      return durationIntelligenceIntegration.generateResourcePlanWithIntelligence(agencyId, tasks, startDate, endDate);
    },
    predictAndSignal: async (agencyId, task, params) => {
      const { durationIntelligenceIntegration } = await import('../intelligence/duration-intelligence-integration');
      return durationIntelligenceIntegration.predictAndSignal(agencyId, task, params);
    },
  },
  outcomeFeedbackService: {
    captureOutcome: async (payload) => {
      const { outcomeFeedbackService } = await import('../intelligence/outcome-feedback-service');
      return outcomeFeedbackService.captureOutcome(payload);
    },
    updateOutcome: async (id, payload) => {
      const { outcomeFeedbackService } = await import('../intelligence/outcome-feedback-service');
      return outcomeFeedbackService.updateOutcome(id, payload);
    },
    getQualityDashboard: async (agencyId, params) => {
      const { outcomeFeedbackService } = await import('../intelligence/outcome-feedback-service');
      return outcomeFeedbackService.getQualityDashboard(agencyId, params);
    },
  },
});

function handleResult(res: any, result: { ok: boolean; status: number; data?: unknown; error?: string }) {
  if (!result.ok) {
    return res.status(result.status).json({ message: result.error });
  }
  return res.status(result.status).json(result.data);
}

export function createAllocationPlansListHandler(service: IntelligenceOperationsService = intelligenceOperationsService) {
  return async (req: AuthRequest, res: any) => {
    try {
      return handleResult(
        res,
        await service.listAllocationPlans(req.user?.agencyId, {
          status: req.query.status as string | undefined,
          limit: req.query.limit as string | undefined,
        })
      );
    } catch (error: any) {
      console.error('Error fetching allocation plans:', error);
      return res.status(500).json({ message: 'Failed to fetch allocation plans' });
    }
  };
}

export function createAllocationPlanGetHandler(service: IntelligenceOperationsService = intelligenceOperationsService) {
  return async (req: AuthRequest, res: any) => {
    try {
      return handleResult(res, await service.getAllocationPlan(req.params.id));
    } catch (error: any) {
      console.error('Error fetching allocation plan:', error);
      return res.status(500).json({ message: 'Failed to fetch allocation plan' });
    }
  };
}

export function createAllocationPlanStatusHandler(service: IntelligenceOperationsService = intelligenceOperationsService) {
  return async (req: AuthRequest, res: any) => {
    try {
      return handleResult(res, await service.updateAllocationPlanStatus(req.params.id, req.body?.status));
    } catch (error: any) {
      console.error('Error updating plan status:', error);
      return res.status(500).json({ message: 'Failed to update plan status' });
    }
  };
}

export function createCapacityHeatmapHandler(service: IntelligenceOperationsService = intelligenceOperationsService) {
  return async (req: AuthRequest, res: any) => {
    try {
      return handleResult(
        res,
        await service.getCapacityHeatmap(req.user?.agencyId, {
          startDate: req.query.startDate as string | undefined,
          endDate: req.query.endDate as string | undefined,
        })
      );
    } catch (error: any) {
      console.error('Error fetching capacity heatmap:', error);
      return res.status(500).json({ message: 'Failed to fetch capacity heatmap' });
    }
  };
}

export function createCapacityProfilesListHandler(service: IntelligenceOperationsService = intelligenceOperationsService) {
  return async (req: AuthRequest, res: any) => {
    try {
      return handleResult(res, await service.listCapacityProfiles(req.user?.agencyId, req.query.activeOnly === 'true'));
    } catch (error: any) {
      console.error('Error fetching capacity profiles:', error);
      return res.status(500).json({ message: 'Failed to fetch capacity profiles' });
    }
  };
}

export function createCapacityProfileCreateHandler(service: IntelligenceOperationsService = intelligenceOperationsService) {
  return async (req: AuthRequest, res: any) => {
    try {
      return handleResult(res, await service.createCapacityProfile(req.user?.agencyId, req.body));
    } catch (error: any) {
      console.error('Error creating capacity profile:', error);
      return res.status(500).json({ message: 'Failed to create capacity profile' });
    }
  };
}

export function createCapacityProfileUpdateHandler(service: IntelligenceOperationsService = intelligenceOperationsService) {
  return async (req: AuthRequest, res: any) => {
    try {
      return handleResult(res, await service.updateCapacityProfile(req.params.id, req.body));
    } catch (error: any) {
      console.error('Error updating capacity profile:', error);
      return res.status(500).json({ message: 'Failed to update capacity profile' });
    }
  };
}

export function createCommercialCalculateHandler(service: IntelligenceOperationsService = intelligenceOperationsService) {
  return async (req: AuthRequest, res: any) => {
    try {
      return handleResult(res, await service.calculateCommercialImpact(req.user?.agencyId, req.body));
    } catch (error: any) {
      console.error('Error calculating commercial impact:', error);
      return res.status(500).json({ message: 'Failed to calculate commercial impact' });
    }
  };
}

export function createCommercialTopPrioritiesHandler(service: IntelligenceOperationsService = intelligenceOperationsService) {
  return async (req: AuthRequest, res: any) => {
    try {
      return handleResult(res, await service.getCommercialTopPriorities(req.user?.agencyId, req.query.limit as string | undefined));
    } catch (error: any) {
      console.error('Error fetching commercial impact priorities:', error);
      return res.status(500).json({ message: 'Failed to fetch commercial impact priorities' });
    }
  };
}

export function createCommercialFactorsGetHandler(service: IntelligenceOperationsService = intelligenceOperationsService) {
  return async (req: AuthRequest, res: any) => {
    try {
      return handleResult(res, await service.getCommercialFactors(req.user?.agencyId));
    } catch (error: any) {
      console.error('Error fetching commercial impact factors:', error);
      return res.status(500).json({ message: 'Failed to fetch commercial impact factors' });
    }
  };
}

export function createCommercialFactorsUpdateHandler(service: IntelligenceOperationsService = intelligenceOperationsService) {
  return async (req: AuthRequest, res: any) => {
    try {
      return handleResult(res, await service.updateCommercialFactors(req.user?.agencyId, req.body));
    } catch (error: any) {
      console.error('Error updating commercial impact factors:', error);
      return res.status(500).json({ message: 'Failed to update commercial impact factors' });
    }
  };
}

export function createCommercialBatchHandler(service: IntelligenceOperationsService = intelligenceOperationsService) {
  return async (req: AuthRequest, res: any) => {
    try {
      return handleResult(res, await service.batchCalculateCommercialImpact(req.user?.agencyId, req.body?.tasks));
    } catch (error: any) {
      console.error('Error batch calculating commercial impact:', error);
      return res.status(500).json({ message: 'Failed to batch calculate commercial impact' });
    }
  };
}

export function createIntegrationSlaRisksHandler(service: IntelligenceOperationsService = intelligenceOperationsService) {
  return async (req: AuthRequest, res: any) => {
    try {
      return handleResult(res, await service.checkSlaRisks(req.user?.agencyId, req.body?.tasksWithPredictions));
    } catch (error: any) {
      console.error('Error checking SLA risks:', error);
      return res.status(500).json({ message: 'Failed to check SLA risks' });
    }
  };
}

export function createIntegrationEnrichTasksHandler(service: IntelligenceOperationsService = intelligenceOperationsService) {
  return async (req: AuthRequest, res: any) => {
    try {
      return handleResult(res, await service.enrichTasks(req.user?.agencyId, req.body?.taskIds || []));
    } catch (error: any) {
      console.error('Error enriching tasks:', error);
      return res.status(500).json({ message: 'Failed to enrich tasks' });
    }
  };
}

export function createIntegrationGeneratePlanHandler(service: IntelligenceOperationsService = intelligenceOperationsService) {
  return async (req: AuthRequest, res: any) => {
    try {
      return handleResult(res, await service.generateIntelligentPlan(req.user?.agencyId, req.body));
    } catch (error: any) {
      console.error('Error generating intelligent resource plan:', error);
      return res.status(500).json({ message: 'Failed to generate intelligent resource plan' });
    }
  };
}

export function createIntegrationPredictAndSignalHandler(service: IntelligenceOperationsService = intelligenceOperationsService) {
  return async (req: AuthRequest, res: any) => {
    try {
      return handleResult(res, await service.predictAndSignal(req.user?.agencyId, req.body));
    } catch (error: any) {
      console.error('Error predicting and signaling:', error);
      return res.status(500).json({ message: 'Failed to predict and signal' });
    }
  };
}

export function createOutcomeCaptureHandler(service: IntelligenceOperationsService = intelligenceOperationsService) {
  return async (req: AuthRequest, res: any) => {
    try {
      return handleResult(res, await service.captureOutcome(req.user?.agencyId, req.body));
    } catch (error: any) {
      console.error('Error capturing outcome:', error);
      return res.status(500).json({ message: 'Failed to capture outcome' });
    }
  };
}

export function createOutcomeUpdateHandler(service: IntelligenceOperationsService = intelligenceOperationsService) {
  return async (req: AuthRequest, res: any) => {
    try {
      return handleResult(res, await service.updateOutcome(req.params.id, req.body));
    } catch (error: any) {
      console.error('Error updating outcome:', error);
      return res.status(500).json({ message: 'Failed to update outcome' });
    }
  };
}

export function createQualityDashboardHandler(service: IntelligenceOperationsService = intelligenceOperationsService) {
  return async (req: AuthRequest, res: any) => {
    try {
      return handleResult(
        res,
        await service.getQualityDashboard(req.user?.agencyId, {
          clientId: req.query.clientId as string | undefined,
          periods: req.query.periods as string | undefined,
        })
      );
    } catch (error: any) {
      console.error('Error getting quality dashboard:', error);
      return res.status(500).json({ message: 'Failed to get quality dashboard' });
    }
  };
}

export function createCalibrationGetHandler(service: IntelligenceOperationsService = intelligenceOperationsService) {
  return async (req: AuthRequest, res: any) => {
    try {
      return handleResult(res, await service.getCalibration(req.user?.agencyId, req.query.clientId as string | undefined));
    } catch (error: any) {
      console.error('Error getting calibration parameters:', error);
      return res.status(500).json({ message: 'Failed to get calibration parameters' });
    }
  };
}

export function createCalibrationUpdateHandler(service: IntelligenceOperationsService = intelligenceOperationsService) {
  return async (req: AuthRequest, res: any) => {
    try {
      return handleResult(res, await service.upsertCalibration(req.user?.agencyId, req.body));
    } catch (error: any) {
      console.error('Error updating calibration parameter:', error);
      return res.status(500).json({ message: 'Failed to update calibration parameter' });
    }
  };
}

intelligenceRouter.get('/resource-optimization/plans', requireAuth, requireRole('Admin', 'SuperAdmin'), createAllocationPlansListHandler());
intelligenceRouter.get('/resource-optimization/plans/:id', requireAuth, requireRole('Admin', 'SuperAdmin'), createAllocationPlanGetHandler());
intelligenceRouter.patch('/resource-optimization/plans/:id/status', requireAuth, requireRole('Admin'), createAllocationPlanStatusHandler());
intelligenceRouter.get('/resource-optimization/capacity-heatmap', requireAuth, requireRole('Admin', 'SuperAdmin'), createCapacityHeatmapHandler());
intelligenceRouter.get('/resource-optimization/capacity-profiles', requireAuth, requireRole('Admin', 'SuperAdmin'), createCapacityProfilesListHandler());
intelligenceRouter.post('/resource-optimization/capacity-profiles', requireAuth, requireRole('Admin'), createCapacityProfileCreateHandler());
intelligenceRouter.patch('/resource-optimization/capacity-profiles/:id', requireAuth, requireRole('Admin'), createCapacityProfileUpdateHandler());

intelligenceRouter.post('/commercial-impact/calculate', requireAuth, requireRole('Admin', 'SuperAdmin'), createCommercialCalculateHandler());
intelligenceRouter.get('/commercial-impact/top-priorities', requireAuth, requireRole('Admin', 'SuperAdmin'), createCommercialTopPrioritiesHandler());
intelligenceRouter.get('/commercial-impact/factors', requireAuth, requireRole('Admin', 'SuperAdmin'), createCommercialFactorsGetHandler());
intelligenceRouter.put('/commercial-impact/factors', requireAuth, requireRole('Admin'), createCommercialFactorsUpdateHandler());
intelligenceRouter.post('/commercial-impact/batch-calculate', requireAuth, requireRole('Admin', 'SuperAdmin'), createCommercialBatchHandler());

intelligenceRouter.post('/integration/sla-risks', requireAuth, requireRole('Admin', 'SuperAdmin'), createIntegrationSlaRisksHandler());
intelligenceRouter.post('/integration/enrich-tasks', requireAuth, requireRole('Admin', 'SuperAdmin'), createIntegrationEnrichTasksHandler());
intelligenceRouter.post('/integration/generate-intelligent-plan', requireAuth, requireRole('Admin', 'SuperAdmin'), createIntegrationGeneratePlanHandler());
intelligenceRouter.post('/integration/predict-and-signal', requireAuth, requireRole('Admin', 'SuperAdmin'), createIntegrationPredictAndSignalHandler());

intelligenceRouter.post('/feedback-loop/outcomes', requireAuth, requireRole('Admin', 'SuperAdmin'), createOutcomeCaptureHandler());
intelligenceRouter.patch('/feedback-loop/outcomes/:id', requireAuth, requireRole('Admin', 'SuperAdmin'), createOutcomeUpdateHandler());
intelligenceRouter.get('/feedback-loop/quality-dashboard', requireAuth, requireRole('Admin', 'SuperAdmin'), createQualityDashboardHandler());
intelligenceRouter.get('/feedback-loop/calibration', requireAuth, requireRole('Admin', 'SuperAdmin'), createCalibrationGetHandler());
intelligenceRouter.put('/feedback-loop/calibration', requireAuth, requireRole('Admin'), createCalibrationUpdateHandler());

export default intelligenceRouter;
