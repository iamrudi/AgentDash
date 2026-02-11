import { Router } from 'express';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/supabase-auth';
import { AgencySettingsService } from '../application/agency/agency-settings-service';
import { storage } from '../storage';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();
const agencySettingsService = new AgencySettingsService(storage);

const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadsDir = path.join(process.cwd(), 'uploads', 'logos');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req: AuthRequest, file, cb) => {
    const agencyId = req.user?.agencyId || 'unknown';
    const type = req.body?.type || 'logo';
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${agencyId}-${type}-${Date.now()}${ext}`;
    cb(null, filename);
  }
});

const logoUpload = multer({
  storage: logoStorage,
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, SVG, and WebP images are allowed.'));
    }
  }
});

export function createAgencySettingsGetHandler(service: AgencySettingsService = agencySettingsService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.getSettings({
        isSuperAdmin: req.user?.isSuperAdmin,
        agencyId: req.user?.agencyId,
      });
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error fetching agency settings:", error);
      return res.status(500).json({ message: error.message });
    }
  };
}

router.get("/", requireAuth, requireRole("Admin"), createAgencySettingsGetHandler());

export function createAgencySettingsUpdateHandler(service: AgencySettingsService = agencySettingsService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.updateSettings(
        {
          isSuperAdmin: req.user?.isSuperAdmin,
          agencyId: req.user?.agencyId,
        },
        req.body ?? {}
      );
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error updating agency settings:", error);
      return res.status(500).json({ message: error.message });
    }
  };
}

router.put("/", requireAuth, requireRole("Admin"), createAgencySettingsUpdateHandler());

export function createAgencySettingsLogoUploadHandler(service: AgencySettingsService = agencySettingsService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.uploadLogo(
        { agencyId: req.user?.agencyId },
        req.file ? { path: req.file.path, filename: req.file.filename } : undefined,
        req.body?.type
      );
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error uploading logo:", error);
      return res.status(500).json({ message: error.message || "Failed to upload logo" });
    }
  };
}

router.post("/logo", requireAuth, requireRole("Admin"), logoUpload.single('logo'), createAgencySettingsLogoUploadHandler());

export function createAgencySettingsLogoDeleteHandler(service: AgencySettingsService = agencySettingsService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.deleteLogo({ agencyId: req.user?.agencyId }, req.params.type);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error deleting logo:", error);
      return res.status(500).json({ message: error.message || "Failed to delete logo" });
    }
  };
}

router.delete("/logo/:type", requireAuth, requireRole("Admin"), createAgencySettingsLogoDeleteHandler());

export function createAgencySettingsBrandingHandler(service: AgencySettingsService = agencySettingsService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.getBranding({
        agencyId: req.user?.agencyId,
        clientId: req.user?.clientId,
      });
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Error fetching branding settings:", error);
      return res.status(500).json({ message: error.message });
    }
  };
}

router.get("/branding", requireAuth, createAgencySettingsBrandingHandler());

export default router;
