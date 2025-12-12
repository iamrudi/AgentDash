/**
 * SuperAdmin Router
 * 
 * Platform-level administration routes for SuperAdmin users.
 * These routes bypass tenant isolation by design and operate
 * across all agencies with full audit logging.
 * 
 * Security: All routes require requireAuth + requireSuperAdmin middleware.
 * Audit: All mutating operations are logged to audit_logs table.
 * 
 * Routes: 16
 */

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireSuperAdmin, type AuthRequest } from '../middleware/supabase-auth';
import { storage } from '../storage';
import { db } from '../db';
import { agencySettings, updateAgencySettingSchema } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { invalidateAIProviderCache } from '../ai/provider';

const superadminRouter = Router();

const logAuditEvent = async (
  userId: string,
  action: string,
  resourceType: string,
  resourceId: string | null,
  details: any,
  ipAddress: string | undefined,
  userAgent: string | undefined
) => {
  try {
    await storage.createAuditLog({
      userId,
      action,
      resourceType,
      resourceId,
      details,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    console.error('[AUDIT LOG ERROR]', error);
  }
};

superadminRouter.get("/users", requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const users = await storage.getAllUsersForSuperAdmin();
    res.json(users);
  } catch (error: any) {
    console.error('[SUPER ADMIN] Error fetching users:', error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

superadminRouter.patch("/users/:userId/email", requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const { updateUserEmail } = await import("../lib/supabase-auth");
    const { updateUserEmailSchema } = await import("@shared/schema");
    const { userId } = req.params;

    const validation = updateUserEmailSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        message: "Invalid email address", 
        errors: validation.error.errors 
      });
    }

    const { email } = validation.data;

    const oldUser = await storage.getUserById(userId);
    if (!oldUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const { supabaseAdmin } = await import("../lib/supabase");
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    const oldEmail = authUser?.user?.email || 'unknown';

    await updateUserEmail(userId, email);

    await logAuditEvent(
      req.user!.id,
      'user.update_email',
      'user',
      userId,
      { oldEmail, newEmail: email },
      req.ip,
      req.get('user-agent')
    );

    res.json({ message: "User email updated successfully" });
  } catch (error: any) {
    console.error('[SUPER ADMIN] Error updating user email:', error);
    res.status(500).json({ message: error.message || "Failed to update user email" });
  }
});

superadminRouter.patch("/users/:userId/password", requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const { updateUserPassword } = await import("../lib/supabase-auth");
    const { updateUserPasswordSchema } = await import("@shared/schema");
    const { userId } = req.params;

    const validation = updateUserPasswordSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        message: "Invalid password", 
        errors: validation.error.errors 
      });
    }

    const { password } = validation.data;

    const user = await storage.getUserById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await updateUserPassword(userId, password);

    await logAuditEvent(
      req.user!.id,
      'user.update_password',
      'user',
      userId,
      { passwordChanged: true },
      req.ip,
      req.get('user-agent')
    );

    res.json({ message: "User password updated successfully" });
  } catch (error: any) {
    console.error('[SUPER ADMIN] Error updating user password:', error);
    res.status(500).json({ message: error.message || "Failed to update user password" });
  }
});

superadminRouter.patch("/users/:userId/promote-superadmin", requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const { promoteUserToSuperAdmin } = await import("../lib/supabase-auth");
    const { userId } = req.params;

    const profile = await storage.getProfileById(userId);
    if (!profile) {
      return res.status(404).json({ message: "User not found" });
    }

    const oldState = {
      role: profile.role,
      isSuperAdmin: profile.isSuperAdmin,
      agencyId: profile.agencyId
    };

    const updatedProfile = await promoteUserToSuperAdmin(userId);

    await logAuditEvent(
      req.user!.id,
      'user.promote_superadmin',
      'user',
      userId,
      { 
        oldRole: oldState.role,
        newRole: 'SuperAdmin',
        oldAgencyId: oldState.agencyId,
        newAgencyId: null,
        oldIsSuperAdmin: oldState.isSuperAdmin,
        newIsSuperAdmin: true
      },
      req.ip,
      req.get('user-agent')
    );

    res.json({ 
      message: "User promoted to SuperAdmin successfully",
      profile: updatedProfile
    });
  } catch (error: any) {
    console.error('[SUPER ADMIN] Error promoting user to SuperAdmin:', error);
    res.status(500).json({ message: error.message || "Failed to promote user" });
  }
});

