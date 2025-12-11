import { storage } from "../storage";
import type { ClientKnowledge, KnowledgeCategory } from "@shared/schema";

export interface RetrievalContext {
  agencyId: string;
  clientId?: string;
  projectId?: string;
  taskType?: string;
  categories?: string[];
  maxDocuments?: number;
  includeExpired?: boolean;
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  category: string;
  categoryType: string;
  freshness: number;
  confidence: number;
  relevanceScore: number;
  structuredData?: Record<string, unknown>;
  validUntil?: Date;
}

export interface AssembledContext {
  documents: KnowledgeDocument[];
  summary: string;
  totalDocuments: number;
  categoryCounts: Record<string, number>;
  freshnessScore: number;
}

const TASK_CATEGORY_MAPPING: Record<string, string[]> = {
  recommendation: ["brand_voice", "business_constraints", "preferences", "historical_decisions"],
  strategic: ["industry_context", "competitor_info", "business_constraints", "historical_decisions"],
  creative: ["brand_voice", "preferences"],
  operational: ["operational_notes", "business_constraints", "preferences"],
  analysis: ["industry_context", "competitor_info", "historical_decisions"],
  content: ["brand_voice", "preferences", "industry_context"],
  campaign: ["brand_voice", "business_constraints", "industry_context", "competitor_info"],
};

const FRESHNESS_DECAY_DAYS = 90;
const DEFAULT_MAX_DOCUMENTS = 20;

export class KnowledgeRetrievalService {
  
  async assembleContext(context: RetrievalContext): Promise<AssembledContext> {
    const categories = context.categories || this.getCategoriesForTask(context.taskType);
    const maxDocs = context.maxDocuments || DEFAULT_MAX_DOCUMENTS;

    const allKnowledge = await storage.getClientKnowledge(context.agencyId, {
      clientId: context.clientId,
      status: "active",
    });

    const categoryMap = await this.buildCategoryMap(context.agencyId);

    let relevantKnowledge = allKnowledge.filter(k => {
      const category = categoryMap.get(k.categoryId);
      if (!category) return false;
      
      if (categories.length > 0 && !categories.includes(category.categoryType || "")) {
        return false;
      }

      if (!context.includeExpired) {
        if (!k.isCurrentlyValid) return false;
        const now = new Date();
        if (k.validFrom && new Date(k.validFrom) > now) return false;
        if (k.validUntil && new Date(k.validUntil) < now) return false;
      }

      if (context.projectId && k.projectId && k.projectId !== context.projectId) {
        return false;
      }

      return true;
    });

    const scoredDocuments = relevantKnowledge.map(k => {
      const category = categoryMap.get(k.categoryId);
      const freshness = this.calculateFreshness(k.updatedAt);
      const confidence = parseFloat(k.confidenceScore || "1");
      const relevanceScore = this.calculateRelevance(k, context, freshness, confidence);

      return {
        id: k.id,
        title: k.title,
        content: k.content || this.formatStructuredData(k.structuredData as Record<string, unknown> | null),
        category: category?.name || "Unknown",
        categoryType: category?.categoryType || "unknown",
        freshness,
        confidence,
        relevanceScore,
        structuredData: k.structuredData as Record<string, unknown> | undefined,
        validUntil: k.validUntil || undefined,
      };
    });

    scoredDocuments.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const topDocuments = scoredDocuments.slice(0, maxDocs);

    const categoryCounts: Record<string, number> = {};
    for (const doc of topDocuments) {
      categoryCounts[doc.category] = (categoryCounts[doc.category] || 0) + 1;
    }

    const avgFreshness = topDocuments.length > 0
      ? topDocuments.reduce((sum, d) => sum + d.freshness, 0) / topDocuments.length
      : 0;

    const summary = this.generateContextSummary(topDocuments, categoryCounts);

    return {
      documents: topDocuments,
      summary,
      totalDocuments: topDocuments.length,
      categoryCounts,
      freshnessScore: avgFreshness,
    };
  }

