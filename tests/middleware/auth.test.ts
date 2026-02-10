import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createMockRequest,
  createMockResponse,
  createMockNext,
  createMockStorage,
  testUsers,
  testClientA,
  testClientB,
  testAgencyA,
  testAgencyB,
} from "../utils/test-helpers";
import type { AuthRequest } from "../../server/middleware/supabase-auth";

describe("Auth Middleware", () => {
  describe("requireRole", () => {
    it("should allow access when user has required role", async () => {
      const { requireRole } = await import("../../server/middleware/supabase-auth");
      
      const req = createMockRequest({ user: testUsers.adminAgencyA }) as AuthRequest;
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requireRole("Admin");
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should deny access when user lacks required role", async () => {
      const { requireRole } = await import("../../server/middleware/supabase-auth");
      
      const req = createMockRequest({ user: testUsers.staffAgencyA }) as AuthRequest;
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requireRole("Admin");
      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.getJson().message).toBe("Insufficient permissions");
    });

    it("should allow multiple role options", async () => {
      const { requireRole } = await import("../../server/middleware/supabase-auth");
      
      const req = createMockRequest({ user: testUsers.staffAgencyA }) as AuthRequest;
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requireRole("Admin", "Staff");
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("should deny when no user attached", async () => {
      const { requireRole } = await import("../../server/middleware/supabase-auth");
      
      const req = createMockRequest({}) as AuthRequest;
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requireRole("Admin");
      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe("requireSuperAdmin", () => {
    it("should allow SuperAdmin access", async () => {
      const { requireSuperAdmin } = await import("../../server/middleware/supabase-auth");
      
      const req = createMockRequest({ user: testUsers.superAdmin }) as AuthRequest;
      const res = createMockResponse();
      const next = createMockNext();

      requireSuperAdmin(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should deny regular admin access", async () => {
      const { requireSuperAdmin } = await import("../../server/middleware/supabase-auth");
      
      const req = createMockRequest({ user: testUsers.adminAgencyA }) as AuthRequest;
      const res = createMockResponse();
      const next = createMockNext();

      requireSuperAdmin(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.getJson().message).toBe("Super Admin access required");
    });

    it("should deny staff access", async () => {
      const { requireSuperAdmin } = await import("../../server/middleware/supabase-auth");
      
      const req = createMockRequest({ user: testUsers.staffAgencyA }) as AuthRequest;
      const res = createMockResponse();
      const next = createMockNext();

      requireSuperAdmin(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("should deny when no user attached", async () => {
      const { requireSuperAdmin } = await import("../../server/middleware/supabase-auth");
      
      const req = createMockRequest({}) as AuthRequest;
      const res = createMockResponse();
      const next = createMockNext();

      requireSuperAdmin(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe("verifyClientAccess - Agency Isolation", () => {
    it("should allow admin to access clients in their own agency", async () => {
      const { verifyClientAccess } = await import("../../server/middleware/supabase-auth");
      
      const req = createMockRequest({ user: testUsers.adminAgencyA }) as AuthRequest;
      const storage = createMockStorage();
      storage.getClientById.mockResolvedValue(testClientA);

      const hasAccess = await verifyClientAccess(req, testClientA.id, storage as any);

      expect(hasAccess).toBe(true);
      expect(storage.getClientById).toHaveBeenCalledWith(testClientA.id);
    });

    it("should DENY admin access to clients in DIFFERENT agency (cross-tenant)", async () => {
      const { verifyClientAccess } = await import("../../server/middleware/supabase-auth");
      
      const req = createMockRequest({ user: testUsers.adminAgencyA }) as AuthRequest;
      const storage = createMockStorage();
      storage.getClientById.mockResolvedValue(testClientB);

      const hasAccess = await verifyClientAccess(req, testClientB.id, storage as any);

      expect(hasAccess).toBe(false);
    });

    it("should ALLOW SuperAdmin to access clients across ALL agencies", async () => {
      const { verifyClientAccess } = await import("../../server/middleware/supabase-auth");
      
      const req = createMockRequest({ user: testUsers.superAdmin }) as AuthRequest;
      const storage = createMockStorage();
      storage.getClientById.mockResolvedValue(testClientB);

      const hasAccess = await verifyClientAccess(req, testClientB.id, storage as any);

      expect(hasAccess).toBe(true);
      expect(storage.getClientById).not.toHaveBeenCalled();
    });

    it("should allow client user to access their own client data", async () => {
      const { verifyClientAccess } = await import("../../server/middleware/supabase-auth");
      
      const req = createMockRequest({ user: testUsers.clientUserA }) as AuthRequest;
      const storage = createMockStorage();

      const hasAccess = await verifyClientAccess(req, testClientA.id, storage as any);

      expect(hasAccess).toBe(true);
    });

    it("should DENY client user access to other clients", async () => {
      const { verifyClientAccess } = await import("../../server/middleware/supabase-auth");
      
      const req = createMockRequest({ user: testUsers.clientUserA }) as AuthRequest;
      const storage = createMockStorage();

      const hasAccess = await verifyClientAccess(req, testClientB.id, storage as any);

      expect(hasAccess).toBe(false);
    });

    it("should deny access when client not found", async () => {
      const { verifyClientAccess } = await import("../../server/middleware/supabase-auth");
      
      const req = createMockRequest({ user: testUsers.adminAgencyA }) as AuthRequest;
      const storage = createMockStorage();
      storage.getClientById.mockResolvedValue(null);

      const hasAccess = await verifyClientAccess(req, "non-existent-id", storage as any);

      expect(hasAccess).toBe(false);
    });

    it("should deny admin access when admin has no agencyId", async () => {
      const { verifyClientAccess } = await import("../../server/middleware/supabase-auth");
      
      const adminWithoutAgency = { ...testUsers.adminAgencyA, agencyId: undefined };
      const req = createMockRequest({ user: adminWithoutAgency }) as AuthRequest;
      const storage = createMockStorage();

      const hasAccess = await verifyClientAccess(req, testClientA.id, storage as any);

      expect(hasAccess).toBe(false);
    });
  });

  describe("requireClientAccess middleware", () => {
    it("should call next when access is verified", async () => {
      const { requireClientAccess } = await import("../../server/middleware/supabase-auth");
      
      const req = createMockRequest({ 
        user: testUsers.adminAgencyA,
        params: { clientId: testClientA.id }
      }) as AuthRequest;
      const res = createMockResponse();
      const next = createMockNext();
      
      const storage = createMockStorage();
      storage.getClientById.mockResolvedValue(testClientA);

      const middleware = requireClientAccess(storage as any);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("should return 403 when cross-tenant access attempted", async () => {
      const { requireClientAccess } = await import("../../server/middleware/supabase-auth");
      
      const req = createMockRequest({ 
        user: testUsers.adminAgencyA,
        params: { clientId: testClientB.id }
      }) as AuthRequest;
      const res = createMockResponse();
      const next = createMockNext();
      
      const storage = createMockStorage();
      storage.getClientById.mockResolvedValue(testClientB);

      const middleware = requireClientAccess(storage as any);
      await middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.getJson().message).toBe("Access denied to this client's resources");
    });

    it("should return 400 when clientId not provided", async () => {
      const { requireClientAccess } = await import("../../server/middleware/supabase-auth");
      
      const req = createMockRequest({ 
        user: testUsers.adminAgencyA,
        params: {}
      }) as AuthRequest;
      const res = createMockResponse();
      const next = createMockNext();
      
      const storage = createMockStorage();

      const middleware = requireClientAccess(storage as any);
      await middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.getJson().message).toBe("Client ID required");
    });
  });
});
