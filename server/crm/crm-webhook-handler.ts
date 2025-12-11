import { createHash, createHmac } from "crypto";
import { db } from "../db";
import { agencySettings, workflowSignals } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { SignalRouter } from "../workflow/signal-router";

export type CRMEventType = 
  | 'deal.created'
  | 'deal.updated'
  | 'deal.deleted'
  | 'deal.propertyChange'
  | 'contact.created'
  | 'contact.updated'
  | 'contact.deleted'
  | 'contact.propertyChange'
  | 'company.created'
  | 'company.updated'
  | 'company.deleted'
  | 'company.propertyChange'
  | 'meeting.created'
  | 'meeting.updated'
  | 'meeting.deleted'
  | 'form.submitted';

export interface CRMWebhookPayload {
  subscriptionId?: number;
  portalId: number;
  appId?: number;
  occurredAt: number;
  eventType: string;
  objectId: number;
  propertyName?: string;
  propertyValue?: string;
  changeSource?: string;
  subscriptionType?: string;
}

export interface NormalizedCRMEvent {
  source: 'hubspot';
  type: CRMEventType;
  objectType: 'deal' | 'contact' | 'company' | 'meeting' | 'form';
  objectId: string;
  portalId: string;
  occurredAt: Date;
  propertyName?: string;
  propertyValue?: string;
  previousValue?: string;
  changeSource?: string;
  rawPayload: Record<string, unknown>;
}

export interface CRMSignalPayload {
  objectType: string;
  objectId: string;
  eventType: CRMEventType;
  portalId: string;
  propertyName?: string;
  propertyValue?: string;
  previousValue?: string;
  changeSource?: string;
  occurredAt: string;
}

export class CRMWebhookHandler {
  /**
   * Verify HubSpot webhook signature using v3 spec.
   * HubSpot v3 signature: HMAC-SHA256(clientSecret, requestMethod + requestUri + requestBody + timestamp)
   * The signature is provided in X-HubSpot-Signature-v3 header.
   * Uses constant-time comparison to prevent timing attacks.
   * 
   * For v2 fallback (older webhook configs):
   * SHA-256(clientSecret + requestBody)
   */
  async verifyHubSpotSignatureV3(
    requestMethod: string,
    requestUri: string,
    requestBody: string,
    signature: string,
    clientSecret: string,
    timestamp: string
  ): Promise<boolean> {
    if (!signature || !clientSecret || !timestamp) {
      return false;
    }

    // Check timestamp is within 5 minutes (300 seconds) to prevent replay attacks
    const requestTimestamp = parseInt(timestamp, 10);
    const currentTimestamp = Math.floor(Date.now() / 1000);
    if (Math.abs(currentTimestamp - requestTimestamp) > 300) {
      console.warn('[CRM_WEBHOOK] Signature timestamp expired');
      return false;
    }

    // HubSpot v3 signature: HMAC-SHA256(clientSecret, requestMethod + requestUri + requestBody + timestamp)
    const sourceString = requestMethod + requestUri + requestBody + timestamp;
    const expectedHash = createHmac('sha256', clientSecret)
      .update(sourceString)
      .digest('base64');
    
    return this.constantTimeCompare(signature, expectedHash);
  }

  /**
   * Verify HubSpot webhook signature using v2 spec (fallback).
   * SHA-256(clientSecret + requestBody)
   */
  async verifyHubSpotSignatureV2(
    requestBody: string,
    signature: string,
    clientSecret: string
  ): Promise<boolean> {
    if (!signature || !clientSecret) {
      return false;
    }

    const sourceString = clientSecret + requestBody;
    const expectedHash = createHash('sha256')
      .update(sourceString)
      .digest('hex');
    
    return this.constantTimeCompare(signature, expectedHash);
  }

