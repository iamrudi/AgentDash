/**
 * Knowledge Router
 * 
 * Brand Knowledge Layer routes for knowledge ingestion, retrieval,
 * and AI context assembly.
 * 
 * Routes: 12
 */

import { Router } from 'express';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/supabase-auth';
import { storage } from '../storage';

const knowledgeRouter = Router();

// Get knowledge categories
knowledgeRouter.get("/categories", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }

    const { knowledgeIngestionService } = await import("../intelligence/knowledge-ingestion-service");
    const categories = await knowledgeIngestionService.getCategories(agencyId);
    res.json(categories);
  } catch (error: any) {
    console.error("Error getting knowledge categories:", error);
    res.status(500).json({ message: "Failed to get knowledge categories" });
  }
});

// Initialize default knowledge categories
knowledgeRouter.post("/categories/initialize", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }

    const { knowledgeIngestionService } = await import("../intelligence/knowledge-ingestion-service");
    const categories = await knowledgeIngestionService.initializeDefaultCategories(agencyId);
    res.json(categories);
  } catch (error: any) {
    console.error("Error initializing knowledge categories:", error);
    res.status(500).json({ message: "Failed to initialize knowledge categories" });
  }
});

// Search knowledge (must be before /:id to avoid route conflicts)
knowledgeRouter.get("/search", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }

    const { knowledgeRetrievalService } = await import("../intelligence/knowledge-retrieval-service");
    const results = await knowledgeRetrievalService.searchKnowledge(agencyId, req.query.q as string, {
      clientId: req.query.clientId as string,
      categoryId: req.query.categoryId as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    });
    res.json(results);
  } catch (error: any) {
    console.error("Error searching knowledge:", error);
    res.status(500).json({ message: "Failed to search knowledge" });
  }
});

// Get knowledge ingestion history (must be before /:id to avoid route conflicts)
knowledgeRouter.get("/ingestion-history", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }

    const { knowledgeIngestionService } = await import("../intelligence/knowledge-ingestion-service");
    const history = await knowledgeIngestionService.getIngestionHistory(agencyId, req.query.knowledgeId as string);
    res.json(history);
  } catch (error: any) {
    console.error("Error getting ingestion history:", error);
    res.status(500).json({ message: "Failed to get ingestion history" });
  }
});

// Ingest knowledge
knowledgeRouter.post("/", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }

    const { knowledgeIngestionService } = await import("../intelligence/knowledge-ingestion-service");
    const result = await knowledgeIngestionService.ingest({
      ...req.body,
      agencyId,
      createdBy: req.user?.id,
    });
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error: any) {
    console.error("Error ingesting knowledge:", error);
    res.status(500).json({ message: "Failed to ingest knowledge" });
  }
});

// Get knowledge entries
knowledgeRouter.get("/", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }

    const { knowledgeIngestionService } = await import("../intelligence/knowledge-ingestion-service");
    const knowledge = await knowledgeIngestionService.getKnowledge(agencyId, {
      clientId: req.query.clientId as string,
      categoryId: req.query.categoryId as string,
      status: req.query.status as string,
      validOnly: req.query.validOnly === "true",
    });
    res.json(knowledge);
  } catch (error: any) {
    console.error("Error getting knowledge:", error);
    res.status(500).json({ message: "Failed to get knowledge" });
  }
});

// Get single knowledge entry
knowledgeRouter.get("/:id", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const knowledge = await storage.getClientKnowledgeById(req.params.id);
    if (!knowledge) {
      return res.status(404).json({ message: "Knowledge entry not found" });
    }
    res.json(knowledge);
  } catch (error: any) {
    console.error("Error getting knowledge entry:", error);
    res.status(500).json({ message: "Failed to get knowledge entry" });
  }
});

// Update knowledge entry
knowledgeRouter.patch("/:id", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const { knowledgeIngestionService } = await import("../intelligence/knowledge-ingestion-service");
    const result = await knowledgeIngestionService.update(req.params.id, req.body, req.user?.id);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error: any) {
    console.error("Error updating knowledge:", error);
    res.status(500).json({ message: "Failed to update knowledge" });
  }
});

// Archive knowledge entry
knowledgeRouter.post("/:id/archive", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const { knowledgeIngestionService } = await import("../intelligence/knowledge-ingestion-service");
    const result = await knowledgeIngestionService.archive(req.params.id, req.user?.id);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error: any) {
    console.error("Error archiving knowledge:", error);
    res.status(500).json({ message: "Failed to archive knowledge" });
  }
});

// Supersede knowledge entry
knowledgeRouter.post("/:id/supersede", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }

    const { knowledgeIngestionService } = await import("../intelligence/knowledge-ingestion-service");
    const result = await knowledgeIngestionService.supersede(req.params.id, {
      ...req.body,
      agencyId,
      createdBy: req.user?.id,
    });
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error: any) {
    console.error("Error superseding knowledge:", error);
    res.status(500).json({ message: "Failed to supersede knowledge" });
  }
});

// Assemble knowledge context for AI
knowledgeRouter.post("/assemble-context", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }

    const { knowledgeRetrievalService } = await import("../intelligence/knowledge-retrieval-service");
    const context = await knowledgeRetrievalService.assembleContext({
      ...req.body,
      agencyId,
    });
    res.json(context);
  } catch (error: any) {
    console.error("Error assembling knowledge context:", error);
    res.status(500).json({ message: "Failed to assemble knowledge context" });
  }
});

// Get prompt context (formatted string for AI)
knowledgeRouter.post("/prompt-context", requireAuth, requireRole("Admin", "SuperAdmin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }

    const { knowledgeRetrievalService } = await import("../intelligence/knowledge-retrieval-service");
    const context = await knowledgeRetrievalService.getContextForPrompt({
      ...req.body,
      agencyId,
    });
    res.json({ context });
  } catch (error: any) {
    console.error("Error getting prompt context:", error);
    res.status(500).json({ message: "Failed to get prompt context" });
  }
});

export default knowledgeRouter;
