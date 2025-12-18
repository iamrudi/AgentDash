/**
 * Knowledge Documents Router
 * 
 * Vector Storage API routes for knowledge document CRUD,
 * indexing, and semantic search.
 * 
 * Routes: 9
 */

import { Router } from 'express';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/supabase-auth';
import { db } from '../db';
import { knowledgeDocuments, documentEmbeddings, insertKnowledgeDocumentSchema, updateKnowledgeDocumentSchema } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { embeddingService } from '../vector/embedding-service';

const knowledgeDocumentsRouter = Router();

// Get all documents for agency
knowledgeDocumentsRouter.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userAgencyId = req.user?.agencyId;
    if (!userAgencyId && !req.user?.isSuperAdmin) {
      return res.status(400).json({ message: "Agency context required" });
    }
    const agencyId = userAgencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }
    
    const { documentType, clientId, status } = req.query;
    
    let conditions = [eq(knowledgeDocuments.agencyId, agencyId)];
    if (documentType) {
      conditions.push(eq(knowledgeDocuments.documentType, documentType as string));
    }
    if (clientId) {
      conditions.push(eq(knowledgeDocuments.clientId, clientId as string));
    }
    if (status) {
      conditions.push(eq(knowledgeDocuments.status, status as string));
    }
    
    const docs = await db.select()
      .from(knowledgeDocuments)
      .where(and(...conditions))
      .orderBy(desc(knowledgeDocuments.createdAt));
    
    res.json(docs);
  } catch (error: any) {
    console.error("Error fetching knowledge documents:", error);
    res.status(500).json({ message: "Failed to fetch knowledge documents" });
  }
});

// Get single document
knowledgeDocumentsRouter.get("/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const agencyId = req.user?.agencyId;
    if (!agencyId && !req.user?.isSuperAdmin) {
      return res.status(400).json({ message: "Agency context required" });
    }
    
    const doc = await db.select()
      .from(knowledgeDocuments)
      .where(and(
        eq(knowledgeDocuments.id, id),
        eq(knowledgeDocuments.agencyId, agencyId!)
      ))
      .limit(1);
    
    if (doc.length === 0) {
      return res.status(404).json({ message: "Document not found" });
    }
    
    res.json(doc[0]);
  } catch (error: any) {
    console.error("Error fetching knowledge document:", error);
    res.status(500).json({ message: "Failed to fetch knowledge document" });
  }
});

// Create document and index it
knowledgeDocumentsRouter.post("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }
    
    const validated = insertKnowledgeDocumentSchema.parse({
      ...req.body,
      agencyId,
      createdBy: req.user?.id,
      status: "pending",
    });
    
    const [newDoc] = await db.insert(knowledgeDocuments).values(validated).returning();
    
    // If content is provided, start indexing
    if (newDoc.content) {
      await db.update(knowledgeDocuments)
        .set({ status: "processing" })
        .where(eq(knowledgeDocuments.id, newDoc.id));
      
      try {
        const result = await embeddingService.indexDocument(
          newDoc.id,
          agencyId,
          newDoc.content
        );
        
        res.json({
          document: { ...newDoc, status: "indexed", chunkCount: result.chunkCount },
          indexingResult: result,
        });
      } catch (indexError: any) {
        await db.update(knowledgeDocuments)
          .set({ status: "failed", errorMessage: indexError.message })
          .where(eq(knowledgeDocuments.id, newDoc.id));
        
        res.status(500).json({
          document: newDoc,
          message: "Document created but indexing failed",
          error: indexError.message,
        });
      }
    } else {
      res.json({ document: newDoc });
    }
  } catch (error: any) {
    console.error("Error creating knowledge document:", error);
    res.status(500).json({ message: "Failed to create knowledge document" });
  }
});

// Update document
knowledgeDocumentsRouter.patch("/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }
    
    const existingDoc = await db.select()
      .from(knowledgeDocuments)
      .where(and(
        eq(knowledgeDocuments.id, id),
        eq(knowledgeDocuments.agencyId, agencyId)
      ))
      .limit(1);
    
    if (existingDoc.length === 0) {
      return res.status(404).json({ message: "Document not found" });
    }
    
    const validated = updateKnowledgeDocumentSchema.parse(req.body);
    
    const [updatedDoc] = await db.update(knowledgeDocuments)
      .set({ ...validated, updatedAt: new Date() })
      .where(eq(knowledgeDocuments.id, id))
      .returning();
    
    // Re-index if content changed
    if (validated.content && validated.content !== existingDoc[0].content) {
      await db.update(knowledgeDocuments)
        .set({ status: "processing" })
        .where(eq(knowledgeDocuments.id, id));
      
      try {
        const result = await embeddingService.indexDocument(id, agencyId, validated.content);
        
        res.json({
          document: { ...updatedDoc, status: "indexed", chunkCount: result.chunkCount },
          reindexed: true,
          indexingResult: result,
        });
      } catch (indexError: any) {
        await db.update(knowledgeDocuments)
          .set({ status: "failed", errorMessage: indexError.message })
          .where(eq(knowledgeDocuments.id, id));
        
        res.json({
          document: updatedDoc,
          reindexed: false,
          error: indexError.message,
        });
      }
    } else {
      res.json({ document: updatedDoc });
    }
  } catch (error: any) {
    console.error("Error updating knowledge document:", error);
    res.status(500).json({ message: "Failed to update knowledge document" });
  }
});

