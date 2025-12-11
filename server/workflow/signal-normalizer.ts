import crypto from "crypto";
import type { InsertWorkflowSignal, SignalSource, SignalUrgency } from "@shared/schema";

export interface RawSignalPayload {
  source: string;
  type: string;
  data: Record<string, unknown>;
  clientId?: string;
  urgency?: string;
  timestamp?: string | Date;
  metadata?: Record<string, unknown>;
}

export interface NormalizedSignal {
  agencyId: string;
  source: SignalSource;
  type: string;
  payload: Record<string, unknown>;
  clientId?: string;
  urgency: SignalUrgency;
  dedupHash: string;
  status: "pending";
  processed: false;
  retryCount: number;
}

const VALID_SOURCES: SignalSource[] = ["ga4", "gsc", "hubspot", "linkedin", "internal", "webhook"];
const VALID_URGENCIES: SignalUrgency[] = ["low", "normal", "high", "critical"];

export class SignalNormalizer {
  private static canonicalizePayload(data: Record<string, unknown>): Record<string, unknown> {
    const sortedKeys = Object.keys(data).sort();
    const canonical: Record<string, unknown> = {};
    
    for (const key of sortedKeys) {
      const value = data[key];
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        canonical[key] = this.canonicalizePayload(value as Record<string, unknown>);
      } else if (Array.isArray(value)) {
        canonical[key] = value.map(item => 
          typeof item === "object" && item !== null 
            ? this.canonicalizePayload(item as Record<string, unknown>) 
            : item
        );
      } else {
        canonical[key] = value;
      }
    }
    
    return canonical;
  }

  static computeDedupHash(agencyId: string, source: string, type: string, payload: Record<string, unknown>): string {
    const canonicalPayload = this.canonicalizePayload(payload);
    const hashInput = JSON.stringify({
      agencyId,
      source,
      type,
      payload: canonicalPayload,
    });
    
    return crypto.createHash("sha256").update(hashInput).digest("hex");
  }

  static validateSource(source: string): source is SignalSource {
    return VALID_SOURCES.includes(source as SignalSource);
  }

  static validateUrgency(urgency: string): urgency is SignalUrgency {
    return VALID_URGENCIES.includes(urgency as SignalUrgency);
  }

  static normalize(agencyId: string, raw: RawSignalPayload): NormalizedSignal {
    const source = raw.source.toLowerCase();
    if (!this.validateSource(source)) {
      throw new Error(`Invalid signal source: ${raw.source}. Valid sources: ${VALID_SOURCES.join(", ")}`);
    }

    const urgency = (raw.urgency?.toLowerCase() || "normal");
    if (!this.validateUrgency(urgency)) {
      throw new Error(`Invalid urgency: ${raw.urgency}. Valid urgencies: ${VALID_URGENCIES.join(", ")}`);
    }

    const dedupHash = this.computeDedupHash(agencyId, source, raw.type, raw.data);

    const payload: Record<string, unknown> = {
      ...raw.data,
      _metadata: {
        ...(raw.timestamp ? { originalTimestamp: raw.timestamp } : {}),
        ingestedAt: new Date().toISOString(),
        ...(raw.metadata || {}),
      },
    };

    return {
      agencyId,
      source,
      type: raw.type,
      payload,
      clientId: raw.clientId || undefined,
      urgency,
      dedupHash,
      status: "pending",
      processed: false,
      retryCount: 0,
    };
  }

  static toInsertSignal(normalized: NormalizedSignal): InsertWorkflowSignal {
    return {
      agencyId: normalized.agencyId,
      source: normalized.source,
      type: normalized.type,
      payload: normalized.payload,
      clientId: normalized.clientId || null,
      urgency: normalized.urgency,
      dedupHash: normalized.dedupHash,
      status: normalized.status,
      processed: normalized.processed,
      retryCount: normalized.retryCount,
    };
  }
}

export const signalNormalizer = new SignalNormalizer();
