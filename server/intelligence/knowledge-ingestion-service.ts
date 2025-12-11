import { storage } from "../storage";
import type {
  InsertClientKnowledge,
  InsertKnowledgeIngestionLog,
  ClientKnowledge,
  KnowledgeCategory,
  KnowledgeIngestionLog,
} from "@shared/schema";

export interface KnowledgeIngestionRequest {
  agencyId: string;
  categoryId: string;
  title: string;
  content?: string;
  structuredData?: Record<string, unknown>;
  clientId?: string;
  projectId?: string;
  source?: string;
  sourceUrl?: string;
  sourceDocumentId?: string;
  validFrom?: Date;
  validUntil?: Date;
  confidenceScore?: number;
  createdBy?: string;
}

export interface IngestionResult {
  success: boolean;
  knowledge?: ClientKnowledge;
  ingestionLog: KnowledgeIngestionLog;
  conflicts?: ConflictInfo[];
  validationErrors?: string[];
}

export interface ConflictInfo {
  existingKnowledgeId: string;
  existingTitle: string;
  conflictType: "duplicate_title" | "overlapping_content" | "contradictory";
  severity: "low" | "medium" | "high";
  resolution?: "supersede" | "merge" | "ignore";
}

export interface CategoryValidationSchema {
  requiredFields?: string[];
  optionalFields?: string[];
  fieldValidations?: Record<string, FieldValidation>;
}

export interface FieldValidation {
  type: "string" | "number" | "boolean" | "array" | "url" | "date";
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  enum?: string[];
}

const DEFAULT_CATEGORY_SCHEMAS: Record<string, CategoryValidationSchema> = {
  brand_voice: {
    requiredFields: ["tone", "style"],
    optionalFields: ["examples", "doNotUse", "keywords"],
    fieldValidations: {
      tone: { type: "string", minLength: 3 },
      style: { type: "string", minLength: 3 },
    },
  },
  business_constraints: {
    requiredFields: ["constraint"],
    optionalFields: ["reason", "exceptions", "priority"],
    fieldValidations: {
      constraint: { type: "string", minLength: 5 },
      priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
    },
  },
  industry_context: {
    requiredFields: ["industry", "context"],
    optionalFields: ["marketSize", "trends", "keyPlayers"],
    fieldValidations: {
      industry: { type: "string", minLength: 2 },
    },
  },
  competitor_info: {
    requiredFields: ["competitorName"],
    optionalFields: ["website", "strengths", "weaknesses", "positioning", "notes"],
    fieldValidations: {
      competitorName: { type: "string", minLength: 2 },
      website: { type: "url" },
    },
  },
  historical_decisions: {
    requiredFields: ["decision", "decisionDate"],
    optionalFields: ["rationale", "outcome", "reversible"],
    fieldValidations: {
      decision: { type: "string", minLength: 10 },
      decisionDate: { type: "date" },
    },
  },
  operational_notes: {
    requiredFields: ["note"],
    optionalFields: ["category", "priority", "expiresAt"],
    fieldValidations: {
      note: { type: "string", minLength: 5 },
    },
  },
  preferences: {
    requiredFields: ["preference"],
    optionalFields: ["reason", "context", "weight"],
    fieldValidations: {
      preference: { type: "string", minLength: 3 },
    },
  },
};

export class KnowledgeIngestionService {
  
  async ingest(request: KnowledgeIngestionRequest): Promise<IngestionResult> {
    const validationErrors = await this.validateRequest(request);
    if (validationErrors.length > 0) {
      return {
        success: false,
        ingestionLog: await this.logIngestion(request, "created", "failed", validationErrors.join("; ")),
        validationErrors,
      };
    }

    const conflicts = await this.detectConflicts(request);
    
    const knowledgeData: InsertClientKnowledge = {
      agencyId: request.agencyId,
      categoryId: request.categoryId,
      title: request.title,
      content: request.content,
      structuredData: request.structuredData,
      clientId: request.clientId,
      projectId: request.projectId,
      source: request.source || "manual",
      sourceUrl: request.sourceUrl,
      sourceDocumentId: request.sourceDocumentId,
      validFrom: request.validFrom || new Date(),
      validUntil: request.validUntil,
      isCurrentlyValid: true,
      confidenceScore: request.confidenceScore?.toString() || "1",
      version: 1,
      status: "active",
      createdBy: request.createdBy,
    };

    const knowledge = await storage.createClientKnowledge(knowledgeData);
    
    const ingestionLog = await this.logIngestion(
      request,
      "created",
      "success",
      undefined,
      knowledge.id,
      conflicts.length > 0 ? conflicts : undefined
    );

    return {
      success: true,
      knowledge,
      ingestionLog,
      conflicts: conflicts.length > 0 ? conflicts : undefined,
    };
  }

