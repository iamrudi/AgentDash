import { Router } from "express";
import { storage } from "../storage";

const router = Router();

// TEST ENDPOINT: Create user with specific role (development only)
router.post("/create-user", async (req, res) => {
  if (process.env.NODE_ENV !== "development") {
    return res.status(404).json({ message: "Not found" });
  }

  try {
    const { email, password, fullName, role, companyName, agencyId: requestedAgencyId } = req.body;
        
    console.log(`[TEST CREATE USER] Request: email=${email}, role=${role}, requestedAgencyId=${requestedAgencyId}`);
        
    const { provisionUser } = await import("../lib/user-provisioning");
        
    let agencyId: string | undefined = requestedAgencyId;
    if (!agencyId && (role === "Client" || !role)) {
      const defaultAgency = await storage.getDefaultAgency();
      if (!defaultAgency) {
        return res.status(500).json({ message: "System configuration error: No default agency found" });
      }
      agencyId = defaultAgency.id;
      console.log(`[TEST CREATE USER] Using default agency: ${agencyId}`);
    } else {
      console.log(`[TEST CREATE USER] Using requested agency: ${agencyId}`);
    }
        
    const result = await provisionUser({
      email,
      password,
      fullName,
      role: role || "Client",
      agencyId: agencyId || null,
      clientData: companyName ? { companyName } : undefined
    });
        
    console.log(`[TEST CREATE USER] Profile created with ID: ${result.profileId}`);

    res.status(201).json({ 
      message: "Test user created successfully",
      user: { id: result.profileId, email: email },
      profile: { id: result.profileId, fullName: fullName, role: role || "Client", agencyId }
    });
  } catch (error: any) {
    console.error("Test user creation error:", error);
    res.status(500).json({ message: error.message || "User creation failed" });
  }
});

export default router;
