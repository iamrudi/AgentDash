import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getAuthUser } from "./auth";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
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
