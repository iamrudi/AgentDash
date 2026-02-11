import type { IStorage } from "../../storage";
import type { RequestContext } from "../../middleware/request-context";

export interface InitiativeSendResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export class InitiativeSendService {
  constructor(private storage: IStorage) {}

  async sendInitiative(
    ctx: RequestContext,
    initiativeId: string
  ): Promise<InitiativeSendResult<unknown>> {
    const initiative = await this.storage.sendInitiativeToClient(initiativeId);

    // Create notification for client about new initiative (non-blocking).
    try {
      const client = await this.storage.getClientById(initiative.clientId);
      if (client) {
        const clientProfile = await this.storage.getProfileById(client.profileId);
        if (clientProfile) {
          await this.storage.createNotification({
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

    if (this.storage.createAuditLog) {
      try {
        await this.storage.createAuditLog({
          userId: ctx.userId,
          action: "initiative.send",
          resourceType: "initiative",
          resourceId: initiativeId,
          details: { clientId: initiative.clientId },
          ipAddress: ctx.ip,
          userAgent: ctx.userAgent,
        });
      } catch {
        // non-blocking audit
      }
    }

    return { ok: true, status: 200, data: initiative };
  }
}