  async update(
    knowledgeId: string,
    updates: Partial<KnowledgeIngestionRequest>,
    performedBy?: string
  ): Promise<IngestionResult> {
    const existing = await storage.getClientKnowledgeById(knowledgeId);
    if (!existing) {
      return {
        success: false,
        ingestionLog: await this.logIngestion(
          { agencyId: updates.agencyId || "", categoryId: updates.categoryId || "", title: updates.title || "" },
          "updated",
          "failed",
          "Knowledge entry not found"
        ),
        validationErrors: ["Knowledge entry not found"],
      };
    }

    const updatedKnowledge = await storage.updateClientKnowledge(knowledgeId, {
      title: updates.title,
      content: updates.content,
      structuredData: updates.structuredData,
      validFrom: updates.validFrom,
      validUntil: updates.validUntil,
      confidenceScore: updates.confidenceScore?.toString(),
      version: (existing.version || 1) + 1,
      previousVersionId: existing.id,
    });

    if (!updatedKnowledge) {
      return {
        success: false,
        ingestionLog: await this.logIngestion(
          { agencyId: existing.agencyId, categoryId: existing.categoryId, title: updates.title || existing.title },
          "updated",
          "failed",
          "Failed to update knowledge entry"
        ),
        validationErrors: ["Failed to update knowledge entry"],
      };
    }

    const ingestionLog = await this.logIngestion(
      { agencyId: existing.agencyId, categoryId: existing.categoryId, title: updatedKnowledge.title },
      "updated",
      "success",
      undefined,
      knowledgeId
    );

    return {
      success: true,
      knowledge: updatedKnowledge,
      ingestionLog,
    };
  }

  async archive(knowledgeId: string, performedBy?: string): Promise<IngestionResult> {
    const existing = await storage.getClientKnowledgeById(knowledgeId);
    if (!existing) {
      return {
        success: false,
        ingestionLog: await this.logIngestion(
          { agencyId: "", categoryId: "", title: "" },
          "archived",
          "failed",
          "Knowledge entry not found"
        ),
        validationErrors: ["Knowledge entry not found"],
      };
    }

    const updatedKnowledge = await storage.updateClientKnowledge(knowledgeId, {
      status: "archived",
      isCurrentlyValid: false,
    });

    const ingestionLog = await this.logIngestion(
      { agencyId: existing.agencyId, categoryId: existing.categoryId, title: existing.title },
      "archived",
      "success",
      undefined,
      knowledgeId
    );

    return {
      success: true,
      knowledge: updatedKnowledge || undefined,
      ingestionLog,
    };
  }

  async supersede(
    knowledgeId: string,
    newRequest: KnowledgeIngestionRequest
  ): Promise<IngestionResult> {
    const existing = await storage.getClientKnowledgeById(knowledgeId);
    if (!existing) {
      return {
        success: false,
        ingestionLog: await this.logIngestion(newRequest, "superseded", "failed", "Original knowledge entry not found"),
        validationErrors: ["Original knowledge entry not found"],
      };
    }

    await storage.updateClientKnowledge(knowledgeId, {
      status: "superseded",
      isCurrentlyValid: false,
    });

    newRequest.source = newRequest.source || "supersede";
    const newResult = await this.ingest(newRequest);

    if (newResult.success && newResult.knowledge) {
      await storage.updateClientKnowledge(newResult.knowledge.id, {
        previousVersionId: knowledgeId,
        version: (existing.version || 1) + 1,
      });
    }

    await this.logIngestion(
      { agencyId: existing.agencyId, categoryId: existing.categoryId, title: existing.title },
      "superseded",
      "success",
      undefined,
      knowledgeId
    );

    return newResult;
  }