superadminRouter.patch("/users/:userId/role", requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const { updateUserRole } = await import("../lib/supabase-auth");
    const { userId } = req.params;
    const { role, agencyId } = req.body;

    if (!role || !['Client', 'Staff', 'Admin', 'SuperAdmin'].includes(role)) {
      return res.status(400).json({ message: "Invalid role specified" });
    }

    const profile = await storage.getProfileById(userId);
    if (!profile) {
      return res.status(404).json({ message: "User not found" });
    }

    const oldState = {
      role: profile.role,
      isSuperAdmin: profile.isSuperAdmin,
      agencyId: profile.agencyId
    };

    const updatedProfile = await updateUserRole(userId, role, agencyId);

    await logAuditEvent(
      req.user!.id,
      'user.role_update',
      'user',
      userId,
      { 
        oldRole: oldState.role,
        newRole: role,
        oldAgencyId: oldState.agencyId,
        newAgencyId: updatedProfile.agencyId,
        oldIsSuperAdmin: oldState.isSuperAdmin,
        newIsSuperAdmin: updatedProfile.isSuperAdmin
      },
      req.ip,
      req.get('user-agent')
    );

    res.json({ 
      message: "User role updated successfully",
      profile: updatedProfile
    });
  } catch (error: any) {
    console.error('[SUPER ADMIN] Error updating user role:', error);
    res.status(500).json({ message: error.message || "Failed to update user role" });
  }
});

superadminRouter.delete("/users/:userId", requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;

    const user = await storage.getUserById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { deleteUser } = await import("../lib/supabase-auth");
    await deleteUser(userId);

    await logAuditEvent(
      req.user!.id,
      'user.delete',
      'user',
      userId,
      { deletedUser: user },
      req.ip,
      req.get('user-agent')
    );

    res.json({ message: "User deleted successfully" });
  } catch (error: any) {
    console.error('[SUPER ADMIN] Error deleting user:', error);
    res.status(500).json({ message: "Failed to delete user" });
  }
});

superadminRouter.get("/agencies", requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const agencies = await storage.getAllAgenciesForSuperAdmin();
    res.json(agencies);
  } catch (error: any) {
    console.error('[SUPER ADMIN] Error fetching agencies:', error);
    res.status(500).json({ message: "Failed to fetch agencies" });
  }
});

superadminRouter.delete("/agencies/:agencyId", requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const { agencyId } = req.params;

    const agency = await storage.getAgencyById(agencyId);
    if (!agency) {
      return res.status(404).json({ message: "Agency not found" });
    }

    await storage.deleteAgency(agencyId);

    await logAuditEvent(
      req.user!.id,
      'agency.delete',
      'agency',
      agencyId,
      { deletedAgency: agency },
      req.ip,
      req.get('user-agent')
    );

    res.json({ message: "Agency deleted successfully" });
  } catch (error: any) {
    console.error('[SUPER ADMIN] Error deleting agency:', error);
    res.status(500).json({ message: "Failed to delete agency" });
  }
});

superadminRouter.get("/clients", requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const clients = await storage.getAllClientsForSuperAdmin();
    res.json(clients);
  } catch (error: any) {
    console.error('[SUPER ADMIN] Error fetching clients:', error);
    res.status(500).json({ message: "Failed to fetch clients" });
  }
});

superadminRouter.delete("/clients/:clientId", requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;

    const allClients = await storage.getAllClientsForSuperAdmin();
    const client = allClients.find(c => c.id === clientId);
    
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    await storage.deleteClient(clientId);

    await logAuditEvent(
      req.user!.id,
      'client.delete',
      'client',
      clientId,
      { deletedClient: client },
      req.ip,
      req.get('user-agent')
    );

    res.json({ message: "Client deleted successfully" });
  } catch (error: any) {
    console.error('[SUPER ADMIN] Error deleting client:', error);
    res.status(500).json({ message: "Failed to delete client" });
  }
});

superadminRouter.get("/agencies/:agencyId/settings", requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const { agencyId } = req.params;

    const agencies = await storage.getAllAgenciesForSuperAdmin();
    const agency = agencies.find(a => a.id === agencyId);
    if (!agency) {
      return res.status(404).json({ message: "Agency not found" });
    }

    const settings = await db
      .select()
      .from(agencySettings)
      .where(eq(agencySettings.agencyId, agencyId))
      .limit(1);

    if (settings.length === 0) {
      return res.json({
        agencyId,
        agencyName: agency.name,
        aiProvider: (process.env.AI_PROVIDER?.toLowerCase() || "gemini"),
        isDefault: true,
      });
    }

    res.json({
      agencyId,
      agencyName: agency.name,
      aiProvider: settings[0].aiProvider.toLowerCase(),
      isDefault: false,
    });
  } catch (error: any) {
    console.error('[SUPER ADMIN] Error fetching agency settings:', error);
    res.status(500).json({ message: "Failed to fetch agency settings" });
  }
});

