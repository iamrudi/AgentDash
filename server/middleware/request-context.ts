import type { Request } from "express";
import type { AuthRequest } from "./supabase-auth";

export interface RequestContext {
  userId: string;
  email: string;
  role: string;
  agencyId?: string;
  clientId?: string;
  isSuperAdmin?: boolean;
  requestId?: string;
  ip?: string;
  userAgent?: string;
}

export function buildRequestContext(req: Request, user: NonNullable<AuthRequest["user"]>): RequestContext {
  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    agencyId: user.agencyId,
    clientId: user.clientId,
    isSuperAdmin: user.isSuperAdmin,
    requestId: (req as any).requestId,
    ip: req.ip,
    userAgent: req.get("user-agent") ?? undefined,
  };
}

export function getRequestContext(req: AuthRequest): RequestContext {
  const ctx = (req as AuthRequest).ctx ?? req.context;
  if (!ctx) {
    throw new Error("Request context missing");
  }
  return ctx;
}
