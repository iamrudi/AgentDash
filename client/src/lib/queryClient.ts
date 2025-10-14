import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getAuthUser, isTokenExpired, updateAuthTokens, clearAuthUser } from "./auth";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

let isRefreshing = false;
let refreshPromise: Promise<void> | null = null;

async function refreshTokenIfNeeded(): Promise<void> {
  const authUser = getAuthUser();
  
  if (!authUser || !authUser.refreshToken) {
    return;
  }

  // Check if token is expired or about to expire
  if (!isTokenExpired()) {
    return;
  }

  // If already refreshing, wait for that to complete
  if (isRefreshing && refreshPromise) {
    await refreshPromise;
    return;
  }

  // Start refresh process
  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: authUser.refreshToken }),
      });

      if (!res.ok) {
        // Refresh failed - clear auth and redirect to login
        clearAuthUser();
        window.location.href = "/login";
        throw new Error("Session expired");
      }

      const data = await res.json();
      
      // Update tokens in localStorage
      updateAuthTokens(data.token, data.refreshToken, data.expiresAt);
    } catch (error) {
      console.error("Token refresh failed:", error);
      clearAuthUser();
      window.location.href = "/login";
      throw error;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  await refreshPromise;
}

function getAuthHeaders(): HeadersInit {
  const authUser = getAuthUser();
  const headers: HeadersInit = {};
  
  if (authUser && authUser.token) {
    headers["Authorization"] = `Bearer ${authUser.token}`;
  }
  
  return headers;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Refresh token if needed before making request
  await refreshTokenIfNeeded();
  
  const headers = {
    ...getAuthHeaders(),
    ...(data ? { "Content-Type": "application/json" } : {}),
  };

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";

// Helper to build URL from hierarchical query key
function buildUrlFromQueryKey(queryKey: readonly unknown[]): string {
  const pathSegments: string[] = [];
  let queryParams: Record<string, string> = {};

  for (const segment of queryKey) {
    if (typeof segment === 'string') {
      pathSegments.push(segment);
    } else if (typeof segment === 'object' && segment !== null) {
      // Merge object into query params
      queryParams = { ...queryParams, ...segment as Record<string, string> };
    }
  }

  const basePath = pathSegments.join('/');
  const searchParams = new URLSearchParams(queryParams);
  const queryString = searchParams.toString();
  
  return queryString ? `${basePath}?${queryString}` : basePath;
}

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Refresh token if needed before making query
    await refreshTokenIfNeeded();
    
    const url = buildUrlFromQueryKey(queryKey);
    const res = await fetch(url, {
      headers: getAuthHeaders(),
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