  private async validateRequest(request: KnowledgeIngestionRequest): Promise<string[]> {
    const errors: string[] = [];

    if (!request.agencyId) {
      errors.push("Agency ID is required");
    }

    if (!request.categoryId) {
      errors.push("Category ID is required");
    }

    if (!request.title || request.title.trim().length < 3) {
      errors.push("Title must be at least 3 characters");
    }

    if (!request.content && !request.structuredData) {
      errors.push("Either content or structured data is required");
    }

    const category = await storage.getKnowledgeCategoryById(request.categoryId);
    if (!category) {
      errors.push("Invalid category ID");
      return errors;
    }

    if (request.structuredData && category.categoryType) {
      const schemaErrors = this.validateAgainstSchema(
        request.structuredData,
        category.categoryType
      );
      errors.push(...schemaErrors);
    }

    return errors;
  }

  private validateAgainstSchema(
    data: Record<string, unknown>,
    categoryType: string
  ): string[] {
    const errors: string[] = [];
    const schema = DEFAULT_CATEGORY_SCHEMAS[categoryType];
    
    if (!schema) {
      return errors;
    }

    if (schema.requiredFields) {
      for (const field of schema.requiredFields) {
        if (!(field in data) || data[field] === undefined || data[field] === null || data[field] === "") {
          errors.push(`Required field '${field}' is missing for category type '${categoryType}'`);
        }
      }
    }

    if (schema.fieldValidations) {
      for (const [field, validation] of Object.entries(schema.fieldValidations)) {
        if (field in data && data[field] !== undefined) {
          const value = data[field];
          
          if (validation.type === "string" && typeof value !== "string") {
            errors.push(`Field '${field}' must be a string`);
          } else if (validation.type === "string" && typeof value === "string") {
            if (validation.minLength && value.length < validation.minLength) {
              errors.push(`Field '${field}' must be at least ${validation.minLength} characters`);
            }
            if (validation.maxLength && value.length > validation.maxLength) {
              errors.push(`Field '${field}' must be at most ${validation.maxLength} characters`);
            }
            if (validation.enum && !validation.enum.includes(value)) {
              errors.push(`Field '${field}' must be one of: ${validation.enum.join(", ")}`);
            }
          }
          
          if (validation.type === "number" && typeof value !== "number") {
            errors.push(`Field '${field}' must be a number`);
          }
          
          if (validation.type === "boolean" && typeof value !== "boolean") {
            errors.push(`Field '${field}' must be a boolean`);
          }
          
          if (validation.type === "url" && typeof value === "string") {
            try {
              new URL(value);
            } catch {
              errors.push(`Field '${field}' must be a valid URL`);
            }
          }
        }
      }
    }

    return errors;
  }

  private async detectConflicts(request: KnowledgeIngestionRequest): Promise<ConflictInfo[]> {
    const conflicts: ConflictInfo[] = [];

    const existingKnowledge = await storage.getClientKnowledge(request.agencyId, {
      clientId: request.clientId,
      categoryId: request.categoryId,
      status: "active",
    });

    for (const existing of existingKnowledge) {
      if (existing.title.toLowerCase() === request.title.toLowerCase()) {
        conflicts.push({
          existingKnowledgeId: existing.id,
          existingTitle: existing.title,
          conflictType: "duplicate_title",
          severity: "high",
        });
      }

      if (request.content && existing.content) {
        const similarity = this.calculateSimilarity(request.content, existing.content);
        if (similarity > 0.7) {
          conflicts.push({
            existingKnowledgeId: existing.id,
            existingTitle: existing.title,
            conflictType: "overlapping_content",
            severity: similarity > 0.9 ? "high" : "medium",
          });
        }
      }
    }

    return conflicts;
  }

  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    const words1Set = new Set(words1);
    const words2Set = new Set(words2);
    
    let intersectionCount = 0;
    words1.forEach(w => {
      if (words2Set.has(w)) intersectionCount++;
    });
    