  /**
   * Constant-time string comparison to prevent timing attacks.
   */
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    
    return result === 0;
  }

  /**
   * Legacy method for backward compatibility.
   * Prefers v3 verification, falls back to v2.
   */
  async verifyHubSpotSignature(
    requestBody: string,
    signature: string,
    clientSecret: string
  ): Promise<boolean> {
    return this.verifyHubSpotSignatureV2(requestBody, signature, clientSecret);
  }

  async findAgencyByPortalId(portalId: string): Promise<string | null> {
    const settings = await db
      .select({ agencyId: agencySettings.agencyId })
      .from(agencySettings)
      .where(eq(agencySettings.hubspotPortalId, portalId))
      .limit(1);

    return settings.length > 0 ? settings[0].agencyId : null;
  }

  normalizeHubSpotEvent(payload: CRMWebhookPayload): NormalizedCRMEvent {
    const subscriptionType = payload.subscriptionType || payload.eventType || '';
    const [objectType, action] = this.parseSubscriptionType(subscriptionType);
    
    const eventType = this.mapToEventType(objectType, action, payload.propertyName);

    return {
      source: 'hubspot',
      type: eventType,
      objectType: objectType as NormalizedCRMEvent['objectType'],
      objectId: String(payload.objectId),
      portalId: String(payload.portalId),
      occurredAt: new Date(payload.occurredAt),
      propertyName: payload.propertyName,
      propertyValue: payload.propertyValue,
      changeSource: payload.changeSource,
      rawPayload: payload as unknown as Record<string, unknown>,
    };
  }

  private parseSubscriptionType(subscriptionType: string): [string, string] {
    const parts = subscriptionType.toLowerCase().split('.');
    if (parts.length >= 2) {
      return [parts[0], parts[1]];
    }
    return ['unknown', 'unknown'];
  }

  private mapToEventType(
    objectType: string,
    action: string,
    propertyName?: string
  ): CRMEventType {
    const typeMap: Record<string, Record<string, CRMEventType>> = {
      deal: {
        created: 'deal.created',
        updated: 'deal.updated',
        deleted: 'deal.deleted',
        propertychange: 'deal.propertyChange',
      },
      contact: {
        created: 'contact.created',
        updated: 'contact.updated',
        deleted: 'contact.deleted',
        propertychange: 'contact.propertyChange',
      },
      company: {
        created: 'company.created',
        updated: 'company.updated',
        deleted: 'company.deleted',
        propertychange: 'company.propertyChange',
      },
      meeting: {
        created: 'meeting.created',
        updated: 'meeting.updated',
        deleted: 'meeting.deleted',
      },
      // HubSpot form submissions come as 'forms.submission'
      forms: {
        submission: 'form.submitted',
      },
      form: {
        submitted: 'form.submitted',
        submission: 'form.submitted',
      },
    };

    return typeMap[objectType]?.[action] || 'deal.updated';
  }

  async createSignalFromCRMEvent(
    agencyId: string,
    event: NormalizedCRMEvent
  ): Promise<{ signalId: string; isDuplicate: boolean }> {
    const signalPayload: CRMSignalPayload = {
      objectType: event.objectType,
      objectId: event.objectId,
      eventType: event.type,
      portalId: event.portalId,
      propertyName: event.propertyName,
      propertyValue: event.propertyValue,
      previousValue: event.previousValue,
      changeSource: event.changeSource,
      occurredAt: event.occurredAt.toISOString(),
    };

    const canonicalPayload = JSON.stringify(signalPayload, Object.keys(signalPayload).sort());
    const dedupHash = createHash('sha256')
      .update(`${agencyId}:hubspot:${event.type}:${canonicalPayload}`)
      .digest('hex');

    const existing = await db
      .select({ id: workflowSignals.id })
      .from(workflowSignals)
      .where(
        and(
          eq(workflowSignals.agencyId, agencyId),
          eq(workflowSignals.dedupHash, dedupHash)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return { signalId: existing[0].id, isDuplicate: true };
    }

    const urgency = this.determineUrgency(event);
    const signalType = this.mapEventToSignalType(event.type);

    const [signal] = await db
      .insert(workflowSignals)
      .values({
        agencyId,
        source: 'hubspot',
        type: signalType,
        payload: signalPayload,
        urgency,
        dedupHash,
        status: 'pending',
        retryCount: 0,
      })
      .returning();

    return { signalId: signal.id, isDuplicate: false };
  }

  private determineUrgency(event: NormalizedCRMEvent): 'low' | 'normal' | 'high' | 'critical' {
    if (event.type === 'deal.propertyChange' && event.propertyName === 'dealstage') {
      return 'high';
    }
    if (event.type.includes('created')) {
      return 'normal';
    }
    if (event.type.includes('deleted')) {
      return 'high';
    }
    return 'normal';
  }

  private mapEventToSignalType(eventType: CRMEventType): string {
    const typeMapping: Record<CRMEventType, string> = {
      'deal.created': 'deal_created',
      'deal.updated': 'deal_updated',
      'deal.deleted': 'deal_deleted',
      'deal.propertyChange': 'deal_stage_changed',
      'contact.created': 'contact_created',
      'contact.updated': 'contact_updated',
      'contact.deleted': 'contact_deleted',
      'contact.propertyChange': 'contact_property_changed',
      'company.created': 'company_created',
      'company.updated': 'company_updated',
      'company.deleted': 'company_deleted',
      'company.propertyChange': 'company_property_changed',
      'meeting.created': 'meeting_scheduled',
      'meeting.updated': 'meeting_updated',
      'meeting.deleted': 'meeting_deleted',
      'form.submitted': 'form_submission',
    };
    return typeMapping[eventType] || 'crm_event';
  }

  async processWebhookBatch(
    payloads: CRMWebhookPayload[]
  ): Promise<{ processed: number; duplicates: number; errors: string[]; workflowsTriggered: number }> {
    let processed = 0;
    let duplicates = 0;
    let workflowsTriggered = 0;
    const errors: string[] = [];
    const signalRouter = new SignalRouter();

    for (const payload of payloads) {
      try {
        const agencyId = await this.findAgencyByPortalId(String(payload.portalId));
        if (!agencyId) {
          errors.push(`No agency found for portal ID ${payload.portalId}`);
          continue;
        }

        const result = await signalRouter.ingestSignal(
          agencyId,
          'hubspot',
          payload as unknown as Record<string, unknown>
        );

        if (result.isDuplicate) {
          duplicates++;
        } else {
          processed++;
          workflowsTriggered += result.workflowsTriggered.length;
        }
      } catch (error: any) {
        errors.push(`Error processing event: ${error.message}`);
      }
    }

    return { processed, duplicates, errors, workflowsTriggered };
  }

  async processAndRouteCRMEvent(
    agencyId: string,
    event: NormalizedCRMEvent
  ): Promise<{ signalId: string; isDuplicate: boolean; workflowsTriggered: string[] }> {
    const signalRouter = new SignalRouter();
    
    const result = await signalRouter.ingestSignal(
      agencyId,
      'hubspot',
      event.rawPayload
    );

    return {
      signalId: result.signal.id,
      isDuplicate: result.isDuplicate,
      workflowsTriggered: result.workflowsTriggered,
    };
  }
}

export const crmWebhookHandler = new CRMWebhookHandler();
