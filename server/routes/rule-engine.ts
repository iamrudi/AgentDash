/**
 * Rule Engine Router
 *
 * Workflow rules API including CRUD operations, versions,
 * conditions, actions, audits, and evaluations.
 *
 * Routes: 12
 */

import { Router } from 'express';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/supabase-auth';
import { resolveAgencyContext } from '../middleware/agency-context';
import { storage } from '../storage';
import { RuleEngineService } from '../application/rules/rule-engine-service';

const router = Router();
const ruleEngineService = new RuleEngineService(storage);
router.use(requireAuth, requireRole("Admin", "SuperAdmin"));

export function createWorkflowRulesListHandler(service: RuleEngineService = ruleEngineService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const { agencyId } = resolveAgencyContext(req, { allowQueryParam: true });
      const result = await service.listRules(agencyId);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error('Error fetching workflow rules:', error);
      return res.status(500).json({ message: "Failed to fetch workflow rules" });
    }
  };
}

router.get('/workflow-rules', requireAuth, createWorkflowRulesListHandler());

export function createWorkflowRuleGetHandler(service: RuleEngineService = ruleEngineService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.getRule(req.params.id, {
        agencyId: req.user?.agencyId,
        isSuperAdmin: req.user?.isSuperAdmin,
      });
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error('Error fetching workflow rule:', error);
      return res.status(500).json({ message: "Failed to fetch workflow rule" });
    }
  };
}

router.get('/workflow-rules/:id', requireAuth, createWorkflowRuleGetHandler());

export function createWorkflowRuleCreateHandler(service: RuleEngineService = ruleEngineService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const { agencyId } = resolveAgencyContext(req, { allowQueryParam: true });
      const result = await service.createRule(agencyId, req.user?.id, req.body ?? {});
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error('Error creating workflow rule:', error);
      return res.status(500).json({ message: "Failed to create workflow rule" });
    }
  };
}

router.post('/workflow-rules', requireAuth, createWorkflowRuleCreateHandler());

export function createWorkflowRuleUpdateHandler(service: RuleEngineService = ruleEngineService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.updateRule(
        req.params.id,
        {
          agencyId: req.user?.agencyId,
          isSuperAdmin: req.user?.isSuperAdmin,
          id: req.user?.id,
        },
        req.body ?? {}
      );
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error('Error updating workflow rule:', error);
      return res.status(500).json({ message: "Failed to update workflow rule" });
    }
  };
}

router.patch('/workflow-rules/:id', requireAuth, createWorkflowRuleUpdateHandler());

export function createWorkflowRuleDeleteHandler(service: RuleEngineService = ruleEngineService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.deleteRule(req.params.id, {
        agencyId: req.user?.agencyId,
        isSuperAdmin: req.user?.isSuperAdmin,
        id: req.user?.id,
      });
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).send();
    } catch (error: any) {
      console.error('Error deleting workflow rule:', error);
      return res.status(500).json({ message: "Failed to delete workflow rule" });
    }
  };
}

router.delete('/workflow-rules/:id', requireAuth, createWorkflowRuleDeleteHandler());

export function createWorkflowRuleVersionsListHandler(service: RuleEngineService = ruleEngineService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.listRuleVersions(req.params.id, {
        agencyId: req.user?.agencyId,
        isSuperAdmin: req.user?.isSuperAdmin,
      });
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error('Error fetching rule versions:', error);
      return res.status(500).json({ message: "Failed to fetch rule versions" });
    }
  };
}

router.get('/workflow-rules/:id/versions', requireAuth, createWorkflowRuleVersionsListHandler());

export function createWorkflowRuleVersionCreateHandler(service: RuleEngineService = ruleEngineService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.createRuleVersion(
        req.params.id,
        {
          agencyId: req.user?.agencyId,
          isSuperAdmin: req.user?.isSuperAdmin,
          id: req.user?.id,
        },
        req.body ?? {}
      );
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error('Error creating rule version:', error);
      return res.status(500).json({ message: "Failed to create rule version" });
    }
  };
}

router.post('/workflow-rules/:id/versions', requireAuth, createWorkflowRuleVersionCreateHandler());

export function createWorkflowRuleVersionPublishHandler(service: RuleEngineService = ruleEngineService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.publishRuleVersion(req.params.id, {
        agencyId: req.user?.agencyId,
        isSuperAdmin: req.user?.isSuperAdmin,
        id: req.user?.id,
      });
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error('Error publishing rule version:', error);
      return res.status(500).json({ message: "Failed to publish rule version" });
    }
  };
}

router.post('/workflow-rule-versions/:id/publish', requireAuth, createWorkflowRuleVersionPublishHandler());

export function createWorkflowRuleConditionsListHandler(service: RuleEngineService = ruleEngineService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.listRuleConditions(req.params.id);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error('Error fetching rule conditions:', error);
      return res.status(500).json({ message: "Failed to fetch rule conditions" });
    }
  };
}

router.get('/workflow-rule-versions/:id/conditions', requireAuth, createWorkflowRuleConditionsListHandler());

export function createWorkflowRuleActionsListHandler(service: RuleEngineService = ruleEngineService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.listRuleActions(req.params.id);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error('Error fetching rule actions:', error);
      return res.status(500).json({ message: "Failed to fetch rule actions" });
    }
  };
}

router.get('/workflow-rule-versions/:id/actions', requireAuth, createWorkflowRuleActionsListHandler());

export function createWorkflowRuleAuditsListHandler(service: RuleEngineService = ruleEngineService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.listRuleAudits(req.params.id, {
        agencyId: req.user?.agencyId,
        isSuperAdmin: req.user?.isSuperAdmin,
      });
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error('Error fetching rule audits:', error);
      return res.status(500).json({ message: "Failed to fetch rule audits" });
    }
  };
}

router.get('/workflow-rules/:id/audits', requireAuth, createWorkflowRuleAuditsListHandler());

export function createWorkflowRuleEvaluationsListHandler(service: RuleEngineService = ruleEngineService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.listRuleEvaluations(
        req.params.id,
        {
          agencyId: req.user?.agencyId,
          isSuperAdmin: req.user?.isSuperAdmin,
        },
        req.query.limit
      );
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error('Error fetching rule evaluations:', error);
      return res.status(500).json({ message: "Failed to fetch rule evaluations" });
    }
  };
}

router.get('/workflow-rules/:id/evaluations', requireAuth, createWorkflowRuleEvaluationsListHandler());

export default router;