superadminRouter.put("/agencies/:agencyId/settings", requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const { agencyId } = req.params;

    const validationResult = updateAgencySettingSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        message: "Invalid settings data",
        errors: validationResult.error.errors,
      });
    }

    const { aiProvider } = validationResult.data;

    const agencies = await storage.getAllAgenciesForSuperAdmin();
    const agency = agencies.find(a => a.id === agencyId);
    if (!agency) {
      return res.status(404).json({ message: "Agency not found" });
    }

    const existingSettings = await db
      .select()
      .from(agencySettings)
      .where(eq(agencySettings.agencyId, agencyId))
      .limit(1);

    let result;
    if (existingSettings.length === 0) {
      [result] = await db
        .insert(agencySettings)
        .values({
          agencyId,
          aiProvider,
        })
        .returning();
    } else {
      [result] = await db
        .update(agencySettings)
        .set({
          aiProvider,
          updatedAt: sql`now()`,
        })
        .where(eq(agencySettings.agencyId, agencyId))
        .returning();
    }

    invalidateAIProviderCache(agencyId);

    await logAuditEvent(
      req.user!.id,
      'agency.settings.update',
      'agency',
      agencyId,
      { aiProvider, agencyName: agency.name },
      req.ip,
      req.get('user-agent')
    );

    res.json({
      ...result,
      agencyName: agency.name,
    });
  } catch (error: any) {
    console.error('[SUPER ADMIN] Error updating agency settings:', error);
    res.status(500).json({ message: "Failed to update agency settings" });
  }
});

superadminRouter.get("/recommendations", requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const allInitiatives = await storage.getAllInitiatives();
    
    const initiativesWithClients = await Promise.all(
      allInitiatives.map(async (init) => {
        const client = await storage.getClientById(init.clientId);
        let agencyName = undefined;
        if (client?.agencyId) {
          const agencies = await storage.getAllAgenciesForSuperAdmin();
          const agency = agencies.find(a => a.id === client.agencyId);
          agencyName = agency?.name;
        }
        return { 
          ...init, 
          client,
          agencyName
        };
      })
    );
    
    res.json(initiativesWithClients);
  } catch (error: any) {
    console.error('[SUPER ADMIN] Error fetching recommendations:', error);
    res.status(500).json({ message: "Failed to fetch recommendations" });
  }
});

superadminRouter.post("/clients/:clientId/generate-recommendations", requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;
    
    const client = await storage.getClientById(clientId);
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }
    
    const generateRecommendationsSchema = z.object({
      preset: z.enum(["quick-wins", "strategic-growth", "full-audit"]),
      includeCompetitors: z.boolean().default(false),
      competitorDomains: z.array(z.string()).max(5).optional()
    });
    
    const validatedData = generateRecommendationsSchema.parse(req.body);
    const { generateAIRecommendations } = await import("../ai-analyzer");
    
    const result = await generateAIRecommendations(storage, clientId, {
      preset: validatedData.preset,
      includeCompetitors: validatedData.includeCompetitors,
      competitorDomains: validatedData.competitorDomains
    });
    
    if (!result.success) {
      return res.status(400).json({ message: result.error });
    }

    await logAuditEvent(
      req.user!.id,
      'recommendations.generate',
      'client',
      clientId,
      { 
        preset: validatedData.preset, 
        clientName: client.companyName,
        recommendationsCreated: result.recommendationsCreated 
      },
      req.ip,
      req.get('user-agent')
    );
    
    res.json({ 
      success: true, 
      message: `Successfully generated ${result.recommendationsCreated} AI-powered recommendations`,
      count: result.recommendationsCreated 
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error('[SUPER ADMIN] Error generating recommendations:', error);
    res.status(500).json({ message: error.message });
  }
});

superadminRouter.get("/audit-logs", requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const { limit = '100', offset = '0' } = req.query;
    const auditLogs = await storage.getAuditLogs(parseInt(limit as string), parseInt(offset as string));
    res.json(auditLogs);
  } catch (error: any) {
    console.error('[SUPER ADMIN] Error fetching audit logs:', error);
    res.status(500).json({ message: "Failed to fetch audit logs" });
  }
});

export default superadminRouter;
