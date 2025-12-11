import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { db } from "../db";
import { knowledgeDocuments, documentEmbeddings, embeddingIndexStats, semanticSearchLogs, type EmbeddingIndexStats } from "@shared/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface ChunkOptions {
  maxTokens?: number;
  overlapTokens?: number;
  preserveSentences?: boolean;
}

export interface EmbeddingResult {
  embedding: number[];
  tokenCount: number;
  model: string;
  provider: "openai" | "gemini";
}

export interface SearchResult {
  chunkId: string;
  documentId: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
  document?: {
    title: string;
    documentType: string;
  };
}

export interface SearchOptions {
  topK?: number;
  minScore?: number;
  documentType?: string;
  clientId?: string;
}

export class EmbeddingService {
  private defaultProvider: "openai" | "gemini";
  private defaultModel: string;

  constructor(provider: "openai" | "gemini" = "openai") {
    this.defaultProvider = provider;
    this.defaultModel = provider === "openai" 
      ? "text-embedding-3-small" 
      : "text-embedding-004";
  }

  async generateEmbedding(
    text: string,
    provider?: "openai" | "gemini"
  ): Promise<EmbeddingResult> {
    const useProvider = provider || this.defaultProvider;

    if (useProvider === "openai") {
      return this.generateOpenAIEmbedding(text);
    } else {
      return this.generateGeminiEmbedding(text);
    }
  }

