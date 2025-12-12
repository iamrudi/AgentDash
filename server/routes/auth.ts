import { Router, type Response } from 'express';
import { storage } from '../storage';
import { requireAuth, type AuthRequest } from '../middleware/supabase-auth';
import logger from '../middleware/logger';

const router = Router();

router.post('/signup', async (req, res) => {
  try {
    const { email, password, fullName, companyName } = req.body;
    
    const defaultAgency = await storage.getDefaultAgency();
    if (!defaultAgency) {
      return res.status(500).json({ message: 'System configuration error: No default agency found' });
    }

    const { provisionUser } = await import('../lib/user-provisioning');
    
    await provisionUser({
      email,
      password,
      fullName,
      role: 'Client',
      agencyId: defaultAgency.id,
      clientData: companyName ? { companyName } : undefined
    });

    res.status(201).json({ message: 'Account created successfully' });
  } catch (error: any) {
    logger.error('Signup error', { error: error.message });
    res.status(500).json({ message: error.message || 'Signup failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const { signInWithPassword } = await import('../lib/supabase-auth');
    const authResult = await signInWithPassword(email, password);

    if (!authResult.data.session) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const profile = await storage.getProfileByUserId(authResult.data.user!.id);
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    let agencyId: string | undefined;
    let clientId: string | undefined;

    if (profile.role === 'Client') {
      const client = await storage.getClientByProfileId(profile.id);
      clientId = client?.id;
      agencyId = client?.agencyId;
    } else if (profile.role === 'Admin' || profile.role === 'Staff') {
      agencyId = profile.agencyId || undefined;
    }

    res.json({
      token: authResult.data.session!.access_token,
      refreshToken: authResult.data.session!.refresh_token,
      expiresAt: authResult.data.session!.expires_at,
      user: {
        id: authResult.data.user!.id,
        email: authResult.data.user!.email || email,
        profile,
        clientId,
        agencyId,
      },
    });
  } catch (error: any) {
    logger.error('Login error', { error: error.message });
    res.status(500).json({ message: error.message || 'Login failed' });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token required' });
    }

    const { refreshAccessToken } = await import('../lib/supabase-auth');
    const authResult = await refreshAccessToken(refreshToken);

    if (!authResult.data.session) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const profile = await storage.getProfileByUserId(authResult.data.user!.id);
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    let agencyId: string | undefined;
    let clientId: string | undefined;

    if (profile.role === 'Client') {
      const client = await storage.getClientByProfileId(profile.id);
      clientId = client?.id;
      agencyId = client?.agencyId;
    } else if (profile.role === 'Admin' || profile.role === 'Staff') {
      agencyId = profile.agencyId || undefined;
    }

    res.json({
      token: authResult.data.session!.access_token,
      refreshToken: authResult.data.session!.refresh_token,
      expiresAt: authResult.data.session!.expires_at,
      user: {
        id: authResult.data.user!.id,
        email: authResult.data.user!.email,
        profile,
        clientId,
        agencyId,
      },
    });
  } catch (error: any) {
    logger.error('Token refresh error', { error: error.message });
    res.status(500).json({ message: error.message || 'Token refresh failed' });
  }
});

export default router;
