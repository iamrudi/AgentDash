import { Router } from 'express';
import { storage } from '../storage';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/supabase-auth';
import { resolveAgencyContext } from '../middleware/agency-context';
import { createClientUserSchema, createStaffAdminUserSchema } from '@shared/schema';
import { z } from 'zod';

const router = Router();

// Create client user (Admin only)
// POST /api/agency/clients/create-user
router.post("/clients/create-user", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const validatedData = createClientUserSchema.parse(req.body);
    const { email, password, fullName, companyName } = validatedData;

    const { provisionUser } = await import("../lib/user-provisioning");
    
    const { agencyId } = resolveAgencyContext(req, { requireBodyField: 'agencyId' });
    
    const result = await provisionUser({
      email,
      password,
      fullName,
      role: "Client",
      agencyId: agencyId!,
      clientData: {
        companyName
      }
    });

    res.status(201).json({ 
      message: "Client created successfully",
      client: { 
        id: result.clientId!, 
        companyName: companyName,
        user: { 
          email: email,
          fullName: fullName
        }
      }
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: "Validation failed", 
        errors: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
      });
    }
    console.error("Client creation error:", error);
    res.status(500).json({ message: error.message || "Client creation failed" });
  }
});

// Get all users (Admin only)
// GET /api/agency/users
router.get("/users", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const { agencyId } = resolveAgencyContext(req, { allowQueryParam: true });
    const users = await storage.getAllUsersWithProfiles(agencyId);
    res.json(users);
  } catch (error: any) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error("Get users error:", error);
    res.status(500).json({ message: error.message || "Failed to fetch users" });
  }
});

// Update user role (Admin only)
// PATCH /api/agency/users/:userId/role
router.patch("/users/:userId/role", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!["Client", "Staff", "Admin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    await storage.updateUserRole(userId, role);
    res.json({ message: "User role updated successfully" });
  } catch (error: any) {
    console.error("Update user role error:", error);
    res.status(500).json({ message: error.message || "Failed to update user role" });
  }
});

// Delete user (Admin only)
// DELETE /api/agency/users/:userId
router.delete("/users/:userId", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;
    
    if (req.user?.id === userId) {
      return res.status(400).json({ message: "Cannot delete your own account" });
    }

    const { deleteUser } = await import("../lib/supabase-auth");
    await deleteUser(userId);
    
    res.json({ message: "User deleted successfully" });
  } catch (error: any) {
    console.error("Delete user error:", error);
    res.status(500).json({ message: error.message || "Failed to delete user" });
  }
});

// Create staff or admin user (Admin only)
// POST /api/agency/users/create
router.post("/users/create", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const validatedData = createStaffAdminUserSchema.parse(req.body);
    const { email, password, fullName, role } = validatedData;

    const { provisionUser } = await import("../lib/user-provisioning");
    
    const { agencyId } = resolveAgencyContext(req, { requireBodyField: 'agencyId' });
    
    const result = await provisionUser({
      email,
      password,
      fullName,
      role,
      agencyId: agencyId!
    });

    res.status(201).json({ 
      message: `${role} user created successfully`,
      user: { 
        id: result.profileId,
        email: email,
        fullName: fullName,
        role: role
      }
    });
  } catch (error: any) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: "Validation failed", 
        errors: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
      });
    }
    console.error("User creation error:", error);
    res.status(500).json({ message: error.message || "User creation failed" });
  }
});

export default router;
