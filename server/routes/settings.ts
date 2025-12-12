// server/routes/settings.ts

import { Router } from 'express';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/supabase-auth';
import { runtimeSettings } from '../config/runtimeSettings';

const settingsRouter = Router();

/**
 * @route GET /api/settings/rate-limit-status
 * @description Get the current status of the API rate limiter
 * @access Private
 */
settingsRouter.get('/rate-limit-status', requireAuth, (req, res) => {
  res.json({ isEnabled: runtimeSettings.isRateLimiterEnabled });
});

/**
 * @route POST /api/settings/toggle-rate-limit
 * @description Toggles the API rate limiter on or off
 * @access Private (Admin Only)
 */
settingsRouter.post(
  '/toggle-rate-limit',
  requireAuth,
  requireRole('Admin'),
  (req, res) => {
    runtimeSettings.isRateLimiterEnabled = !runtimeSettings.isRateLimiterEnabled;
    res.json({
      message: `Rate limiter is now ${runtimeSettings.isRateLimiterEnabled ? 'enabled' : 'disabled'}.`,
      isEnabled: runtimeSettings.isRateLimiterEnabled,
    });
  },
);


export default settingsRouter;
