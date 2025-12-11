import { Router, Request, Response } from "express";
import { z } from "zod";
import { crmWebhookHandler, CRMWebhookPayload } from "./crm-webhook-handler";
import { db } from "../db";
import { workflowSignals } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export const crmRouter = Router();

const hubspotWebhookPayloadSchema = z.array(
  z.object({
    subscriptionId: z.number().optional(),
    portalId: z.number(),
    appId: z.number().optional(),
    occurredAt: z.number(),
    eventType: z.string().optional(),
    objectId: z.number(),
    propertyName: z.string().optional(),
    propertyValue: z.string().optional(),
    changeSource: z.string().optional(),
    subscriptionType: z.string().optional(),
  })
);

crmRouter.post("/webhooks/hubspot", async (req: Request, res: Response) => {
  try {
    const signature = req.headers["x-hubspot-signature-v3"] as string;
    
    if (!signature) {
      console.warn("[CRM_WEBHOOK] Missing HubSpot signature header");
    }

    const parseResult = hubspotWebhookPayloadSchema.safeParse(req.body);
    if (!parseResult.success) {
      console.error("[CRM_WEBHOOK] Invalid payload:", parseResult.error);
      return res.status(400).json({ error: "Invalid webhook payload" });
    }

    const payloads = parseResult.data as CRMWebhookPayload[];
    
    console.log(`[CRM_WEBHOOK] Received ${payloads.length} HubSpot event(s)`);

    const result = await crmWebhookHandler.processWebhookBatch(payloads);
    
    console.log(`[CRM_WEBHOOK] Processed: ${result.processed}, Duplicates: ${result.duplicates}, Errors: ${result.errors.length}`);

    if (result.errors.length > 0) {
      console.warn("[CRM_WEBHOOK] Errors:", result.errors);
    }


    res.status(200).json({
      received: payloads.length,
      processed: result.processed,
      duplicates: result.duplicates,
      workflowsTriggered: result.workflowsTriggered,
    });
  } catch (error: any) {
    console.error("[CRM_WEBHOOK] Error processing webhook:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

crmRouter.get("/status/:agencyId", async (req: Request, res: Response) => {
  try {
    const { agencyId } = req.params;
    const userAgencyId = (req as any).agencyId;
    
    if (agencyId !== userAgencyId && !(req as any).user?.isSuperAdmin) {
      return res.status(403).json({ error: "Access denied" });
    }

    const { getHubSpotStatus } = await import("../lib/hubspot");
    const status = await getHubSpotStatus(agencyId);
    
    res.json(status);
  } catch (error: any) {
    console.error("[CRM_STATUS] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

crmRouter.get("/events", async (req: Request, res: Response) => {
  try {
    const agencyId = (req as any).agencyId;
    if (!agencyId) {
      return res.status(400).json({ error: "Agency context required" });
    }

    const { limit = "50", offset = "0", source = "hubspot" } = req.query;
    
    const signals = await db
      .select()
      .from(workflowSignals)
      .where(eq(workflowSignals.agencyId, agencyId))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string))
      .orderBy(desc(workflowSignals.createdAt));

    const crmSignals = signals.filter(s => s.source === source);

    res.json({
      events: crmSignals,
      total: crmSignals.length,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error: any) {
    console.error("[CRM_EVENTS] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

crmRouter.post("/sync/:agencyId", async (req: Request, res: Response) => {
  try {
    const { agencyId } = req.params;
    const userAgencyId = (req as any).agencyId;
    
    if (agencyId !== userAgencyId && !(req as any).user?.isSuperAdmin) {
      return res.status(403).json({ error: "Access denied" });
    }

    const { fetchHubSpotCRMData, isHubSpotConfigured } = await import("../lib/hubspot");
    
    const configured = await isHubSpotConfigured(agencyId);
    if (!configured) {
      return res.status(400).json({ error: "HubSpot not configured for this agency" });
    }

    const data = await fetchHubSpotCRMData(agencyId);

    res.json({
      synced: true,
      contacts: data.totalContacts,
      deals: data.totalDeals,
      companies: data.totalCompanies,
      dealValue: data.dealValue,
    });
  } catch (error: any) {
    console.error("[CRM_SYNC] Error:", error);
    res.status(500).json({ error: error.message });
  }
});
