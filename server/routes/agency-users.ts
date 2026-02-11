import { Router } from 'express';
import { storage } from '../storage';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/supabase-auth';
import { resolveAgencyContext } from '../middleware/agency-context';
import { AgencyUserService } from '../application/agency-users/agency-user-service';

const router = Router();
const agencyUserService = new AgencyUserService(storage);

export function createAgencyClientUserCreateHandler(service: AgencyUserService = agencyUserService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const { agencyId } = resolveAgencyContext(req, { requireBodyField: 'agencyId' });
      const result = await service.createClientUser(agencyId!, req.body, req.user?.id);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      if (error.status) {
        return res.status(error.status).json({ message: error.message });
      }
      console.error("Client creation error:", error);
      return res.status(500).json({ message: error.message || "Client creation failed" });
    }
  };
}

// Create client user (Admin only)
// POST /api/agency/clients/create-user
router.post("/clients/create-user", requireAuth, requireRole("Admin"), createAgencyClientUserCreateHandler());

export function createAgencyUsersListHandler(service: AgencyUserService = agencyUserService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const { agencyId } = resolveAgencyContext(req, { allowQueryParam: true });
      const result = await service.listUsers(agencyId);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      if (error.status) {
        return res.status(error.status).json({ message: error.message });
      }
      console.error("Get users error:", error);
      return res.status(500).json({ message: error.message || "Failed to fetch users" });
    }
  };
}

// Get all users (Admin only)
// GET /api/agency/users
router.get("/users", requireAuth, requireRole("Admin"), createAgencyUsersListHandler());

export function createAgencyUsersRoleUpdateHandler(service: AgencyUserService = agencyUserService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.updateRole(req.params.userId, req.body?.role);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Update user role error:", error);
      return res.status(500).json({ message: error.message || "Failed to update user role" });
    }
  };
}

// Update user role (Admin only)
// PATCH /api/agency/users/:userId/role
router.patch("/users/:userId/role", requireAuth, requireRole("Admin"), createAgencyUsersRoleUpdateHandler());

export function createAgencyUsersDeleteHandler(service: AgencyUserService = agencyUserService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.deleteUser(req.user?.id, req.params.userId);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Delete user error:", error);
      return res.status(500).json({ message: error.message || "Failed to delete user" });
    }
  };
}

// Delete user (Admin only)
// DELETE /api/agency/users/:userId
router.delete("/users/:userId", requireAuth, requireRole("Admin"), createAgencyUsersDeleteHandler());

export function createAgencyStaffAdminUserCreateHandler(service: AgencyUserService = agencyUserService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const { agencyId } = resolveAgencyContext(req, { requireBodyField: 'agencyId' });
      const result = await service.createStaffOrAdminUser(agencyId!, req.body);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error, errors: result.errors });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      if (error.status) {
        return res.status(error.status).json({ message: error.message });
      }
      console.error("User creation error:", error);
      return res.status(500).json({ message: error.message || "User creation failed" });
    }
  };
}

// Create staff or admin user (Admin only)
// POST /api/agency/users/create
router.post("/users/create", requireAuth, requireRole("Admin"), createAgencyStaffAdminUserCreateHandler());

export default router;
