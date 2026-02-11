import type { IStorage } from "../../storage";

interface MessageLogger {
  error: (message: string, details: Record<string, unknown>) => void;
}

export interface ClientMessageResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export class ClientMessageService {
  constructor(private readonly storage: IStorage, private readonly logger: MessageLogger) {}

  async createMessage(
    userId: string,
    payload: {
      subject?: unknown;
      content?: unknown;
      projectId?: unknown;
      priority?: unknown;
    }
  ): Promise<ClientMessageResult<unknown>> {
    const profile = await this.storage.getProfileByUserId(userId);
    const client = profile ? await this.storage.getClientByProfileId(profile.id) : undefined;
    if (!client) {
      return { ok: false, status: 404, error: "Client record not found" };
    }

    const subject = typeof payload.subject === "string" ? payload.subject : "";
    const content = typeof payload.content === "string" ? payload.content : "";
    if (!subject || !content) {
      return { ok: false, status: 400, error: "Subject and content are required" };
    }

    const projectId = typeof payload.projectId === "string" ? payload.projectId : null;
    const priority = typeof payload.priority === "string" && payload.priority ? payload.priority : "Normal";

    const newMessage = await this.storage.createMessage({
      clientId: client.id,
      senderProfileId: profile!.id,
      subject,
      content,
      projectId,
      priority,
    } as any);

    try {
      const adminUsers = client.agencyId
        ? await this.storage.getAllUsersWithProfiles(client.agencyId)
        : [];
      const admins = adminUsers.filter((entry) => entry.profile?.role === "Admin");
      const assignedAdmin = client.accountManagerProfileId
        ? admins.find((entry) => entry.profile?.id === client.accountManagerProfileId)
        : undefined;
      const recipients = assignedAdmin ? [assignedAdmin] : admins;

      for (const admin of recipients) {
        await this.storage.createNotification({
          userId: admin.id,
          type: "client_message",
          title: "New Client Message",
          message: `${profile!.fullName} from ${client.companyName} sent a new message`,
          link: "/agency/messages",
          isRead: "false",
          isArchived: "false",
        });
      }
    } catch (notificationError) {
      this.logger.error("Failed to create client message notification", {
        error: notificationError as unknown as string,
      });
    }

    return { ok: true, status: 201, data: newMessage };
  }
}
