import { Profile } from "@shared/schema";

// Authentication context and utilities
export interface AuthUser {
  id: string;
  email: string;
  profile: Profile;
  token: string;
  clientId?: string;
}

// Store auth user and token in localStorage
export function setAuthUser(data: { token: string; user: { id: string; email: string; profile: Profile; clientId?: string } }) {
  const authUser: AuthUser = {
    ...data.user,
    token: data.token,
  };
  localStorage.setItem("authUser", JSON.stringify(authUser));
}

export function getAuthUser(): AuthUser | null {
  const stored = localStorage.getItem("authUser");
  return stored ? JSON.parse(stored) : null;
}

export function clearAuthUser() {
  localStorage.removeItem("authUser");
}

export function isAuthenticated(): boolean {
  return !!getAuthUser();
}

export function getUserRole(): string | null {
  const user = getAuthUser();
  return user?.profile?.role || null;
}
