import { Router } from 'express';
import { storage } from '../storage';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/supabase-auth';

const router = Router();

router.get('/tasks', requireAuth, requireRole('Staff', 'Admin'), async (req: AuthRequest, res) => {
  try {
    if (!req.user!.agencyId) {
      return res.status(403).json({ message: 'Agency association required' });
    }
    const allTasks = await storage.getAllTasks(req.user!.agencyId);
    const tasksWithProjects = await Promise.all(
      allTasks.map(async (task) => {
        const project = task.projectId ? await storage.getProjectById(task.projectId) : undefined;
        return { ...task, project };
      })
    );
    res.json(tasksWithProjects);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/tasks/full', requireAuth, requireRole('Staff', 'Admin'), async (req: AuthRequest, res) => {
  try {
    if (!req.user!.agencyId) {
      return res.status(403).json({ message: 'Agency association required' });
    }

    const profile = await storage.getProfileByUserId(req.user!.id);
    if (!profile) {
      return res.status(403).json({ message: 'Profile not found' });
    }

    const allTasks = await storage.getAllTasks(req.user!.agencyId);
    
    const tasksToReturn = req.user!.role === 'Staff' 
      ? await Promise.all(
          allTasks.map(async (task) => {
            const assignments = await storage.getAssignmentsByTaskId(task.id);
            const isAssigned = assignments.some(a => a.staffProfileId === profile.id);
            return isAssigned ? task : null;
          })
        ).then(tasks => tasks.filter((t): t is typeof allTasks[number] => t !== null))
      : allTasks;

    const tasksWithAssignments = await Promise.all(
      tasksToReturn.map(async (task) => {
        const assignments = await storage.getAssignmentsByTaskId(task.id);
        const assignmentsWithProfiles = await Promise.all(
          assignments.map(async (assignment) => {
            const assigneeProfile = await storage.getProfileById(assignment.staffProfileId);
            return { ...assignment, staffProfile: assigneeProfile };
          })
        );
        return { ...task, assignments: assignmentsWithProfiles };
      })
    );
    
    res.json(tasksWithAssignments);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/notifications/counts', requireAuth, requireRole('Staff'), async (req: AuthRequest, res) => {
  try {
    const profile = await storage.getProfileByUserId(req.user!.id);
    
    if (!profile) {
      return res.json({ newTasks: 0, highPriorityTasks: 0 });
    }

    const counts = await storage.getStaffNotificationCounts(profile.id);
    res.json(counts);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
