import type { Request, Response } from "express";
import logger from "./logger";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    clientId?: string;
    agencyId?: string;
    isSuperAdmin?: boolean;
  };
}

export interface AgencyContextOptions {
  /**
   * Allow SuperAdmin to provide agencyId via query parameter (for GET requests)
   * Default: false
   */
  allowQueryParam?: boolean;
  
  /**
   * Require SuperAdmin to provide agencyId in request body field (for POST/PUT/DELETE)
   * Specify the field name (e.g., 'agencyId')
   * Default: undefined (no body field required)
   */
  requireBodyField?: string;
}

export interface AgencyContext {
  /**
   * The resolved agency ID to use for the request
   * - For SuperAdmin: from query param, body field, or undefined (all agencies)
   * - For Admin/Staff: from req.user.agencyId
   */
  agencyId: string | undefined;
  
  /**
   * The scope of the request
   * - 'superadmin': Request from SuperAdmin (may span multiple agencies)
   * - 'agency': Request scoped to specific agency
   */
  scope: 'superadmin' | 'agency';
}

/**
 * Resolve agency context for the current request
 * 
 * This helper standardizes how SuperAdmin and Admin users access agency-scoped resources:
 * - SuperAdmin can optionally filter by agency via query param or provide agency in body for mutations
 * - Admin/Staff must have agencyId in their profile
 * 
 * @param req - Express request with authenticated user
 * @param options - Configuration for how to resolve agency context
 * @returns AgencyContext with resolved agencyId and scope
 * @throws 403 error if Admin/Staff lacks agency association
 * @throws 400 error if SuperAdmin mutation lacks required agencyId in body
 * 
 * @example
 * // GET endpoint - allow SuperAdmin to filter via query param
 * const { agencyId } = resolveAgencyContext(req, { allowQueryParam: true });
 * const clients = await storage.getAllClients(agencyId);
 * 
 * @example
 * // POST endpoint - require SuperAdmin to provide agencyId in body
 * const { agencyId } = resolveAgencyContext(req, { requireBodyField: 'agencyId' });
 * await storage.createClient({ ...data, agencyId });
 */
export function resolveAgencyContext(
  req: AuthRequest,
  options: AgencyContextOptions = {}
): AgencyContext {
  const { allowQueryParam = false, requireBodyField } = options;
  
  // SuperAdmin can access across agencies
  if (req.user?.isSuperAdmin) {
    let agencyId: string | undefined;
    
    // For GET requests: allow optional query parameter filtering
    if (allowQueryParam && req.query.agencyId) {
      agencyId = req.query.agencyId as string;
      logger.info('SuperAdmin filtering by agency', { email: req.user.email, agencyId });
    }
    
    // For CREATE/UPDATE/DELETE requests: require body field
    if (requireBodyField) {
      agencyId = req.body[requireBodyField];
      
      if (!agencyId) {
        throw {
          status: 400,
          message: `SuperAdmin must provide ${requireBodyField} in request body`
        };
      }
      
      logger.info('SuperAdmin operating on agency', { email: req.user.email, agencyId });
    }
    
    // If no filtering specified, SuperAdmin sees all agencies
    if (!agencyId) {
      logger.info('SuperAdmin accessing all agencies', { email: req.user.email });
    }
    
    return {
      agencyId,
      scope: 'superadmin'
    };
  }
  
  // Admin/Staff must have agency association
  if (!req.user?.agencyId) {
    throw {
      status: 403,
      message: 'Agency association required'
    };
  }
  
  logger.info('User accessing agency', { role: req.user.role, email: req.user.email, agencyId: req.user.agencyId });
  
  return {
    agencyId: req.user.agencyId,
    scope: 'agency'
  };
}
