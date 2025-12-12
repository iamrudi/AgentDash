import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { requireAuth, requireRole, requireClientAccess, requireProjectAccess, requireTaskAccess, type AuthRequest } from '../middleware/supabase-auth';
import { resolveAgencyContext } from '../middleware/agency-context';
import { insertProjectSchema } from '@shared/schema';

const router = Router();

router.get('/clients', requireAuth, requireRole('Admin'), async (req: AuthRequest, res) => {
  try {
    const { agencyId } = resolveAgencyContext(req, { allowQueryParam: true });
    const clients = await storage.getAllClientsWithDetails(agencyId);
    res.json(clients);
  } catch (error: any) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
});

router.get('/clients/:clientId', requireAuth, requireRole('Admin'), requireClientAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;
    const client = await storage.getClientById(clientId);
    
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    
    res.json(client);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.patch('/clients/:clientId', requireAuth, requireRole('Admin'), requireClientAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;
    const { leadValue, retainerAmount, billingDay, monthlyRetainerHours } = req.body;
    
    const client = await storage.getClientById(clientId);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    
    const updates: any = {};
    if (leadValue !== undefined) updates.leadValue = leadValue;
    if (retainerAmount !== undefined) updates.retainerAmount = retainerAmount;
    if (billingDay !== undefined) updates.billingDay = billingDay;
    if (monthlyRetainerHours !== undefined) updates.monthlyRetainerHours = monthlyRetainerHours;
    
    const updatedClient = await storage.updateClient(clientId, updates);
    res.json(updatedClient);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/clients/:clientId/retainer-hours', requireAuth, requireRole('Admin'), requireClientAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;
    const hoursInfo = await storage.checkRetainerHours(clientId);
    res.json(hoursInfo);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/clients/:clientId/reset-retainer-hours', requireAuth, requireRole('Admin'), requireClientAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;
    const updatedClient = await storage.resetRetainerHours(clientId);
    res.json(updatedClient);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/projects', requireAuth, requireRole('Admin', 'Staff'), async (req: AuthRequest, res) => {
  try {
    if (req.user!.isSuperAdmin) {
      const allProjects = await storage.getAllProjects();
      return res.json(allProjects);
    }

    if (!req.user!.agencyId) {
      return res.status(403).json({ message: 'Agency association required' });
    }

    const projects = await storage.getAllProjects(req.user!.agencyId);
    res.json(projects);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/projects', requireAuth, requireRole('Admin'), async (req: AuthRequest, res) => {
  try {
    if (!req.user!.agencyId && !req.user!.isSuperAdmin) {
      return res.status(403).json({ message: 'Agency association required' });
    }
    
    const projectData = insertProjectSchema.parse({
      ...req.body,
      agencyId: req.user!.isSuperAdmin ? req.body.agencyId : req.user!.agencyId,
    });
    const newProject = await storage.createProject(projectData);
    res.status(201).json(newProject);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    res.status(500).json({ message: error.message });
  }
});

router.get('/projects/:id', requireAuth, requireRole('Admin', 'Staff'), requireProjectAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const project = await storage.getProjectWithTasks(id);
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    res.json(project);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.patch('/projects/:id', requireAuth, requireRole('Admin'), requireProjectAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const updated = await storage.updateProject(id, updates);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/projects/:projectId/lists', requireAuth, requireRole('Admin', 'Staff', 'SuperAdmin'), requireProjectAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.params;
    const lists = await storage.getTaskListsByProjectId(projectId);
    res.json(lists);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/metrics', requireAuth, requireRole('Admin'), async (req: AuthRequest, res) => {
  try {
    if (!req.user!.agencyId) {
      return res.status(403).json({ message: 'Agency association required' });
    }
    const metrics = await storage.getAllMetrics(90, req.user!.agencyId);
    res.json(metrics);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/clients/:clientId/metrics', requireAuth, requireRole('Admin'), requireClientAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;
    const metrics = await storage.getMetricsByClientId(clientId, 90);
    res.json(metrics);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/initiatives', requireAuth, requireRole('Admin'), async (req: AuthRequest, res) => {
  try {
    if (!req.user!.agencyId) {
      return res.status(403).json({ message: 'Agency association required' });
    }
    const initiatives = await storage.getAllInitiatives(req.user!.agencyId);
    res.json(initiatives);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/integrations', requireAuth, requireRole('Admin'), async (req: AuthRequest, res) => {
  try {
    if (!req.user!.agencyId) {
      return res.status(403).json({ message: 'Agency association required' });
    }
    const integrations = await storage.getAllIntegrations(req.user!.agencyId);
    const safeIntegrations = integrations.map(({ accessToken, refreshToken, accessTokenIv, refreshTokenIv, accessTokenAuthTag, refreshTokenAuthTag, ...safe }) => safe);
    res.json(safeIntegrations);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/staff', requireAuth, requireRole('Admin'), async (req: AuthRequest, res) => {
  try {
    if (req.user!.isSuperAdmin) {
      const staff = await storage.getAllStaff();
      const staffList = staff.map(s => ({ id: s.id, name: s.fullName }));
      return res.json(staffList);
    }

    if (!req.user!.agencyId) {
      return res.status(403).json({ message: 'Agency association required' });
    }
    const staff = await storage.getAllStaff(req.user!.agencyId);
    const staffList = staff.map(s => ({ id: s.id, name: s.fullName }));
    res.json(staffList);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/messages', requireAuth, requireRole('Admin', 'Staff'), async (req: AuthRequest, res) => {
  try {
    if (!req.user!.agencyId) {
      return res.status(403).json({ message: 'Agency association required' });
    }
    const messages = await storage.getAllMessages(req.user!.agencyId);
    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/notifications/counts', requireAuth, requireRole('Admin'), async (req: AuthRequest, res) => {
  try {
    if (!req.user!.agencyId) {
      return res.status(403).json({ message: 'Agency association required' });
    }
    const counts = await storage.getNotificationCounts(req.user!.agencyId);
    res.json(counts);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
