import { Router } from "express";
import { z } from "zod";
import { slaService } from "./sla-service";
import { runManualScan } from "./sla-cron";
import { db } from "../db";
import { slaDefinitions, slaBreaches, slaBreachEvents, escalationChains } from "@shared/schema";
import { eq, and, desc, asc } from "drizzle-orm";

export const slaRouter = Router();

const createSlaSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  responseTimeHours: z.string(),
  resolutionTimeHours: z.string(),
  appliesTo: z.array(z.enum(["task", "project", "initiative"])),
  priority: z.enum(["Low", "Medium", "High", "Urgent"]).optional(),
  clientId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  businessHoursOnly: z.boolean().optional(),
  businessHoursStart: z.string().optional(),
  businessHoursEnd: z.string().optional(),
  excludeWeekends: z.boolean().optional(),
});

const createEscalationSchema = z.object({
  level: z.number().int().positive(),
  profileId: z.string().uuid(),
  escalateAfterMinutes: z.number().int().nonnegative(),
  notifyInApp: z.boolean().optional(),
  reassignTask: z.boolean().optional(),
});

slaRouter.get("/definitions", async (req, res) => {
  try {
    const agencyId = (req as any).agencyId;
    if (!agencyId) {
      return res.status(403).json({ error: "Agency access required" });
    }

    const definitions = await db.select()
      .from(slaDefinitions)
      .where(eq(slaDefinitions.agencyId, agencyId))
      .orderBy(asc(slaDefinitions.name));

    res.json(definitions);
  } catch (error) {
    console.error("Error fetching SLA definitions:", error);
    res.status(500).json({ error: "Failed to fetch SLA definitions" });
  }
});

slaRouter.post("/definitions", async (req, res) => {
  try {
    const agencyId = (req as any).agencyId;
    const userId = (req as any).userId;
    if (!agencyId) {
      return res.status(403).json({ error: "Agency access required" });
    }

    const validatedData = createSlaSchema.parse(req.body);

    const [newSla] = await db.insert(slaDefinitions)
      .values({
        name: validatedData.name,
        description: validatedData.description,
        responseTimeHours: validatedData.responseTimeHours,
        resolutionTimeHours: validatedData.resolutionTimeHours,
        appliesTo: validatedData.appliesTo,
        priority: validatedData.priority ?? "medium",
        clientId: validatedData.clientId,
        projectId: validatedData.projectId,
        businessHoursOnly: validatedData.businessHoursOnly,
        businessHoursStart: validatedData.businessHoursStart ? parseInt(validatedData.businessHoursStart) : 9,
        businessHoursEnd: validatedData.businessHoursEnd ? parseInt(validatedData.businessHoursEnd) : 17,
        agencyId,
        createdBy: userId,
        status: "active",
      })
      .returning();

    res.status(201).json(newSla);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request body", details: error.errors });
    }
    console.error("Error creating SLA definition:", error);
    res.status(500).json({ error: "Failed to create SLA definition" });
  }
});

slaRouter.get("/definitions/:id", async (req, res) => {
  try {
    const agencyId = (req as any).agencyId;
    if (!agencyId) {
      return res.status(403).json({ error: "Agency access required" });
    }

    const [sla] = await db.select()
      .from(slaDefinitions)
      .where(and(
        eq(slaDefinitions.id, req.params.id),
        eq(slaDefinitions.agencyId, agencyId)
      ))
      .limit(1);

    if (!sla) {
      return res.status(404).json({ error: "SLA definition not found" });
    }

    res.json(sla);
  } catch (error) {
    console.error("Error fetching SLA definition:", error);
    res.status(500).json({ error: "Failed to fetch SLA definition" });
  }
});

