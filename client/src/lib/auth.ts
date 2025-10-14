import { Profile } from "@shared/schema";

// Authentication context and utilities
export interface AuthUser {
  id: string;
  email: string;
  profile: Profile;
  token: string;
  refreshToken?: string;
  expiresAt?: number;
  clientId?: string;
}

// Store auth user and tokens in localStorage
export function setAuthUser(data: { 
  token: string; 
  refreshToken?: string;
  expiresAt?: number;
  user: { id: string; email: string; profile: Profile; clientId?: string } 
}) {
  const authUser: AuthUser = {
    ...data.user,
    token: data.token,
    refreshToken: data.refreshToken,
    expiresAt: data.expiresAt,
  };
  localStorage.setItem("authUser", JSON.stringify(authUser));
}

export function getAuthUser(): AuthUser | null {
  const stored = localStorage.getItem("authUser");
  return stored ? JSON.parse(stored) : null;
}

export function updateAuthTokens(token: string, refreshToken: string, expiresAt: number) {
  const authUser = getAuthUser();
  if (authUser) {
    authUser.token = token;
    authUser.refreshToken = refreshToken;
    authUser.expiresAt = expiresAt;
    localStorage.setItem("authUser", JSON.stringify(authUser));
  }
}

export function clearAuthUser() {
  localStorage.removeItem("authUser");
}

export function isAuthenticated(): boolean {
  return !!getAuthUser();
}

export function isTokenExpired(): boolean {
  const authUser = getAuthUser();
  if (!authUser || !authUser.expiresAt) {
    return true;
  }
  // Token is expired if current time is past expiry (with 60 second buffer)
  return Date.now() / 1000 > authUser.expiresAt - 60;
}

export function getUserRole(): string | null {
  const user = getAuthUser();
  return user?.profile?.role || null;
}
