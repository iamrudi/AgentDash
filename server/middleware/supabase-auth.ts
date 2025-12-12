import { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { db } from "../db";
import { profiles, clients } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { IStorage } from "../storage";
import logger from "./logger";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    clientId?: string; // Client ID for tenant isolation (Client role)
    agencyId?: string; // Agency ID for tenant isolation (Admin/Staff roles)
    isSuperAdmin?: boolean; // Platform-wide super admin flag
  };
}

// Supabase Auth middleware
export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const token = authHeader.replace("Bearer ", "");
  
  try {
    // Verify Supabase token
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    // Extract role and agencyId from app_metadata (stateless, no DB query needed)
    // Fallback to user_metadata for backward compatibility with existing users
    const role = (user.app_metadata?.['role'] || user.user_metadata?.['role']) as string;
    let agencyId: string | undefined = user.app_metadata?.['agency_id'] || undefined;
    let clientId: string | undefined;

    // Validate role exists
    if (!role) {
      return res.status(401).json({ message: "User role not found in token" });
    }

    // Query profiles table to get isSuperAdmin flag
    // This is done for all users to ensure Super Admins are always identified
    let isSuperAdmin = false;
    const [profile] = await db
      .select({ isSuperAdmin: profiles.isSuperAdmin, agencyId: profiles.agencyId })
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1);

    if (profile) {
      isSuperAdmin = profile.isSuperAdmin || false;
    }

    // Handle different user roles
    if (role === "Client") {
      // Client users: query database to get their clientId and agencyId
      const [client] = await db
        .select()
        .from(clients)
        .where(eq(clients.profileId, user.id))
        .limit(1);
      
      if (!client) {
        return res.status(401).json({ message: "Client profile not found" });
      }
      
      if (!client.agencyId) {
        logger.warn('Client user has no agencyId in client record', { userId: user.id });
        return res.status(401).json({ message: "Agency association not found for client" });
      }
      
      clientId = client.id;
      agencyId = client.agencyId;
    } else if ((role === "Admin" || role === "Staff") && !agencyId && !isSuperAdmin) {
      // Admin/Staff without agencyId in app_metadata: fallback to profile table
      // This ensures backward compatibility with existing users
      // Skip this check for Super Admins as they don't need agency association
      
      if (!profile) {
        return res.status(401).json({ message: "User profile not found" });
      }
      
      agencyId = profile.agencyId ?? undefined;
      
      if (!agencyId) {
        logger.warn('Admin/Staff user has no agencyId in profile or app_metadata', { userId: user.id });
        return res.status(401).json({ message: "Agency association not found" });
      }
    }
    // For Admin/Staff with agencyId in app_metadata - no DB query needed (optimal path)
    // Super Admins don't require agency association
    
    req.user = {
      id: user.id, // Supabase Auth user ID
      email: user.email || '',
      role,
      clientId,
      agencyId,
      isSuperAdmin,
    };

    logger.info('User authenticated', {
      requestId: (req as any).requestId,
      email: user.email,
      role,
      agencyId,
      clientId,
      isSuperAdmin,
    });
    
    next();
  } catch (error) {
    logger.error('Auth error', { 
      requestId: (req as any).requestId,
      error: (error as Error).message 
    });
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

// Role-based authorization middleware
export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // SuperAdmin users bypass all role restrictions
    if (req.user.isSuperAdmin) {
      return next();
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

  // Super Admins can access any client across all agencies
  if (req.user.isSuperAdmin) {
    logger.info('Super admin access granted', { userId: req.user.id, resourceClientId });
    return true;
  }

  // Admins can ONLY access clients in their own agency
  if (req.user.role === "Admin") {
    if (!req.user.agencyId) {
      logger.warn('Admin user has no agencyId - denying client access', { userId: req.user.id });
      return false;
    }
    
    const client = await storage.getClientById(resourceClientId);
    if (!client) {
      logger.warn('Client not found', { resourceClientId });
      return false;
    }
    
    // Critical: Admin can only access clients in their own agency
    if (client.agencyId !== req.user.agencyId) {
      logger.warn('Admin attempted cross-agency access', { userId: req.user.id, userAgencyId: req.user.agencyId, resourceClientId, resourceAgencyId: client.agencyId });
      return false;
    }
    
    return true;
  }

  // Client users can only access their own data
  if (req.user.role === "Client") {
    return req.user.clientId === resourceClientId;
  }

  // Staff users can access clients in their own agency (read-only for now)
  if (req.user.role === "Staff") {
    if (!req.user.agencyId) {
      logger.warn('Staff user has no agencyId - denying client access', { userId: req.user.id });
      return false;
    }
    
    const client = await storage.getClientById(resourceClientId);
    if (!client) {
      logger.warn('Client not found', { resourceClientId });
      return false;
    }
    
    // Staff can only access clients in their own agency
    if (client.agencyId !== req.user.agencyId) {
      logger.warn('Staff attempted cross-agency access', { userId: req.user.id, userAgencyId: req.user.agencyId, resourceClientId, resourceAgencyId: client.agencyId });
      return false;
    }
    
    return true;
  }

  return false;
}

// Tenant isolation for projects
export async function verifyProjectAccess(
  req: AuthRequest,
  projectId: string,
  storage: IStorage
): Promise<boolean> {
  if (!req.user) {
    return false;
  }

  const project = await storage.getProjectById(projectId);
  if (!project) {
    logger.warn('Project not found', { projectId });
    return false;
  }

  // Verify access to the client who owns this project
  return await verifyClientAccess(req, project.clientId, storage);
}

// Tenant isolation for tasks
export async function verifyTaskAccess(
  req: AuthRequest,
  taskId: string,
  storage: IStorage
): Promise<boolean> {
  if (!req.user) {
    return false;
  }

  const task = await storage.getTaskById(taskId);
  if (!task) {
    logger.warn('Task not found', { taskId });
    return false;
  }

  if (!task.projectId) {
    logger.warn('Task has no associated project', { taskId });
    return false;
  }

  // Get the project to find the client
  const project = await storage.getProjectById(task.projectId);
  if (!project) {
    logger.warn('Project for task not found', { projectId: task.projectId, taskId });
    return false;
  }

  // Verify access to the client who owns this project
  return await verifyClientAccess(req, project.clientId, storage);
}

// Tenant isolation for initiatives
export async function verifyInitiativeAccess(
  req: AuthRequest,
  initiativeId: string,
  storage: IStorage
): Promise<boolean> {
  if (!req.user) {
    return false;
  }

  const initiative = await storage.getInitiativeById(initiativeId);
  if (!initiative) {
    logger.warn('Initiative not found', { initiativeId });
    return false;
  }

  // Verify access to the client who owns this initiative
  return await verifyClientAccess(req, initiative.clientId, storage);
}

// Tenant isolation for invoices
export async function verifyInvoiceAccess(
  req: AuthRequest,
  invoiceId: string,
  storage: IStorage
): Promise<boolean> {
  if (!req.user) {
    return false;
  }

  const invoice = await storage.getInvoiceById(invoiceId);
  if (!invoice) {
    logger.warn('Invoice not found', { invoiceId });
    return false;
  }

  // Verify access to the client who owns this invoice
  return await verifyClientAccess(req, invoice.clientId, storage);
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

// Middleware to enforce tenant isolation on project-specific routes
export function requireProjectAccess(storage: IStorage) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const projectId = req.params.id || req.params.projectId || req.body.projectId;
    
    if (!projectId) {
      return res.status(400).json({ message: "Project ID required" });
    }

    const hasAccess = await verifyProjectAccess(req, projectId, storage);
    
    if (!hasAccess) {
      return res.status(403).json({ message: "Access denied to this project" });
    }

    next();
  };
}

