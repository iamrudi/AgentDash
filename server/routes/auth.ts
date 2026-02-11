import { Router } from 'express';
import { storage } from '../storage';
import logger from '../middleware/logger';
import { AuthService } from '../application/auth/auth-service';

const router = Router();
const authService = new AuthService(storage);

export function createSignupHandler(service: AuthService = authService) {
  return async (req: any, res: any) => {
    try {
      const result = await service.signup({
        email: req.body?.email,
        password: req.body?.password,
        fullName: req.body?.fullName,
        companyName: req.body?.companyName,
      });
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      logger.error('Signup error', { error: error.message });
      return res.status(500).json({ message: error.message || 'Signup failed' });
    }
  };
}

router.post('/signup', createSignupHandler());

export function createLoginHandler(service: AuthService = authService) {
  return async (req: any, res: any) => {
    try {
      const result = await service.login({
        email: req.body?.email,
        password: req.body?.password,
      });
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      logger.error('Login error', { error: error.message });
      return res.status(500).json({ message: error.message || 'Login failed' });
    }
  };
}

router.post('/login', createLoginHandler());

export function createRefreshHandler(service: AuthService = authService) {
  return async (req: any, res: any) => {
    try {
      const result = await service.refresh({
        refreshToken: req.body?.refreshToken,
      });
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      logger.error('Token refresh error', { error: error.message });
      return res.status(500).json({ message: error.message || 'Token refresh failed' });
    }
  };
}

router.post('/refresh', createRefreshHandler());

export default router;
