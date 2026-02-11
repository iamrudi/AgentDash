import { Router } from 'express';
import { storage } from '../storage';
import { requireAuth, type AuthRequest } from '../middleware/supabase-auth';
import logger from '../middleware/logger';
import { UserProfileService } from '../application/user/user-profile-service';

const router = Router();
const userProfileService = new UserProfileService(storage);

export function createUserProfileUpdateHandler(service: UserProfileService = userProfileService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.updateProfile(req.user!.id, req.body);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      logger.error('Profile update error', { error: error.message });
      return res.status(500).json({ message: error.message || 'Failed to update profile' });
    }
  };
}

router.patch('/profile', requireAuth, createUserProfileUpdateHandler());

export function createUserProfileGetHandler(service: UserProfileService = userProfileService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.getProfile(req.user!.id);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      logger.error('Profile fetch error', { error: error.message });
      return res.status(500).json({ message: error.message || 'Failed to fetch profile' });
    }
  };
}

router.get('/profile', requireAuth, createUserProfileGetHandler());

export default router;