  private async generateOpenAIEmbedding(text: string): Promise<EmbeddingResult> {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
      encoding_format: "float",
    });

    return {
      embedding: response.data[0].embedding,
      tokenCount: response.usage?.total_tokens || Math.ceil(text.length / 4),
      model: "text-embedding-3-small",
      provider: "openai",
    };
  }

  private async generateGeminiEmbedding(text: string): Promise<EmbeddingResult> {
    const result = await genAI.models.embedContent({
      model: "text-embedding-004",
      contents: text,
    });
    const embedding = result.embeddings?.[0]?.values || [];

    return {
      embedding: embedding,
      tokenCount: Math.ceil(text.length / 4),
      model: "text-embedding-004",
      provider: "gemini",
    };
  }

  chunkText(
    text: string,
    options: ChunkOptions = {}
  ): string[] {
    const {
      maxTokens = 500,
      overlapTokens = 50,
      preserveSentences = true,
    } = options;

    const maxChars = maxTokens * 4;
    const overlapChars = overlapTokens * 4;

    if (text.length <= maxChars) {
      return [text.trim()];
    }

    const chunks: string[] = [];
    let startIndex = 0;

    while (startIndex < text.length) {
      let endIndex = Math.min(startIndex + maxChars, text.length);

      if (preserveSentences && endIndex < text.length) {
        const lastPeriod = text.lastIndexOf(".", endIndex);
        const lastQuestion = text.lastIndexOf("?", endIndex);
        const lastExclaim = text.lastIndexOf("!", endIndex);
        const lastNewline = text.lastIndexOf("\n", endIndex);

        const sentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclaim, lastNewline);
        
        if (sentenceEnd > startIndex + maxChars / 2) {
          endIndex = sentenceEnd + 1;
        }
      }

      const chunk = text.slice(startIndex, endIndex).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }

      startIndex = endIndex - overlapChars;
      if (startIndex >= text.length - overlapChars) {
        break;
      }
    }

    return chunks;
  }

  async indexDocument(
    documentId: string,
    agencyId: string,
    content: string,
    provider?: "openai" | "gemini"
  ): Promise<{ chunkCount: number; totalTokens: number }> {
    const chunks = this.chunkText(content);
    let totalTokens = 0;

    await db.delete(documentEmbeddings)
      .where(eq(documentEmbeddings.documentId, documentId));

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const result = await this.generateEmbedding(chunk, provider);
      totalTokens += result.tokenCount;

      await db.insert(documentEmbeddings).values({
        agencyId,
        documentId,
        chunkIndex: i,
        content: chunk,
        embedding: result.embedding,
        embeddingModel: result.model,
        embeddingProvider: result.provider,
        tokenCount: result.tokenCount,
        metadata: { chunkIndex: i, totalChunks: chunks.length },
      });
    }

    await db.update(knowledgeDocuments)
      .set({
        status: "indexed",
        chunkCount: chunks.length,
        lastIndexedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(knowledgeDocuments.id, documentId));

    await this.updateIndexStats(agencyId);

    return { chunkCount: chunks.length, totalTokens };
  }

  async semanticSearch(
    query: string,
    agencyId: string,
    options: SearchOptions = {},
    userId?: string
  ): Promise<SearchResult[]> {
    const startTime = Date.now();
    const { topK = 5, minScore = 0.7, documentType, clientId } = options;

    const queryResult = await this.generateEmbedding(query);
    const queryEmbedding = queryResult.embedding;

    let whereConditions = [eq(documentEmbeddings.agencyId, agencyId)];

    const allEmbeddings = await db.select({
      id: documentEmbeddings.id,
      documentId: documentEmbeddings.documentId,
      content: documentEmbeddings.content,
      embedding: documentEmbeddings.embedding,
      metadata: documentEmbeddings.metadata,
    })
    .from(documentEmbeddings)
    .where(and(...whereConditions));

    const scoredResults = allEmbeddings.map(emb => {
      const score = this.cosineSimilarity(queryEmbedding, emb.embedding as number[]);
      return {
        chunkId: emb.id,
        documentId: emb.documentId,
        content: emb.content,
        score,
        metadata: emb.metadata || {},
      };
    });

    let filteredResults = scoredResults
      .filter(r => r.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    if (documentType || clientId) {
      const docIds = Array.from(new Set(filteredResults.map(r => r.documentId)));
      if (docIds.length > 0) {
        const docs = await db.select()
          .from(knowledgeDocuments)
          .where(and(
            inArray(knowledgeDocuments.id, docIds),
            eq(knowledgeDocuments.agencyId, agencyId)
          ));

        const docMap = new Map(docs.map(d => [d.id, d]));

        filteredResults = filteredResults.filter(r => {
          const doc = docMap.get(r.documentId);
          if (!doc) return false;
          if (documentType && doc.documentType !== documentType) return false;
          if (clientId && doc.clientId !== clientId) return false;
          return true;
        });
      }
    }

    const docIds = Array.from(new Set(filteredResults.map(r => r.documentId)));
    const docs = docIds.length > 0 
      ? await db.select({ id: knowledgeDocuments.id, title: knowledgeDocuments.title, documentType: knowledgeDocuments.documentType })
          .from(knowledgeDocuments)
          .where(and(
            inArray(knowledgeDocuments.id, docIds),
            eq(knowledgeDocuments.agencyId, agencyId)
          ))
      : [];
    const docMap = new Map(docs.map(d => [d.id, d]));

    const results: SearchResult[] = filteredResults.map(r => ({
      ...r,
      document: docMap.get(r.documentId),
    }));

    const durationMs = Date.now() - startTime;

    await db.insert(semanticSearchLogs).values({
      agencyId,
      userId,
      query,
      queryEmbedding,
      resultCount: results.length,
      topResultIds: results.map(r => r.chunkId),
      topScores: results.map(r => r.score),
      durationMs,
      filters: { documentType, clientId, topK, minScore },
    });

    await this.updateQueryStats(agencyId, durationMs);

    return results;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (normA * normB);
  }

  async updateIndexStats(agencyId: string): Promise<void> {
    const stats = await db.select({
      totalDocs: sql<number>`count(distinct ${knowledgeDocuments.id})`,
      totalChunks: sql<number>`count(${documentEmbeddings.id})`,
      totalTokens: sql<number>`coalesce(sum(${documentEmbeddings.tokenCount}), 0)`,
    })
    .from(documentEmbeddings)
    .leftJoin(knowledgeDocuments, eq(documentEmbeddings.documentId, knowledgeDocuments.id))
    .where(eq(documentEmbeddings.agencyId, agencyId));

    const existingStats = await db.select()
      .from(embeddingIndexStats)
      .where(eq(embeddingIndexStats.agencyId, agencyId))
      .limit(1);

    if (existingStats.length > 0) {
      await db.update(embeddingIndexStats)
        .set({
          totalDocuments: stats[0]?.totalDocs || 0,
          totalChunks: stats[0]?.totalChunks || 0,
          totalTokens: stats[0]?.totalTokens || 0,
          updatedAt: new Date(),
        })
        .where(eq(embeddingIndexStats.agencyId, agencyId));
    } else {
      await db.insert(embeddingIndexStats).values({
        agencyId,
        totalDocuments: stats[0]?.totalDocs || 0,
        totalChunks: stats[0]?.totalChunks || 0,
        totalTokens: stats[0]?.totalTokens || 0,
      });
    }
  }

  private async updateQueryStats(agencyId: string, durationMs: number): Promise<void> {
    const existing = await db.select()
      .from(embeddingIndexStats)
      .where(eq(embeddingIndexStats.agencyId, agencyId))
      .limit(1);

    if (existing.length > 0) {
      const current = existing[0];
      const currentAvg = parseFloat(current.averageQueryTimeMs?.toString() || "0");
      const currentCount = current.queryCount || 0;
      const newAvg = ((currentAvg * currentCount) + durationMs) / (currentCount + 1);

      await db.update(embeddingIndexStats)
        .set({
          averageQueryTimeMs: newAvg.toFixed(2),
          queryCount: currentCount + 1,
          updatedAt: new Date(),
        })
        .where(eq(embeddingIndexStats.agencyId, agencyId));
    }
  }

  async rebuildIndex(agencyId: string, provider?: "openai" | "gemini"): Promise<{ documentsReindexed: number; totalChunks: number }> {
    const docs = await db.select()
      .from(knowledgeDocuments)
      .where(and(
        eq(knowledgeDocuments.agencyId, agencyId),
        eq(knowledgeDocuments.status, "indexed")
      ));

    let totalChunks = 0;

    for (const doc of docs) {
      if (doc.content) {
        const result = await this.indexDocument(doc.id, agencyId, doc.content, provider);
        totalChunks += result.chunkCount;
      }
    }

    await db.update(embeddingIndexStats)
      .set({ lastRebuildAt: new Date(), updatedAt: new Date() })
      .where(eq(embeddingIndexStats.agencyId, agencyId));

    return { documentsReindexed: docs.length, totalChunks };
  }

  async pruneOrphanedEmbeddings(agencyId: string): Promise<number> {
    const orphaned = await db.select({ id: documentEmbeddings.id })
      .from(documentEmbeddings)
      .leftJoin(knowledgeDocuments, eq(documentEmbeddings.documentId, knowledgeDocuments.id))
      .where(and(
        eq(documentEmbeddings.agencyId, agencyId),
        sql`${knowledgeDocuments.id} IS NULL`
      ));

    if (orphaned.length > 0) {
      const orphanIds = orphaned.map(o => o.id);
      for (const id of orphanIds) {
        await db.delete(documentEmbeddings).where(eq(documentEmbeddings.id, id));
      }
    }

    await db.update(embeddingIndexStats)
      .set({ lastPruneAt: new Date(), updatedAt: new Date() })
      .where(eq(embeddingIndexStats.agencyId, agencyId));

    await this.updateIndexStats(agencyId);

    return orphaned.length;
  }

  async getIndexStats(agencyId: string): Promise<EmbeddingIndexStats | null> {
    const stats = await db.select()
      .from(embeddingIndexStats)
      .where(eq(embeddingIndexStats.agencyId, agencyId))
      .limit(1);

    return stats[0] || null;
  }
}

export const embeddingService = new EmbeddingService();