  async getContextForPrompt(
    context: RetrievalContext
  ): Promise<string> {
    const assembled = await this.assembleContext(context);
    
    if (assembled.documents.length === 0) {
      return "";
    }

    let promptContext = `\n## Client Knowledge Context\n\n`;
    promptContext += `${assembled.summary}\n\n`;

    const groupedByCategory: Record<string, KnowledgeDocument[]> = {};
    for (const doc of assembled.documents) {
      const existing = groupedByCategory[doc.category] || [];
      existing.push(doc);
      groupedByCategory[doc.category] = existing;
    }

    for (const category of Object.keys(groupedByCategory)) {
      const docs = groupedByCategory[category];
      promptContext += `### ${category}\n`;
      for (const doc of docs) {
        promptContext += `- **${doc.title}**: ${doc.content.substring(0, 500)}${doc.content.length > 500 ? "..." : ""}\n`;
      }
      promptContext += "\n";
    }

    return promptContext;
  }

  async searchKnowledge(
    agencyId: string,
    query: string,
    options?: {
      clientId?: string;
      categoryId?: string;
      limit?: number;
    }
  ): Promise<ClientKnowledge[]> {
    const allKnowledge = await storage.getClientKnowledge(agencyId, {
      clientId: options?.clientId,
      categoryId: options?.categoryId,
      status: "active",
    });

    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

    const scored = allKnowledge.map(k => {
      let score = 0;
      const titleLower = k.title.toLowerCase();
      const contentLower = (k.content || "").toLowerCase();

      if (titleLower.includes(queryLower)) {
        score += 10;
      }
      if (contentLower.includes(queryLower)) {
        score += 5;
      }

      for (const word of queryWords) {
        if (titleLower.includes(word)) score += 3;
        if (contentLower.includes(word)) score += 1;
      }

      return { knowledge: k, score };
    });

    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, options?.limit || 10)
      .map(s => s.knowledge);
  }

  async updateUsage(knowledgeId: string, usedInContext: string): Promise<void> {
    const existing = await storage.getClientKnowledgeById(knowledgeId);
    if (existing) {
      await storage.updateClientKnowledge(knowledgeId, {
        usageCount: (existing.usageCount || 0) + 1,
        lastUsedAt: new Date(),
        lastUsedInContext: usedInContext,
      });
    }
  }

  private getCategoriesForTask(taskType?: string): string[] {
    if (!taskType) return [];
    return TASK_CATEGORY_MAPPING[taskType] || [];
  }

  private async buildCategoryMap(agencyId: string): Promise<Map<string, KnowledgeCategory>> {
    const categories = await storage.getKnowledgeCategoriesByAgencyId(agencyId);
    return new Map(categories.map(c => [c.id, c]));
  }

  private calculateFreshness(updatedAt: Date): number {
    const now = new Date();
    const daysSinceUpdate = (now.getTime() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceUpdate <= 0) return 1;
    if (daysSinceUpdate >= FRESHNESS_DECAY_DAYS) return 0.1;
    
    return 1 - (daysSinceUpdate / FRESHNESS_DECAY_DAYS) * 0.9;
  }

  private calculateRelevance(
    knowledge: ClientKnowledge,
    context: RetrievalContext,
    freshness: number,
    confidence: number
  ): number {
    let score = 0;

    score += freshness * 0.3;
    score += confidence * 0.3;

    if (context.clientId && knowledge.clientId === context.clientId) {
      score += 0.2;
    }

    if (context.projectId && knowledge.projectId === context.projectId) {
      score += 0.2;
    }

    if (!knowledge.clientId && !knowledge.projectId) {
      score += 0.1;
    }

    return score;
  }

  private formatStructuredData(data: Record<string, unknown> | null): string {
    if (!data) return "";
    
    const parts: string[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        parts.push(`${key}: ${value}`);
      } else if (Array.isArray(value)) {
        parts.push(`${key}: ${value.join(", ")}`);
      }
    }
    
    return parts.join("; ");
  }

  private generateContextSummary(
    documents: KnowledgeDocument[],
    categoryCounts: Record<string, number>
  ): string {
    if (documents.length === 0) {
      return "No relevant knowledge documents found.";
    }

    const categoryList = Object.entries(categoryCounts)
      .map(([cat, count]) => `${cat} (${count})`)
      .join(", ");

    const avgFreshness = documents.reduce((sum, d) => sum + d.freshness, 0) / documents.length;
    const freshnessLabel = avgFreshness > 0.7 ? "fresh" : avgFreshness > 0.4 ? "moderately current" : "potentially outdated";

    return `Found ${documents.length} relevant knowledge documents across categories: ${categoryList}. Overall content is ${freshnessLabel}.`;
  }
}

export const knowledgeRetrievalService = new KnowledgeRetrievalService();
