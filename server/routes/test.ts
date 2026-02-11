import { Router } from "express";
import { storage } from "../storage";
import { TestUserService } from "../application/test/test-user-service";
import { requireAuth, requireRole } from "../middleware/supabase-auth";

const router = Router();
const testUserService = new TestUserService(storage);

// TEST ENDPOINT: Create user with specific role (development only)
export function createTestCreateUserHandler(service: TestUserService = testUserService) {
  return async (req: any, res: any) => {
    try {
      const result = await service.createUser({
        env: process.env.NODE_ENV,
        email: req.body?.email,
        password: req.body?.password,
        fullName: req.body?.fullName,
        role: req.body?.role,
        companyName: req.body?.companyName,
        requestedAgencyId: req.body?.agencyId,
      });
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Test user creation error:", error);
      return res.status(500).json({ message: error.message || "User creation failed" });
    }
  };
}

router.post("/create-user", requireAuth, requireRole("SuperAdmin"), createTestCreateUserHandler());

export default router;
