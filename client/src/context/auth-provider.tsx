import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getAuthUser, isTokenExpired, updateAuthTokens, clearAuthUser } from "@/lib/auth";
import { useLocation } from "wouter";

interface AuthContextValue {
  authReady: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  authReady: false,
  isAuthenticated: false,
});

export function useAuthStatus() {
  return useContext(AuthContext);
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [authReady, setAuthReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    let isMounted = true;

    async function initializeAuth() {
      const authUser = getAuthUser();

      if (!authUser) {
        // No auth user - mark as ready but not authenticated
        if (isMounted) {
          setIsAuthenticated(false);
          setAuthReady(true);
        }
        return;
      }

      // User exists - check if token needs refresh
      if (isTokenExpired() && authUser.refreshToken) {
        try {
          // Refresh the token before marking ready
          const res = await fetch("/api/auth/refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken: authUser.refreshToken }),
          });

          if (!res.ok) {
            // Refresh failed - clear auth and mark ready
            clearAuthUser();
            if (isMounted) {
              setIsAuthenticated(false);
              setAuthReady(true);
              setLocation("/login");
            }
            return;
          }

          const data = await res.json();
          updateAuthTokens(data.token, data.refreshToken, data.expiresAt);
          
          if (isMounted) {
            setIsAuthenticated(true);
            setAuthReady(true);
          }
        } catch (error) {
          console.error("Auth initialization failed:", error);
          clearAuthUser();
          if (isMounted) {
            setIsAuthenticated(false);
            setAuthReady(true);
            setLocation("/login");
          }
        }
      } else {
        // Token is valid or no refresh token - mark as ready
        if (isMounted) {
          setIsAuthenticated(true);
          setAuthReady(true);
        }
      }
    }

    initializeAuth();

    return () => {
      isMounted = false;
    };
  }, [setLocation]);

  return (
    <AuthContext.Provider value={{ authReady, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}