    const unionCount = words1Set.size + words2Set.size - intersectionCount;
    
    if (unionCount === 0) return 0;
    return intersectionCount / unionCount;
  }

  private async logIngestion(
    request: Partial<KnowledgeIngestionRequest>,
    action: string,
    validationStatus: string,
    validationErrors?: string,
    knowledgeId?: string,
    conflicts?: ConflictInfo[]
  ): Promise<KnowledgeIngestionLog> {
    const logData: InsertKnowledgeIngestionLog = {
      agencyId: request.agencyId || "",
      knowledgeId,
      action,
      sourceType: request.source || "manual",
      newData: {
        title: request.title,
        sourceUrl: request.sourceUrl,
        sourceDocumentId: request.sourceDocumentId,
      },
      validationStatus,
      validationErrors: validationErrors ? [validationErrors] : undefined,
      conflictDetected: conflicts ? conflicts.length > 0 : false,
      conflictDetails: conflicts ? conflicts.map(c => ({
        existingId: c.existingKnowledgeId,
        type: c.conflictType,
        severity: c.severity,
      })) : undefined,
      performedBy: request.createdBy,
      performedAt: new Date(),
    };

    return await storage.createKnowledgeIngestionLog(logData);
  }

  async getKnowledge(
    agencyId: string,
    options?: {
      clientId?: string;
      categoryId?: string;
      status?: string;
      validOnly?: boolean;
    }
  ): Promise<ClientKnowledge[]> {
    const knowledge = await storage.getClientKnowledge(agencyId, {
      clientId: options?.clientId,
      categoryId: options?.categoryId,
      status: options?.status || "active",
    });

    if (options?.validOnly) {
      const now = new Date();
      return knowledge.filter(k => {
        if (!k.isCurrentlyValid) return false;
        if (k.validFrom && new Date(k.validFrom) > now) return false;
        if (k.validUntil && new Date(k.validUntil) < now) return false;
        return true;
      });
    }

    return knowledge;
  }

  async getCategories(agencyId: string): Promise<KnowledgeCategory[]> {
    return await storage.getKnowledgeCategoriesByAgencyId(agencyId);
  }

  async getIngestionHistory(
    agencyId: string,
    knowledgeId?: string
  ): Promise<KnowledgeIngestionLog[]> {
    return await storage.getKnowledgeIngestionLogs(agencyId, knowledgeId);
  }

  async initializeDefaultCategories(agencyId: string): Promise<KnowledgeCategory[]> {
    const existingCategories = await storage.getKnowledgeCategoriesByAgencyId(agencyId);
    if (existingCategories.length > 0) {
      return existingCategories;
    }

    const defaultCategories = [
      { name: "brand_voice", displayName: "Brand Voice & Messaging", categoryType: "brand_voice", description: "Tone, style, and messaging guidelines for the brand" },
      { name: "business_constraints", displayName: "Business Constraints", categoryType: "business_constraints", description: "Limitations, rules, and non-negotiable requirements" },
      { name: "industry_context", displayName: "Industry Context", categoryType: "industry_context", description: "Market insights, trends, and industry information" },
      { name: "competitor_info", displayName: "Competitor Information", categoryType: "competitor_info", description: "Details about competitors and market positioning" },
      { name: "historical_decisions", displayName: "Historical Decisions", categoryType: "historical_decisions", description: "Past decisions and their rationale" },
      { name: "operational_notes", displayName: "Operational Notes", categoryType: "operational_notes", description: "Day-to-day operational information and notes" },
      { name: "preferences", displayName: "Preferences", categoryType: "preferences", description: "Client preferences and requirements" },
    ];

    const created: KnowledgeCategory[] = [];
    for (const cat of defaultCategories) {
      const category = await storage.createKnowledgeCategory({
        agencyId,
        name: cat.name,
        displayName: cat.displayName,
        categoryType: cat.categoryType,
        description: cat.description,
        schemaDefinition: DEFAULT_CATEGORY_SCHEMAS[cat.categoryType] || {},
        isActive: true,
        isSystemCategory: true,
      });
      created.push(category);
    }

    return created;
  }
}

export const knowledgeIngestionService = new KnowledgeIngestionService();
