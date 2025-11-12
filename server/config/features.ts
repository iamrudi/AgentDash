/**
 * Feature Flags Configuration
 * 
 * This file controls feature availability across the application.
 * Update flags here to enable/disable features without redeployment.
 */

export interface FeatureFlags {
  // AI Features
  aiRecommendations: boolean;
  chatWithData: boolean;
  
  // Analytics
  googleAnalytics: boolean;
  googleSearchConsole: boolean;
  
  // Automation
  autoInvoicing: boolean;
  trashCleanup: boolean;
  
  // Communication
  realtimeChat: boolean;
  emailNotifications: boolean;
  
  // Advanced Features
  competitorAnalysis: boolean;
  leadEventTracking: boolean;
  
  // Experimental
  betaFeatures: boolean;
  maintenanceMode: boolean;
}

const defaultFlags: FeatureFlags = {
  // AI Features - Enabled
  aiRecommendations: true,
  chatWithData: true,
  
  // Analytics - Enabled
  googleAnalytics: true,
  googleSearchConsole: true,
  
  // Automation - Enabled
  autoInvoicing: true,
  trashCleanup: true,
  
  // Communication - Enabled
  realtimeChat: true,
  emailNotifications: false, // Requires SMTP config
  
  // Advanced Features - Enabled
  competitorAnalysis: true,
  leadEventTracking: true,
  
  // Experimental - Disabled by default
  betaFeatures: false,
  maintenanceMode: false,
};

// Environment-based overrides
const environmentFlags: Partial<FeatureFlags> = {
  // Production-specific flags
  ...(process.env.NODE_ENV === 'production' && {
    betaFeatures: false,
  }),
  
  // Development-specific flags
  ...(process.env.NODE_ENV === 'development' && {
    betaFeatures: true,
  }),
  
  // Maintenance mode (set via env var)
  ...(process.env.MAINTENANCE_MODE === 'true' && {
    maintenanceMode: true,
  }),
};

export const features: FeatureFlags = {
  ...defaultFlags,
  ...environmentFlags,
};

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  return features[feature];
}

/**
 * Get all enabled features
 */
export function getEnabledFeatures(): string[] {
  return Object.entries(features)
    .filter(([_, enabled]) => enabled)
    .map(([feature]) => feature);
}

/**
 * Middleware to check feature availability
 */
export function requireFeature(feature: keyof FeatureFlags) {
  return (req: any, res: any, next: any) => {
    if (!isFeatureEnabled(feature)) {
      return res.status(503).json({
        error: 'Feature unavailable',
        message: `The ${feature} feature is currently disabled`,
      });
    }
    next();
  };
}
