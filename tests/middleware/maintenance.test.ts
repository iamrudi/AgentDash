import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createMockRequest,
  createMockResponse,
  createMockNext,
  testUsers,
} from "../utils/test-helpers";

vi.mock("../../server/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}));

describe("Maintenance Middleware", () => {
  let mockDb: any;

  beforeEach(async () => {
    vi.resetModules();
    mockDb = (await import("../../server/db")).db;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("maintenanceMiddleware behavior", () => {
    it("should allow all requests when maintenance is disabled", async () => {
      const { maintenanceMiddleware, clearMaintenanceCache } = await import("../../server/middleware/maintenance");
      
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ value: { enabled: false } }]),
        }),
      });
      
      clearMaintenanceCache();
      
      const req = createMockRequest({ 
        user: testUsers.adminAgencyA,
        path: "/api/agency/clients"
      }) as any;
      const res = createMockResponse();
      const next = createMockNext();

      await maintenanceMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalledWith(503);
    });

    it("should block regular users when maintenance is enabled", async () => {
      const { maintenanceMiddleware, clearMaintenanceCache } = await import("../../server/middleware/maintenance");
      
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ 
            value: { 
              enabled: true, 
              message: "Under maintenance" 
            } 
          }]),
        }),
      });
      
      clearMaintenanceCache();
      
      const req = createMockRequest({ 
        user: testUsers.adminAgencyA,
        path: "/api/agency/clients"
      }) as any;
      const res = createMockResponse();
      const next = createMockNext();

      await maintenanceMiddleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.getJson().error).toBe("maintenance_mode");
      expect(res.getJson().retryAfter).toBe(300);
    });

    it("should allow SuperAdmin access when maintenance is enabled", async () => {
      const { maintenanceMiddleware, clearMaintenanceCache } = await import("../../server/middleware/maintenance");
      
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ 
            value: { enabled: true, message: "Under maintenance" } 
          }]),
        }),
      });
      
      clearMaintenanceCache();
      
      const req = createMockRequest({ 
        user: testUsers.superAdmin,
        path: "/api/agency/clients"
      }) as any;
      const res = createMockResponse();
      const next = createMockNext();

      await maintenanceMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalledWith(503);
    });

    it("should allow auth login endpoint during maintenance", async () => {
      const { maintenanceMiddleware, clearMaintenanceCache } = await import("../../server/middleware/maintenance");
      
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ 
            value: { enabled: true, message: "Under maintenance" } 
          }]),
        }),
      });
      
      clearMaintenanceCache();
      
      const req = createMockRequest({ 
        path: "/api/auth/login"
      }) as any;
      const res = createMockResponse();
      const next = createMockNext();

      await maintenanceMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("should allow auth session endpoint during maintenance", async () => {
      const { maintenanceMiddleware, clearMaintenanceCache } = await import("../../server/middleware/maintenance");
      
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ 
            value: { enabled: true, message: "Under maintenance" } 
          }]),
        }),
      });
      
      clearMaintenanceCache();
      
      const req = createMockRequest({ 
        path: "/api/auth/session"
      }) as any;
      const res = createMockResponse();
      const next = createMockNext();

      await maintenanceMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("should allow auth logout endpoint during maintenance", async () => {
      const { maintenanceMiddleware, clearMaintenanceCache } = await import("../../server/middleware/maintenance");
      
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ 
            value: { enabled: true, message: "Under maintenance" } 
          }]),
        }),
      });
      
      clearMaintenanceCache();
      
      const req = createMockRequest({ 
        path: "/api/auth/logout"
      }) as any;
      const res = createMockResponse();
      const next = createMockNext();

      await maintenanceMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe("clearMaintenanceCache", () => {
    it("should exist as an exported function", async () => {
      const { clearMaintenanceCache } = await import("../../server/middleware/maintenance");
      expect(typeof clearMaintenanceCache).toBe("function");
    });
  });

  describe("isMaintenanceModeEnabled", () => {
    it("should return cached maintenance state", async () => {
      const { isMaintenanceModeEnabled, clearMaintenanceCache } = await import("../../server/middleware/maintenance");
      
      clearMaintenanceCache();
      
      expect(typeof isMaintenanceModeEnabled()).toBe("boolean");
    });
  });
});
