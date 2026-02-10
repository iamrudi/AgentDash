import { Router } from "express";
import { z } from "zod";
import { 
  requireAuth, 
  requireRole, 
  requireInitiativeAccess,
  type AuthRequest 
} from "../middleware/supabase-auth";
import { storage } from "../storage";
import { db } from "../db";
import { projects, taskLists, tasks } from "@shared/schema";
import { InvoiceGeneratorService } from "../services/invoiceGenerator";

const router = Router();

// Create initiative
router.post("/", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const { billingType, cost, estimatedHours, ...rest } = req.body;
    
    const initiativeData: any = { ...rest };
    
    // Infer billing type from provided fields if not specified
    let effectiveBillingType = billingType;
    if (!billingType) {
      if (estimatedHours && !cost) {
        effectiveBillingType = "hours";
      } else {
        effectiveBillingType = "cost";
      }
    }
    
    // Handle billing type - either cost or hours
    if (effectiveBillingType === "hours") {
      const hours = estimatedHours ? parseFloat(estimatedHours) : NaN;
      if (isNaN(hours) || hours <= 0) {
        return res.status(400).json({ message: "Valid estimated hours (> 0) required for hours-based billing" });
      }
      initiativeData.billingType = "hours";
      initiativeData.estimatedHours = hours;
      initiativeData.cost = null;
    } else {
      // Cost billing - cost is required
      const costValue = cost ? parseFloat(cost) : NaN;
      if (isNaN(costValue) || costValue <= 0) {
        return res.status(400).json({ message: "Valid cost (> 0) required for cost-based billing" });
      }
      initiativeData.billingType = "cost";
      initiativeData.cost = costValue.toString();
      initiativeData.estimatedHours = null;
    }
    
    const initiative = await storage.createInitiative(initiativeData);
    res.status(201).json(initiative);
  } catch (error: any) {
    if (error.message?.includes("Opportunity must be approved")) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
});

