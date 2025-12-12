import { Router } from 'express';
import { storage } from '../storage';
import { requireAuth, type AuthRequest } from '../middleware/supabase-auth';
import logger from '../middleware/logger';

const router = Router();

router.patch('/profile', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { updateUserProfileSchema } = await import('@shared/schema');
    
    const validation = updateUserProfileSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        message: 'Invalid profile data',
        errors: validation.error.errors,
      });
    }
    
    const { fullName, skills } = validation.data;
    const userId = req.user!.id;
    
    const updateData: { fullName?: string; skills?: string[] } = {};
    if (fullName !== undefined) {
      updateData.fullName = fullName;
    }
    if (skills !== undefined) {
      updateData.skills = skills;
    }
    
    const updatedProfile = await storage.updateUserProfile(userId, updateData);
    
    if (!updatedProfile) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    
    res.json({
      message: 'Profile updated successfully',
      profile: updatedProfile,
    });
  } catch (error: any) {
    logger.error('Profile update error', { error: error.message });
    res.status(500).json({ message: error.message || 'Failed to update profile' });
  }
});

router.get('/profile', requireAuth, async (req: AuthRequest, res) => {
  try {
    const profile = await storage.getProfileByUserId(req.user!.id);
    
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    
    res.json(profile);
  } catch (error: any) {
    logger.error('Profile fetch error', { error: error.message });
    res.status(500).json({ message: error.message || 'Failed to fetch profile' });
  }
});

export default router;
