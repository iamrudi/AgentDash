import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt";
import { db } from "../db";
import { profiles, clients } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { IStorage } from "../storage";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    clientId?: string; // Client ID for tenant isolation (Client role)
    agencyId?: string; // Agency ID for tenant isolation (Admin/Staff roles)
  };
}

// JWT-based auth middleware
export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const token = authHeader.replace("Bearer ", "");
  
  try {
    const payload = verifyToken(token);
    
    // Get user profile to determine agency and client association
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, payload.userId))
      .limit(1);

    let clientId: string | undefined;
    let agencyId: string | undefined = payload.agencyId;

    // If user is a client, get their clientId for tenant isolation
    if (profile?.role === "Client") {
      const [client] = await db
        .select()
        .from(clients)
        .where(eq(clients.profileId, profile.id))
        .limit(1);
      
      clientId = client?.id;
      agencyId = client?.agencyId; // Clients also belong to an agency
    } else if (profile?.role === "Admin" || profile?.role === "Staff") {
      // For Admin/Staff, get agencyId from profile (prefer JWT payload, fallback to profile)
      agencyId = payload.agencyId || profile.agencyId || undefined;
    }
    
    req.user = {
      id: payload.userId,
      email: payload.email,
      role: profile?.role || payload.role,
      clientId,
      agencyId,
    };

    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

// Role-based authorization middleware
export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    next();
  };
}

// Tenant isolation helper: verify user can access a client's resources
export async function verifyClientAccess(
  req: AuthRequest,
  resourceClientId: string,
  storage: IStorage
): Promise<boolean> {
  if (!req.user) {
    return false;
  }

  // Admins can ONLY access clients in their own agency
  if (req.user.role === "Admin") {
    if (!req.user.agencyId) {
      console.warn(`Admin user ${req.user.id} has no agencyId - denying client access`);
      return false;
    }
    
    const client = await storage.getClientById(resourceClientId);
    if (!client) {
      console.warn(`Client ${resourceClientId} not found`);
      return false;
    }
    
    // Critical: Admin can only access clients in their own agency
    if (client.agencyId !== req.user.agencyId) {
      console.warn(`Admin ${req.user.id} (agency: ${req.user.agencyId}) attempted to access client ${resourceClientId} (agency: ${client.agencyId})`);
      return false;
    }
    
    return true;
  }

  // Client users can only access their own data
  if (req.user.role === "Client") {
    return req.user.clientId === resourceClientId;
  }

  // Staff users need to be assigned to tasks related to this client
  // For now, deny access (can be enhanced to check task assignments)
  return false;
}

// Middleware to enforce tenant isolation on client-specific routes
export function requireClientAccess(storage: IStorage) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const clientId = req.params.clientId || req.body.clientId;
    
    if (!clientId) {
      return res.status(400).json({ message: "Client ID required" });
    }

    const hasAccess = await verifyClientAccess(req, clientId, storage);
    
    if (!hasAccess) {
      return res.status(403).json({ message: "Access denied to this client's resources" });
    }

    next();
  };
}
