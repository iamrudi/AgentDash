import { Router } from 'express';
import { storage } from '../storage';
import { 
  requireAuth, 
  requireRole, 
  requireClientAccess,
  type AuthRequest 
} from '../middleware/supabase-auth';
import { getRequestContext } from "../middleware/request-context";
import { LeadEventsService } from "../application/integrations/lead-events-service";
import { Ga4LeadEventService } from "../application/integrations/ga4-lead-event-service";
import { Ga4PropertyService } from "../application/integrations/ga4-property-service";
import { Ga4ReadService } from "../application/integrations/ga4-read-service";
import { GscReadService } from "../application/integrations/gsc-read-service";
import { ClientIntegrationService } from "../application/integrations/client-integration-service";
import { ClientIntegrationStatusService } from "../application/integrations/client-integration-status-service";
import { HubspotAgencyService } from "../application/integrations/hubspot-agency-service";
import { LinkedinAgencyService } from "../application/integrations/linkedin-agency-service";

const router = Router();
const leadEventsService = new LeadEventsService(storage);
const ga4LeadEventService = new Ga4LeadEventService(storage);
const ga4PropertyService = new Ga4PropertyService(storage);
const ga4ReadService = new Ga4ReadService(storage);
const gscReadService = new GscReadService(storage);
const clientIntegrationService = new ClientIntegrationService(storage);
const clientIntegrationStatusService = new ClientIntegrationStatusService(storage);
const hubspotAgencyService = new HubspotAgencyService();
const linkedinAgencyService = new LinkedinAgencyService();

// GA4 Integration Routes

// Get GA4 integration status for a client
export function createGa4StatusHandler(service: ClientIntegrationStatusService = clientIntegrationStatusService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.getGa4Status(req.params.clientId);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.get(
  "/ga4/:clientId",
  requireAuth,
  requireRole("Admin", "Client"),
  requireClientAccess(storage),
  createGa4StatusHandler()
);

// Fetch available GA4 properties (Admin only)
export function createGa4PropertiesHandler(service: Ga4ReadService = ga4ReadService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.fetchProperties(req.params.clientId);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Fetch properties error:", error);
      const message = error.userMessage || error.message || "Failed to fetch properties";
      return res.status(500).json({ message });
    }
  };
}

router.get(
  "/ga4/:clientId/properties",
  requireAuth,
  requireRole("Admin"),
  requireClientAccess(storage),
  createGa4PropertiesHandler()
);

