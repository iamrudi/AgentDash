// server/routes/settings.ts

import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { runtimeSettings } from '../config/runtimeSettings';
import { db } from '../db';
import { systemSettings } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { reloadCorsDomainsFromDB } from '../index';

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

/**
 * @route GET /api/settings/cors-domains
 * @description Get all CORS allowed origins from database
 * @access Private (Admin Only)
 */
settingsRouter.get(
  '/cors-domains',
  requireAuth,
  requireRole('Admin'),
  async (req, res) => {
    try {
      const setting = await db.query.systemSettings.findFirst({
        where: eq(systemSettings.key, 'cors_allowed_origins'),
      });

      const domains = setting?.value as { domains: string[] } || { domains: [] };
      res.json(domains);
    } catch (error: any) {
      console.error('[GET /api/settings/cors-domains] Error:', error);
      res.status(500).json({ message: 'Failed to fetch CORS domains' });
    }
  },
);

/**
 * @route POST /api/settings/cors-domains
 * @description Add a new CORS allowed origin
 * @access Private (Admin Only)
 */
settingsRouter.post(
  '/cors-domains',
  requireAuth,
  requireRole('Admin'),
  async (req, res) => {
    try {
      const { domain } = req.body;

      if (!domain || typeof domain !== 'string') {
        return res.status(400).json({ message: 'Domain is required' });
      }

      // Validate domain format (basic URL validation)
      try {
        new URL(domain);
      } catch (e) {
        return res.status(400).json({ message: 'Invalid domain format. Use full URL (e.g., https://example.com)' });
      }

      // Get or create the setting
      let setting = await db.query.systemSettings.findFirst({
        where: eq(systemSettings.key, 'cors_allowed_origins'),
      });

      const domains = setting?.value as { domains: string[] } || { domains: [] };

      // Check if domain already exists
      if (domains.domains.includes(domain)) {
        return res.status(400).json({ message: 'Domain already exists' });
      }

      // Add the new domain
      domains.domains.push(domain);

      if (setting) {
        // Update existing setting
        await db.update(systemSettings)
          .set({
            value: domains,
            updatedBy: req.user!.id,
            updatedAt: new Date(),
          })
          .where(eq(systemSettings.id, setting.id));
      } else {
        // Create new setting
        await db.insert(systemSettings).values({
          key: 'cors_allowed_origins',
          value: domains,
          description: 'Allowed origins for CORS',
          updatedBy: req.user!.id,
        });
      }

      res.json({ message: 'Domain added successfully', domains });
    } catch (error: any) {
      console.error('[POST /api/settings/cors-domains] Error:', error);
      res.status(500).json({ message: 'Failed to add CORS domain' });
    }
  },
);

/**
 * @route DELETE /api/settings/cors-domains
 * @description Remove a CORS allowed origin
 * @access Private (Admin Only)
 */
settingsRouter.delete(
  '/cors-domains',
  requireAuth,
  requireRole('Admin'),
  async (req, res) => {
    try {
      const { domain } = req.body;

      if (!domain || typeof domain !== 'string') {
        return res.status(400).json({ message: 'Domain is required' });
      }

      const setting = await db.query.systemSettings.findFirst({
        where: eq(systemSettings.key, 'cors_allowed_origins'),
      });

      if (!setting) {
        return res.status(404).json({ message: 'No CORS settings found' });
      }

      const domains = setting.value as { domains: string[] };

      // Remove the domain
      const index = domains.domains.indexOf(domain);
      if (index === -1) {
        return res.status(404).json({ message: 'Domain not found' });
      }

      domains.domains.splice(index, 1);

      // Update the setting
      await db.update(systemSettings)
        .set({
          value: domains,
          updatedBy: req.user!.id,
          updatedAt: new Date(),
        })
        .where(eq(systemSettings.id, setting.id));

      res.json({ message: 'Domain removed successfully', domains });
    } catch (error: any) {
      console.error('[DELETE /api/settings/cors-domains] Error:', error);
      res.status(500).json({ message: 'Failed to remove CORS domain' });
    }
  },
);

export default settingsRouter;
