import { Router, type Response } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthRequest } from '../middleware/supabase-auth';
import { storage } from '../storage';
import { getAIProvider } from '../ai/provider';

const router = Router();

router.post("/analyze-data", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const analyzeDataSchema = z.object({
      contextData: z.any(),
      question: z.string().min(1, "Question is required"),
    });

    const validationResult = analyzeDataSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ message: "Invalid request data", errors: validationResult.error.errors });
    }

    const { contextData, question } = validationResult.data;
    const profile = await storage.getProfileByUserId(req.user!.id);
    let client;

    if (profile?.role === "Admin" || profile?.role === "Staff") {
      if (!contextData?.clientId) {
        return res.status(400).json({ message: "Client ID required for Admin/Staff users" });
      }
      client = await storage.getClientById(contextData.clientId);
    } else {
      client = await storage.getClientByProfileId(profile!.id);
    }

    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    console.log("[AI Analysis Request] Client:", client.companyName);
    console.log("[AI Analysis Request] Question:", question);
    console.log("[AI Analysis Request] Context Data:", JSON.stringify(contextData, null, 2));

    const aiProvider = await getAIProvider(client.agencyId);
    const analysis = await aiProvider.analyzeDataOnDemand(
      client.companyName,
      contextData,
      question
    );

    console.log("[AI Analysis Response]:", JSON.stringify(analysis, null, 2));
    res.json(analysis);
  } catch (error: any) {
    console.error("On-demand AI analysis error:", error);
    res.status(500).json({ message: error.message || "Failed to get analysis" });
  }
});

router.post("/request-action", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const recommendationSchema = z.object({
      title: z.string().min(1),
      observation: z.string().min(1),
      proposedAction: z.string().min(1),
      impact: z.enum(["High", "Medium", "Low"]),
      estimatedCost: z.number().min(0),
      triggerMetric: z.string().min(1),
      baselineValue: z.number(),
      clientId: z.string().optional(),
    });

    const validationResult = recommendationSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ message: "Invalid recommendation data", errors: validationResult.error.errors });
    }

    const recommendation = validationResult.data;
    const profile = await storage.getProfileByUserId(req.user!.id);
    let client;

    if (profile?.role === "Admin" || profile?.role === "Staff") {
      if (!recommendation.clientId) {
        return res.status(400).json({ message: "Client ID required for Admin/Staff users" });
      }
      client = await storage.getClientById(recommendation.clientId);
    } else {
      client = await storage.getClientByProfileId(profile!.id);
    }

    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    const status = (profile?.role === "Admin" || profile?.role === "Staff") ? "Draft" : "Needs Review";
    const sentToClient = (profile?.role === "Admin" || profile?.role === "Staff") ? "false" : "true";
    
    const initiative = await storage.createInitiative({
      clientId: client.id,
      title: recommendation.title,
      observation: recommendation.observation,
      proposedAction: recommendation.proposedAction,
      cost: recommendation.estimatedCost?.toString() || "0",
      impact: recommendation.impact,
      status: status,
      triggerMetric: recommendation.triggerMetric || "",
      baselineValue: recommendation.baselineValue?.toString() || "0",
      sentToClient: sentToClient,
    });

    const message = (profile?.role === "Admin" || profile?.role === "Staff") 
      ? "Recommendation saved as draft. You can edit and send it from the AI Recommendations page."
      : "Recommendation submitted for review.";
    
    res.status(201).json({ initiativeId: initiative.id, message });
  } catch (error: any) {
    console.error("AI request action error:", error);
    res.status(500).json({ message: error.message || "Failed to submit recommendation" });
  }
});

export default router;
