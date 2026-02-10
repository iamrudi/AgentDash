import type { Response, NextFunction } from "express";
import type { AuthRequest } from "./supabase-auth";

export function policyBoundary(boundary: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    (req as any).policyBoundary = boundary;
    res.locals.policyBoundary = boundary;

    next();
  };
}
