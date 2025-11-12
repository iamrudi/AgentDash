import { useEffect } from "react";
import { useLocation } from "wouter";
import { isAuthenticated, getUserRole, getAuthUser } from "@/lib/auth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  requireSuperAdmin?: boolean;
}

export function ProtectedRoute({ children, allowedRoles, requireSuperAdmin }: ProtectedRouteProps) {
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isAuthenticated()) {
      setLocation("/login");
      return;
    }

    if (allowedRoles) {
      const role = getUserRole();
      if (!role || !allowedRoles.includes(role)) {
        // Redirect to appropriate dashboard based on role
        if (role === "Admin") {
          setLocation("/agency");
        } else if (role === "Client") {
          setLocation("/client");
        } else if (role === "Staff") {
          setLocation("/staff");
        } else {
          setLocation("/login");
        }
        return;
      }
    }

    if (requireSuperAdmin) {
      const authUser = getAuthUser();
      if (!authUser?.profile?.isSuperAdmin) {
        const role = getUserRole();
        if (role === "Admin") {
          setLocation("/agency");
        } else if (role === "Client") {
          setLocation("/client");
        } else if (role === "Staff") {
          setLocation("/staff");
        } else {
          setLocation("/login");
        }
      }
    }
  }, [allowedRoles, requireSuperAdmin, setLocation]);

  if (!isAuthenticated()) {
    return null;
  }

  if (allowedRoles) {
    const role = getUserRole();
    if (!role || !allowedRoles.includes(role)) {
      return null;
    }
  }

  if (requireSuperAdmin) {
    const authUser = getAuthUser();
    if (!authUser?.profile?.isSuperAdmin) {
      return null;
    }
  }

  return <>{children}</>;
}