slaRouter.patch("/definitions/:id", async (req, res) => {
  try {
    const agencyId = (req as any).agencyId;
    if (!agencyId) {
      return res.status(403).json({ error: "Agency access required" });
    }

    const existingSla = await db.select()
      .from(slaDefinitions)
      .where(and(
        eq(slaDefinitions.id, req.params.id),
        eq(slaDefinitions.agencyId, agencyId)
      ))
      .limit(1);

    if (existingSla.length === 0) {
      return res.status(404).json({ error: "SLA definition not found" });
    }

    const [updated] = await db.update(slaDefinitions)
      .set({
        ...req.body,
        updatedAt: new Date(),
      })
      .where(eq(slaDefinitions.id, req.params.id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error("Error updating SLA definition:", error);
    res.status(500).json({ error: "Failed to update SLA definition" });
  }
});

slaRouter.delete("/definitions/:id", async (req, res) => {
  try {
    const agencyId = (req as any).agencyId;
    if (!agencyId) {
      return res.status(403).json({ error: "Agency access required" });
    }

    const existingSla = await db.select()
      .from(slaDefinitions)
      .where(and(
        eq(slaDefinitions.id, req.params.id),
        eq(slaDefinitions.agencyId, agencyId)
      ))
      .limit(1);

    if (existingSla.length === 0) {
      return res.status(404).json({ error: "SLA definition not found" });
    }

    await db.delete(slaDefinitions)
      .where(eq(slaDefinitions.id, req.params.id));

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting SLA definition:", error);
    res.status(500).json({ error: "Failed to delete SLA definition" });
  }
});

slaRouter.get("/breaches", async (req, res) => {
  try {
    const agencyId = (req as any).agencyId;
    if (!agencyId) {
      return res.status(403).json({ error: "Agency access required" });
    }

    const { status, slaId, limit = "50" } = req.query;

    let query = db.select()
      .from(slaBreaches)
      .innerJoin(slaDefinitions, eq(slaBreaches.slaId, slaDefinitions.id))
      .where(eq(slaDefinitions.agencyId, agencyId))
      .orderBy(desc(slaBreaches.detectedAt))
      .limit(parseInt(limit as string, 10));

    const results = await query;

    const breaches = results.map(r => ({
      ...r.sla_breaches,
      slaName: r.sla_definitions.name,
    }));

    res.json(breaches);
  } catch (error) {
    console.error("Error fetching SLA breaches:", error);
    res.status(500).json({ error: "Failed to fetch SLA breaches" });
  }
});

slaRouter.get("/breaches/:id", async (req, res) => {
  try {
    const agencyId = (req as any).agencyId;
    if (!agencyId) {
      return res.status(403).json({ error: "Agency access required" });
    }

    const [breach] = await db.select()
      .from(slaBreaches)
      .innerJoin(slaDefinitions, eq(slaBreaches.slaId, slaDefinitions.id))
      .where(and(
        eq(slaBreaches.id, req.params.id),
        eq(slaDefinitions.agencyId, agencyId)
      ))
      .limit(1);

    if (!breach) {
      return res.status(404).json({ error: "Breach not found" });
    }

    const events = await db.select()
      .from(slaBreachEvents)
      .where(eq(slaBreachEvents.breachId, req.params.id))
      .orderBy(asc(slaBreachEvents.createdAt));

    res.json({
      ...breach.sla_breaches,
      slaName: breach.sla_definitions.name,
      events,
    });
  } catch (error) {
    console.error("Error fetching breach details:", error);
    res.status(500).json({ error: "Failed to fetch breach details" });
  }
});

slaRouter.post("/breaches/:id/acknowledge", async (req, res) => {
  try {
    const agencyId = (req as any).agencyId;
    const userId = (req as any).userId;
    if (!agencyId) {
      return res.status(403).json({ error: "Agency access required" });
    }

    await slaService.acknowledgeBreach(req.params.id, userId, req.body.notes);
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error acknowledging breach:", error);
    res.status(500).json({ error: "Failed to acknowledge breach" });
  }
});

slaRouter.post("/breaches/:id/resolve", async (req, res) => {
  try {
    const agencyId = (req as any).agencyId;
    const userId = (req as any).userId;
    if (!agencyId) {
      return res.status(403).json({ error: "Agency access required" });
    }

    await slaService.resolveBreach(req.params.id, userId, req.body.resolution);
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error resolving breach:", error);
    res.status(500).json({ error: "Failed to resolve breach" });
  }
});

slaRouter.get("/definitions/:id/escalations", async (req, res) => {
  try {
    const agencyId = (req as any).agencyId;
    if (!agencyId) {
      return res.status(403).json({ error: "Agency access required" });
    }

    const sla = await db.select()
      .from(slaDefinitions)
      .where(and(
        eq(slaDefinitions.id, req.params.id),
        eq(slaDefinitions.agencyId, agencyId)
      ))
      .limit(1);

    if (sla.length === 0) {
      return res.status(404).json({ error: "SLA definition not found" });
    }

    const escalations = await db.select()
      .from(escalationChains)
      .where(eq(escalationChains.slaId, req.params.id))
      .orderBy(asc(escalationChains.level));

    res.json(escalations);
  } catch (error) {
    console.error("Error fetching escalation chain:", error);
    res.status(500).json({ error: "Failed to fetch escalation chain" });
  }
});

slaRouter.post("/definitions/:id/escalations", async (req, res) => {
  try {
    const agencyId = (req as any).agencyId;
    if (!agencyId) {
      return res.status(403).json({ error: "Agency access required" });
    }

    const sla = await db.select()
      .from(slaDefinitions)
      .where(and(
        eq(slaDefinitions.id, req.params.id),
        eq(slaDefinitions.agencyId, agencyId)
      ))
      .limit(1);

    if (sla.length === 0) {
      return res.status(404).json({ error: "SLA definition not found" });
    }

    const validatedData = createEscalationSchema.parse(req.body);

    const [escalation] = await db.insert(escalationChains)
      .values({
        agencyId,
        slaId: req.params.id,
        level: validatedData.level,
        profileId: validatedData.profileId,
        escalateAfterMinutes: validatedData.escalateAfterMinutes,
        notifyInApp: validatedData.notifyInApp,
        reassignTask: validatedData.reassignTask,
      })
      .returning();

    res.status(201).json(escalation);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request body", details: error.errors });
    }
    console.error("Error creating escalation:", error);
    res.status(500).json({ error: "Failed to create escalation" });
  }
});

slaRouter.post("/scan", async (req, res) => {
  try {
    const agencyId = (req as any).agencyId;
    if (!agencyId) {
      return res.status(403).json({ error: "Agency access required" });
    }

    const result = await runManualScan(agencyId);
    
    res.json(result);
  } catch (error) {
    console.error("Error running manual SLA scan:", error);
    res.status(500).json({ error: "Failed to run SLA scan" });
  }
});

slaRouter.get("/check/:resourceType/:resourceId", async (req, res) => {
  try {
    const agencyId = (req as any).agencyId;
    if (!agencyId) {
      return res.status(403).json({ error: "Agency access required" });
    }

    const { resourceType, resourceId } = req.params;
    const { clientId, projectId } = req.query;

    if (resourceType !== "task") {
      return res.status(400).json({ error: "Only task SLA checks are currently supported" });
    }

    if (!clientId || typeof clientId !== "string") {
      return res.status(400).json({ error: "clientId query parameter is required" });
    }

    const result = await slaService.checkSlaForTask(
      resourceId, 
      agencyId, 
      clientId, 
      typeof projectId === "string" ? projectId : undefined
    );
    
    res.json(result);
  } catch (error) {
    console.error("Error checking SLA:", error);
    res.status(500).json({ error: "Failed to check SLA" });
  }
});