// Delete document
knowledgeDocumentsRouter.delete("/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }
    
    const existingDoc = await db.select()
      .from(knowledgeDocuments)
      .where(and(
        eq(knowledgeDocuments.id, id),
        eq(knowledgeDocuments.agencyId, agencyId)
      ))
      .limit(1);
    
    if (existingDoc.length === 0) {
      return res.status(404).json({ message: "Document not found" });
    }
    
    // Delete embeddings first (cascade would handle this but explicit is clearer)
    await db.delete(documentEmbeddings).where(eq(documentEmbeddings.documentId, id));
    await db.delete(knowledgeDocuments).where(eq(knowledgeDocuments.id, id));
    
    // Update index stats
    await embeddingService.updateIndexStats(agencyId);
    
    res.json({ message: "Document deleted" });
  } catch (error: any) {
    console.error("Error deleting knowledge document:", error);
    res.status(500).json({ message: "Failed to delete knowledge document" });
  }
});

// Re-index a document
knowledgeDocumentsRouter.post("/:id/reindex", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }
    
    const doc = await db.select()
      .from(knowledgeDocuments)
      .where(and(
        eq(knowledgeDocuments.id, id),
        eq(knowledgeDocuments.agencyId, agencyId)
      ))
      .limit(1);
    
    if (doc.length === 0) {
      return res.status(404).json({ message: "Document not found" });
    }
    
    if (!doc[0].content) {
      return res.status(400).json({ message: "Document has no content to index" });
    }
    
    await db.update(knowledgeDocuments)
      .set({ status: "processing" })
      .where(eq(knowledgeDocuments.id, id));
    
    const result = await embeddingService.indexDocument(id, agencyId, doc[0].content);
    
    res.json({
      message: "Document reindexed",
      result,
    });
  } catch (error: any) {
    console.error("Error reindexing document:", error);
    res.status(500).json({ message: "Failed to reindex document" });
  }
});

// Semantic search
knowledgeDocumentsRouter.post("/search", requireAuth, async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }
    
    const { query, topK, minScore, documentType, clientId } = req.body;
    
    if (!query || typeof query !== "string") {
      return res.status(400).json({ message: "Query is required" });
    }
    
    const results = await embeddingService.semanticSearch(
      query,
      agencyId,
      { topK, minScore, documentType, clientId },
      req.user?.id
    );
    
    res.json({ results });
  } catch (error: any) {
    console.error("Error performing semantic search:", error);
    res.status(500).json({ message: "Failed to perform semantic search" });
  }
});

// Get embedding index stats
knowledgeDocumentsRouter.get("/stats/embeddings", requireAuth, async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }
    
    const stats = await embeddingService.getIndexStats(agencyId);
    
    if (!stats) {
      return res.json({
        totalDocuments: 0,
        totalChunks: 0,
        totalTokens: 0,
        queryCount: 0,
      });
    }
    
    res.json(stats);
  } catch (error: any) {
    console.error("Error fetching embedding stats:", error);
    res.status(500).json({ message: "Failed to fetch embedding stats" });
  }
});

// Rebuild entire index (Admin only)
knowledgeDocumentsRouter.post("/index/rebuild", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }
    
    const result = await embeddingService.rebuildIndex(agencyId);
    
    res.json({
      message: "Index rebuild completed",
      result,
    });
  } catch (error: any) {
    console.error("Error rebuilding index:", error);
    res.status(500).json({ message: "Failed to rebuild index" });
  }
});

// Prune orphaned embeddings (Admin only)
knowledgeDocumentsRouter.post("/index/prune", requireAuth, requireRole("Admin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.user?.agencyId;
    if (!agencyId) {
      return res.status(400).json({ message: "Agency context required" });
    }
    
    const prunedCount = await embeddingService.pruneOrphanedEmbeddings(agencyId);
    
    res.json({
      message: "Prune completed",
      prunedCount,
    });
  } catch (error: any) {
    console.error("Error pruning embeddings:", error);
    res.status(500).json({ message: "Failed to prune embeddings" });
  }
});

export default knowledgeDocumentsRouter;
