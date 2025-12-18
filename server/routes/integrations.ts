import { Router } from 'express';
import { storage } from '../storage';
import { 
  requireAuth, 
  requireRole, 
  requireClientAccess,
  type AuthRequest 
} from '../middleware/supabase-auth';
import { refreshAccessToken, fetchGA4Properties, fetchGSCSites, fetchGA4AvailableKeyEvents } from '../lib/googleOAuth';
import { agencySettings } from '@shared/schema';
import { db } from '../db';
import { eq } from 'drizzle-orm';

const router = Router();

// GA4 Integration Routes

// Get GA4 integration status for a client
router.get("/ga4/:clientId", requireAuth, requireRole("Admin", "Client"), requireClientAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;

    const integration = await storage.getIntegrationByClientId(clientId, 'GA4');
    
    if (!integration) {
      return res.json({ connected: false });
    }

    res.json({
      connected: true,
      ga4PropertyId: integration.ga4PropertyId,
      expiresAt: integration.expiresAt,
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Fetch available GA4 properties (Admin only)
router.get("/ga4/:clientId/properties", requireAuth, requireRole("Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;
    
    let integration = await storage.getIntegrationByClientId(clientId, 'GA4');
    
    if (!integration) {
      return res.status(404).json({ message: "GA4 integration not found" });
    }

    if (integration.expiresAt && new Date(integration.expiresAt) < new Date()) {
      if (!integration.refreshToken) {
        return res.status(401).json({ message: "Token expired and no refresh token available" });
      }

      const newTokens = await refreshAccessToken(integration.refreshToken);
      if (!newTokens.success) {
        return res.status(401).json({ message: newTokens.error || "Token refresh failed" });
      }
      integration = await storage.updateIntegration(integration.id, {
        accessToken: newTokens.accessToken,
        expiresAt: newTokens.expiresAt,
      });
    }

    const properties = await fetchGA4Properties(integration.accessToken!, clientId);
    res.json(properties);
  } catch (error: any) {
    console.error("Fetch properties error:", error);
    const message = error.userMessage || error.message || "Failed to fetch properties";
    res.status(500).json({ message });
  }
});

// Save selected GA4 property (Admin only)
router.post("/ga4/:clientId/property", requireAuth, requireRole("Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;
    const { ga4PropertyId, ga4LeadEventName } = req.body;

    if (!ga4PropertyId) {
      return res.status(400).json({ message: "ga4PropertyId is required" });
    }

    if (ga4LeadEventName && (typeof ga4LeadEventName !== 'string' || ga4LeadEventName.length > 500)) {
      return res.status(400).json({ message: "ga4LeadEventName must be a string with max 500 characters" });
    }

    const integration = await storage.getIntegrationByClientId(clientId, 'GA4');
    
    if (!integration) {
      return res.status(404).json({ message: "GA4 integration not found" });
    }

    const updated = await storage.updateIntegration(integration.id, {
      ga4PropertyId,
      ga4LeadEventName: ga4LeadEventName || null,
    });

    if (ga4LeadEventName) {
      const leadEventsArray = ga4LeadEventName.split(',').map((e: string) => e.trim()).filter((e: string) => e.length > 0);
      await storage.updateClient(clientId, {
        leadEvents: leadEventsArray,
      });
      console.log(`[Lead Events Sync] Updated client ${clientId} leadEvents from GA4 property save: ${leadEventsArray.join(',')}`);
    } else {
      await storage.updateClient(clientId, {
        leadEvents: [],
      });
      console.log(`[Lead Events Sync] Cleared client ${clientId} leadEvents (GA4 lead event name was null)`);
    }

    res.json({
      message: "GA4 property and lead event saved successfully",
      ga4PropertyId: updated.ga4PropertyId,
      ga4LeadEventName: updated.ga4LeadEventName,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Update GA4 lead event name only (Admin only)
router.patch("/ga4/:clientId/lead-event", requireAuth, requireRole("Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;
    const { ga4LeadEventName } = req.body;

    if (ga4LeadEventName !== null && ga4LeadEventName !== undefined && ga4LeadEventName !== '') {
      if (typeof ga4LeadEventName !== 'string' || ga4LeadEventName.length > 500) {
        return res.status(400).json({ message: "ga4LeadEventName must be a string with max 500 characters" });
      }
    }

    const integration = await storage.getIntegrationByClientId(clientId, 'GA4');
    
    if (!integration) {
      return res.status(404).json({ message: "GA4 integration not found. Please connect GA4 first." });
    }

    const updated = await storage.updateIntegration(integration.id, {
      ga4LeadEventName: ga4LeadEventName || null,
    });

    if (ga4LeadEventName) {
      const leadEventsArray = ga4LeadEventName.split(',').map((e: string) => e.trim()).filter((e: string) => e.length > 0);
      await storage.updateClient(clientId, {
        leadEvents: leadEventsArray,
      });
      console.log(`[Lead Events Sync] Updated client ${clientId} leadEvents from lead event PATCH: ${leadEventsArray.join(',')}`);
    } else {
      await storage.updateClient(clientId, {
        leadEvents: [],
      });
      console.log(`[Lead Events Sync] Cleared client ${clientId} leadEvents (lead event name was cleared via PATCH)`);
    }

    res.json({
      message: "Lead event configuration updated successfully",
      ga4LeadEventName: updated.ga4LeadEventName,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Fetch available GA4 key events for selection (Admin only)
router.get("/ga4/:clientId/key-events", requireAuth, requireRole("Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;
    
    let integration = await storage.getIntegrationByClientId(clientId, 'GA4');
    
    if (!integration || !integration.ga4PropertyId) {
      return res.status(404).json({ message: "GA4 integration or property not configured" });
    }

    if (integration.expiresAt && new Date(integration.expiresAt) < new Date()) {
      if (!integration.refreshToken) {
        return res.status(401).json({ message: "Token expired and no refresh token available" });
      }

      const newTokens = await refreshAccessToken(integration.refreshToken);
      if (!newTokens.success) {
        return res.status(401).json({ message: newTokens.error || "Token refresh failed" });
      }
      integration = await storage.updateIntegration(integration.id, {
        accessToken: newTokens.accessToken,
        expiresAt: newTokens.expiresAt,
      });
    }

    const keyEventsData = await fetchGA4AvailableKeyEvents(
      integration.accessToken!,
      integration.ga4PropertyId!,
      clientId
    );
    
    res.json(keyEventsData);
  } catch (error: any) {
    console.error("Fetch key events error:", error);
    const message = error.userMessage || error.message || "Failed to fetch key events";
    res.status(500).json({ message });
  }
});

// Disconnect GA4 integration (Admin only)
router.delete("/ga4/:clientId", requireAuth, requireRole("Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;

    const integration = await storage.getIntegrationByClientId(clientId, 'GA4');
    
    if (!integration) {
      return res.status(404).json({ message: "GA4 integration not found" });
    }

    await storage.deleteIntegration(integration.id);

    res.json({ message: "GA4 integration disconnected successfully" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// GSC Integration Routes

// Get GSC integration status for a client
router.get("/gsc/:clientId", requireAuth, requireRole("Admin", "Client"), requireClientAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;

    const integration = await storage.getIntegrationByClientId(clientId, 'GSC');
    
    if (!integration) {
      return res.json({ connected: false });
    }

    res.json({
      connected: true,
      gscSiteUrl: integration.gscSiteUrl,
      expiresAt: integration.expiresAt,
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Fetch available GSC sites (Admin only)
router.get("/gsc/:clientId/sites", requireAuth, requireRole("Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;
    
    let integration = await storage.getIntegrationByClientId(clientId, 'GSC');
    
    if (!integration) {
      return res.status(404).json({ message: "Search Console integration not found" });
    }

    if (integration.expiresAt && new Date(integration.expiresAt) < new Date()) {
      if (!integration.refreshToken) {
        return res.status(401).json({ message: "Token expired and no refresh token available" });
      }

      const newTokens = await refreshAccessToken(integration.refreshToken);
      if (!newTokens.success) {
        return res.status(401).json({ message: newTokens.error || "Token refresh failed" });
      }
      integration = await storage.updateIntegration(integration.id, {
        accessToken: newTokens.accessToken,
        expiresAt: newTokens.expiresAt,
      });
    }

    const sites = await fetchGSCSites(integration.accessToken!, clientId);
    res.json(sites);
  } catch (error: any) {
    console.error("Fetch sites error:", error);
    const message = error.userMessage || error.message || "Failed to fetch sites";
    res.status(500).json({ message });
  }
});

// Save selected GSC site (Admin only)
router.post("/gsc/:clientId/site", requireAuth, requireRole("Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;
    const { gscSiteUrl } = req.body;

    if (!gscSiteUrl) {
      return res.status(400).json({ message: "gscSiteUrl is required" });
    }

    const integration = await storage.getIntegrationByClientId(clientId, 'GSC');
    
    if (!integration) {
      return res.status(404).json({ message: "Search Console integration not found" });
    }

    const updated = await storage.updateIntegration(integration.id, {
      gscSiteUrl,
    });

    res.json({
      message: "Search Console site saved successfully",
      gscSiteUrl: updated.gscSiteUrl,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Disconnect GSC integration (Admin only)
router.delete("/gsc/:clientId", requireAuth, requireRole("Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;

    const integration = await storage.getIntegrationByClientId(clientId, 'GSC');
    
    if (!integration) {
      return res.status(404).json({ message: "Search Console integration not found" });
    }

    await storage.deleteIntegration(integration.id);

    res.json({ message: "Search Console integration disconnected successfully" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// HubSpot Integration Routes (Agency-wide)

// Get HubSpot connection status for the agency (Admin only)
router.get("/hubspot/status", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user!.agencyId;
    if (!agencyId) {
      return res.status(400).json({ connected: false, error: "Agency ID not found" });
    }

    const { getHubSpotStatus } = await import("../lib/hubspot");
    const status = await getHubSpotStatus(agencyId);
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ 
      connected: false, 
      error: error.message || "Failed to check HubSpot status" 
    });
  }
});

// Connect HubSpot for the agency (Admin only)
router.post("/hubspot/connect", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user!.agencyId;
    if (!agencyId) {
      return res.status(400).json({ error: "Agency ID not found" });
    }

    const { accessToken } = req.body;
    if (!accessToken) {
      return res.status(400).json({ error: "Access token is required" });
    }

    const { encrypt } = await import("../lib/encryption");
    const { encrypted, iv, authTag } = encrypt(accessToken);

    const existing = await db
      .select()
      .from(agencySettings)
      .where(eq(agencySettings.agencyId, agencyId))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(agencySettings)
        .set({
          hubspotAccessToken: encrypted,
          hubspotAccessTokenIv: iv,
          hubspotAccessTokenAuthTag: authTag,
          hubspotConnectedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(agencySettings.agencyId, agencyId));
    } else {
      await db
        .insert(agencySettings)
        .values({
          agencyId,
          hubspotAccessToken: encrypted,
          hubspotAccessTokenIv: iv,
          hubspotAccessTokenAuthTag: authTag,
          hubspotConnectedAt: new Date(),
        });
    }

    res.json({ success: true, message: "HubSpot connected successfully" });
  } catch (error: any) {
    res.status(500).json({ 
      error: error.message || "Failed to connect HubSpot" 
    });
  }
});

// Disconnect HubSpot for the agency (Admin only)
router.post("/hubspot/disconnect", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user!.agencyId;
    if (!agencyId) {
      return res.status(400).json({ error: "Agency ID not found" });
    }

    await db
      .update(agencySettings)
      .set({
        hubspotAccessToken: null,
        hubspotAccessTokenIv: null,
        hubspotAccessTokenAuthTag: null,
        hubspotConnectedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(agencySettings.agencyId, agencyId));

    res.json({ success: true, message: "HubSpot disconnected successfully" });
  } catch (error: any) {
    res.status(500).json({ 
      error: error.message || "Failed to disconnect HubSpot" 
    });
  }
});

// Fetch HubSpot CRM data for the agency (Admin only)
router.get("/hubspot/data", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user!.agencyId;
    if (!agencyId) {
      return res.status(400).json({ error: "Agency ID not found" });
    }

    const { fetchHubSpotCRMData } = await import("../lib/hubspot");
    const data = await fetchHubSpotCRMData(agencyId);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ 
      message: error.message || "Failed to fetch HubSpot data" 
    });
  }
});

// LinkedIn Integration Routes (Agency-wide)

// Get LinkedIn connection status for the agency (Admin only)
router.get("/linkedin/status", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user!.agencyId;
    if (!agencyId) {
      return res.status(400).json({ connected: false, error: "Agency ID not found" });
    }

    const { getLinkedInStatus } = await import("../lib/linkedin");
    const status = await getLinkedInStatus(agencyId);
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ 
      connected: false, 
      error: error.message || "Failed to check LinkedIn status" 
    });
  }
});

// Connect LinkedIn for the agency (Admin only)
router.post("/linkedin/connect", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user!.agencyId;
    if (!agencyId) {
      return res.status(400).json({ error: "Agency ID not found" });
    }

    const { accessToken, organizationId } = req.body;
    if (!accessToken || !organizationId) {
      return res.status(400).json({ error: "Access token and organization ID are required" });
    }

    const { encrypt } = await import("../lib/encryption");
    const { encrypted, iv, authTag } = encrypt(accessToken);

    const existing = await db
      .select()
      .from(agencySettings)
      .where(eq(agencySettings.agencyId, agencyId))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(agencySettings)
        .set({
          linkedinAccessToken: encrypted,
          linkedinAccessTokenIv: iv,
          linkedinAccessTokenAuthTag: authTag,
          linkedinOrganizationId: organizationId,
          linkedinConnectedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(agencySettings.agencyId, agencyId));
    } else {
      await db
        .insert(agencySettings)
        .values({
          agencyId,
          linkedinAccessToken: encrypted,
          linkedinAccessTokenIv: iv,
          linkedinAccessTokenAuthTag: authTag,
          linkedinOrganizationId: organizationId,
          linkedinConnectedAt: new Date(),
        });
    }

    res.json({ success: true, message: "LinkedIn connected successfully" });
  } catch (error: any) {
    res.status(500).json({ 
      error: error.message || "Failed to connect LinkedIn" 
    });
  }
});

// Disconnect LinkedIn for the agency (Admin only)
router.post("/linkedin/disconnect", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user!.agencyId;
    if (!agencyId) {
      return res.status(400).json({ error: "Agency ID not found" });
    }

    await db
      .update(agencySettings)
      .set({
        linkedinAccessToken: null,
        linkedinAccessTokenIv: null,
        linkedinAccessTokenAuthTag: null,
        linkedinOrganizationId: null,
        linkedinConnectedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(agencySettings.agencyId, agencyId));

    res.json({ success: true, message: "LinkedIn disconnected successfully" });
  } catch (error: any) {
    res.status(500).json({ 
      error: error.message || "Failed to disconnect LinkedIn" 
    });
  }
});

// Fetch LinkedIn data for the agency (Admin only)
router.get("/linkedin/data", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user!.agencyId;
    if (!agencyId) {
      return res.status(400).json({ error: "Agency ID not found" });
    }

    const { fetchLinkedInData } = await import("../lib/linkedin");
    const data = await fetchLinkedInData(agencyId);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ 
      message: error.message || "Failed to fetch LinkedIn data" 
    });
  }
});

// Lead Events Route (under /clients path - will be mounted separately)
// POST /api/clients/:clientId/lead-events - Save selected lead events for a client
router.post("/clients/:clientId/lead-events", requireAuth, requireRole("Admin"), requireClientAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { clientId } = req.params;
    const { leadEvents } = req.body;

    if (!Array.isArray(leadEvents)) {
      return res.status(400).json({ message: "leadEvents must be an array" });
    }

    if (!leadEvents.every(event => typeof event === 'string')) {
      return res.status(400).json({ message: "All lead events must be strings" });
    }

    const client = await storage.getClientById(clientId);
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    const updated = await storage.updateClient(clientId, {
      leadEvents,
    });

    const ga4Integration = await storage.getIntegrationByClientId(clientId, 'GA4');
    if (ga4Integration) {
      const leadEventsString = leadEvents.map((e: string) => e.trim()).join(',');
      await storage.updateIntegration(ga4Integration.id, {
        ga4LeadEventName: leadEventsString || null,
      });
      console.log(`[Lead Events Sync] Updated GA4 integration for client ${clientId} with events: ${leadEventsString}`);
    }

    res.json({
      message: "Lead events saved successfully",
      leadEvents: updated.leadEvents,
    });
  } catch (error: any) {
    console.error("Save lead events error:", error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
