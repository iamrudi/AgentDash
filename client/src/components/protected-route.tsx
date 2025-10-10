import { useEffect } from "react";
import { useLocation } from "wouter";
import { isAuthenticated, getUserRole } from "@/lib/auth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
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
      }
    }
  }, [allowedRoles, setLocation]);

  if (!isAuthenticated()) {
    return null;
  }

  if (allowedRoles) {
    const role = getUserRole();
    if (!role || !allowedRoles.includes(role)) {
      return null;
    }
  }

  return <>{children}</>;
}