// Middleware to enforce tenant isolation on task-specific routes
export function requireTaskAccess(storage: IStorage) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const taskId = req.params.id || req.params.taskId || req.body.taskId;
    
    if (!taskId) {
      return res.status(400).json({ message: "Task ID required" });
    }

    const hasAccess = await verifyTaskAccess(req, taskId, storage);
    
    if (!hasAccess) {
      return res.status(403).json({ message: "Access denied to this task" });
    }

    next();
  };
}

// Middleware to enforce tenant isolation on initiative-specific routes
export function requireInitiativeAccess(storage: IStorage) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const initiativeId = req.params.id || req.params.initiativeId || req.body.initiativeId;
    
    if (!initiativeId) {
      return res.status(400).json({ message: "Initiative ID required" });
    }

    const hasAccess = await verifyInitiativeAccess(req, initiativeId, storage);
    
    if (!hasAccess) {
      return res.status(403).json({ message: "Access denied to this initiative" });
    }

    next();
  };
}

// Middleware to enforce tenant isolation on invoice-specific routes
export function requireInvoiceAccess(storage: IStorage) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const invoiceId = req.params.id || req.params.invoiceId || req.body.invoiceId;
    
    if (!invoiceId) {
      return res.status(400).json({ message: "Invoice ID required" });
    }

    const hasAccess = await verifyInvoiceAccess(req, invoiceId, storage);
    
    if (!hasAccess) {
      return res.status(403).json({ message: "Access denied to this invoice" });
    }

    next();
  };
}

// Middleware to require Super Admin access
export function requireSuperAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }

  if (!req.user.isSuperAdmin) {
    logger.warn('Non-super admin attempted super admin route access', { userId: req.user.id, email: req.user.email, path: req.path });
    return res.status(403).json({ message: "Super Admin access required" });
  }

  logger.info('Super admin route access', { userId: req.user.id, email: req.user.email, path: req.path });
  next();
}
