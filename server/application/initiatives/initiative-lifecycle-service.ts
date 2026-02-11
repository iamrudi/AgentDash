import type { IStorage } from "../../storage";
import type { RequestContext } from "../../middleware/request-context";
import { InvoiceGeneratorService } from "../../services/invoiceGenerator";

export interface InitiativeLifecycleResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export class InitiativeLifecycleService {
  constructor(private storage: IStorage) {}

  async generateInvoice(
    ctx: RequestContext,
    initiativeId: string
  ): Promise<InitiativeLifecycleResult<{ invoiceId: string; message: string }>> {
    try {
      const invoiceGenerator = new InvoiceGeneratorService(this.storage);
      const invoiceId = await invoiceGenerator.generateInvoiceFromInitiative(initiativeId);

      if (this.storage.createAuditLog) {
        try {
          await this.storage.createAuditLog({
            userId: ctx.userId,
            action: "initiative.generate_invoice",
            resourceType: "initiative",
            resourceId: initiativeId,
            details: { invoiceId },
            ipAddress: ctx.ip,
            userAgent: ctx.userAgent,
          });
        } catch {
          // non-blocking audit
        }
      }

      return { ok: true, status: 201, data: { invoiceId, message: "Invoice generated successfully" } };
    } catch (error: any) {
      return { ok: false, status: 500, error: error.message || "Failed to generate invoice" };
    }
  }

  async softDeleteInitiative(
    ctx: RequestContext,
    initiativeId: string
  ): Promise<InitiativeLifecycleResult<{ message: string; initiative: unknown }>> {
    try {
      const initiative = await this.storage.softDeleteInitiative(initiativeId);
      if (this.storage.createAuditLog) {
        try {
          await this.storage.createAuditLog({
            userId: ctx.userId,
            action: "initiative.soft_delete",
            resourceType: "initiative",
            resourceId: initiativeId,
            details: {},
            ipAddress: ctx.ip,
            userAgent: ctx.userAgent,
          });
        } catch {
          // non-blocking audit
        }
      }
      return { ok: true, status: 200, data: { message: "Initiative moved to trash", initiative } };
    } catch (error: any) {
      return { ok: false, status: 500, error: error.message };
    }
  }

  async restoreInitiative(
    ctx: RequestContext,
    initiativeId: string
  ): Promise<InitiativeLifecycleResult<{ message: string; initiative: unknown }>> {
    try {
      const initiative = await this.storage.restoreInitiative(initiativeId);
      if (this.storage.createAuditLog) {
        try {
          await this.storage.createAuditLog({
            userId: ctx.userId,
            action: "initiative.restore",
            resourceType: "initiative",
            resourceId: initiativeId,
            details: {},
            ipAddress: ctx.ip,
            userAgent: ctx.userAgent,
          });
        } catch {
          // non-blocking audit
        }
      }
      return { ok: true, status: 200, data: { message: "Initiative restored", initiative } };
    } catch (error: any) {
      return { ok: false, status: 500, error: error.message };
    }
  }

  async getDeletedInitiatives(): Promise<InitiativeLifecycleResult<unknown>> {
    try {
      const deletedInitiatives = await this.storage.getDeletedInitiatives();
      return { ok: true, status: 200, data: deletedInitiatives };
    } catch (error: any) {
      return { ok: false, status: 500, error: error.message };
    }
  }

  async permanentlyDeleteInitiative(
    ctx: RequestContext,
    initiativeId: string
  ): Promise<InitiativeLifecycleResult<{ message: string }>> {
    try {
      await this.storage.permanentlyDeleteInitiative(initiativeId);
      if (this.storage.createAuditLog) {
        try {
          await this.storage.createAuditLog({
            userId: ctx.userId,
            action: "initiative.permanent_delete",
            resourceType: "initiative",
            resourceId: initiativeId,
            details: {},
            ipAddress: ctx.ip,
            userAgent: ctx.userAgent,
          });
        } catch {
          // non-blocking audit
        }
      }
      return { ok: true, status: 200, data: { message: "Initiative permanently deleted" } };
    } catch (error: any) {
      return { ok: false, status: 500, error: error.message };
    }
  }
}
