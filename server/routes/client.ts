import { Router } from 'express';
import { storage } from '../storage';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/supabase-auth';
import logger from '../middleware/logger';

const router = Router();

router.get('/profile', requireAuth, requireRole('Client'), async (req: AuthRequest, res) => {
  try {
    const profile = await storage.getProfileByUserId(req.user!.id);
    const client = await storage.getClientByProfileId(profile!.id);
    
    if (!client) {
      return res.status(404).json({ message: 'Client record not found' });
    }

    res.json({
      id: client.id,
      companyName: client.companyName,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/projects', requireAuth, requireRole('Client', 'Admin'), async (req: AuthRequest, res) => {
  try {
    if (req.user!.role === 'Admin') {
      if (!req.user!.agencyId) {
        return res.status(403).json({ message: 'Agency association required' });
      }
      const allProjects = await storage.getAllProjects(req.user!.agencyId);
      const projectsWithClients = await Promise.all(
        allProjects.map(async (project) => {
          const client = await storage.getClientById(project.clientId);
          return { ...project, client };
        })
      );
      return res.json(projectsWithClients);
    }

    const profile = await storage.getProfileById(req.user!.id);
    const client = await storage.getClientByProfileId(profile!.id);
    
    if (!client) {
      return res.json([]);
    }

    const projects = await storage.getProjectsByClientId(client.id);
    const projectsWithClient = projects.map(p => ({ ...p, client }));
    res.json(projectsWithClient);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/tasks/recent', requireAuth, requireRole('Client'), async (req: AuthRequest, res) => {
  try {
    const profile = await storage.getProfileByUserId(req.user!.id);
    const client = await storage.getClientByProfileId(profile!.id);
    
    if (!client) {
      return res.json([]);
    }

    const projects = await storage.getProjectsByClientId(client.id);
    
    if (projects.length === 0) {
      return res.json([]);
    }

    const allTasks = await Promise.all(
      projects.map(async (project) => {
        const projectWithTasks = await storage.getProjectWithTasks(project.id);
        return (projectWithTasks?.tasks || []).map(task => ({
          ...task,
          project: {
            id: project.id,
            name: project.name
          }
        }));
      })
    );

    const tasks = allTasks.flat().sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    res.json(tasks.slice(0, 5));
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/projects-with-tasks', requireAuth, requireRole('Client'), async (req: AuthRequest, res) => {
  try {
    const profile = await storage.getProfileByUserId(req.user!.id);
    const client = await storage.getClientByProfileId(profile!.id);
    
    if (!client) {
      return res.json([]);
    }

    const projects = await storage.getProjectsByClientId(client.id);
    
    const projectsWithTasks = await Promise.all(
      projects.map(async (project) => {
        const projectData = await storage.getProjectWithTasks(project.id);
        return {
          ...project,
          tasks: projectData?.tasks || [],
          taskStats: {
            total: projectData?.tasks.length || 0,
            completed: projectData?.tasks.filter(t => t.status === 'Completed').length || 0,
            inProgress: projectData?.tasks.filter(t => t.status === 'In Progress').length || 0,
            pending: projectData?.tasks.filter(t => t.status === 'Pending').length || 0,
          }
        };
      })
    );

    res.json(projectsWithTasks);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/invoices', requireAuth, requireRole('Client', 'Admin'), async (req: AuthRequest, res) => {
  try {
    if (req.user!.role === 'Admin') {
      if (!req.user!.agencyId) {
        return res.status(403).json({ message: 'Agency association required' });
      }
      const allInvoices = await storage.getAllInvoices(req.user!.agencyId);
      const invoicesWithClients = await Promise.all(
        allInvoices.map(async (invoice) => {
          const client = await storage.getClientById(invoice.clientId);
          return { ...invoice, client };
        })
      );
      return res.json(invoicesWithClients);
    }

    const profile = await storage.getProfileById(req.user!.id);
    const client = await storage.getClientByProfileId(profile!.id);
    
    if (!client) {
      return res.json([]);
    }

    const invoices = await storage.getInvoicesByClientId(client.id);
    const invoicesWithClient = invoices.map(i => ({ ...i, client }));
    res.json(invoicesWithClient);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/initiatives', requireAuth, requireRole('Client', 'Admin'), async (req: AuthRequest, res) => {
  try {
    if (req.user!.role === 'Admin') {
      if (!req.user!.agencyId) {
        return res.status(403).json({ message: 'Agency association required' });
      }
      const allInitiatives = await storage.getAllInitiatives(req.user!.agencyId);
      const initsWithClients = await Promise.all(
        allInitiatives.map(async (init) => {
          const client = await storage.getClientById(init.clientId);
          return { ...init, client };
        })
      );
      return res.json(initsWithClients);
    }

    const profile = await storage.getProfileById(req.user!.id);
    const client = await storage.getClientByProfileId(profile!.id);
    
    if (!client) {
      return res.json([]);
    }

    const initiatives = await storage.getInitiativesByClientId(client.id);
    const initsWithClient = initiatives.map(i => ({ ...i, client }));
    res.json(initsWithClient);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/objectives', requireAuth, requireRole('Client'), async (req: AuthRequest, res) => {
  try {
    const profile = await storage.getProfileByUserId(req.user!.id);
    const client = await storage.getClientByProfileId(profile!.id);
    
    if (!client) {
      return res.json([]);
    }

    const objectives = await storage.getActiveObjectivesByClientId(client.id);
    res.json(objectives);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/messages', requireAuth, requireRole('Client'), async (req: AuthRequest, res) => {
  try {
    const profile = await storage.getProfileByUserId(req.user!.id);
    const client = await storage.getClientByProfileId(profile!.id);
    
    if (!client) {
      return res.json([]);
    }

    const messages = await storage.getMessagesByClientId(client.id);
    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/messages', requireAuth, requireRole('Client'), async (req: AuthRequest, res) => {
  try {
    const profile = await storage.getProfileByUserId(req.user!.id);
    const client = await storage.getClientByProfileId(profile!.id);
    
    if (!client) {
      return res.status(404).json({ message: 'Client record not found' });
    }

    const { subject, content, projectId, priority } = req.body;

    if (!subject || !content) {
      return res.status(400).json({ message: 'Subject and content are required' });
    }

    const newMessage = await storage.createMessage({
      clientId: client.id,
      senderProfileId: profile!.id,
      subject,
      content,
      projectId: projectId || null,
      priority: priority || 'Normal',
    });

    try {
      const adminUsers = client.agencyId 
        ? await storage.getAllUsersWithProfiles(client.agencyId)
        : [];
      const admins = adminUsers.filter(u => u.profile?.role === 'Admin');
      
      for (const admin of admins) {
        await storage.createNotification({
          userId: admin.id,
          type: 'client_message',
          title: 'New Client Message',
          message: `${profile!.fullName} from ${client.companyName} sent a new message`,
          link: '/agency/messages',
          isRead: 'false',
          isArchived: 'false',
        });
      }
    } catch (notificationError) {
      logger.error('Failed to create client message notification', { error: notificationError });
    }

    res.status(201).json(newMessage);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/notifications/counts', requireAuth, requireRole('Client'), async (req: AuthRequest, res) => {
  try {
    const profile = await storage.getProfileByUserId(req.user!.id);
    const client = await storage.getClientByProfileId(profile!.id);
    
    if (!client) {
      return res.json({ unreadMessages: 0, newRecommendations: 0 });
    }

    const counts = await storage.getClientNotificationCounts(client.id);
    res.json(counts);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
