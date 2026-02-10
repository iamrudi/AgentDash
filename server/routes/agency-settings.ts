import { Router } from 'express';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/supabase-auth';
import { agencySettings, updateAgencySettingSchema } from '@shared/schema';
import { invalidateAIProviderCache } from '../ai/provider';
import { storage } from '../storage';
import { db } from '../db';
import { eq, sql } from 'drizzle-orm';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

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

router.get("/", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    if (req.user!.isSuperAdmin && !req.user!.agencyId) {
      return res.json({
        aiProvider: (process.env.AI_PROVIDER?.toLowerCase() || "gemini"),
        isDefault: true,
        isSuperAdminGlobal: true,
      });
    }

    if (!req.user!.agencyId) {
      return res.status(403).json({ message: "Agency association required" });
    }

    const settings = await db
      .select()
      .from(agencySettings)
      .where(eq(agencySettings.agencyId, req.user!.agencyId))
      .limit(1);

    if (settings.length === 0) {
      return res.json({
        aiProvider: (process.env.AI_PROVIDER?.toLowerCase() || "gemini"),
        isDefault: true,
      });
    }

    res.json({
      aiProvider: settings[0].aiProvider.toLowerCase(),
      isDefault: false,
    });
  } catch (error: any) {
    console.error("Error fetching agency settings:", error);
    res.status(500).json({ message: error.message });
  }
});

router.put("/", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const validationResult = updateAgencySettingSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        message: "Invalid settings data",
        errors: validationResult.error.errors,
      });
    }

    const { aiProvider } = validationResult.data;

    if (req.user!.isSuperAdmin && !req.user!.agencyId) {
      return res.json({
        aiProvider: aiProvider,
        isDefault: true,
        isSuperAdminGlobal: true,
        message: "SuperAdmins can view AI provider preferences, but changing the global default requires updating the AI_PROVIDER environment variable. To change settings for a specific agency, please log in as an Admin of that agency."
      });
    }

    if (!req.user!.agencyId) {
      return res.status(403).json({ message: "Agency association required" });
    }

    const existingSettings = await db
      .select()
      .from(agencySettings)
      .where(eq(agencySettings.agencyId, req.user!.agencyId))
      .limit(1);

    if (existingSettings.length === 0) {
      const [newSettings] = await db
        .insert(agencySettings)
        .values({
          agencyId: req.user!.agencyId,
          aiProvider,
        })
        .returning();

      invalidateAIProviderCache(req.user!.agencyId);

      res.json(newSettings);
    } else {
      const [updatedSettings] = await db
        .update(agencySettings)
        .set({
          aiProvider,
          updatedAt: sql`now()`,
        })
        .where(eq(agencySettings.agencyId, req.user!.agencyId))
        .returning();

      invalidateAIProviderCache(req.user!.agencyId);

      res.json(updatedSettings);
    }
  } catch (error: any) {
    console.error("Error updating agency settings:", error);
    res.status(500).json({ message: error.message });
  }
});

router.post("/logo", requireAuth, requireRole("Admin"), logoUpload.single('logo'), async (req: AuthRequest, res) => {
  try {
    if (!req.user!.agencyId) {
      return res.status(403).json({ message: "Agency association required" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const { type } = req.body;
    if (!type || !['agencyLogo', 'clientLogo', 'staffLogo'].includes(type)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: "Invalid logo type. Must be agencyLogo, clientLogo, or staffLogo" });
    }

    const logoUrl = `/uploads/logos/${req.file.filename}`;

    const existingSettings = await db
      .select()
      .from(agencySettings)
      .where(eq(agencySettings.agencyId, req.user!.agencyId))
      .limit(1);

    const updateData: Record<string, any> = {
      [type]: logoUrl,
      updatedAt: sql`now()`,
    };

    if (existingSettings.length === 0) {
      const [newSettings] = await db
        .insert(agencySettings)
        .values({
          agencyId: req.user!.agencyId,
          aiProvider: 'gemini',
          [type]: logoUrl,
        })
        .returning();

      res.json({
        message: "Logo uploaded successfully",
        logoUrl,
        settings: newSettings,
      });
    } else {
      const oldLogoUrl = existingSettings[0][type as keyof typeof existingSettings[0]] as string | null;
      if (oldLogoUrl) {
        const oldLogoPath = path.join(process.cwd(), oldLogoUrl);
        if (fs.existsSync(oldLogoPath)) {
          fs.unlinkSync(oldLogoPath);
        }
      }

      const [updatedSettings] = await db
        .update(agencySettings)
        .set(updateData)
        .where(eq(agencySettings.agencyId, req.user!.agencyId))
        .returning();

      res.json({
        message: "Logo uploaded successfully",
        logoUrl,
        settings: updatedSettings,
      });
    }
  } catch (error: any) {
    console.error("Error uploading logo:", error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: error.message || "Failed to upload logo" });
  }
});

router.delete("/logo/:type", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    if (!req.user!.agencyId) {
      return res.status(403).json({ message: "Agency association required" });
    }

    const { type } = req.params;
    if (!['agencyLogo', 'clientLogo', 'staffLogo'].includes(type)) {
      return res.status(400).json({ message: "Invalid logo type. Must be agencyLogo, clientLogo, or staffLogo" });
    }

    const existingSettings = await db
      .select()
      .from(agencySettings)
      .where(eq(agencySettings.agencyId, req.user!.agencyId))
      .limit(1);

    if (existingSettings.length === 0) {
      return res.status(404).json({ message: "Agency settings not found" });
    }

    const logoUrl = existingSettings[0][type as keyof typeof existingSettings[0]] as string | null;
    if (logoUrl) {
      const logoPath = path.join(process.cwd(), logoUrl);
      if (fs.existsSync(logoPath)) {
        fs.unlinkSync(logoPath);
      }
    }

    const [updatedSettings] = await db
      .update(agencySettings)
      .set({
        [type]: null,
        updatedAt: sql`now()`,
      })
      .where(eq(agencySettings.agencyId, req.user!.agencyId))
      .returning();

    res.json({
      message: "Logo removed successfully",
      settings: updatedSettings,
    });
  } catch (error: any) {
    console.error("Error deleting logo:", error);
    res.status(500).json({ message: error.message || "Failed to delete logo" });
  }
});

router.get("/branding", requireAuth, async (req: AuthRequest, res) => {
  try {
    let agencyId = req.user!.agencyId;
    
    if (!agencyId && req.user!.clientId) {
      const client = await storage.getClientById(req.user!.clientId);
      agencyId = client?.agencyId;
    }

    if (!agencyId) {
      return res.json({
        agencyLogo: null,
        clientLogo: null,
        staffLogo: null,
      });
    }

    const settings = await db
      .select({
        agencyLogo: agencySettings.agencyLogo,
        clientLogo: agencySettings.clientLogo,
        staffLogo: agencySettings.staffLogo,
      })
      .from(agencySettings)
      .where(eq(agencySettings.agencyId, agencyId))
      .limit(1);

    if (settings.length === 0) {
      return res.json({
        agencyLogo: null,
        clientLogo: null,
        staffLogo: null,
      });
    }

    res.json(settings[0]);
  } catch (error: any) {
    console.error("Error fetching branding settings:", error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
