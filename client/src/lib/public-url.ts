/**
 * Get the public URL for the application
 * 
 * In production, set VITE_PUBLIC_URL environment variable to your production domain
 * (e.g., https://your-app.replit.app or https://yourdomain.com)
 * 
 * If not set, falls back to the current window location origin
 */
export function getPublicUrl(): string {
  // Use environment variable if set (for production deployments)
  const publicUrl = import.meta.env.VITE_PUBLIC_URL;
  
  if (publicUrl) {
    // Remove trailing slash if present
    return publicUrl.replace(/\/$/, '');
  }
  
  // Fallback to current window location (works in dev and production)
  return window.location.origin;
}

/**
 * Get the full URL for a path
 */
export function getFullUrl(path: string): string {
  const baseUrl = getPublicUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}
