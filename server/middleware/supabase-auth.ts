import { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../lib/supabase";
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

    // Get user profile from our database (profile.id = Supabase Auth user ID)
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1);

    if (!profile) {
      return res.status(401).json({ message: "User profile not found" });
    }

    let clientId: string | undefined;
    let agencyId: string | undefined = profile.agencyId || undefined;

    // If user is a client, get their clientId for tenant isolation
    if (profile.role === "Client") {
      const [client] = await db
        .select()
        .from(clients)
        .where(eq(clients.profileId, profile.id))
        .limit(1);
      
      clientId = client?.id;
      agencyId = client?.agencyId; // Clients also belong to an agency
    } else if (profile.role === "Admin" || profile.role === "Staff") {
      // For Admin/Staff, get agencyId from profile
      agencyId = profile.agencyId || undefined;
    }
    
    req.user = {
      id: user.id, // Supabase Auth user ID
      email: user.email || '',
      role: profile.role,
      clientId,
      agencyId,
    };

    console.log(`[AUTH] User ${user.email} authenticated - Role: ${profile.role}, AgencyId: ${agencyId}, ClientId: ${clientId}`);
    
    next();
  } catch (error) {
    console.error("Auth error:", error);
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

  // Staff users can access clients in their own agency (read-only for now)
  if (req.user.role === "Staff") {
    if (!req.user.agencyId) {
      console.warn(`Staff user ${req.user.id} has no agencyId - denying client access`);
      return false;
    }
    
    const client = await storage.getClientById(resourceClientId);
    if (!client) {
      console.warn(`Client ${resourceClientId} not found`);
      return false;
    }
    
    // Staff can only access clients in their own agency
    if (client.agencyId !== req.user.agencyId) {
      console.warn(`Staff ${req.user.id} (agency: ${req.user.agencyId}) attempted to access client ${resourceClientId} (agency: ${client.agencyId})`);
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
    console.warn(`Project ${projectId} not found`);
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
    console.warn(`Task ${taskId} not found`);
    return false;
  }

  // Get the project to find the client
  const project = await storage.getProjectById(task.projectId);
  if (!project) {
    console.warn(`Project ${task.projectId} for task ${taskId} not found`);
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
    console.warn(`Initiative ${initiativeId} not found`);
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
    console.warn(`Invoice ${invoiceId} not found`);
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