// Update initiative (edit before sending)
router.patch("/:id", requireAuth, requireRole("Admin"), requireInitiativeAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { title, observation, proposedAction, cost, impact, estimatedHours, billingType } = req.body;
    
    const updates: any = {
      title,
      observation,
      proposedAction,
      impact
    };
    
    // Handle billing type - either cost or hours
    if (billingType === "hours") {
      const hours = estimatedHours ? parseFloat(estimatedHours) : NaN;
      if (isNaN(hours) || hours <= 0) {
        return res.status(400).json({ message: "Valid estimated hours (> 0) required for hours-based billing" });
      }
      updates.billingType = "hours";
      updates.estimatedHours = hours;
      updates.cost = null; // Clear cost if switching to hours
    } else if (billingType === "cost") {
      // Cost is required for cost-based billing
      const costValue = cost ? parseFloat(cost) : NaN;
      if (isNaN(costValue) || costValue <= 0) {
        return res.status(400).json({ message: "Valid cost (> 0) required for cost-based billing" });
      }
      updates.billingType = "cost";
      updates.cost = costValue.toString();
      updates.estimatedHours = null; // Clear hours if switching to cost
    } else if (cost !== undefined || estimatedHours !== undefined) {
      // Legacy support: if no billingType specified, infer from provided values
      // If a field is provided (not undefined), validate it
      if (cost !== undefined) {
        const costValue = parseFloat(cost);
        if (isNaN(costValue) || costValue <= 0) {
          return res.status(400).json({ message: "Valid cost (> 0) required" });
        }
        updates.cost = costValue.toString();
        updates.billingType = "cost";
      }
      if (estimatedHours !== undefined) {
        const hours = parseFloat(estimatedHours);
        if (isNaN(hours) || hours <= 0) {
          return res.status(400).json({ message: "Valid estimated hours (> 0) required" });
        }
        updates.estimatedHours = hours;
        updates.billingType = "hours";
      }
    }
    
    const initiative = await storage.updateInitiative(id, updates);
    
    res.json(initiative);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Send initiative to client
router.post("/:id/send", requireAuth, requireRole("Admin"), requireInitiativeAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const initiative = await storage.sendInitiativeToClient(id);
    
    // Create notification for client about new initiative (don't let notification failures break sending)
    try {
      const client = await storage.getClientById(initiative.clientId);
      if (client) {
        const clientProfile = await storage.getProfileById(client.profileId);
        if (clientProfile) {
          // profile.id IS the user ID (Supabase Auth ID)
          await storage.createNotification({
            userId: clientProfile.id,
            type: "new_initiative",
            title: "New Strategic Initiative",
            message: `Your agency has sent you a new strategic initiative: "${initiative.title}"`,
            link: "/client/recommendations",
            isRead: "false",
            isArchived: "false",
          });
        }
      }
    } catch (notificationError) {
      console.error("Failed to create new initiative notification:", notificationError);
    }
    
    res.json(initiative);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Client responds to initiative (approve/reject/discuss)
router.post("/:id/respond", requireAuth, requireRole("Client", "Admin"), requireInitiativeAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { response, feedback } = req.body;
    
    console.log(`[INITIATIVE_RESPOND] Received request for initiative ${id}:`, { response, feedback, hasResponse: !!response });
    
    if (!["approved", "rejected", "discussing"].includes(response)) {
      console.log(`[INITIATIVE_RESPOND] Invalid response value: "${response}"`);
      return res.status(400).json({ message: "Invalid response. Must be 'approved', 'rejected', or 'discussing'" });
    }
    
    // Get initiative to check billing type
    const existingInitiative = await storage.getInitiativeById(id);
    if (!existingInitiative) {
      console.log(`[INITIATIVE_RESPOND] Initiative not found: ${id}`);
      return res.status(404).json({ message: "Initiative not found" });
    }
    
    console.log(`[INITIATIVE_RESPOND] Initiative details:`, {
      billingType: existingInitiative.billingType,
      estimatedHours: existingInitiative.estimatedHours,
      clientId: existingInitiative.clientId
    });
    
    // If approving an hours-based initiative, check and deduct retainer hours
    if (response === "approved" && existingInitiative.billingType === "hours" && existingInitiative.estimatedHours) {
      const hoursNeeded = parseFloat(existingInitiative.estimatedHours);
      const hoursInfo = await storage.checkRetainerHours(existingInitiative.clientId);
      
      console.log(`[INITIATIVE_RESPOND] Retainer hours check:`, {
        hoursNeeded,
        hoursAvailable: hoursInfo.available,
        hoursTotal: hoursInfo.total,
        hoursUsed: hoursInfo.used
      });
      
      if (hoursInfo.available < hoursNeeded) {
        console.log(`[INITIATIVE_RESPOND] Insufficient retainer hours!`);
        return res.status(400).json({ 
          message: `Insufficient retainer hours. You have ${hoursInfo.available} hours available but need ${hoursNeeded} hours. Please contact your account manager to purchase additional hours.` 
        });
      }
      
      // Deduct the hours
      await storage.deductRetainerHours(existingInitiative.clientId, hoursNeeded);
      console.log(`[INITIATIVE_RESPOND] Deducted ${hoursNeeded} retainer hours`);
    }
    
    const initiative = await storage.updateInitiativeClientResponse(id, response, feedback);
    
    // Track recommendation outcome in feedback loop (fire-and-forget, non-blocking)
    // Import at module level would be better but using dynamic import for isolation
    import("../intelligence/outcome-feedback-service").then(({ outcomeFeedbackService }) => {
      storage.getClientById(existingInitiative.clientId).then((client) => {
        if (client) {
          outcomeFeedbackService.captureOutcome({
            agencyId: client.agencyId,
            clientId: existingInitiative.clientId,
            recommendationId: id,
            recommendationType: existingInitiative.recommendationType || "strategic",
            wasAccepted: response === "approved",
            predictedImpact: existingInitiative.impact ? Number(existingInitiative.impact) : undefined,
            notes: feedback || undefined,
          }).then(() => {
            console.log(`[FEEDBACK_LOOP] Captured outcome for initiative ${id}: ${response}`);
          }).catch((err: Error) => {
            console.error("[FEEDBACK_LOOP] Failed to capture outcome:", err);
          });
        }
      }).catch((err: Error) => {
        console.error("[FEEDBACK_LOOP] Failed to get client:", err);
      });
    }).catch((err: Error) => {
      console.error("[FEEDBACK_LOOP] Failed to import feedback service:", err);
    });
    
    // If approved, automatically create project and invoice (if not already created)
    let projectId: string | undefined = existingInitiative.projectId || undefined;
    let invoiceId: string | undefined = existingInitiative.invoiceId || undefined;
    
    if (response === "approved") {
      // Create project if not already created
      if (!projectId) {
        // Validate client exists BEFORE creating any resources
        const client = await storage.getClientById(existingInitiative.clientId);
        if (!client) {
          return res.status(400).json({ 
            message: "Cannot create project: client not found for this initiative" 
          });
        }
        
        // Use transaction for atomic project+task creation
        try {
          let createdProjectId: string | undefined;
          
          await db.transaction(async (tx) => {
            // Create project
            const [project] = await tx.insert(projects).values({
              name: existingInitiative.title,
              description: existingInitiative.observation,
              status: "Active",
              clientId: existingInitiative.clientId,
            }).returning();
            
            if (!project?.id) {
              throw new Error("Failed to create project: no ID returned");
            }
            
            createdProjectId = project.id;
            console.log(`Created project ${project.id} from approved initiative ${id}`);
            
            // Create task list
            const [taskList] = await tx.insert(taskLists).values({
              name: existingInitiative.title,
              projectId: project.id,
              agencyId: client.agencyId,
            }).returning();
            
            console.log(`Created task list ${taskList.id} for project ${project.id}`);
            
            // Create tasks from actionTasks array
            if (existingInitiative.actionTasks && Array.isArray(existingInitiative.actionTasks) && existingInitiative.actionTasks.length > 0) {
              const taskValues = existingInitiative.actionTasks.map(taskDescription => ({
                description: taskDescription,
                status: "To Do" as const,
                priority: "Medium" as const,
                projectId: project.id,
                listId: taskList.id,
                startDate: null,
                dueDate: null,
                parentId: null,
                initiativeId: existingInitiative.id,
              }));
              
              await tx.insert(tasks).values(taskValues);
              console.log(`Created ${existingInitiative.actionTasks.length} tasks from initiative ${id}`);
            }
          });
          
          // Guard: Ensure transaction set the ID before proceeding
          if (!createdProjectId) {
            throw new Error("Transaction completed but project ID was not set");
          }
          
          // Only assign projectId to outer scope AFTER transaction commits successfully
          projectId = createdProjectId;
          
          // Persist project reference in initiative (outside transaction)
          await storage.updateInitiative(id, { projectId });
          
        } catch (autoCreateError: any) {
          console.error("Failed to auto-create project/tasks from initiative:", autoCreateError);
          return res.status(500).json({ 
            message: `Initiative approved, but failed to create project: ${autoCreateError.message}` 
          });
        }
      }
      
      // Generate invoice if needed (fixed cost initiatives or if cost is specified) and not already generated
      if (!invoiceId && (existingInitiative.billingType === "fixed" || (existingInitiative.cost && parseFloat(existingInitiative.cost) > 0))) {
        try {
          const invoiceGenerator = new InvoiceGeneratorService(storage);
          invoiceId = await invoiceGenerator.generateInvoiceFromInitiative(id);
          
          // Persist invoice reference in initiative
          await storage.updateInitiative(id, { invoiceId });
          
          console.log(`Generated invoice ${invoiceId} from approved initiative ${id}`);
        } catch (invoiceError) {
          console.error("Failed to generate invoice from initiative:", invoiceError);
          // Don't fail the approval, just log the error
        }
      }
    }
    
    // Create notification for admin users about client response (don't let notification failures break the response)
    try {
      const profile = await storage.getProfileByUserId(req.user!.id);
      if (profile?.role === "Client") {
        const client = await storage.getClientByProfileId(profile.id);
        // Only notify admins in the same agency as this client
        const adminUsers = client?.agencyId 
          ? await storage.getAllUsersWithProfiles(client.agencyId)
          : [];
        const admins = adminUsers.filter(u => u.profile?.role === "Admin");
        
        const responseText = response === "approved" ? "approved" : response === "rejected" ? "rejected" : "wants to discuss";
        
        for (const admin of admins) {
          await storage.createNotification({
            userId: admin.id,
            type: "initiative_response",
            title: "Initiative Response",
            message: `${profile.fullName} from ${client?.companyName} ${responseText} "${existingInitiative.title}"`,
            link: `/agency/recommendations`,
            isRead: "false",
            isArchived: "false",
          });
        }
      }
    } catch (notificationError) {
      console.error("Failed to create initiative response notification:", notificationError);
    }
    
    res.json({ 
      ...initiative, 
      projectId,
      invoiceId,
      message: response === "approved" 
        ? `Initiative approved successfully${projectId ? ', project and tasks created' : ''}${invoiceId ? ', invoice generated' : ''}` 
        : undefined
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Generate invoice from approved initiative
router.post("/:id/generate-invoice", requireAuth, requireRole("Admin"), requireInitiativeAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const invoiceGenerator = new InvoiceGeneratorService(storage);
    const invoiceId = await invoiceGenerator.generateInvoiceFromInitiative(id);
    res.status(201).json({ invoiceId, message: "Invoice generated successfully" });
  } catch (error: any) {
    console.error("Generate invoice error:", error);
    res.status(500).json({ message: error.message || "Failed to generate invoice" });
  }
});

// Soft delete initiative (move to trash)
router.delete("/:id", requireAuth, requireRole("Admin"), requireInitiativeAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const initiative = await storage.softDeleteInitiative(id);
    res.json({ message: "Initiative moved to trash", initiative });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Restore initiative from trash
router.post("/:id/restore", requireAuth, requireRole("Admin"), requireInitiativeAccess(storage), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const initiative = await storage.restoreInitiative(id);
    res.json({ message: "Initiative restored", initiative });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Get deleted initiatives (trash)
router.get("/trash", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const deletedInitiatives = await storage.getDeletedInitiatives();
    res.json(deletedInitiatives);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Permanently delete initiative
router.delete("/:id/permanent", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await storage.permanentlyDeleteInitiative(id);
    res.json({ message: "Initiative permanently deleted" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
