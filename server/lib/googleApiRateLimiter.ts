/**
 * Google API Rate Limiter
 * Prevents quota exhaustion by limiting API calls per time window
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class GoogleApiRateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  
  // Google API default quotas (conservative estimates)
  private readonly QUOTAS = {
    GA4_REQUESTS_PER_DAY: 10000,
    GA4_REQUESTS_PER_HOUR: 1000,
    GSC_REQUESTS_PER_DAY: 1000,
    GSC_REQUESTS_PER_HOUR: 100,
  };

  // Time windows in milliseconds
  private readonly HOUR = 60 * 60 * 1000;
  private readonly DAY = 24 * 60 * 60 * 1000;

  /**
   * Reserve a request slot (check and increment atomically)
   * @param service - 'GA4' or 'GSC'
   * @param clientId - Client identifier for per-client rate limiting
   * @returns Object with allowed status, retry-after time if blocked, and release function
   */
  reserveRequest(service: 'GA4' | 'GSC', clientId: string): { allowed: boolean; retryAfter?: number; release?: () => void } {
    const now = Date.now();
    
    // Check hourly limit
    const hourlyKey = `${service}:${clientId}:hour`;
    const hourlyLimit = service === 'GA4' ? this.QUOTAS.GA4_REQUESTS_PER_HOUR : this.QUOTAS.GSC_REQUESTS_PER_HOUR;
    const hourlyCheck = this.checkLimit(hourlyKey, hourlyLimit, now, this.HOUR);
    
    if (!hourlyCheck.allowed) {
      return hourlyCheck;
    }

    // Check daily limit
    const dailyKey = `${service}:${clientId}:day`;
    const dailyLimit = service === 'GA4' ? this.QUOTAS.GA4_REQUESTS_PER_DAY : this.QUOTAS.GSC_REQUESTS_PER_DAY;
    const dailyCheck = this.checkLimit(dailyKey, dailyLimit, now, this.DAY);
    
    if (!dailyCheck.allowed) {
      return dailyCheck;
    }

    // Reserve the slot by incrementing counters immediately
    this.incrementCounter(hourlyKey, now, this.HOUR);
    this.incrementCounter(dailyKey, now, this.DAY);

    // Return a release function to decrement if the request fails
    const release = () => {
      this.decrementCounter(hourlyKey);
      this.decrementCounter(dailyKey);
    };

    return { allowed: true, release };
  }

  /**
   * Check a specific limit
   */
  private checkLimit(key: string, limit: number, now: number, window: number): { allowed: boolean; retryAfter?: number } {
    const entry = this.limits.get(key);
    
    // No entry or expired - allowed
    if (!entry || now >= entry.resetTime) {
      return { allowed: true };
    }

    // Check if under limit
    if (entry.count < limit) {
      return { allowed: true };
    }

    // Over limit - calculate retry-after in seconds
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }

  /**
   * Increment counter for a key
   */
  private incrementCounter(key: string, now: number, window: number): void {
    const entry = this.limits.get(key);
    
    if (!entry || now >= entry.resetTime) {
      // Create new entry
      this.limits.set(key, {
        count: 1,
        resetTime: now + window,
      });
    } else {
      // Increment existing
      entry.count++;
    }
  }

  /**
   * Decrement counter for a key (used when releasing reserved slot)
   */
  private decrementCounter(key: string): void {
    const entry = this.limits.get(key);
    
    if (entry && entry.count > 0) {
      entry.count--;
      // If count reaches 0 and entry is still valid, keep it (don't delete) 
      // to maintain the time window
    }
  }

  /**
   * Clean up expired entries (call periodically)
   */
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    this.limits.forEach((entry, key) => {
      if (now >= entry.resetTime) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.limits.delete(key));
  }

  /**
   * Get current usage stats for monitoring
   */
  getUsageStats(service: 'GA4' | 'GSC', clientId: string): { hourly: number; daily: number } {
    const hourlyKey = `${service}:${clientId}:hour`;
    const dailyKey = `${service}:${clientId}:day`;
    
    const hourlyEntry = this.limits.get(hourlyKey);
    const dailyEntry = this.limits.get(dailyKey);
    
    return {
      hourly: hourlyEntry?.count || 0,
      daily: dailyEntry?.count || 0,
    };
  }
}

// Singleton instance
export const googleApiRateLimiter = new GoogleApiRateLimiter();

// Cleanup expired entries every hour
setInterval(() => {
  googleApiRateLimiter.cleanup();
}, 60 * 60 * 1000);