// Save selected GA4 property (Admin only)
export function createGa4PropertyHandler(service: Ga4PropertyService = ga4PropertyService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const ctx = getRequestContext(req);
      const result = await service.saveProperty(ctx, req.params.clientId, {
        ga4PropertyId: req.body?.ga4PropertyId,
        ga4LeadEventName: req.body?.ga4LeadEventName,
      });
      if (!result.ok) {
        const payload: any = { message: result.error };
        if (result.errors) payload.errors = result.errors;
        return res.status(result.status).json(payload);
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.post(
  "/ga4/:clientId/property",
  requireAuth,
  requireRole("Admin"),
  requireClientAccess(storage),
  createGa4PropertyHandler()
);

// Update GA4 lead event name only (Admin only)
export function createGa4LeadEventPatchHandler(service: Ga4LeadEventService = ga4LeadEventService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const ctx = getRequestContext(req);
      const result = await service.updateLeadEventName(
        ctx,
        req.params.clientId,
        req.body?.ga4LeadEventName
      );
      if (!result.ok) {
        const payload: any = { message: result.error };
        if (result.errors) payload.errors = result.errors;
        return res.status(result.status).json(payload);
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.patch(
  "/ga4/:clientId/lead-event",
  requireAuth,
  requireRole("Admin"),
  requireClientAccess(storage),
  createGa4LeadEventPatchHandler()
);

// Fetch available GA4 key events for selection (Admin only)
export function createGa4KeyEventsHandler(service: Ga4ReadService = ga4ReadService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.fetchKeyEvents(req.params.clientId);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Fetch key events error:", error);
      const message = error.userMessage || error.message || "Failed to fetch key events";
      return res.status(500).json({ message });
    }
  };
}

router.get(
  "/ga4/:clientId/key-events",
  requireAuth,
  requireRole("Admin"),
  requireClientAccess(storage),
  createGa4KeyEventsHandler()
);

// Disconnect GA4 integration (Admin only)
export function createGa4DisconnectHandler(service: ClientIntegrationService = clientIntegrationService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.disconnectGa4(req.params.clientId);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.delete(
  "/ga4/:clientId",
  requireAuth,
  requireRole("Admin"),
  requireClientAccess(storage),
  createGa4DisconnectHandler()
);

// GSC Integration Routes

// Get GSC integration status for a client
export function createGscStatusHandler(service: ClientIntegrationStatusService = clientIntegrationStatusService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.getGscStatus(req.params.clientId);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.get(
  "/gsc/:clientId",
  requireAuth,
  requireRole("Admin", "Client"),
  requireClientAccess(storage),
  createGscStatusHandler()
);

// Fetch available GSC sites (Admin only)
export function createGscSitesHandler(service: GscReadService = gscReadService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.fetchSites(req.params.clientId);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Fetch sites error:", error);
      const message = error.userMessage || error.message || "Failed to fetch sites";
      return res.status(500).json({ message });
    }
  };
}

router.get(
  "/gsc/:clientId/sites",
  requireAuth,
  requireRole("Admin"),
  requireClientAccess(storage),
  createGscSitesHandler()
);

// Save selected GSC site (Admin only)
export function createGscSiteSaveHandler(service: ClientIntegrationService = clientIntegrationService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.saveGscSite(req.params.clientId, req.body?.gscSiteUrl);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.post(
  "/gsc/:clientId/site",
  requireAuth,
  requireRole("Admin"),
  requireClientAccess(storage),
  createGscSiteSaveHandler()
);

// Disconnect GSC integration (Admin only)
export function createGscDisconnectHandler(service: ClientIntegrationService = clientIntegrationService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.disconnectGsc(req.params.clientId);
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}

router.delete(
  "/gsc/:clientId",
  requireAuth,
  requireRole("Admin"),
  requireClientAccess(storage),
  createGscDisconnectHandler()
);

// HubSpot Integration Routes (Agency-wide)

// Get HubSpot connection status for the agency (Admin only)
export function createHubspotStatusHandler(service: HubspotAgencyService = hubspotAgencyService) {
  return async (req: AuthRequest, res: any) => {
    const result = await service.getStatus(req.user?.agencyId);
    return res.status(result.status).json(result.data);
  };
}

router.get("/hubspot/status", requireAuth, requireRole("Admin"), createHubspotStatusHandler());

// Connect HubSpot for the agency (Admin only)
export function createHubspotConnectHandler(service: HubspotAgencyService = hubspotAgencyService) {
  return async (req: AuthRequest, res: any) => {
    const result = await service.connect(req.user?.agencyId, req.body?.accessToken);
    return res.status(result.status).json(result.data);
  };
}

router.post("/hubspot/connect", requireAuth, requireRole("Admin"), createHubspotConnectHandler());

// Disconnect HubSpot for the agency (Admin only)
export function createHubspotDisconnectHandler(service: HubspotAgencyService = hubspotAgencyService) {
  return async (req: AuthRequest, res: any) => {
    const result = await service.disconnect(req.user?.agencyId);
    return res.status(result.status).json(result.data);
  };
}

router.post("/hubspot/disconnect", requireAuth, requireRole("Admin"), createHubspotDisconnectHandler());

// Fetch HubSpot CRM data for the agency (Admin only)
export function createHubspotDataHandler(service: HubspotAgencyService = hubspotAgencyService) {
  return async (req: AuthRequest, res: any) => {
    const result = await service.fetchData(req.user?.agencyId);
    return res.status(result.status).json(result.data);
  };
}

router.get("/hubspot/data", requireAuth, requireRole("Admin"), createHubspotDataHandler());

// LinkedIn Integration Routes (Agency-wide)

// Get LinkedIn connection status for the agency (Admin only)
export function createLinkedinStatusHandler(service: LinkedinAgencyService = linkedinAgencyService) {
  return async (req: AuthRequest, res: any) => {
    const result = await service.getStatus(req.user?.agencyId);
    return res.status(result.status).json(result.data);
  };
}

router.get("/linkedin/status", requireAuth, requireRole("Admin"), createLinkedinStatusHandler());

// Connect LinkedIn for the agency (Admin only)
export function createLinkedinConnectHandler(service: LinkedinAgencyService = linkedinAgencyService) {
  return async (req: AuthRequest, res: any) => {
    const result = await service.connect(req.user?.agencyId, req.body?.accessToken, req.body?.organizationId);
    return res.status(result.status).json(result.data);
  };
}

router.post("/linkedin/connect", requireAuth, requireRole("Admin"), createLinkedinConnectHandler());

// Disconnect LinkedIn for the agency (Admin only)
export function createLinkedinDisconnectHandler(service: LinkedinAgencyService = linkedinAgencyService) {
  return async (req: AuthRequest, res: any) => {
    const result = await service.disconnect(req.user?.agencyId);
    return res.status(result.status).json(result.data);
  };
}

router.post("/linkedin/disconnect", requireAuth, requireRole("Admin"), createLinkedinDisconnectHandler());

// Fetch LinkedIn data for the agency (Admin only)
export function createLinkedinDataHandler(service: LinkedinAgencyService = linkedinAgencyService) {
  return async (req: AuthRequest, res: any) => {
    const result = await service.fetchData(req.user?.agencyId);
    return res.status(result.status).json(result.data);
  };
}

router.get("/linkedin/data", requireAuth, requireRole("Admin"), createLinkedinDataHandler());

// Lead Events Route (under /clients path - will be mounted separately)
// POST /api/clients/:clientId/lead-events - Save selected lead events for a client
export function createLeadEventsHandler(service: LeadEventsService = leadEventsService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const ctx = getRequestContext(req);
      const result = await service.saveLeadEvents(ctx, req.params.clientId, req.body?.leadEvents);
      if (!result.ok) {
        const payload: any = { message: result.error };
        if (result.errors) payload.errors = result.errors;
        return res.status(result.status).json(payload);
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error("Save lead events error:", error);
      return res.status(500).json({ message: error.message });
    }
  };
}

router.post(
  "/clients/:clientId/lead-events",
  requireAuth,
  requireRole("Admin"),
  requireClientAccess(storage),
  createLeadEventsHandler()
);

export default router;
